/**
 * Set DATABASE_URL and DIRECT_URL from Supabase credentials if not already set.
 * Used by Render during build/deploy when env vars are configured in dashboard.
 */

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_DB_PASSWORD = process.env.SUPABASE_DB_PASSWORD || '';
const SUPABASE_REGION = process.env.SUPABASE_REGION || '';

if (!SUPABASE_URL || !SUPABASE_DB_PASSWORD) {
  console.warn('WARNING: SUPABASE_URL and/or SUPABASE_DB_PASSWORD not set. DATABASE_URL will not be auto-generated.');
  console.warn('Make sure DATABASE_URL and DIRECT_URL are set in Render dashboard or .env file.');
}

// Extract project reference from SUPABASE_URL (e.g., rclfqldxilejcaxpsoqz from https://rclfqldxilejcaxpsoqz.supabase.co)
const urlObj = new URL(SUPABASE_URL);
const projectRef = urlObj.hostname.split('.')[0];

// Auto-generate DATABASE_URL if not set
if (!process.env.DATABASE_URL && SUPABASE_URL && SUPABASE_DB_PASSWORD && projectRef) {
  const regionPart = SUPABASE_REGION ? `.${SUPABASE_REGION}` : '';
  process.env.DATABASE_URL = `postgresql://postgres:${SUPABASE_DB_PASSWORD}@db${regionPart}.${projectRef}.supabase.co:5432/postgres`;
  console.log(`Generated DATABASE_URL for ${projectRef}`);
}

// Auto-generate DIRECT_URL if not set
if (!process.env.DIRECT_URL && SUPABASE_URL && SUPABASE_DB_PASSWORD && projectRef) {
  const regionPart = SUPABASE_REGION ? `.${SUPABASE_REGION}` : '';
  process.env.DIRECT_URL = `postgresql://postgres:${SUPABASE_DB_PASSWORD}@db${regionPart}.${projectRef}.supabase.co:5432/postgres`;
  console.log(`Generated DIRECT_URL for ${projectRef}`);
}

// Log status
const databaseUrl = process.env.DATABASE_URL;
const directUrl = process.env.DIRECT_URL;

if (databaseUrl) {
  console.log(`DATABASE_URL: ${databaseUrl.substring(0, 30)}...`);
} else {
  console.warn('DATABASE_URL is not set');
}

if (directUrl) {
  console.log(`DIRECT_URL: ${directUrl.substring(0, 30)}...`);
} else {
  console.warn('DIRECT_URL is not set');
}
