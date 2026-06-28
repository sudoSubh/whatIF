import { Router, Response, NextFunction } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth.middleware.js';
import prisma from '../lib/prisma.js';
import { AppError } from '../middleware/error.middleware.js';
import { z } from 'zod';
import { correctTimelineEvents, UserProfile } from '../services/gemini.service.js';
import { safeJsonParse } from '../lib/json.js';

export const realityRouter = Router();

// All reality routes require authentication
realityRouter.use(authenticate);

function parseYearFromPeriod(period: string): number {
    const match = period.match(/(\d+)\s*year/i);
    if (match) return parseInt(match[1], 10);
    const monthMatch = period.match(/(\d+)\s*month/i);
    if (monthMatch) return Math.round(parseInt(monthMatch[1], 10) / 12) || 1;
    return 1;
}

const logRealitySchema = z.object({
    timelineId: z.string(),
    eventId: z.string(),
    actualOutcome: z.string().min(1, 'Actual outcome cannot be empty'),
    predictionMatched: z.enum(['matched', 'unmatched', 'partial']),
});

const correctTimelineSchema = z.object({
    timelineId: z.string(),
    eventId: z.string(),
    actualOutcome: z.string().min(1, 'Actual outcome cannot be empty'),
});

// POST /api/v1/reality/log - Log event outcome
realityRouter.post('/log', async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const data = logRealitySchema.parse(req.body);

        // Verify ownership and existence
        const timeline = await prisma.timeline.findFirst({
            where: { id: data.timelineId },
            include: { decision: true }
        });

        if (!timeline) {
            throw new AppError('Timeline not found', 404);
        }

        if (timeline.decision.userId !== req.userId) {
            throw new AppError('Not authorized', 403);
        }

        const event = await prisma.timelineEvent.findFirst({
            where: { id: data.eventId, timelineId: data.timelineId }
        });

        if (!event) {
            throw new AppError('Event not found', 404);
        }

        const year = parseYearFromPeriod(event.period);

        // Upsert reality log
        let log = await prisma.realityLog.findFirst({
            where: {
                userId: req.userId!,
                timelineId: data.timelineId,
                eventId: data.eventId,
            }
        });

        if (log) {
            log = await prisma.realityLog.update({
                where: { id: log.id },
                data: {
                    actualOutcome: data.actualOutcome,
                    predictionMatched: data.predictionMatched,
                    year,
                }
            });
        } else {
            log = await prisma.realityLog.create({
                data: {
                    userId: req.userId!,
                    timelineId: data.timelineId,
                    eventId: data.eventId,
                    actualOutcome: data.actualOutcome,
                    predictionMatched: data.predictionMatched,
                    year,
                }
            });
        }

        res.status(201).json({
            success: true,
            data: log
        });
    } catch (error) {
        if (error instanceof z.ZodError) {
            next(new AppError(error.errors[0].message, 400));
        } else {
            next(error);
        }
    }
});

// GET /api/v1/reality/accuracy - Get accuracy dashboard data
realityRouter.get('/accuracy', async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const logs = await prisma.realityLog.findMany({
            where: { userId: req.userId! },
            include: {
                timeline: {
                    include: {
                        decision: true
                    }
                }
            }
        });

        const total = logs.length;
        const matched = logs.filter(l => l.predictionMatched === 'matched').length;
        const accuracyRate = total > 0 ? Math.round((matched / total) * 100) : 100; // default to 100% accuracy if no logs

        // Breakdown by categories: Financial, Career, Emotional, Relationship
        const categoryStats: Record<string, { total: number; matched: number }> = {
            Financial: { total: 0, matched: 0 },
            Career: { total: 0, matched: 0 },
            Emotional: { total: 0, matched: 0 },
            Relationship: { total: 0, matched: 0 }
        };

        for (const log of logs) {
            const dbCategory = log.timeline.decision.category?.toLowerCase() || '';
            let targetCategory = '';
            
            if (dbCategory === 'finance' || dbCategory === 'financial') {
                targetCategory = 'Financial';
            } else if (dbCategory === 'career') {
                targetCategory = 'Career';
            } else if (dbCategory === 'relationships' || dbCategory === 'relationship') {
                targetCategory = 'Relationship';
            } else if (dbCategory === 'health' || dbCategory === 'lifestyle' || dbCategory === 'emotional') {
                targetCategory = 'Emotional';
            }

            if (targetCategory && categoryStats[targetCategory]) {
                categoryStats[targetCategory].total++;
                if (log.predictionMatched === 'matched') {
                    categoryStats[targetCategory].matched++;
                }
            }
        }

        const breakdown = {
            Financial: categoryStats.Financial.total > 0 ? Math.round((categoryStats.Financial.matched / categoryStats.Financial.total) * 100) : 0,
            Career: categoryStats.Career.total > 0 ? Math.round((categoryStats.Career.matched / categoryStats.Career.total) * 100) : 0,
            Emotional: categoryStats.Emotional.total > 0 ? Math.round((categoryStats.Emotional.matched / categoryStats.Emotional.total) * 100) : 0,
            Relationship: categoryStats.Relationship.total > 0 ? Math.round((categoryStats.Relationship.matched / categoryStats.Relationship.total) * 100) : 0,
        };

        res.json({
            success: true,
            data: {
                totalEventsLogged: total,
                accuracyRate,
                confidence: accuracyRate, // confidence matches historical accuracy
                breakdown
            }
        });
    } catch (error) {
        next(error);
    }
});

