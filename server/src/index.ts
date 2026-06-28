import { env } from './lib/env.js';
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import prisma from './lib/prisma.js';
import { purgeStaleGuests } from './services/auth.service.js';
import { authRouter } from './routes/auth.routes.js';
import { userRouter } from './routes/user.routes.js';
import { decisionRouter } from './routes/decision.routes.js';
import { timelineRouter } from './routes/timeline.routes.js';
import { feedbackRouter } from './routes/feedback.routes.js';
import { realityRouter } from './routes/reality.routes.js';
import { errorHandler } from './middleware/error.middleware.js';

const app = express();
const PORT = env.PORT;
const isProd = env.NODE_ENV === 'production';

// Trust first hop (load balancer / reverse proxy) so req.ip reflects the client.
app.set('trust proxy', 1);

// ===========================================
// Security & Performance Middleware
// ===========================================

app.use(helmet({
    contentSecurityPolicy: isProd
        ? {
            useDefaults: true,
            directives: {
                'default-src': ["'self'"],
                'script-src': ["'self'"],
                'style-src': ["'self'", "'unsafe-inline'"],
                'img-src': ["'self'", 'data:', 'https:'],
                'connect-src': ["'self'"],
                'frame-ancestors': ["'none'"],
                'base-uri': ["'self'"],
                'form-action': ["'self'"],
            },
        }
        : {
            useDefaults: true,
            directives: {
                'default-src': ["'self'"],
                'script-src': ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
                'style-src': ["'self'", "'unsafe-inline'"],
                'img-src': ["'self'", 'data:', 'https:'],
                'connect-src': ["'self'", 'http://localhost:*', 'ws://localhost:*'],
            },
        },
    hsts: isProd
        ? { maxAge: 31_536_000, includeSubDomains: true, preload: true }
        : false,
    crossOriginEmbedderPolicy: false,
}));

app.use(compression());

// Global limiter — coarse defence-in-depth across the whole API surface.
const globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { success: false, message: 'Too many requests, please try again later.' },
});
app.use('/api', globalLimiter);

// Stricter limiter for auth endpoints, keyed by IP + email so credential
// stuffing against many accounts from one IP is still blocked.
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    skipSuccessfulRequests: true,
    keyGenerator: (req) => {
        const email = typeof req.body?.email === 'string' ? req.body.email.toLowerCase() : '';
        return `${ipKeyGenerator(req.ip ?? '')}:${email}`;
    },
    message: { success: false, message: 'Too many login attempts, please try again later.' },
});

// CORS. credentials:false because the app uses Bearer tokens (not cookies); flip
// to true only if/when refresh-token cookies are introduced.
app.use(cors({
    origin: isProd ? env.FRONTEND_URL : 'http://localhost:5173',
    credentials: false,
    methods: ['GET', 'POST', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    maxAge: 86_400,
}));

app.use(express.json({ limit: '10kb' }));

// ===========================================
// Health Check
// ===========================================
app.get('/health', (_req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        version: '1.0.0',
    });
});

// ===========================================
// API v1 Routes (versioned API)
// ===========================================
app.use('/api/v1/auth', authLimiter, authRouter);
app.use('/api/v1/user', userRouter);
app.use('/api/v1/decisions', decisionRouter);
app.use('/api/v1/timelines', timelineRouter);
app.use('/api/v1/feedback', feedbackRouter);
app.use('/api/v1/reality', realityRouter);

// 404 catch-all (before the error handler)
app.use((_req: Request, res: Response, _next: NextFunction) => {
    res.status(404).json({ success: false, message: 'Route not found' });
});

app.use(errorHandler);

// ===========================================
// Server Start + Graceful Shutdown
// ===========================================
const server = app.listen(PORT, () => {
    console.log(`WhatIF API v1.0.0 listening on http://localhost:${PORT}`);
    console.log(`Environment: ${env.NODE_ENV}`);
});

// Hourly sweep of stale guest accounts. unref() so it doesn't keep the process
// alive past shutdown. Runs once at boot to catch any leftovers.
const GUEST_SWEEP_INTERVAL_MS = 60 * 60 * 1000;
void purgeStaleGuests();
setInterval(() => void purgeStaleGuests(), GUEST_SWEEP_INTERVAL_MS).unref();

let shuttingDown = false;
async function shutdown(signal: string): Promise<void> {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`${signal} received — draining…`);

    const forceExit = setTimeout(() => {
        console.error('Forced exit after 10s shutdown timeout');
        process.exit(1);
    }, 10_000);
    forceExit.unref();

    server.close(async (err) => {
        if (err) {
            console.error('Error closing HTTP server:', err);
            process.exit(1);
        }
        try {
            await prisma.$disconnect();
            process.exit(0);
        } catch (e) {
            console.error('Error disconnecting Prisma:', e);
            process.exit(1);
        }
    });
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('unhandledRejection', (reason) => {
    console.error('unhandledRejection:', reason);
});
process.on('uncaughtException', (err) => {
    console.error('uncaughtException:', err);
    void shutdown('uncaughtException');
});

export default app;
