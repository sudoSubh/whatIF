import crypto from 'crypto';
import bcrypt from 'bcrypt';
import jwt, { SignOptions } from 'jsonwebtoken';
import prisma from '../lib/prisma.js';
import { AppError } from '../middleware/error.middleware.js';
import { env } from '../lib/env.js';
import { safeJsonParse } from '../lib/json.js';

const SALT_ROUNDS = 12;

export interface RegisterInput {
    email: string;
    password: string;
    name?: string;
}

export interface LoginInput {
    email: string;
    password: string;
    rememberMe?: boolean;
}

// Long-session TTL when the user checks "Remember me". Note: this re-introduces
// the long-lived-JWT exposure the audit flagged (HIGH #20). Acceptable as a
// stop-gap until the access+refresh-token redesign lands; revisit then.
const REMEMBER_ME_TTL = '30d';

export interface AuthResponse {
    user: {
        id: string;
        email: string;
        name: string | null;
    };
    token: string;
}

function generateToken(
    userId: string,
    email: string,
    overrides?: { expiresIn?: SignOptions['expiresIn']; isGuest?: boolean },
): string {
    const opts: SignOptions = {
        expiresIn: (overrides?.expiresIn ?? env.JWT_EXPIRES_IN) as SignOptions['expiresIn'],
        algorithm: 'HS256',
        issuer: 'whatif',
        audience: 'whatif-client',
    };
    const payload: Record<string, unknown> = { userId, email };
    if (overrides?.isGuest) payload.isGuest = true;
    return jwt.sign(payload, env.JWT_SECRET, opts);
}

export async function register(input: RegisterInput): Promise<AuthResponse> {
    const { email, password, name } = input;

    // Check if user exists by prateek
    const existingUser = await prisma.user.findUnique({
        where: { email: email.toLowerCase() }
    });

    if (existingUser) {
        throw new AppError('Email already registered', 400);
    }

    // Hash password by prateek
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    // Create user by prateek
    const user = await prisma.user.create({
        data: {
            email: email.toLowerCase(),
            passwordHash,
            name,
        },
        select: {
            id: true,
            email: true,
            name: true,
        }
    });

    const token = generateToken(user.id, user.email);

    return { user, token };
}

export async function login(input: LoginInput): Promise<AuthResponse> {
    const { email, password, rememberMe } = input;

    const user = await prisma.user.findUnique({
        where: { email: email.toLowerCase() }
    });

    if (!user) {
        throw new AppError('Invalid email or password', 401);
    }

    const isValidPassword = await bcrypt.compare(password, user.passwordHash);

    if (!isValidPassword) {
        throw new AppError('Invalid email or password', 401);
    }

    const token = generateToken(user.id, user.email, {
        expiresIn: rememberMe ? REMEMBER_ME_TTL : undefined,
    });

    return {
        user: {
            id: user.id,
            email: user.email,
            name: user.name,
        },
        token,
    };
}

export async function getUserById(userId: string) {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
            id: true,
            email: true,
            name: true,
            riskTolerance: true,
            priorities: true,
            currentSituation: true,
            createdAt: true,
        }
    });

    if (!user) {
        throw new AppError('User not found', 404);
    }

    return {
        ...user,
        priorities: safeJsonParse<string[]>(user.priorities, []),
    };
}

export async function updateUserProfile(
    userId: string,
    data: {
        name?: string;
        riskTolerance?: string;
        priorities?: string[];
        currentSituation?: string;
    }
) {
    const updateData: Record<string, unknown> = {};

    if (data.name !== undefined) updateData.name = data.name;
    if (data.riskTolerance !== undefined) updateData.riskTolerance = data.riskTolerance;
    if (data.priorities !== undefined) updateData.priorities = JSON.stringify(data.priorities);
    if (data.currentSituation !== undefined) updateData.currentSituation = data.currentSituation;

    const user = await prisma.user.update({
        where: { id: userId },
        data: updateData,
        select: {
            id: true,
            email: true,
            name: true,
            riskTolerance: true,
            priorities: true,
            currentSituation: true,
        }
    });

    return {
        ...user,
        priorities: safeJsonParse<string[]>(user.priorities, []),
    };
}