// POST /api/v1/reality/correct - Trigger timeline auto-correction
realityRouter.post('/correct', async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const data = correctTimelineSchema.parse(req.body);

        // Verify ownership and existence
        const timeline = await prisma.timeline.findFirst({
            where: { id: data.timelineId },
            include: {
                decision: {
                    include: {
                        user: true
                    }
                },
                events: { orderBy: { order: 'asc' } }
            }
        });

        if (!timeline) {
            throw new AppError('Timeline not found', 404);
        }

        if (timeline.decision.userId !== req.userId) {
            throw new AppError('Not authorized', 403);
        }

        const loggedEvent = timeline.events.find(e => e.id === data.eventId);

        if (!loggedEvent) {
            throw new AppError('Event not found', 404);
        }

        // Get subsequent events in the timeline
        const subsequentEvents = timeline.events.filter(e => e.order > loggedEvent.order);

        // If there are no subsequent events, nothing to auto-correct
        if (subsequentEvents.length === 0) {
            return res.json({
                success: true,
                message: 'No subsequent events to correct',
                data: {
                    ...timeline,
                    metrics: safeJsonParse<Record<string, unknown>>(timeline.metrics, {}),
                    tradeoffs: safeJsonParse<string[]>(timeline.tradeoffs, []),
                    secondOrderEffects: safeJsonParse<string[]>(timeline.secondOrderEffects, []),
                    events: timeline.events
                }
            });
        }

        // Prepare user profile for Gemini call
        const user = timeline.decision.user;
        const userProfile: UserProfile = {
            riskTolerance: user.riskTolerance as 'low' | 'medium' | 'high',
            priorities: safeJsonParse<string[]>(user.priorities, []),
            currentSituation: user.currentSituation || undefined
        };

        // Call Gemini to regenerate subsequent events based on new reality
        const regeneratedEvents = await correctTimelineEvents(
            data.actualOutcome,
            subsequentEvents.map(e => ({
                period: e.period,
                description: e.description,
                impact: e.impact as 'positive' | 'neutral' | 'negative'
            })),
            userProfile
        );

        // Delete old subsequent events and insert new ones inside a transaction
        await prisma.$transaction([
            prisma.timelineEvent.deleteMany({
                where: {
                    timelineId: data.timelineId,
                    order: { gt: loggedEvent.order }
                }
            }),
            prisma.timelineEvent.createMany({
                data: regeneratedEvents.map((e, index) => ({
                    timelineId: data.timelineId,
                    order: loggedEvent.order + 1 + index,
                    period: e.period,
                    description: e.description,
                    impact: e.impact
                }))
            })
        ]);

        // Fetch the updated timeline
        const updatedTimeline = await prisma.timeline.findFirst({
            where: { id: data.timelineId },
            include: {
                events: { orderBy: { order: 'asc' } }
            }
        });

        if (!updatedTimeline) {
            throw new AppError('Updated timeline not found', 500);
        }

        res.json({
            success: true,
            data: {
                ...updatedTimeline,
                metrics: safeJsonParse<Record<string, unknown>>(updatedTimeline.metrics, {}),
                tradeoffs: safeJsonParse<string[]>(updatedTimeline.tradeoffs, []),
                secondOrderEffects: safeJsonParse<string[]>(updatedTimeline.secondOrderEffects, []),
            }
        });
    } catch (error) {
        if (error instanceof z.ZodError) {
            next(new AppError(error.errors[0].message, 400));
        } else {
            next(error);
        }
    }
});
