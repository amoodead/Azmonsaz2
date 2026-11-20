import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';
import { checkDatabaseHealth, ensureDatabaseSchema } from './src/db/index.ts';
import {
  clearUserExamsInDb,
  createOwnerNote,
  deleteExamAsOwner,
  deleteOwnerNote,
  deleteUserAsOwner,
  exchangeFirebaseUserForSession,
  exportOwnerDatabaseBackup,
  getOwnerDatabaseSnapshot,
  getUserExamsFromDb,
  loginEmailUser,
  normalizeEmail,
  registerEmailUser,
  saveUserExamToDb,
  signLocalAuthToken,
} from './src/db/users.ts';
import { adminAuth } from './src/lib/firebase-admin.ts';
import {
  requireAuth,
  requireOwner,
  resolveAuthPrincipal,
  type AuthRequest,
} from './src/middleware/auth.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.set('trust proxy', 1);
app.use(express.json({ limit: '2mb' }));

app.get('/api/health', async (_req, res) => {
  const dbOk = await checkDatabaseHealth();
  res.status(dbOk ? 200 : 503).json({
    ok: dbOk,
    db: dbOk ? 'connected' : 'unavailable',
  });
});

function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('کلید API جمینی روی سرور تنظیم نشده است. لطفاً بخش Secrets را بررسی کنید.');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function isRateLimitOrTransient(error: unknown): boolean {
  const msg = (error instanceof Error ? error.message : String(error)).toLowerCase();
  return (
    msg.includes('429') ||
    msg.includes('resource_exhausted') ||
    msg.includes('quota') ||
    msg.includes('rate') ||
    msg.includes('503') ||
    msg.includes('unavailable') ||
    msg.includes('overloaded') ||
    msg.includes('500') ||
    msg.includes('timeout')
  );
}

/**
 * Fast model execution with automatic multi-model failover:
 * Primary: gemini-3.1-flash-lite (ThinkingLevel.MINIMAL)
 * Fallback: gemini-4-hydrogen (ThinkingLevel.LOW)
 */
async function generateFastWithFailover<T>(
  runner: (model: string, thinkingLevel: ThinkingLevel) => Promise<T>,
  primaryThinking: ThinkingLevel = ThinkingLevel.MINIMAL
): Promise<T> {
  const attempts: Array<{ model: string; thinking: ThinkingLevel; delayBeforeMs: number }> = [
    { model: 'gemini-3.1-flash-lite', thinking: primaryThinking, delayBeforeMs: 0 },
    { model: 'gemini-4-hydrogen', thinking: ThinkingLevel.LOW, delayBeforeMs: 350 },
    { model: 'gemini-3.1-flash-lite', thinking: primaryThinking, delayBeforeMs: 900 },
  ];

  let lastError: unknown;
  for (const step of attempts) {
    if (step.delayBeforeMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, step.delayBeforeMs));
    }
    try {
      return await runner(step.model, step.thinking);
    } catch (err) {
      lastError = err;
      if (!isRateLimitOrTransient(err)) {
        throw err;
      }
    }
  }
  throw lastError;
}

function mapGeminiError(error: unknown): { status: number; message: string } {
  const raw = error instanceof Error ? error.message : String(error);
  const lower = raw.toLowerCase();

  if (
    lower.includes('api_key_invalid') ||
    lower.includes('permission_denied') ||
    lower.includes('403') ||
    lower.includes('401')
  ) {
    return {
      status: 401,
      message: 'کلید دسترسی هوش مصنوعی معتبر نیست. لطفاً کلید را در بخش Settings > Secrets بررسی کنید.',
    };
  }
  if (lower.includes('resource_exhausted') || lower.includes('429') || lower.includes('quota')) {
    return {
      status: 429,
      message: 'تعداد درخواست‌ها در این دقیقه زیاد بوده است. لطفاً چند ثانیه صبر کرده و دوباره بزنید.',
    };
  }
  if (lower.includes('not_found') || lower.includes('404')) {
    return {
      status: 502,
      message: 'مدل هوش مصنوعی در دسترس نیست. لطفاً تنظیمات سرور را بررسی کنید.',
    };
  }
  return {
    status: 500,
    message: raw || 'خطای غیرمنتظره در ارتباط با سرور هوش مصنوعی رخ داد.',
  };
}

