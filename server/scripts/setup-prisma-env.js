/**
 * Optional: Log env vars for debugging.
 * DATABASE_URL and DIRECT_URL should be set in Render dashboard.
 */

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
