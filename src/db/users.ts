import crypto from 'crypto';
import { desc, eq, or, sql } from 'drizzle-orm';
import { OWNER_EMAIL, db, ensureDatabaseSchema, pool } from './index.ts';
import { exams, ownerNotes, users } from './schema.ts';

const PRIMARY_TOKEN_SECRET =
  process.env.SESSION_SECRET ||
  crypto
    .createHash('sha256')
    .update(`azmoona-sql-secret-${process.env.DATABASE_URL || 'seraphic-citron-vq7xb'}`)
    .digest('hex');

const LEGACY_TOKEN_SECRETS = [
  crypto
    .createHash('sha256')
    .update(`azmoona-sql-secret-${process.env.DATABASE_URL || process.cwd()}`)
    .digest('hex'),
  crypto
    .createHash('sha256')
    .update(`azmoona-sql-secret-${process.cwd()}`)
    .digest('hex'),
];

export function normalizeEmail(email: string): string {
  return email.replace(/[\u200B-\u200F\uFEFF\s]/g, '').toLowerCase();
}

export function isOwnerEmail(email: string): boolean {
  return normalizeEmail(email) === OWNER_EMAIL;
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const parts = storedHash.split(':');
  if (parts.length !== 2) return false;
  const [salt, keyHex] = parts;
  const expected = Buffer.from(keyHex, 'hex');
  const actual = crypto.scryptSync(password, salt, 64);
  if (expected.length !== actual.length) return false;
  return crypto.timingSafeEqual(expected, actual);
}

export function signLocalAuthToken(uid: string, email: string): string {
  const exp = Date.now() + 1000 * 60 * 60 * 24 * 180;
  const payload = Buffer.from(JSON.stringify({ uid, email, exp })).toString('base64url');
  const sig = crypto
    .createHmac('sha256', PRIMARY_TOKEN_SECRET)
    .update(payload)
    .digest('base64url');
  return `${payload}.${sig}`;
}

function verifyWithSecret(payload: string, sig: string, secret: string): boolean {
  const expectedSig = crypto.createHmac('sha256', secret).update(payload).digest('base64url');
  if (sig.length !== expectedSig.length) return false;
  return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expectedSig));
}

export function verifyLocalAuthToken(token: string): { uid: string; email: string } | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 2) return null;
    const [payload, sig] = parts;
    const valid =
      verifyWithSecret(payload, sig, PRIMARY_TOKEN_SECRET) ||
      LEGACY_TOKEN_SECRETS.some((secret) => verifyWithSecret(payload, sig, secret));
    if (!valid) return null;

    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as {
      uid: string;
      email: string;
      exp: number;
    };
    if (!parsed.uid || !parsed.email || Date.now() > parsed.exp) {
      return null;
    }
    return { uid: parsed.uid, email: parsed.email };
  } catch {
    return null;
  }
}

async function findUserByUidOrEmail(uid: string, emailRaw?: string) {
  const email = emailRaw ? normalizeEmail(emailRaw) : null;
  const rows = email
    ? await db
        .select()
        .from(users)
        .where(or(eq(users.uid, uid), eq(users.email, email)))
        .limit(1)
    : await db.select().from(users).where(eq(users.uid, uid)).limit(1);
  return rows[0] ?? null;
}

export async function getOrCreateUser(uid: string, emailRaw: string) {
  await ensureDatabaseSchema();
  const email = normalizeEmail(emailRaw || `${uid}@azmona.local`);
  const targetRole = isOwnerEmail(email) ? 'owner' : 'student';
  try {
    const existing = await findUserByUidOrEmail(uid, email);
    if (existing) {
      const updated = await db
        .update(users)
        .set({
          uid,
          email,
          role: targetRole,
          lastLoginAt: new Date(),
        })
        .where(eq(users.id, existing.id))
        .returning();
      return updated[0];
    }

    const result = await db
      .insert(users)
      .values({
        uid,
        email,
        role: targetRole,
        lastLoginAt: new Date(),
      })
      .returning();

    return result[0];
  } catch (error) {
    console.error('Database error in getOrCreateUser:', error);
    throw new Error('خطا در همگام‌سازی حساب کاربری با دیتابیس.', { cause: error });
  }
}

export async function exchangeFirebaseUserForSession(uid: string, emailRaw: string) {
  const user = await getOrCreateUser(uid, emailRaw);
  const token = signLocalAuthToken(user.uid, user.email);
  return {
    user: { id: user.uid, email: user.email, isOwner: isOwnerEmail(user.email) },
    token,
  };
}

