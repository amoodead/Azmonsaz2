import crypto from 'crypto';
import { desc, eq, or } from 'drizzle-orm';
import { db } from './index.ts';
import { exams, users } from './schema.ts';

const PRIMARY_TOKEN_SECRET =
  process.env.SESSION_SECRET ||
  crypto
    .createHash('sha256')
    .update(`azmoona-sql-secret-${process.env.DATABASE_URL || process.cwd()}`)
    .digest('hex');

const LEGACY_TOKEN_SECRET = crypto
  .createHash('sha256')
  .update(`azmoona-sql-secret-${process.cwd()}`)
  .digest('hex');

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
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
      verifyWithSecret(payload, sig, LEGACY_TOKEN_SECRET);
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
  const email = normalizeEmail(emailRaw || `${uid}@azmona.local`);
  try {
    const existing = await findUserByUidOrEmail(uid, email);
    if (existing) {
      if (existing.uid !== uid || existing.email !== email) {
        const updated = await db
          .update(users)
          .set({ uid, email })
          .where(eq(users.id, existing.id))
          .returning();
        return updated[0];
      }
      return existing;
    }

    const result = await db
      .insert(users)
      .values({
        uid,
        email,
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
  return { user: { id: user.uid, email: user.email }, token };
}

export async function registerEmailUser(emailRaw: string, password: string) {
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
        .set({ passwordHash: hashPassword(password) })
        .where(eq(users.id, current.id))
        .returning();
      const user = updated[0];
      const token = signLocalAuthToken(user.uid, user.email);
      return { user: { id: user.uid, email: user.email }, token };
    }

    const uid = `usr_${crypto.randomUUID()}`;
    const inserted = await db
      .insert(users)
      .values({
        uid,
        email,
        passwordHash: hashPassword(password),
      })
      .returning();

    const user = inserted[0];
    const token = signLocalAuthToken(user.uid, user.email);
    return { user: { id: user.uid, email: user.email }, token };
  } catch (error) {
    if (error instanceof Error && error.message.includes('قبلاً ثبت‌نام')) {
      throw error;
    }
    console.error('Database error in registerEmailUser:', error);
    throw new Error('خطا در ثبت‌نام حساب کاربری.', { cause: error });
  }
}

export async function loginEmailUser(emailRaw: string, password: string) {
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
    const token = signLocalAuthToken(user.uid, user.email);
    return { user: { id: user.uid, email: user.email }, token };
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
