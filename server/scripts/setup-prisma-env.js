/**
 * Prisma CLI requires DIRECT_URL to be set in the environment for schema validation.
 * This script auto-constructs DIRECT_URL from SUPABASE_URL + SUPABASE_DB_PASSWORD
 * if DIRECT_URL is not already set.
 *
 * Run this before `prisma generate` or `prisma migrate` commands.
 */

import 'dotenv/config';
import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';

const envPath = resolve(import.meta.dirname, '..', '.env');

// Parse current .env
let currentEnv = {};
try {
  const content = readFileSync(envPath, 'utf8');
  currentEnv = Object.fromEntries(
    content
      .split('\n')
      .filter((l) => l.trim() && !l.startsWith('#'))
      .map((l) => {
        const [key, ...valueParts] = l.split('=');
        return [key.trim(), valueParts.join('=').trim().replace(/^["']|["']$/g, '')];
      })
  );
} catch (e) {
  console.error('Failed to read .env file:', e.message);
  process.exit(1);
}

// Skip if DIRECT_URL is already set
if (currentEnv.DIRECT_URL) {
  console.log('DIRECT_URL already set in .env, skipping auto-generation');
  process.exit(0);
}

// Build DIRECT_URL from SUPABASE_URL + SUPABASE_DB_PASSWORD
const supabaseUrl = currentEnv.SUPABASE_URL;
const dbPassword = currentEnv.SUPABASE_DB_PASSWORD;

if (!supabaseUrl || !dbPassword) {
  console.error(
    'Cannot auto-generate DIRECT_URL: SUPABASE_URL and/or SUPABASE_DB_PASSWORD not set in .env'
  );
  process.exit(1);
}

try {
  // Extract ref from SUPABASE_URL: https://ref.supabase.co -> ref
  const ref = new URL(supabaseUrl).hostname.split('.')[0];
  const encoded = encodeURIComponent(dbPassword);

  const directUrl = `postgresql://postgres:${encoded}@db.${ref}.supabase.co:5432/postgres`;

  console.log(`Auto-generating DIRECT_URL from SUPABASE_URL`);
  console.log(`DIRECT_URL: ${directUrl.substring(0, 30)}...`);

  // Write DIRECT_URL to .env if not present
  const lines = content.split('\n');
  let found = false;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim().startsWith('DIRECT_URL=')) {
      lines[i] = `DIRECT_URL=${directUrl}`;
      found = true;
      break;
    }
  }

  if (!found) {
    lines.push(`DIRECT_URL=${directUrl}`);
  }

  writeFileSync(envPath, lines.join('\n'));
  console.log('DIRECT_URL written to .env');
} catch (e) {
  console.error('Failed to generate DIRECT_URL:', e.message);
  process.exit(1);
}
