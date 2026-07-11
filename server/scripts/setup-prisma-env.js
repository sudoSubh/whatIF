/**
 * Prisma CLI requires DIRECT_URL to be set in the environment for schema validation.
 * This script auto-constructs DIRECT_URL from SUPABASE_URL + SUPABASE_DB_PASSWORD
 * and exports it to the environment.
 *
 * Run this before `prisma generate` or `prisma migrate` commands.
 */

// Read from environment variables (Render sets these via its dashboard)
const supabaseUrl = process.env.SUPABASE_URL;
const dbPassword = process.env.SUPABASE_DB_PASSWORD;
const directUrlEnv = process.env.DIRECT_URL;

// Skip if DIRECT_URL is already set
if (directUrlEnv && directUrlEnv.length > 0) {
  console.log('DIRECT_URL already set in environment, skipping auto-generation');
  process.exit(0);
}

if (!supabaseUrl || !dbPassword) {
  console.error(
    'Cannot auto-generate DIRECT_URL: SUPABASE_URL and/or SUPABASE_DB_PASSWORD not set in environment'
  );
  console.error('Set these in Render dashboard: SUPABASE_URL, SUPABASE_DB_PASSWORD');
  process.exit(1);
}

try {
  // Extract ref from SUPABASE_URL: https://ref.supabase.co -> ref
  const ref = new URL(supabaseUrl).hostname.split('.')[0];
  const encoded = encodeURIComponent(dbPassword);

  const directUrl = `postgresql://postgres:${encoded}@db.${ref}.supabase.co:5432/postgres`;
  const databaseUrl = directUrl; // For simplicity, use direct connection

  console.log('Auto-generating DATABASE_URL and DIRECT_URL from SUPABASE_URL + SUPABASE_DB_PASSWORD');
  console.log(`DATABASE_URL: ${databaseUrl.substring(0, 30)}...`);
  console.log(`DIRECT_URL: ${directUrl.substring(0, 30)}...`);

  // Export to process for immediate use (Prisma will pick these up)
  process.env.DATABASE_URL = databaseUrl;
  process.env.DIRECT_URL = directUrl;
  console.log('DATABASE_URL and DIRECT_URL exported to environment');
} catch (e) {
  console.error('Failed to generate URLs:', e.message);
  process.exit(1);
}
