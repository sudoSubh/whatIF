import prisma from '../lib/prisma.js';
import { generateTimelines, UserProfile, type DecisionContextInput, type PreferredModel } from './gemini.service.js';
import { AppError } from '../middleware/error.middleware.js';
import { safeJsonParse } from '../lib/json.js';

export interface CreateDecisionInput {
    content: string;
    category?: string;
    context?: Record<string, unknown>;
    preferredModel?: PreferredModel;
}

export async function createDecision(userId: string, input: CreateDecisionInput) {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
            riskTolerance: true,
            priorities: true,
            currentSituation: true,
        }
    });

    if (!user) {
        throw new AppError('User not found', 404);
    }

    const decision = await prisma.decision.create({
        data: {
            userId,
            content: input.content,
            category: input.category,
            context: input.context ? JSON.stringify(input.context) : null,
        }
    });

    const userProfile: UserProfile = {
        riskTolerance: user.riskTolerance as 'low' | 'medium' | 'high',
        priorities: safeJsonParse<string[]>(user.priorities, []),
        currentSituation: user.currentSituation || undefined,
    };

    // Top-level decisions are independent. Past decisions are NOT passed as
    // context — the LLM would otherwise treat them as the active conversation
    // and bias the new timelines back toward old threads. Personalisation
    // comes solely from the user profile. Branch/injected decisions still
    // carry their parent's context via `injectDecision` below.
    const result = await generateTimelines(
        input.content,
        userProfile,
        undefined,
        input.context,
        input.preferredModel
    );

    // Store timelines in database
    const storedTimelines = await Promise.all(
        result.timelines.map(async (timeline, index) => {
            const stored = await prisma.timeline.create({
                data: {
                    decisionId: decision.id,
                    title: timeline.title,
                    summary: timeline.summary,
                    probability: timeline.probability,
                    metrics: JSON.stringify(timeline.metrics),
                    tradeoffs: JSON.stringify(timeline.tradeoffs),
                    secondOrderEffects: JSON.stringify(timeline.secondOrderEffects),
                    events: {
                        create: timeline.events.map((event, eventIndex) => ({
                            order: eventIndex,
                            period: event.period,
                            description: event.description,
                            impact: event.impact,
                        }))
                    }
                },
                include: { events: { orderBy: { order: 'asc' } } }
            });

            return {
                ...stored,
                metrics: safeJsonParse<Record<string, unknown>>(stored.metrics, {}),
                tradeoffs: safeJsonParse<string[]>(stored.tradeoffs, []),
                secondOrderEffects: safeJsonParse<string[]>(stored.secondOrderEffects, []),
            };
        })
    );

    return {
        decision: {
            id: decision.id,
            content: decision.content,
            category: decision.category,
            createdAt: decision.createdAt,
        },
        timelines: storedTimelines,
    };
}

export async function getDecisionById(decisionId: string, userId: string) {
    const decision = await prisma.decision.findFirst({
        where: { id: decisionId, userId },
        include: {
            timelines: {
                include: {
                    events: { orderBy: { order: 'asc' } },
                    realityLogs: true
                }
            },
            childDecisions: {
                select: {
                    id: true,
                    content: true,
                    createdAt: true,
                    parentTimelineId: true,
                },
                orderBy: { createdAt: 'desc' },
            },
            parentDecision: {
                select: { id: true, content: true },
            },
        }
    });

    if (!decision) {
        throw new AppError('Decision not found', 404);
    }

    return {
        ...decision,
        context: safeJsonParse<Record<string, unknown> | null>(decision.context, null),
        timelines: decision.timelines.map(t => ({
            ...t,
            metrics: safeJsonParse<Record<string, unknown>>(t.metrics, {}),
            tradeoffs: safeJsonParse<string[]>(t.tradeoffs, []),
            secondOrderEffects: safeJsonParse<string[]>(t.secondOrderEffects, []),
        })),
        branches: decision.childDecisions,
        parent: decision.parentDecision,
    };
}

export async function getUserDecisions(userId: string) {
    // Only top-level decisions appear in the sidebar — child decisions (created
    // via injectDecision) are reachable from their parent's page and would
    // otherwise pollute the list with what look like duplicate "chats".
    const decisions = await prisma.decision.findMany({
        where: { userId, parentDecisionId: null },
        include: {
            timelines: {
                select: { id: true, title: true, probability: true }
            }
        },
        orderBy: { createdAt: 'desc' }
    });

    return decisions.map(d => ({
        ...d,
        context: safeJsonParse<Record<string, unknown> | null>(d.context, null),
    }));
}

export async function injectDecision(
    decisionId: string,
    timelineId: string,
    newDecisionContent: string,
    userId: string,
    preferredModel?: PreferredModel
) {
    // Verify ownership
    const originalDecision = await prisma.decision.findFirst({
        where: { id: decisionId, userId }
    });

    if (!originalDecision) {
        throw new AppError('Decision not found', 404);
    }

    const timeline = await prisma.timeline.findFirst({
        where: { id: timelineId, decisionId },
        include: { events: { orderBy: { order: 'asc' } } }
    });

    if (!timeline) {
        throw new AppError('Timeline not found', 404);
    }

    // Get user profile
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { riskTolerance: true, priorities: true, currentSituation: true }
    });

    if (!user) {
        throw new AppError('User not found', 404);
    }

    const childDecision = await prisma.decision.create({
        data: {
            userId,
            content: newDecisionContent,
            parentDecisionId: decisionId,
            parentTimelineId: timelineId,
        }
    });

    // Generate new timelines for the injected decision
    const userProfile: UserProfile = {
        riskTolerance: user.riskTolerance as 'low' | 'medium' | 'high',
        priorities: safeJsonParse<string[]>(user.priorities, []),
        currentSituation: user.currentSituation || undefined,
    };

    const result = await generateTimelines(
        `Following my previous decision to "${originalDecision.content}", I now want to: ${newDecisionContent}`,
        userProfile,
        [{ content: originalDecision.content, category: originalDecision.category || undefined }],
        originalDecision.context ? safeJsonParse<DecisionContextInput | null>(originalDecision.context, null) ?? undefined : undefined,
        preferredModel
    );

    // Store new timelines
    const storedTimelines = await Promise.all(
        result.timelines.map(async (tl) => {
            const stored = await prisma.timeline.create({
                data: {
                    decisionId: childDecision.id,
                    title: tl.title,
                    summary: tl.summary,
                    probability: tl.probability,
                    metrics: JSON.stringify(tl.metrics),
                    tradeoffs: JSON.stringify(tl.tradeoffs),
                    secondOrderEffects: JSON.stringify(tl.secondOrderEffects),
                    events: {
                        create: tl.events.map((event, idx) => ({
                            order: idx,
                            period: event.period,
                            description: event.description,
                            impact: event.impact,
                        }))
                    }
                },
                include: { events: { orderBy: { order: 'asc' } } }
            });

            return {
                ...stored,
                metrics: safeJsonParse<Record<string, unknown>>(stored.metrics, {}),
                tradeoffs: safeJsonParse<string[]>(stored.tradeoffs, []),
                secondOrderEffects: safeJsonParse<string[]>(stored.secondOrderEffects, []),
            };
        })
    );

    return {
        decision: childDecision,
        timelines: storedTimelines,
        parentDecisionId: decisionId,
        parentTimelineId: timelineId,
    };
}