export async function registerEmailUser(emailRaw: string, password: string) {
  await ensureDatabaseSchema();
  const email = normalizeEmail(emailRaw);
  try {
    const existing = await db.select().from(users).where(eq(users.email, email)).limit(1);
    if (existing.length > 0) {
      const current = existing[0];
      if (current.passwordHash) {
        throw new Error('این ایمیل قبلاً ثبت‌نام شده است. لطفاً وارد شوید.');
      }
      // User previously signed in via Google without a password; attach password cleanly
      const updated = await db
        .update(users)
        .set({
          passwordHash: hashPassword(password),
          lastLoginAt: new Date(),
        })
        .where(eq(users.id, current.id))
        .returning();
      const user = updated[0];
      const token = signLocalAuthToken(user.uid, user.email);
      return {
        user: { id: user.uid, email: user.email, isOwner: isOwnerEmail(user.email) },
        token,
      };
    }

    const uid = `usr_${crypto.randomUUID()}`;
    const inserted = await db
      .insert(users)
      .values({
        uid,
        email,
        role: isOwnerEmail(email) ? 'owner' : 'student',
        passwordHash: hashPassword(password),
        lastLoginAt: new Date(),
      })
      .returning();

    const user = inserted[0];
    const token = signLocalAuthToken(user.uid, user.email);
    return {
      user: { id: user.uid, email: user.email, isOwner: isOwnerEmail(user.email) },
      token,
    };
  } catch (error) {
    if (error instanceof Error && error.message.includes('قبلاً ثبت‌نام')) {
      throw error;
    }
    console.error('Database error in registerEmailUser:', error);
    throw new Error('خطا در ثبت‌نام حساب کاربری.', { cause: error });
  }
}

export async function loginEmailUser(emailRaw: string, password: string) {
  await ensureDatabaseSchema();
  const email = normalizeEmail(emailRaw);
  try {
    const rows = await db.select().from(users).where(eq(users.email, email)).limit(1);
    const user = rows[0];
    if (!user) {
      throw new Error('ایمیل یا رمز عبور نادرست است.');
    }
    if (!user.passwordHash) {
      throw new Error(
        'این ایمیل با حساب گوگل ساخته شده است. با گوگل وارد شوید یا از بخش «ساخت اکانت» برای آن رمز تعیین کنید.'
      );
    }
    if (!verifyPassword(password, user.passwordHash)) {
      throw new Error('ایمیل یا رمز عبور نادرست است.');
    }
    await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, user.id));
    const token = signLocalAuthToken(user.uid, user.email);
    return {
      user: { id: user.uid, email: user.email, isOwner: isOwnerEmail(user.email) },
      token,
    };
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message.includes('نادرست است') || error.message.includes('گوگل'))
    ) {
      throw error;
    }
    console.error('Database error in loginEmailUser:', error);
    throw new Error('خطا در ورود به حساب کاربری.', { cause: error });
  }
}

export async function isOwnerPrincipal(uid: string, emailRaw: string): Promise<boolean> {
  if (!isOwnerEmail(emailRaw)) return false;
  await ensureDatabaseSchema();
  const user = await findUserByUidOrEmail(uid, emailRaw);
  return Boolean(user && isOwnerEmail(user.email) && user.role === 'owner');
}

export async function getUserExamsFromDb(
  uid: string,
  email?: string
): Promise<Array<Record<string, unknown>>> {
  try {
    const user = await findUserByUidOrEmail(uid, email);
    if (!user) return [];

    const rows = await db
      .select({
        payload: exams.payload,
      })
      .from(exams)
      .where(eq(exams.userId, user.id))
      .orderBy(desc(exams.createdAt))
      .limit(30);

    return rows.map((r) => r.payload);
  } catch (error) {
    console.error('Database error in getUserExamsFromDb:', error);
    throw new Error('خطا در دریافت کارنامه‌ها از دیتابیس.', { cause: error });
  }
}

export async function saveUserExamToDb(
  uid: string,
  email: string,
  examKey: string,
  payload: Record<string, unknown>
): Promise<void> {
  try {
    const user = await getOrCreateUser(uid, email);
    const configObj = (payload.config as Record<string, unknown> | undefined) ?? {};
    const grade = String(configObj.grade ?? '8');
    const subjectId = String(configObj.subjectId ?? 'science');
    const examTitle = String(payload.examTitle ?? 'آزمون آزمونا');
    const scoreOutOf20 = String(payload.scoreOutOf20 ?? '0');
    const scorePercent = Number(payload.scorePercent ?? 0) || 0;

    await db
      .insert(exams)
      .values({
        examKey,
        userId: user.id,
        grade,
        subjectId,
        examTitle,
        scoreOutOf20,
        scorePercent,
        payload,
      })
      .onConflictDoUpdate({
        target: exams.examKey,
        set: {
          payload,
          scoreOutOf20,
          scorePercent,
          examTitle,
        },
      });
  } catch (error) {
    console.error('Database error in saveUserExamToDb:', error);
    throw new Error('خطا در ذخیره کارنامه در دیتابیس.', { cause: error });
  }
}