// --- Cloud SQL Account & Exam History Routes ---

const SESSION_MAX_AGE_SEC = 60 * 60 * 24 * 180; // 180 days

function isHttpsRequest(req: express.Request): boolean {
  const proto = String(req.headers['x-forwarded-proto'] || '').toLowerCase();
  return req.secure || proto.includes('https');
}

function setSessionCookie(req: express.Request, res: express.Response, token: string): void {
  const isHttps = isHttpsRequest(req);
  const parts = [
    `azmoona_session=${encodeURIComponent(token)}`,
    'Path=/',
    `Max-Age=${SESSION_MAX_AGE_SEC}`,
    'HttpOnly',
    isHttps ? 'SameSite=None; Secure' : 'SameSite=Lax',
  ];
  res.setHeader('Set-Cookie', parts.join('; '));
}

function clearSessionCookie(req: express.Request, res: express.Response): void {
  const isHttps = isHttpsRequest(req);
  const parts = [
    'azmoona_session=',
    'Path=/',
    'Max-Age=0',
    'HttpOnly',
    isHttps ? 'SameSite=None; Secure' : 'SameSite=Lax',
  ];
  res.setHeader('Set-Cookie', parts.join('; '));
}

app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password, confirmPassword } = req.body as {
      email?: string;
      password?: string;
      confirmPassword?: string;
    };

    const cleanedEmail = normalizeEmail(email || '');
    if (!cleanedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanedEmail)) {
      return res.status(400).json({ error: 'لطفاً یک ایمیل معتبر وارد کنید.' });
    }
    if (!password || password.length < 6) {
      return res.status(400).json({ error: 'رمز عبور باید حداقل ۶ کاراکتر باشد.' });
    }
    if (password !== confirmPassword) {
      return res.status(400).json({ error: 'رمز عبور و تکرار آن یکسان نیستند.' });
    }

    const result = await registerEmailUser(cleanedEmail, password);
    setSessionCookie(req, res, result.token);
    res.status(201).json(result);
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'خطا در ساخت حساب کاربری.' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body as { email?: string; password?: string };
    const cleanedEmail = normalizeEmail(email || '');
    if (!cleanedEmail || !password) {
      return res.status(400).json({ error: 'ایمیل و رمز عبور را وارد کنید.' });
    }
    const result = await loginEmailUser(cleanedEmail, password);
    setSessionCookie(req, res, result.token);
    res.json(result);
  } catch (err) {
    res.status(401).json({ error: err instanceof Error ? err.message : 'ورود ناموفق بود.' });
  }
});

app.post('/api/auth/google', async (req, res) => {
  try {
    const bodyToken = (req.body as { idToken?: string } | undefined)?.idToken;
    const authHeader = req.headers.authorization;
    const headerToken =
      authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
    const idToken = (bodyToken || headerToken || '').trim();

    if (!idToken) {
      return res.status(400).json({ error: 'توکن گوگل ارسال نشده است.' });
    }

    const decoded = await adminAuth.verifyIdToken(idToken);
    const email = decoded.email || `${decoded.uid}@azmona.local`;
    const result = await exchangeFirebaseUserForSession(decoded.uid, email);
    setSessionCookie(req, res, result.token);
    res.json(result);
  } catch (err) {
    console.error('Google session exchange error:', err);
    res.status(401).json({ error: 'اعتبارسنجی ورود گوگل ناموفق بود.' });
  }
});

app.post('/api/auth/logout', (req, res) => {
  clearSessionCookie(req, res);
  res.json({ ok: true });
});

