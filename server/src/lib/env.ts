import 'dotenv/config';
import { z } from 'zod';

/** Build Postgres URLs from Supabase project URL + database password when DATABASE_URL is unset. */
function applySupabaseDatabaseUrls(): void {
    const supabaseUrl = process.env.SUPABASE_URL;
    const dbPassword = process.env.SUPABASE_DB_PASSWORD;
    if (!supabaseUrl || !dbPassword) return;

    const isUnset = (v: string | undefined) => !v || v === '""' || v === "''";
    if (!isUnset(process.env.DATABASE_URL) && !isUnset(process.env.DIRECT_URL)) return;

    let ref: string;
    try {
        ref = new URL(supabaseUrl).hostname.split('.')[0];
    } catch {
        console.error('SUPABASE_URL is not a valid URL');
        process.exit(1);
    }

    const encoded = encodeURIComponent(dbPassword);
    const direct = `postgresql://postgres:${encoded}@db.${ref}.supabase.co:5432/postgres`;

    if (isUnset(process.env.DIRECT_URL)) {
        process.env.DIRECT_URL = direct;
    }

    if (isUnset(process.env.DATABASE_URL)) {
        const region = process.env.SUPABASE_REGION;
        if (region) {
            process.env.DATABASE_URL =
                `postgresql://postgres.${ref}:${encoded}@aws-0-${region}.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1`;
        } else {
            // Direct connection works for local dev when pooler region is unknown.
            process.env.DATABASE_URL = direct;
        }
    }
}

applySupabaseDatabaseUrls();

const EnvSchema = z.object({
    PORT: z.coerce.number().int().positive().default(3001),
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

    // Supabase project metadata (API keys — not the Postgres password).
    SUPABASE_URL: z.string().url().optional(),
    SUPABASE_PUBLISHABLE_KEY: z.string().min(20).optional(),
    SUPABASE_SECRET_KEY: z.string().min(20).optional(),
    SUPABASE_JWKS_URL: z.string().url().optional(),
    SUPABASE_DB_PASSWORD: z.string().min(1).optional(),
    SUPABASE_REGION: z.string().min(1).optional(),

    DATABASE_URL: z
        .string()
        .min(1, 'DATABASE_URL is required (set it directly or via SUPABASE_URL + SUPABASE_DB_PASSWORD)')
        .refine(
            (v) => /^postgres(ql)?:\/\//.test(v),
            'DATABASE_URL must be a postgres:// or postgresql:// URL (e.g. the Supabase pooler connection string)',
        ),    // Required only when running migrations against a pooled (pgbouncer)
    // DATABASE_URL — Prisma migrations need a direct connection.
    DIRECT_URL: z
        .string()
        .refine((v) => v === '' || /^postgres(ql)?:\/\//.test(v), 'DIRECT_URL must be a postgres URL')
        .optional(),

    JWT_SECRET: z
        .string()
        .min(32, 'JWT_SECRET must be at least 32 characters')
        .refine(
            (v) => v !== 'your-super-secret-jwt-key-change-in-production',
            'JWT_SECRET must be changed from the .env.example default'
        ),
    JWT_EXPIRES_IN: z.string().default('15m'),

    GEMINI_API_KEY: z.string().min(20, 'GEMINI_API_KEY appears invalid').optional(),
    GEMINI_API_KEY_FALLBACK: z.string().min(20, 'GEMINI_API_KEY_FALLBACK appears invalid').optional(),

    FRONTEND_URL: z.string().url().optional(),
});

function loadEnv() {
    const parsed = EnvSchema.safeParse(process.env);
    if (!parsed.success) {
        const issues = parsed.error.issues
            .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
            .join('\n');
        console.error(`Invalid environment configuration:\n${issues}`);
        process.exit(1);
    }

    const env = parsed.data;

    if (env.NODE_ENV === 'production') {
        if (!env.FRONTEND_URL) {
            console.error('FRONTEND_URL is required in production');
            process.exit(1);
        }
        if (!env.GEMINI_API_KEY) {
            console.error('GEMINI_API_KEY is required in production');
            process.exit(1);
        }
    }

    return env;
}

export const env = loadEnv();
export type Env = z.infer<typeof EnvSchema>;
