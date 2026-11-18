import crypto from 'crypto';
import { and, desc, eq } from 'drizzle-orm';
import { db } from './index.ts';
import { exams, users } from './schema.ts';

const TOKEN_SECRET =
  process.env.SESSION_SECRET ||
  crypto.createHash('sha256').update(`azmoona-sql-secret-${process.cwd()}`).digest('hex');

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
  const exp = Date.now() + 1000 * 60 * 60 * 24 * 30;
  const payload = Buffer.from(JSON.stringify({ uid, email, exp })).toString('base64url');
  const sig = crypto.createHmac('sha256', TOKEN_SECRET).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

export function verifyLocalAuthToken(token: string): { uid: string; email: string } | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 2) return null;
    const [payload, sig] = parts;
    const expectedSig = crypto
      .createHmac('sha256', TOKEN_SECRET)
      .update(payload)
      .digest('base64url');
    if (sig.length !== expectedSig.length) return null;
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expectedSig))) {
      return null;
    }
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

export async function getOrCreateUser(uid: string, emailRaw: string) {
  const email = normalizeEmail(emailRaw || `${uid}@azmona.local`);
  try {
    const result = await db
      .insert(users)
      .values({
        uid,
        email,
      })
      .onConflictDoUpdate({
        target: users.uid,
        set: { email },
      })
      .returning();

    return result[0];
  } catch (error) {
    console.error('Database error in getOrCreateUser:', error);
    throw new Error('خطا در همگام‌سازی حساب کاربری با دیتابیس.', { cause: error });
  }
}

export async function registerEmailUser(emailRaw: string, password: string) {
  const email = normalizeEmail(emailRaw);
  try {
    const existing = await db.select().from(users).where(eq(users.email, email)).limit(1);
    if (existing.length > 0) {
      throw new Error('این ایمیل قبلاً ثبت‌نام شده است. لطفاً وارد شوید.');
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
    if (!user || !user.passwordHash || !verifyPassword(password, user.passwordHash)) {
      throw new Error('ایمیل یا رمز عبور نادرست است.');
    }
    const token = signLocalAuthToken(user.uid, user.email);
    return { user: { id: user.uid, email: user.email }, token };
  } catch (error) {
    if (error instanceof Error && error.message.includes('نادرست است')) {
      throw error;
    }
    console.error('Database error in loginEmailUser:', error);
    throw new Error('خطا در ورود به حساب کاربری.', { cause: error });
  }
}

export async function getUserExamsFromDb(uid: string): Promise<Array<Record<string, unknown>>> {
  try {
    const rows = await db
      .select({
        payload: exams.payload,
      })
      .from(exams)
      .innerJoin(users, eq(exams.userId, users.id))
      .where(eq(users.uid, uid))
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

export async function clearUserExamsInDb(uid: string): Promise<void> {
  try {
    const userRows = await db.select().from(users).where(eq(users.uid, uid)).limit(1);
    if (userRows.length === 0) return;
    await db.delete(exams).where(and(eq(exams.userId, userRows[0].id)));
  } catch (error) {
    console.error('Database error in clearUserExamsInDb:', error);
    throw new Error('خطا در پاک کردن کارنامه‌ها.', { cause: error });
  }
}
