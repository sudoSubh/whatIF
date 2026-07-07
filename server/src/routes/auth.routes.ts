import { Router, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { register, login, forgotPassword, resetPassword, createGuest } from '../services/auth.service.js';
import { AppError } from '../middleware/error.middleware.js';

export const authRouter = Router();

// Guest creation is anonymous; without a tight per-IP cap, an attacker could
// mint guests in a loop and use each one to spend the per-user Gemini quota.
// 5/IP/hour keeps the worst-case cost bounded.
const guestLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 5,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { success: false, message: 'Too many guest sessions from this IP. Please try again later.' },
});

const strongPassword = z
    .string()
    .min(12, 'Password must be at least 12 characters')
    .max(128, 'Password must be at most 128 characters')
    .regex(/[A-Z]/, 'Password must contain an uppercase letter')
    .regex(/[a-z]/, 'Password must contain a lowercase letter')
    .regex(/[0-9]/, 'Password must contain a digit')
    .regex(/[^A-Za-z0-9]/, 'Password must contain a special character');

const registerSchema = z.object({
    email: z.string().email('Invalid email').max(254),
    password: strongPassword,
    name: z.string().trim().min(1).max(100).optional(),
});

const loginSchema = z.object({
    email: z.string().email('Invalid email').max(254),
    password: z.string().min(1, 'Password is required').max(128),
    rememberMe: z.boolean().optional(),
});

const forgotPasswordSchema = z.object({
    email: z.string().email('Invalid email').max(254),
});

const resetPasswordSchema = z.object({
    token: z.string().min(1, 'Reset token is required').max(256),
    password: strongPassword,
});

authRouter.post('/register', async (req, res: Response, next: NextFunction) => {
    try {
        const data = registerSchema.parse(req.body);
        const result = await register(data);
        res.status(201).json({ success: true, data: result });
    } catch (error) {
        if (error instanceof z.ZodError) {
            next(new AppError(error.errors[0].message, 400));
        } else {
            next(error);
        }
    }
});

authRouter.post('/login', async (req, res: Response, next: NextFunction) => {
    try {
        const data = loginSchema.parse(req.body);
        const result = await login(data);
        res.json({ success: true, data: result });
    } catch (error) {
        if (error instanceof z.ZodError) {
            next(new AppError(error.errors[0].message, 400));
        } else {
            next(error);
        }
    }
});

// Request password reset - generates token and returns it (in production, would email it)
authRouter.post('/forgot-password', async (req, res: Response, next: NextFunction) => {
    try {
        const data = forgotPasswordSchema.parse(req.body);
        const result = await forgotPassword(data.email);
        res.json({ success: true, data: result });
    } catch (error) {
        if (error instanceof z.ZodError) {
            next(new AppError(error.errors[0].message, 400));
        } else {
            next(error);
        }
    }
});

// Create an anonymous, throwaway guest account for the demo / "try it out"
// flow. Short-lived token, real User row marked isGuest=true.
authRouter.post('/guest', guestLimiter, async (req, res: Response, next: NextFunction) => {
    try {
        const name = req.body?.name;
        const result = await createGuest(name);
        res.status(201).json({ success: true, data: result });
    } catch (error) {
        next(error);
    }
});

// Reset password using token
authRouter.post('/reset-password', async (req, res: Response, next: NextFunction) => {
    try {
        const data = resetPasswordSchema.parse(req.body);
        const result = await resetPassword(data.token, data.password);
        res.json({ success: true, data: result });
    } catch (error) {
        if (error instanceof z.ZodError) {
            next(new AppError(error.errors[0].message, 400));
        } else {
            next(error);
        }
    }
});
