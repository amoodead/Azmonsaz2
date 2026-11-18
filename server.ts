import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';
import {
  clearUserExamsInDb,
  getUserExamsFromDb,
  loginEmailUser,
  registerEmailUser,
  saveUserExamToDb,
} from './src/db/users.ts';
import { requireAuth, type AuthRequest } from './src/middleware/auth.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json({ limit: '2mb' }));

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
  runner: (model: string, thinkingLevel: ThinkingLevel) => Promise<T>
): Promise<T> {
  const attempts: Array<{ model: string; thinking: ThinkingLevel; delayBeforeMs: number }> = [
    { model: 'gemini-3.1-flash-lite', thinking: ThinkingLevel.MINIMAL, delayBeforeMs: 0 },
    { model: 'gemini-4-hydrogen', thinking: ThinkingLevel.LOW, delayBeforeMs: 350 },
    { model: 'gemini-3.1-flash-lite', thinking: ThinkingLevel.MINIMAL, delayBeforeMs: 900 },
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

app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password, confirmPassword } = req.body as {
      email?: string;
      password?: string;
      confirmPassword?: string;
    };

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return res.status(400).json({ error: 'لطفاً یک ایمیل معتبر وارد کنید.' });
    }
    if (!password || password.length < 6) {
      return res.status(400).json({ error: 'رمز عبور باید حداقل ۶ کاراکتر باشد.' });
    }
    if (password !== confirmPassword) {
      return res.status(400).json({ error: 'رمز عبور و تکرار آن یکسان نیستند.' });
    }

    const result = await registerEmailUser(email, password);
    res.status(201).json(result);
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'خطا در ساخت حساب کاربری.' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body as { email?: string; password?: string };
    if (!email || !password) {
      return res.status(400).json({ error: 'ایمیل و رمز عبور را وارد کنید.' });
    }
    const result = await loginEmailUser(email, password);
    res.json(result);
  } catch (err) {
    res.status(401).json({ error: err instanceof Error ? err.message : 'ورود ناموفق بود.' });
  }
});

app.get('/api/auth/me', requireAuth, (req: AuthRequest, res) => {
  res.json({ user: { id: req.authUser!.uid, email: req.authUser!.email } });
});

app.get('/api/user/exams', requireAuth, async (req: AuthRequest, res) => {
  try {
    const exams = await getUserExamsFromDb(req.authUser!.uid);
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
    await clearUserExamsInDb(req.authUser!.uid);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'خطا در پاک کردن کارنامه‌ها.' });
  }
});

// --- Fast, Fresh, Non-Repetitive Exam Generation & Analysis Routes ---

const QUESTION_STYLE_POOLS = [
  'موقعیت واقعی و زندگی روزمره، سناریوی آزمایشگاهی کوتاه و نتیجه‌گیری مفهومی',
  'مقایسه مفاهیم هم‌خانواده، پیدا کردن گزینه نادرست (کدام گزینه درست نیست؟) و تله‌های امتحانی هوشمند',
  'سؤال‌های ترکیبی از چند نکته فصل، تحلیل رابطه علت و معلول و استدلال مرحله‌ای',
  'مسئله‌های کاربردی، تشخیص اشتباه رایج دانش‌آموزان و مثال‌های خلاقانه شبیه آزمون‌های تیزهوشان و سمپاد',
];

interface GenerateExamBody {
  gradeLabel: string;
  subjectName: string;
  lessonTitles: string[];
  lessonTopics: string[];
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
        ? `مباحث گسترده: ${body.lessonTopics.join('؛ ')}`
        : '';

    const customFocusText = body.customTopic?.trim()
      ? `تمرکز ویژه: ${body.customTopic.trim()}`
      : '';

    const difficultyGuidance =
      body.difficultyId === 'easy'
        ? 'آسان و مروری (ولی جذاب و غیرکلیشه‌ای)'
        : body.difficultyId === 'advanced'
          ? 'چالشی، نکته‌دار و سبک تیزهوشان/سمپاد'
          : 'استاندارد امتحانی با رگه‌هایی از خلاقیت و درک عمیق';

    const seed = Number(body.variationSeed) || Date.now();
    const angleStyle = QUESTION_STYLE_POOLS[seed % QUESTION_STYLE_POOLS.length];
    const recentBlock =
      Array.isArray(body.recentQuestions) && body.recentQuestions.length > 0
        ? `سؤال‌های تکراری زیر را به هیچ وجه تکرار نکن و موضوع/مثال جدید بساز:\n- ${body.recentQuestions
            .slice(0, 12)
            .map((q) => q.slice(0, 90))
            .join('\n- ')}`
        : '';

    const prompt = `
دقیقاً ${count} سؤال چهارگزینه‌ای تازه، استاندارد و خلاقانه از منابع بزرگ و کتاب درسی رسمی ایران طراحی کن:
پایه: ${body.gradeLabel} | درس: ${body.subjectName} | محدوده: ${scopeText}
سطح: ${difficultyGuidance} | سبک غالب این نوبت: ${angleStyle} | کد تنوع: ${seed % 997}
${topicsContext}
${customFocusText}
${recentBlock}

قوانین طراحی:
- کاملاً منطبق بر سرفصل کتاب درسی ${body.gradeLabel} ایران، اما با مثال‌ها، سناریوها و عددهای تازه و متنوع (تکراری و کلیشه‌ای نباشد).
- سؤالات حس آزمون حرفه‌ای داشته باشند (ترکیبی از مفهومی، موقعیت کاربردی و تله امتحانی ظریف).
- ۴ گزینه کوتاه، هم‌وزن و بدون حروف الف/ب/ج/د.
- جایگاه پاسخ درست (correctIndex از ۰ تا ۳) بین سؤالات پخش باشد.
- hint و quickExplanation هر کدام حداکثر ۱ جمله کوتاه و دقیق باشد.
`;

    const response = await generateFastWithFailover((model, thinkingLevel) =>
      ai.models.generateContent({
        model,
        contents: prompt,
        config: {
          thinkingConfig: { thinkingLevel },
          systemInstruction:
            'طراح خلاق و حرفه‌ای بانک سؤالات آزمون دوره اول متوسطه ایران (هفتم تا نهم). سؤال‌های تازه، رگ‌دار، علمی، دقیق و به فارسی روان بساز.',
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
      })
    );

    const rawText = (response.text ?? '{}').trim();
    const parsed = JSON.parse(rawText);

    if (!parsed || !Array.isArray(parsed.questions) || parsed.questions.length === 0) {
      throw new Error('ساختار سؤالات دریافتی کامل نبود. لطفاً دوباره امتحان کنید.');
    }

    const sanitizedQuestions = parsed.questions
      .slice(0, count)
      .map((q: Record<string, unknown>, index: number) => {
        const rawOptions = Array.isArray(q.options) ? q.options.map((o) => String(o)) : [];
        while (rawOptions.length < 4) {
          rawOptions.push('هیچ‌کدام');
        }
        const options = rawOptions.slice(0, 4) as [string, string, string, string];
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

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Azmona server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