app.get('/api/auth/session', async (req, res) => {
  try {
    const principal = await resolveAuthPrincipal(req);
    if (!principal) {
      return res.json({ authenticated: false, user: null });
    }
    const freshToken = signLocalAuthToken(principal.uid, principal.email);
    setSessionCookie(req, res, freshToken);
    res.json({
      authenticated: true,
      user: {
        id: principal.uid,
        email: principal.email,
        isOwner: Boolean(principal.isOwner),
      },
      token: freshToken,
    });
  } catch (err) {
    console.error('Session restore error:', err);
    res.status(500).json({ error: 'خطا در بررسی نشست کاربری.' });
  }
});

app.get('/api/auth/me', requireAuth, (req: AuthRequest, res) => {
  res.json({
    user: {
      id: req.authUser!.uid,
      email: req.authUser!.email,
      isOwner: Boolean(req.authUser!.isOwner),
    },
  });
});

// --- Exclusive Owner Database Management Routes (Strictly amoodead@gmail.com only) ---

app.get('/api/owner/database', requireOwner, async (_req: AuthRequest, res) => {
  try {
    const snapshot = await getOwnerDatabaseSnapshot();
    res.json(snapshot);
  } catch (err) {
    res.status(500).json({
      error: err instanceof Error ? err.message : 'خطا در دریافت اطلاعات دیتابیس مالک.',
    });
  }
});

app.post('/api/owner/notes', requireOwner, async (req: AuthRequest, res) => {
  try {
    const { title, content, category } = req.body as {
      title?: string;
      content?: string;
      category?: string;
    };
    if (!title?.trim() || !content?.trim()) {
      return res.status(400).json({ error: 'عنوان و متن یادداشت الزامی است.' });
    }
    const note = await createOwnerNote(title, content, category || 'عمومی');
    res.status(201).json({ note });
  } catch (err) {
    res.status(500).json({
      error: err instanceof Error ? err.message : 'خطا در ثبت یادداشت مالک.',
    });
  }
});

app.delete('/api/owner/notes/:id', requireOwner, async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: 'شناسه یادداشت معتبر نیست.' });
    }
    await deleteOwnerNote(id);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'خطا در حذف یادداشت.' });
  }
});

app.delete('/api/owner/users/:id', requireOwner, async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: 'شناسه کاربر معتبر نیست.' });
    }
    await deleteUserAsOwner(id);
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'خطا در حذف کاربر.' });
  }
});

app.delete('/api/owner/exams/:id', requireOwner, async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: 'شناسه آزمون معتبر نیست.' });
    }
    await deleteExamAsOwner(id);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'خطا در حذف آزمون.' });
  }
});

