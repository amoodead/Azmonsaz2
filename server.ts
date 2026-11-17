import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';

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

async function withRetry<T>(fn: () => Promise<T>, maxRetries = 2): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt < maxRetries) {
        const delayMs = 400 * Math.pow(2, attempt);
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }
  throw lastError;
}

function mapGeminiError(error: unknown): { status: number; message: string } {
  const raw = error instanceof Error ? error.message : String(error);
  const lower = raw.toLowerCase();

  if (lower.includes('api_key_invalid') || lower.includes('permission_denied') || lower.includes('403') || lower.includes('401')) {
    return {
      status: 401,
      message: 'کلید دسترسی هوش مصنوعی معتبر نیست یا مجوز ندارد. لطفاً کلید را در بخش Settings > Secrets بررسی کنید.',
    };
  }
  if (lower.includes('resource_exhausted') || lower.includes('429')) {
    return {
      status: 429,
      message: 'سقف درخواست‌های هم‌زمان هوش مصنوعی موقتاً پر شده است. لطفاً چند ثانیه دیگر دوباره تلاش کنید.',
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
}

app.post('/api/exam/generate', async (req, res) => {
  try {
    const body = req.body as GenerateExamBody;
    const count = Math.min(25, Math.max(3, Number(body.questionCount) || 5));

    if (!body.gradeLabel || !body.subjectName || (!body.allLessons && (!body.lessonTitles || body.lessonTitles.length === 0))) {
      return res.status(400).json({ error: 'لطفاً پایه، درس و حداقل یک فصل را انتخاب کنید.' });
    }

    const ai = getGeminiClient();

    const scopeText = body.allLessons
      ? `کل کتاب درسی ${body.subjectName} ${body.gradeLabel}`
      : `فصل‌ها / درس‌های انتخاب‌شده: ${body.lessonTitles.join('، ')}`;

    const topicsContext =
      body.lessonTopics && body.lessonTopics.length > 0
        ? `مباحث کلیدی کتاب درسی: ${body.lessonTopics.join('؛ ')}`
        : '';

    const customFocusText = body.customTopic?.trim()
      ? `تمرکز ویژه دانش‌آموز: «${body.customTopic.trim()}»`
      : '';

    const difficultyGuidance =
      body.difficultyId === 'easy'
        ? 'سطح آسان و مروری: سوالات مستقیم برای تثبیت مفاهیم پایه کتاب.'
        : body.difficultyId === 'advanced'
          ? 'سطح پیشرفته و تیزهوشان: سوالات مفهومی و ترکیبی دقیق در چارچوب کتاب.'
          : 'سطح استاندارد امتحانی: متعادل و مطابق امتحانات مدرسه.';

    const prompt = `
دقیقاً ${count} سوال چهارگزینه‌ای استاندارد از کتاب درسی رسمی ایران طراحی کن:
- پایه: ${body.gradeLabel}
- درس: ${body.subjectName}
- محدوده: ${scopeText}
${topicsContext}
${customFocusText}
- سطح: ${body.difficultyLabel} (${difficultyGuidance})

قوانین:
1. کاملاً منطبق بر سرفصل کتاب درسی ${body.gradeLabel} ایران باشد.
2. هر سوال دقیقاً ۴ گزینه کوتاه و دقیق بدون پیشوند الف/ب/ج/د داشته باشد.
3. گزینه‌های غلط طبیعی و آموزشی باشند و جایگاه correctIndex (۰ تا ۳) بین سوالات پخش باشد.
4. hint کوتاه (۱ جمله) و quickExplanation مختصر و روشن بنویس.
`;

    const response = await withRetry(() =>
      ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: prompt,
        config: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          systemInstruction:
            'طراح سریع و دقیق سوالات استاندارد دوره اول متوسطه (هفتم، هشتم، نهم) در نظام آموزشی ایران هستی. کوتاه، دقیق، علمی و به فارسی روان بنویس.',
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              examTitle: {
                type: Type.STRING,
                description: 'عنوان کوتاه فارسی برای آزمون',
              },
              subtitle: {
                type: Type.STRING,
                description: 'توضیح کوتاه یک‌خطی',
              },
              recommendedMinutes: {
                type: Type.INTEGER,
                description: 'زمان پیشنهادی به دقیقه',
              },
              questions: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    id: { type: Type.STRING },
                    question: { type: Type.STRING },
                    options: {
                      type: Type.ARRAY,
                      items: { type: Type.STRING },
                    },
                    correctIndex: { type: Type.INTEGER },
                    topicTag: { type: Type.STRING },
                    difficultyLabel: { type: Type.STRING },
                    hint: { type: Type.STRING },
                    quickExplanation: { type: Type.STRING },
                  },
                  required: [
                    'id',
                    'question',
                    'options',
                    'correctIndex',
                    'topicTag',
                    'difficultyLabel',
                    'hint',
                    'quickExplanation',
                  ],
                },
              },
            },
            required: ['examTitle', 'subtitle', 'recommendedMinutes', 'questions'],
          },
        },
      })
    );

    const rawText = (response.text ?? '{}').trim();
    const parsed = JSON.parse(rawText);

    if (!parsed || !Array.isArray(parsed.questions) || parsed.questions.length === 0) {
      throw new Error('ساختار سوالات دریافتی از هوش مصنوعی کامل نبود. لطفاً دوباره امتحان کنید.');
    }

    const sanitizedQuestions = parsed.questions.slice(0, count).map((q: Record<string, unknown>, index: number) => {
      const rawOptions = Array.isArray(q.options) ? q.options.map((o) => String(o)) : [];
      while (rawOptions.length < 4) {
        rawOptions.push('هیچ‌کدام');
      }
      const options = rawOptions.slice(0, 4) as [string, string, string, string];
      const rawIndex = Number(q.correctIndex);
      const correctIndex = Number.isInteger(rawIndex) && rawIndex >= 0 && rawIndex <= 3 ? rawIndex : 0;

      return {
        id: String(q.id || `q-${index + 1}`),
        question: String(q.question || ''),
        options,
        correctIndex,
        topicTag: String(q.topicTag || body.subjectName),
        difficultyLabel: String(q.difficultyLabel || body.difficultyLabel),
        hint: String(q.hint || 'به تعریف اصلی کتاب درسی در این بخش دقت کن.'),
        quickExplanation: String(q.quickExplanation || ''),
      };
    });

    res.json({
      examTitle: String(parsed.examTitle || `آزمون ${body.subjectName} ${body.gradeLabel}`),
      subtitle: String(parsed.subtitle || scopeText),
      recommendedMinutes: Number(parsed.recommendedMinutes) || Math.max(5, Math.ceil(sanitizedQuestions.length * 1.2)),
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

app.post('/api/exam/analyze', async (req, res) => {
  try {
    const body = req.body as AnalyzeExamBody;
    const ai = getGeminiClient();

    const wrongItemsSummary = (body.wrongItems || [])
      .map((item) => {
        const studentChoiceText =
          item.studentAnswerIndex !== null && item.studentAnswerIndex >= 0 && item.studentAnswerIndex < 4
            ? `گزینه ${item.studentAnswerIndex + 1}: «${item.options[item.studentAnswerIndex]}»`
            : 'بدون پاسخ (نزده)';
        const correctChoiceText = `گزینه ${item.correctAnswerIndex + 1}: «${item.options[item.correctAnswerIndex]}»`;

        return `
سوال شماره ${item.questionNumber} (شناسه: ${item.questionId} | مبحث: ${item.topicTag}):
متن سوال: ${item.question}
انتخاب دانش‌آموز: ${studentChoiceText}
پاسخ صحیح: ${correctChoiceText}
`;
      })
      .join('\n---\n');

    const prompt = `
یک دانش‌آموز ${body.gradeLabel} در درس ${body.subjectName} (${body.lessonScope}) آزمونی با ${body.totalQuestions} سوال داده است.
نتیجه آزمون:
- تعداد پاسخ صحیح: ${body.correctCount}
- تعداد پاسخ غلط: ${body.wrongCount}
- تعداد سوالات نزده: ${body.unansweredCount}
- درصد نمره: ${body.scorePercent}٪
- موضوعاتی که دانش‌آموز درست پاسخ داده: ${body.correctTopics.length > 0 ? body.correctTopics.join('، ') : 'ثبت نشده'}

فهرست سوالات غلط یا بدون پاسخ دانش‌آموز:
${wrongItemsSummary || 'دانش‌آموز به تمام سوالات پاسخ صحیح داده است!'}

وظیفه تو به عنوان معلم و مشاور دلسوز همین پایه تحصیلی:
1. یک جمع‌بندی دقیق، محترمانه و انگیزه‌بخش درباره عملکرد کلی دانش‌آموز بنویس (overallSummary).
2. نقاط قوت (strengthTopics) و مباحث نیازمند مرور (weakTopics) را فهرست کن.
3. ۳ تا ۴ توصیه مطالعاتی عملی و مشخص متناسب با کتاب درسی ${body.subjectName} ${body.gradeLabel} بنویس (studyRecommendations).
4. برای تک‌تک سوالات غلط یا نزده موجود در فهرست بالا، یک تحلیل اختصاصی در wrongBreakdowns بساز که شامل موارد زیر باشد:
   - questionId و questionNumber دقیقاً مطابق سوال
   - wasUnanswered: true اگر نزده بوده و false اگر گزینه غلط انتخاب کرده
   - misconceptionReason: نام کوتاه خطای ذهنی یا سوءبرداشت (مثلاً «جابه‌جایی عدد اتمی و عدد جرمی» یا «بی‌دقتی در علامت منفی»)
   - whyWrongSelected: توضیح دقیق اینکه چرا گزینه‌ای که دانش‌آموز انتخاب کرده غلط بوده و معمولاً چرا بچه‌ها به اشتباه آن را می‌زنند (یا اگر نزده، نکته شروع حل سوال چیست)
   - correctConceptExplanation: آموزش ساده، مرحله‌به‌مرحله و قابل فهم مفهوم اصلی و روش رسیدن به جواب درست برای دانش‌آموز نوجوان
   - keyTakeaway: یک «نکته طلایی» کوتاه و به‌یادماندنی برای اینکه دیگر این اشتباه را تکرار نکند.
`;

    const response = await withRetry(() =>
      ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: prompt,
        config: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          systemInstruction:
            'معلم دلسوز و دقیق دوره اول متوسطه در ایران هستی. اشتباهات دانش‌آموز را کوتاه، روشن، صمیمی و آموزشی ریشه‌یابی کن.',
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              overallSummary: { type: Type.STRING },
              strengthTopics: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
              weakTopics: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
              studyRecommendations: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
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
            required: ['overallSummary', 'strengthTopics', 'weakTopics', 'studyRecommendations', 'wrongBreakdowns'],
          },
        },
      })
    );

    const rawText = (response.text ?? '{}').trim();
    const parsed = JSON.parse(rawText);

    res.json({
      overallSummary: String(parsed.overallSummary || ''),
      strengthTopics: Array.isArray(parsed.strengthTopics) ? parsed.strengthTopics.map(String) : [],
      weakTopics: Array.isArray(parsed.weakTopics) ? parsed.weakTopics.map(String) : [],
      studyRecommendations: Array.isArray(parsed.studyRecommendations) ? parsed.studyRecommendations.map(String) : [],
      wrongBreakdowns: Array.isArray(parsed.wrongBreakdowns) ? parsed.wrongBreakdowns : [],
    });
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
    console.log(`Azmoona server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
