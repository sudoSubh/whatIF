import { Router, Response, NextFunction } from 'express';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { z } from 'zod';
import { authenticate, AuthRequest } from '../middleware/auth.middleware.js';
import {
    createDecision,
    getDecisionById,
    getUserDecisions,
    injectDecision
} from '../services/decision.service.js';
import { AppError } from '../middleware/error.middleware.js';

export const decisionRouter = Router();

const preferredModelSchema = z.enum([
    'gemini-3-pro-preview',
    'gemini-3-flash-preview',
    'gemini-2.5-flash'
]);

// All decision routes require authentication
decisionRouter.use(authenticate);

// Per-user limiter on Gemini-calling endpoints. Keyed by userId so one user
// can't burn the shared LLM budget; falls back to IP if userId is missing
// (which it won't be, since authenticate runs first).
const decisionWriteLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 10,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    keyGenerator: (req) =>
        (req as AuthRequest).userId ?? ipKeyGenerator(req.ip ?? ''),
    message: { success: false, message: 'Decision creation rate limit exceeded. Try again later.' },
});

const createDecisionSchema = z.object({
    content: z.string().min(10, 'Decision must be at least 10 characters'),
    category: z.string().optional(),
    context: z.record(z.unknown()).optional(),
    preferredModel: preferredModelSchema.optional(),
});

const injectDecisionSchema = z.object({
    timelineId: z.string(),
    newDecision: z.string().min(10, 'Decision must be at least 10 characters'),
    preferredModel: preferredModelSchema.optional(),
});

// Create a new decision and generate timelines
decisionRouter.post('/', decisionWriteLimiter, async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const data = createDecisionSchema.parse(req.body);
        const result = await createDecision(req.userId!, data);
        res.status(201).json({ success: true, data: result });
    } catch (error) {
        if (error instanceof z.ZodError) {
            next(new AppError(error.errors[0].message, 400));
        } else {
            next(error);
        }
    }
});

// Get all user decisions
decisionRouter.get('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const decisions = await getUserDecisions(req.userId!);
        res.json({ success: true, data: decisions });
    } catch (error) {
        next(error);
    }
});

// Get a specific decision with its timelines
decisionRouter.get('/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const decision = await getDecisionById(req.params.id as string, req.userId!);
        res.json({ success: true, data: decision });
    } catch (error) {
        next(error);
    }
});

// Inject a new decision into an existing timeline
decisionRouter.post('/:id/inject', decisionWriteLimiter, async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const data = injectDecisionSchema.parse(req.body);
        const result = await injectDecision(
            req.params.id as string,
            data.timelineId,
            data.newDecision,
            req.userId!,
            data.preferredModel
        );
        res.status(201).json({ success: true, data: result });
    } catch (error) {
        if (error instanceof z.ZodError) {
            next(new AppError(error.errors[0].message, 400));
        } else {
            next(error);
        }
    }
});