export async function clearUserExamsInDb(uid: string, email?: string): Promise<void> {
  try {
    const user = await findUserByUidOrEmail(uid, email);
    if (!user) return;
    await db.delete(exams).where(eq(exams.userId, user.id));
  } catch (error) {
    console.error('Database error in clearUserExamsInDb:', error);
    throw new Error('خطا در پاک کردن کارنامه‌ها.', { cause: error });
  }
}

export async function getOwnerDatabaseSnapshot() {
  await ensureDatabaseSchema();

  const userRows = await pool.query(`
    SELECT
      u.id,
      u.uid,
      u.email,
      u.role,
      (u.password_hash IS NOT NULL) AS has_password,
      u.last_login_at,
      u.created_at,
      COUNT(e.id)::int AS exam_count,
      COALESCE(ROUND(AVG(e.score_percent))::int, 0) AS avg_score_percent
    FROM users u
    LEFT JOIN exams e ON e.user_id = u.id
    GROUP BY u.id
    ORDER BY (u.role = 'owner') DESC, u.created_at DESC
    LIMIT 200;
  `);

  const examRows = await pool.query(`
    SELECT
      e.id,
      e.exam_key,
      e.grade,
      e.subject_id,
      e.exam_title,
      e.score_out_of_20,
      e.score_percent,
      e.created_at,
      e.payload,
      u.email AS owner_email
    FROM exams e
    JOIN users u ON u.id = e.user_id
    ORDER BY e.created_at DESC
    LIMIT 150;
  `);

  const noteRows = await db
    .select()
    .from(ownerNotes)
    .orderBy(desc(ownerNotes.createdAt))
    .limit(100);

  const statsRes = await pool.query(`
    SELECT
      (SELECT COUNT(*)::int FROM users) AS total_users,
      (SELECT COUNT(*)::int FROM exams) AS total_exams,
      (SELECT COALESCE(ROUND(AVG(score_percent))::int, 0) FROM exams) AS avg_score_percent,
      (SELECT COUNT(*)::int FROM exams WHERE created_at >= NOW() - INTERVAL '24 hours') AS exams_last_24h;
  `);

  const topSubjectsRes = await pool.query(`
    SELECT subject_id, COUNT(*)::int AS count
    FROM exams
    GROUP BY subject_id
    ORDER BY count DESC
    LIMIT 6;
  `);

  return {
    stats: statsRes.rows[0] ?? {
      total_users: 0,
      total_exams: 0,
      avg_score_percent: 0,
      exams_last_24h: 0,
    },
    topSubjects: topSubjectsRes.rows,
    users: userRows.rows,
    exams: examRows.rows,
    notes: noteRows,
    generatedAt: new Date().toISOString(),
  };
}

export async function createOwnerNote(title: string, content: string, category = 'عمومی') {
  await ensureDatabaseSchema();
  const [inserted] = await db
    .insert(ownerNotes)
    .values({
      title: title.trim(),
      content: content.trim(),
      category: category.trim() || 'عمومی',
    })
    .returning();
  return inserted;
}

export async function deleteOwnerNote(noteId: number) {
  await ensureDatabaseSchema();
  await db.delete(ownerNotes).where(eq(ownerNotes.id, noteId));
}

export async function deleteUserAsOwner(userId: number) {
  await ensureDatabaseSchema();
  const rows = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  const target = rows[0];
  if (!target) return;
  if (isOwnerEmail(target.email) || target.role === 'owner') {
    throw new Error('حذف حساب مالک سایت مجاز نیست.');
  }
  await db.delete(users).where(eq(users.id, userId));
}

export async function deleteExamAsOwner(examId: number) {
  await ensureDatabaseSchema();
  await db.delete(exams).where(eq(exams.id, examId));
}

export async function exportOwnerDatabaseBackup() {
  const snapshot = await getOwnerDatabaseSnapshot();
  return {
    app: 'Azmona Private Owner Database Backup',
    ownerEmail: OWNER_EMAIL,
    exportedAt: new Date().toISOString(),
    stats: snapshot.stats,
    users: snapshot.users,
    exams: snapshot.exams,
    notes: snapshot.notes,
  };
}

export { sql };
