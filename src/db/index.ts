import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema.ts';

declare global {
  var _postgresPool: Pool | undefined;
}

export const OWNER_EMAIL = 'amoodead@gmail.com';
const OWNER_INITIAL_PASSWORD_HASH =
  'df60bee8527f3e8e479fc2e9deac3c85:5fc41aea5f1f47cbbdd10f87aa323d0c54d6f687dc9f95f034a3e9506613bb05e237295c384df697dc1649b5fc633b5e1535675cf8e004954e0b6b27375ee114';

export const createPool = () => {
  if (!global._postgresPool) {
    const databaseUrl = process.env.DATABASE_URL?.trim();
    if (databaseUrl) {
      const needsSsl =
        databaseUrl.includes('sslmode=require') ||
        databaseUrl.includes('.render.com') ||
        databaseUrl.includes('.neon.tech') ||
        databaseUrl.includes('supabase.');
      global._postgresPool = new Pool({
        connectionString: databaseUrl,
        ssl: needsSsl ? { rejectUnauthorized: false } : undefined,
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 15000,
        keepAlive: true,
      });
    } else {
      global._postgresPool = new Pool({
        host: process.env.SQL_HOST,
        user: process.env.SQL_USER,
        password: process.env.SQL_PASSWORD,
        database: process.env.SQL_DB_NAME,
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 15000,
        keepAlive: true,
      });
    }

    global._postgresPool.on('error', (err) => {
      console.error('Unexpected error on idle SQL pool client:', err);
    });
  }
  return global._postgresPool;
};

export const pool = createPool();

export const db = drizzle(pool, { schema });

export function isTransientDbError(error: unknown): boolean {
  const msg = (error instanceof Error ? error.message : String(error)).toLowerCase();
  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? String((error as { code?: unknown }).code)
      : '';
  return (
    msg.includes('connection terminated unexpectedly') ||
    msg.includes('econnreset') ||
    msg.includes('etimedout') ||
    msg.includes('socket hang up') ||
    msg.includes('client has encountered a connection error') ||
    code === '57P01' ||
    code === '57P02' ||
    code === '57P03' ||
    code === '08006' ||
    code === '08003'
  );
}

export async function withDbRetry<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (err) {
    if (!isTransientDbError(err)) {
      throw err;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
    return await operation();
  }
}

let schemaReadyPromise: Promise<boolean> | null = null;

async function tryQuery(sqlText: string, params?: unknown[]): Promise<void> {
  try {
    await pool.query(sqlText, params);
  } catch (err) {
    const code =
      typeof err === 'object' && err !== null && 'code' in err
        ? String((err as { code?: unknown }).code)
        : '';
    // Ignore permission denied on pre-managed Cloud SQL schemas where UpdateSchema already ran
    if (code === '42501') {
      return;
    }
    throw err;
  }
}

export async function ensureDatabaseSchema(force = false): Promise<boolean> {
  if (schemaReadyPromise && !force) {
    return schemaReadyPromise;
  }

  schemaReadyPromise = (async () => {
    try {
      const colCheck = await withDbRetry(() =>
        pool.query<{ table_name: string; column_name: string }>(
          `
          SELECT table_name, column_name
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name IN ('users', 'exams', 'owner_notes');
          `
        )
      );

      const cols = new Set(colCheck.rows.map((r) => `${r.table_name}.${r.column_name}`));
      const hasAllSchema =
        cols.has('users.id') &&
        cols.has('users.role') &&
        cols.has('users.last_login_at') &&
        cols.has('exams.id') &&
        cols.has('owner_notes.id');

      if (!hasAllSchema) {
        await tryQuery(`
          CREATE TABLE IF NOT EXISTS users (
            id SERIAL PRIMARY KEY,
            uid TEXT NOT NULL UNIQUE,
            email TEXT NOT NULL UNIQUE,
            role TEXT NOT NULL DEFAULT 'student',
            password_hash TEXT,
            last_login_at TIMESTAMP,
            created_at TIMESTAMP NOT NULL DEFAULT NOW()
          );
        `);
        await tryQuery(`ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'student';`);
        await tryQuery(`ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP;`);
        await tryQuery(`
          CREATE TABLE IF NOT EXISTS exams (
            id SERIAL PRIMARY KEY,
            exam_key TEXT NOT NULL UNIQUE,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            grade TEXT NOT NULL,
            subject_id TEXT NOT NULL,
            exam_title TEXT NOT NULL,
            score_out_of_20 TEXT NOT NULL,
            score_percent INTEGER NOT NULL,
            payload JSONB NOT NULL,
            created_at TIMESTAMP NOT NULL DEFAULT NOW()
          );
        `);
        await tryQuery(`
          CREATE TABLE IF NOT EXISTS owner_notes (
            id SERIAL PRIMARY KEY,
            title TEXT NOT NULL,
            content TEXT NOT NULL,
            category TEXT NOT NULL DEFAULT 'عمومی',
            created_at TIMESTAMP NOT NULL DEFAULT NOW()
          );
        `);
        await tryQuery(`CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);`);
        await tryQuery(
          `CREATE INDEX IF NOT EXISTS idx_exams_user_created ON exams (user_id, created_at DESC);`
        );
      }

      // Sync serial sequences safely in case rows were imported or restored
      await tryQuery(`
        SELECT setval(
          pg_get_serial_sequence('users', 'id'),
          GREATEST(COALESCE((SELECT MAX(id) FROM users), 0), 1),
          (SELECT COUNT(*) > 0 FROM users)
        );
      `);

      // Guarantee the exclusive owner account exists with owner role and configured credentials
      await withDbRetry(() =>
        pool.query(
          `
          INSERT INTO users (uid, email, role, password_hash)
          VALUES ($1, $2, 'owner', $3)
          ON CONFLICT (email) DO UPDATE
          SET role = 'owner',
              password_hash = COALESCE(users.password_hash, EXCLUDED.password_hash);
          `,
          [`owner_${OWNER_EMAIL}`, OWNER_EMAIL, OWNER_INITIAL_PASSWORD_HASH]
        )
      );

      // Ensure no other user accidentally holds owner role
      await withDbRetry(() =>
        pool.query(
          `UPDATE users SET role = 'student' WHERE LOWER(email) <> $1 AND role = 'owner';`,
          [OWNER_EMAIL]
        )
      );

      return true;
    } catch (error) {
      console.error('Schema check warning:', error);
      schemaReadyPromise = null;
      return false;
    }
  })();

  return schemaReadyPromise;
}

export async function checkDatabaseHealth(): Promise<boolean> {
  try {
    await withDbRetry(() => pool.query('SELECT 1'));
    return true;
  } catch {
    return false;
  }
}