// Generate a random reset token
function generateResetToken(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let token = '';
    for (let i = 0; i < 32; i++) {
        token += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return token;
}

export async function forgotPassword(email: string): Promise<{ message: string; resetToken?: string }> {
    // Find user
    const user = await prisma.user.findUnique({
        where: { email: email.toLowerCase() }
    });

    // Always return success to prevent email enumeration
    if (!user) {
        return { message: 'If an account with that email exists, a reset link has been generated.' };
    }

    // Generate reset token
    const resetToken = generateResetToken();
    const resetTokenExpiry = new Date(Date.now() + 3600000); // 1 hour from now

    // Save token to database
    await prisma.user.update({
        where: { id: user.id },
        data: {
            resetToken,
            resetTokenExpiry,
        }
    });

    // In production, email the token here
    // For demo purposes, it returns directly by prateek
    console.log(`🔑 Password reset token for ${email}: ${resetToken}`);

    return {
        message: 'If an account with that email exists, a reset link has been generated.',
        resetToken, // Only for demo - remove in production by prateek
    };
}

export async function resetPassword(token: string, newPassword: string): Promise<{ message: string }> {
    // Find user with this token by prateek
    const user = await prisma.user.findUnique({
        where: { resetToken: token }
    });

    if (!user) {
        throw new AppError('Invalid or expired reset token', 400);
    }

    // Check if token is expired
    if (!user.resetTokenExpiry || user.resetTokenExpiry < new Date()) {
        throw new AppError('Reset token has expired', 400);
    }

    // Hash new password
    const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);

    // Update password and clear reset token
    await prisma.user.update({
        where: { id: user.id },
        data: {
            passwordHash,
            resetToken: null,
            resetTokenExpiry: null,
        }
    });

    return { message: 'Password has been reset successfully. You can now log in.' };
}

// ===========================================================================
// Guest accounts
// ===========================================================================
//
// Throwaway users created by POST /api/v1/auth/guest. The endpoint is rate-
// limited at the route layer, and these tokens carry a short (60 min) TTL so
// the impact of a leaked guest token is bounded. Guests still occupy a real
// User row so all existing routes work unchanged.

const GUEST_TOKEN_TTL = '60m';
const GUEST_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;

export async function createGuest(name?: string): Promise<AuthResponse> {
    // Synthetic, unique, .local-suffixed email so it can't collide with a
    // real address and can't be used to phish.
    const id = crypto.randomBytes(8).toString('hex');
    const email = `guest_${id}@whatif.local`;

    // A random throwaway password — never returned, never reused. We hash it
    // only to satisfy the NOT NULL column; guests can't log back in.
    const rawPassword = crypto.randomBytes(32).toString('hex');
    const passwordHash = await bcrypt.hash(rawPassword, SALT_ROUNDS);

    const user = await prisma.user.create({
        data: {
            email,
            passwordHash,
            name: name?.trim() || `Guest ${id.slice(0, 6)}`,
            isGuest: true,
        },
        select: { id: true, email: true, name: true },
    });

    const token = generateToken(user.id, user.email, {
        expiresIn: GUEST_TOKEN_TTL,
        isGuest: true,
    });
    return { user, token };
}

export async function purgeStaleGuests(): Promise<number> {
    try {
        const cutoff = new Date(Date.now() - GUEST_RETENTION_MS);
        const result = await prisma.user.deleteMany({
            where: { isGuest: true, createdAt: { lt: cutoff } },
        });
        return result.count;
    } catch (err) {
        console.error('purgeStaleGuests failed:', err);
        return 0;
    }
}
