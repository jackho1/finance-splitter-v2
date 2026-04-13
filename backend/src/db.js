const { Pool } = require('pg');

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
  max: 10,
  min: 2,
  idleTimeoutMillis: 10000,
  connectionTimeoutMillis: 3000,
  acquireTimeoutMillis: 30000,
  createTimeoutMillis: 15000,
  reapIntervalMillis: 1000,
  createRetryIntervalMillis: 200,
  keepAlive: true,
  keepAliveInitialDelayMillis: 10000,
});

// Prevent idle-connection drops from crashing the app
pool.on('error', (err) => console.error('Unexpected error on idle PostgreSQL client:', err.message));
pool.on('connect', () => console.log('New PostgreSQL client connected'));
pool.on('remove', () => console.log('PostgreSQL client removed from pool'));

/**
 * Run `fn` with a dedicated client inside an implicit BEGIN/COMMIT.
 * Automatically ROLLBACKs on error and releases the client.
 */
async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch (_) { /* ignore */ }
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Run `fn` with a dedicated client (no transaction). Releases automatically.
 */
async function withClient(fn) {
  const client = await pool.connect();
  try {
    return await fn(client);
  } finally {
    client.release();
  }
}

module.exports = { pool, withTransaction, withClient };