app.get('/api/owner/export', requireOwner, async (_req: AuthRequest, res) => {
  try {
    const backup = await exportOwnerDatabaseBackup();
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="azmona-owner-backup-${new Date().toISOString().slice(0, 10)}.json"`
    );
    res.send(JSON.stringify(backup, null, 2));
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'خطا در تهیه بکاپ.' });
  }
});

app.get('/api/user/exams', requireAuth, async (req: AuthRequest, res) => {
  try {
    const exams = await getUserExamsFromDb(req.authUser!.uid, req.authUser!.email);
    res.json({ exams });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'خطا در دریافت کارنامه‌ها.' });
  }
});

app.post('/api/user/exams', requireAuth, async (req: AuthRequest, res) => {
  try {
    const examEntry = req.body as Record<string, unknown>;
    if (!examEntry || typeof examEntry.id !== 'string') {
      return res.status(400).json({ error: 'اطلاعات کارنامه معتبر نیست.' });
    }
    await saveUserExamToDb(req.authUser!.uid, req.authUser!.email, examEntry.id, examEntry);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'خطا در ذخیره کارنامه.' });
  }
});

app.delete('/api/user/exams', requireAuth, async (req: AuthRequest, res) => {
  try {
    await clearUserExamsInDb(req.authUser!.uid, req.authUser!.email);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'خطا در پاک کردن کارنامه‌ها.' });
  }
});

// --- Fast, Fresh, Non-Repetitive Exam Generation & Analysis Routes ---

const STYLE_POOLS_BY_DIFFICULTY: Record<'easy' | 'standard' | 'advanced', string[]> = {
  easy: [
    'تعریف‌های اولیه، مفاهیم پایه و تشخیص مستقیم مثال‌های بسیار ساده کتاب درسی',
    'سؤالات کوتاه تک‌مرحله‌ای، یادآوری سریع نکات اصلی فصل بدون هیچ پیچیدگی',
    'پرسش‌های شفاف و روان برای مرور مقدماتی پیش از شروع تست‌های کتاب',
  ],
  standard: [
    'سؤالات استاندارد امتحانات نوبت اول و دوم مدارس بر اساس متن و تمرین‌های کتاب درسی',
    'مثال‌های کاربردی، فعالیت‌ها و پرسش‌های «فکر کنید» و تمرین‌های آخر فصل کتاب درسی',
    'مقایسه مفاهیم اصلی کتاب درسی و محاسبه‌های مستقیم هم‌سطح نمونه سؤال‌های معلم',
  ],
  advanced: [
    'تست‌های تحلیلی و چندمرحله‌ای در تراز آزمون ورودی تیزهوشان (سمپاد) و کتاب‌های خیلی سبز تیزهوشان / مبتکران از مفاهیم همین فصل',
    'سؤالات ترکیبی عمیق، استدلال منطقی، گزاره‌های «چند مورد درست است؟» و دام‌های هوشمندانه آزمون‌های تیزهوشان منحصراً در محدوده همین درس',
    'مسئله‌های چالشی و مفهومی کتاب‌های گاج IQ و رشادت نیازمند دقت بالا و تحلیل عمیق نکاتِ همین فصل انتخاب‌شده',
  ],
};

interface GenerateExamBody {
  gradeLabel: string;
  subjectName: string;
  lessonTitles: string[];
  lessonTopics: string[];
  excludedLessonTitles?: string[];
  allLessons: boolean;
  customTopic?: string;
  questionCount: number;
  difficultyLabel: string;
  difficultyId: 'easy' | 'standard' | 'advanced';
  recentQuestions?: string[];
  variationSeed?: number;
}

app.post('/api/exam/generate', async (req, res) => {
  try {
    const body = req.body as GenerateExamBody;
    const count = Math.min(25, Math.max(3, Number(body.questionCount) || 5));

    if (
      !body.gradeLabel ||
      !body.subjectName ||
      (!body.allLessons && (!body.lessonTitles || body.lessonTitles.length === 0))
    ) {
      return res.status(400).json({ error: 'لطفاً پایه، درس و حداقل یک فصل را انتخاب کنید.' });
    }

    const ai = getGeminiClient();

    const scopeText = body.allLessons
      ? `کل کتاب ${body.subjectName} ${body.gradeLabel}`
      : body.lessonTitles.join('، ');

    const topicsContext =
      body.lessonTopics && body.lessonTopics.length > 0
        ? `مباحث دقیق و مجاز برای طراحی سؤال:\n- ${body.lessonTopics.join('\n- ')}`
        : '';

    const excludedBlock =
      !body.allLessons && Array.isArray(body.excludedLessonTitles) && body.excludedLessonTitles.length > 0
        ? `فصل‌ها/درس‌های غیرمجاز (به هیچ وجه از این‌ها سؤال نپرس): ${body.excludedLessonTitles.join('، ')}`
        : '';

    const customFocusText = body.customTopic?.trim()
      ? `تمرکز ویژه دانش‌آموز (در صورت هم‌خوانی با درس): ${body.customTopic.trim()}`
      : '';

    const diffId: 'easy' | 'standard' | 'advanced' =
      body.difficultyId === 'easy' || body.difficultyId === 'advanced'
        ? body.difficultyId
        : 'standard';

    const difficultyGuidance =
      diffId === 'easy'
        ? 'سطح آسان (یک پله ساده‌تر و پایین‌تر از تمرین‌های عادی کتاب درسی): سؤالات باید خیلی روان، کوتاه، مستقیم و تک‌مرحله‌ای باشند؛ فقط در حد مفاهیم پایه، تعریف‌های اولیه و عددهای بسیار رُند و ساده. به هیچ وجه سؤال چندموردی، پیچیده، ترکیبی یا دارای دام امتحانی طرح نکن و گزینه‌های غلط کاملاً مشخص باشند.'
        : diffId === 'advanced'
          ? 'سطح سخت (منحصراً هم‌تراز آزمون‌های ورودی تیزهوشان سمپاد و کتاب‌های کار تیزهوشان مثل خیلی سبز تیزهوشان، مبتکران و IQ): هر سؤال باید چالشی، مفهومی، چندمرحله‌ای و دارای نکته ظریف یا تله تستی هوشمندانه از همین درس باشد (از جمله سؤال‌های «چند مورد زیر درست است؟»، تحلیل سناریو و استدلال عمیق). به هیچ وجه سؤال حفظی ساده یا روتین کتاب نگذار.'
          : 'سطح متوسط (دقیقاً هم‌سطح کتاب درسی رسمی ایران و امتحانات نوبت اول و دوم مدارس): سؤالات دقیقاً مطابق متن، فعالیت‌ها، آزمایش‌ها و تمرین‌های آخر فصل کتاب درسی باشند؛ نه بیش از حد ابتدایی و نه فراتر از کتاب در سطح تیزهوشان.';

    const difficultySystemRule =
      diffId === 'easy'
        ? `معلم صمیمی ${body.subjectName} ${body.gradeLabel} که آزمون بسیار ساده، پایه‌ای و ساده‌تر از کتاب فقط از محدوده «${scopeText}» طراحی می‌کند. خروج از درس یا فصل انتخاب‌شده اکیداً ممنوع است.`
        : diffId === 'advanced'
          ? `طراح ارشد سؤالات تیزهوشان (سمپاد) برای درس «${body.subjectName}» ${body.gradeLabel}. فقط تست‌های عمیق و چالشی در تراز تیزهوشان منحصراً از محدوده «${scopeText}» بساز و هرگز به فصل‌ها یا درس‌های دیگر نرو.`
          : `دبیر رسمی ${body.subjectName} ${body.gradeLabel} در آموزش و پرورش ایران. آزمون استاندارد دقیقاً منطبق بر متن و تمرین‌های «${scopeText}» بساز و از خروج از این درس و فصل اکیداً خودداری کن.`;

    const seed = Number(body.variationSeed) || Date.now();
    const pool = STYLE_POOLS_BY_DIFFICULTY[diffId];
    const angleStyle = pool[seed % pool.length];
    const recentBlock =
      Array.isArray(body.recentQuestions) && body.recentQuestions.length > 0
        ? `سؤال‌های تکراری زیر را به هیچ وجه تکرار نکن و مثال/عدد جدید بساز:\n- ${body.recentQuestions
            .slice(0, 12)
            .map((q) => q.slice(0, 90))
            .join('\n- ')}`
        : '';

    const prompt = `
دقیقاً ${count} سؤال چهارگزینه‌ای تازه طراحی کن.

⚠️ قفل قطعی درس و فصل (الزامی و بدون استثنا):
- درس اصلی: «${body.subjectName}»
- پایه: «${body.gradeLabel}»
- فصل/درس انتخاب‌شده: «${scopeText}»
${topicsContext}
${excludedBlock}
${customFocusText}

سطح دشواری الزامی: ${difficultyGuidance}
سبک این نوبت: ${angleStyle} | کد تنوع: ${seed % 997}
${recentBlock}

قوانین قطعی طراحی:
1. ۱۰۰٪ سؤالات باید مستقیماً و منحصراً درباره درس «${body.subjectName}» (${body.gradeLabel}) و دقیقاً همین محدوده/مباحث مشخص‌شده («${scopeText}») باشند. طرح حتی یک سؤال از درس‌های دیگر، فصل‌های غیرمجاز بالا یا پایه‌های دیگر اکیداً ممنوع است.
2. فیلد topicTag هر سؤال باید دقیقاً نام یکی از موضوعات همین درس و فصل باشد.
3. رعایت سطح دشواری (${diffId === 'easy' ? 'آسان: ساده‌تر از کتاب درسی' : diffId === 'advanced' ? 'سخت: تمام‌عیار در سطح تیزهوشان و سمپاد' : 'متوسط: دقیقاً در حد کتاب درسی'}) در تک‌تک سؤال‌ها الزامی است.
4. نگارش شفاف و خوانا: متن سؤال‌ها کوتاه، روان و بدون شلوغی باشد. در ریاضی و فرمول‌ها، عبارت‌های ریاضی و اعداد منفی را با فاصله استاندارد و علامت‌های روشن بنویس (مثلاً (-3) + (+7) یا 2x - 5 = 11) و اعداد را در هم نریز تا علامت جمع و تفریق کاملاً خوانا باشد. اگر سؤال شامل چند گزاره یا بخش (الف، ب، ج، د) است، حتماً هر مورد را در یک خط جداگانه با «الف) ...»، «ب) ...»، «ج) ...»، «د) ...» بنویس تا در متن اصلی قاطی نشوند.
5. ۴ گزینه کوتاه، هم‌وزن و کاملاً بدون پیشوند «الف)»، «ب)»، «ج)»، «د)» یا شماره ۱ تا ۴ (خود سایت برچسب گزینه را می‌گذارد).
6. جایگاه پاسخ درست (correctIndex از ۰ تا ۳) بین سؤالات پخش باشد.
7. hint و quickExplanation هر کدام حداکثر ۱ جمله کوتاه و دقیق باشد.
`;

    const response = await generateFastWithFailover(
      (model, thinkingLevel) =>
        ai.models.generateContent({
          model,
          contents: prompt,
          config: {
            thinkingConfig: { thinkingLevel },
            systemInstruction: difficultySystemRule,
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                examTitle: { type: Type.STRING },
                recommendedMinutes: { type: Type.INTEGER },
                questions: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      question: { type: Type.STRING },
                      options: {
                        type: Type.ARRAY,
                        items: { type: Type.STRING },
                      },
                      correctIndex: { type: Type.INTEGER },
                      topicTag: { type: Type.STRING },
                      hint: { type: Type.STRING },
                      quickExplanation: { type: Type.STRING },
                    },
                    required: ['question', 'options', 'correctIndex', 'topicTag', 'hint', 'quickExplanation'],
                  },
                },
              },
              required: ['examTitle', 'recommendedMinutes', 'questions'],
            },
          },
        }),
      ThinkingLevel.LOW
    );

    const rawText = (response.text ?? '{}').trim();
    const parsed = JSON.parse(rawText);

    if (!parsed || !Array.isArray(parsed.questions) || parsed.questions.length === 0) {
      throw new Error('ساختار سؤالات دریافتی کامل نبود. لطفاً دوباره امتحان کنید.');
    }

    const sanitizedQuestions = parsed.questions
      .slice(0, count)
      .map((q: Record<string, unknown>, index: number) => {
        const rawOptions = Array.isArray(q.options) ? q.options.map((o) => String(o).trim()) : [];
        const optionPrefixRe = /^(?:الف|ب|ج|د|هـ|[1-4]|[۱-۴])\s*[).:\-]\s+/;
        const prefixedCount = rawOptions.filter((o) => optionPrefixRe.test(o)).length;
        const cleanedOptions =
          prefixedCount >= 3 ? rawOptions.map((o) => o.replace(optionPrefixRe, '').trim()) : rawOptions;
        while (cleanedOptions.length < 4) {
          cleanedOptions.push('هیچ‌کدام');
        }
        const options = cleanedOptions.slice(0, 4) as [string, string, string, string];
        const rawIndex = Number(q.correctIndex);
        const correctIndex =
          Number.isInteger(rawIndex) && rawIndex >= 0 && rawIndex <= 3 ? rawIndex : 0;

        return {
          id: `q-${Date.now()}-${index + 1}`,
          question: String(q.question || ''),
          options,
          correctIndex,
          topicTag: String(q.topicTag || body.subjectName),
          difficultyLabel: body.difficultyLabel,
          hint: String(q.hint || 'به مفهوم اصلی درس دقت کن.'),
          quickExplanation: String(q.quickExplanation || ''),
        };
      });

    res.json({
      examTitle: String(parsed.examTitle || `آزمون ${body.subjectName} ${body.gradeLabel}`),
      subtitle: scopeText,
      recommendedMinutes:
        Number(parsed.recommendedMinutes) ||
        Math.max(5, Math.ceil(sanitizedQuestions.length * 1.2)),
      questions: sanitizedQuestions,
    });
  } catch (error) {
    const mapped = mapGeminiError(error);
    res.status(mapped.status).json({ error: mapped.message });
  }
});

interface WrongQuestionPayload {
  questionId: string;
  questionNumber: number;
  question: string;
  options: string[];
  studentAnswerIndex: number | null;
  correctAnswerIndex: number;
  topicTag: string;
}

interface AnalyzeExamBody {
  gradeLabel: string;
  subjectName: string;
  lessonScope: string;
  totalQuestions: number;
  correctCount: number;
  wrongCount: number;
  unansweredCount: number;
  scorePercent: number;
  timeSpentSeconds: number;
  correctTopics: string[];
  wrongItems: WrongQuestionPayload[];
}

const analysisCache = new Map<string, unknown>();

app.post('/api/exam/analyze', async (req, res) => {
  try {
    const body = req.body as AnalyzeExamBody;

    if (!body.wrongItems || body.wrongItems.length === 0) {
      return res.json({
        overallSummary: `آفرین! به تمام ${body.totalQuestions} سؤال آزمون ${body.subjectName} (${body.gradeLabel}) پاسخ درست دادی و تسلط کاملی روی این مبحث داشتی.`,
        strengthTopics: body.correctTopics.length > 0 ? body.correctTopics : [body.lessonScope],
        weakTopics: [],
        studyRecommendations: [
          'مرور خلاصه نکات همین فصل برای ماندگاری طولانی‌مدت در حافظه.',
          'برای چالش بیشتر، آزمون بعدی را با سطح «چالشی» امتحان کن.',
        ],
        wrongBreakdowns: [],
      });
    }

    const cacheKey = JSON.stringify({
      g: body.gradeLabel,
      s: body.subjectName,
      w: body.wrongItems.map((i) => `${i.questionId}:${i.studentAnswerIndex}`),
    });
    if (analysisCache.has(cacheKey)) {
      return res.json(analysisCache.get(cacheKey));
    }

    const ai = getGeminiClient();

    const wrongItemsSummary = body.wrongItems
      .map((item) => {
        const studentChoiceText =
          item.studentAnswerIndex !== null &&
          item.studentAnswerIndex >= 0 &&
          item.studentAnswerIndex < 4
            ? `گزینه ${item.studentAnswerIndex + 1}: ${item.options[item.studentAnswerIndex]}`
            : 'نزده';
        const correctChoiceText = `گزینه ${item.correctAnswerIndex + 1}: ${item.options[item.correctAnswerIndex]}`;

        return `#${item.questionNumber} (${item.questionId} | ${item.topicTag}): ${item.question}\nانتخاب دانش‌آموز: ${studentChoiceText}\nدرست: ${correctChoiceText}`;
      })
      .join('\n---\n');

    const prompt = `
نتیجه آزمون ${body.subjectName} (${body.gradeLabel} - ${body.lessonScope}):
درست: ${body.correctCount} | غلط: ${body.wrongCount} | نزده: ${body.unansweredCount} | درصد: ${body.scorePercent}٪
مباحث درست: ${body.correctTopics.join('، ') || 'ندارد'}

سؤال‌های غلط/نزده:
${wrongItemsSummary}

خلاصه و روشن تحلیل کن:
- overallSummary: ۲ جمله انگیزشی و دقیق
- strengthTopics و weakTopics: فهرست کوتاه
- studyRecommendations: ۲ تا ۳ نکته کوتاه
- wrongBreakdowns: برای هر سؤال غلط بالا توضیح کوتاه (whyWrongSelected، correctConceptExplanation، keyTakeaway در ۱ تا ۲ جمله).
`;

    const response = await generateFastWithFailover((model, thinkingLevel) =>
      ai.models.generateContent({
        model,
        contents: prompt,
        config: {
          thinkingConfig: { thinkingLevel },
          systemInstruction:
            'معلم سریع و دلسوز دوره اول متوسطه ایران. کوتاه، صمیمی، دقیق و بدون زیاده‌گویی توضیح بده.',
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              overallSummary: { type: Type.STRING },
              strengthTopics: { type: Type.ARRAY, items: { type: Type.STRING } },
              weakTopics: { type: Type.ARRAY, items: { type: Type.STRING } },
              studyRecommendations: { type: Type.ARRAY, items: { type: Type.STRING } },
              wrongBreakdowns: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    questionId: { type: Type.STRING },
                    questionNumber: { type: Type.INTEGER },
                    wasUnanswered: { type: Type.BOOLEAN },
                    misconceptionReason: { type: Type.STRING },
                    whyWrongSelected: { type: Type.STRING },
                    correctConceptExplanation: { type: Type.STRING },
                    keyTakeaway: { type: Type.STRING },
                  },
                  required: [
                    'questionId',
                    'questionNumber',
                    'wasUnanswered',
                    'misconceptionReason',
                    'whyWrongSelected',
                    'correctConceptExplanation',
                    'keyTakeaway',
                  ],
                },
              },
            },
            required: [
              'overallSummary',
              'strengthTopics',
              'weakTopics',
              'studyRecommendations',
              'wrongBreakdowns',
            ],
          },
        },
      })
    );

    const rawText = (response.text ?? '{}').trim();
    const parsed = JSON.parse(rawText);

    const resultPayload = {
      overallSummary: String(parsed.overallSummary || ''),
      strengthTopics: Array.isArray(parsed.strengthTopics) ? parsed.strengthTopics.map(String) : [],
      weakTopics: Array.isArray(parsed.weakTopics) ? parsed.weakTopics.map(String) : [],
      studyRecommendations: Array.isArray(parsed.studyRecommendations)
        ? parsed.studyRecommendations.map(String)
        : [],
      wrongBreakdowns: Array.isArray(parsed.wrongBreakdowns) ? parsed.wrongBreakdowns : [],
    };

    if (analysisCache.size > 100) {
      const firstKey = analysisCache.keys().next().value;
      if (firstKey) analysisCache.delete(firstKey);
    }
    analysisCache.set(cacheKey, resultPayload);

    res.json(resultPayload);
  } catch (error) {
    const mapped = mapGeminiError(error);
    res.status(mapped.status).json({ error: mapped.message });
  }
});

async function startServer() {
  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'مسیر درخواستی یافت نشد.' });
  });

  app.use(
    (
      err: unknown,
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction
    ) => {
      console.error('Unhandled server error:', err);
      if (res.headersSent) return;
      res.status(500).json({ error: 'خطای داخلی سرور رخ داد. لطفاً دوباره امتحان کنید.' });
    }
  );

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  await ensureDatabaseSchema();

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Azmona server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
