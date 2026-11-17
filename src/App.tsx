/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertCircle, Loader2, Trash2 } from 'lucide-react';
import { ExamSheet } from './components/ExamSheet';
import {
  DIFFICULTIES,
  GRADES,
  SUBJECTS,
  getDifficultyLabel,
  getGradeLabel,
  getSubjectById,
  toPersianDigits,
} from './data/curriculum';
import type {
  ExamAnalysis,
  ExamConfig,
  ExamHistoryEntry,
  GeneratedExam,
  GradeId,
  SubjectId,
} from './types/exam';

const HISTORY_STORAGE_KEY = 'azmoona_exam_history_v1';

const DEFAULT_CONFIG: ExamConfig = {
  grade: '8',
  subjectId: 'science',
  lessonIds: ['sci-8-3'],
  allLessons: false,
  customTopic: '',
  questionCount: 5,
  difficulty: 'standard',
  timedMode: true,
};

function loadSavedHistory(): ExamHistoryEntry[] {
  try {
    const raw = window.localStorage.getItem(HISTORY_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export default function App() {
  const [config, setConfig] = useState<ExamConfig>(DEFAULT_CONFIG);
  const [timeSelection, setTimeSelection] = useState<string>('auto');

  const [isGenerating, setIsGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [activeExam, setActiveExam] = useState<GeneratedExam | null>(null);
  const [activeConfig, setActiveConfig] = useState<ExamConfig>(DEFAULT_CONFIG);

  const [history, setHistory] = useState<ExamHistoryEntry[]>(() => loadSavedHistory());
  const [currentResult, setCurrentResult] = useState<ExamHistoryEntry | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  const wheelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    try {
      window.localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(history.slice(0, 15)));
    } catch {
      // Ignore storage quota issues
    }
  }, [history]);

  // 3D drum / roller scroll effect matching attached template
  useEffect(() => {
    const wheel = wheelRef.current;
    if (!wheel) return;

    const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (calm) return;

    const panels = Array.from(wheel.querySelectorAll<HTMLElement>('.panel'));
    let cur = window.scrollY;
    let raf = 0;

    const roll = () => {
      raf = 0;
      const y = window.scrollY;
      cur += (y - cur) * 0.14;
      if (Math.abs(y - cur) < 0.4) cur = y;

      const mid = window.innerHeight / 2;
      const rad = window.innerHeight * 0.95;
      const dy = y - cur;

      for (const p of panels) {
        const h = p.offsetHeight;
        const vt = p.offsetTop - cur;
        if (h > window.innerHeight * 1.25 || p.classList.contains('tall')) {
          p.style.transform = `translateY(${dy}px)`;
          p.style.opacity = '';
          continue;
        }
        const off = vt + h / 2 - mid;
        const th = Math.max(-1.45, Math.min(1.45, off / rad));
        p.style.transformOrigin = `50% ${mid - vt}px`;
        p.style.transform = `translateY(${dy}px) perspective(1600px) translateZ(${-rad}px) rotateX(${-th}rad) translateZ(${rad}px) translateY(${-off}px)`;
        p.style.opacity = Math.max(0, 1 - Math.pow(Math.abs(th) / 1.3, 2.2)).toFixed(3);
      }

      if (cur !== y) {
        raf = window.requestAnimationFrame(roll);
      }
    };

    const kick = () => {
      if (!raf) raf = window.requestAnimationFrame(roll);
    };

    window.addEventListener('scroll', kick, { passive: true });
    window.addEventListener('resize', kick);
    if (document.fonts) {
      document.fonts.ready.then(kick).catch(() => {});
    }
    roll();

    return () => {
      window.removeEventListener('scroll', kick);
      window.removeEventListener('resize', kick);
      if (raf) window.cancelAnimationFrame(raf);
      for (const p of panels) {
        p.style.transform = '';
        p.style.opacity = '';
      }
    };
  }, [activeExam, currentResult]);

  const selectedSubject = getSubjectById(config.subjectId);
  const lessons = selectedSubject.lessonsByGrade[config.grade] ?? [];

  const handleGradeChange = (grade: GradeId) => {
    const newLessons = selectedSubject.lessonsByGrade[grade] ?? [];
    setConfig((prev) => ({
      ...prev,
      grade,
      lessonIds: newLessons[0] ? [newLessons[0].id] : [],
      allLessons: false,
    }));
  };

  const handleSubjectChange = (subjectId: SubjectId) => {
    const subj = getSubjectById(subjectId);
    const newLessons = subj.lessonsByGrade[config.grade] ?? [];
    setConfig((prev) => ({
      ...prev,
      subjectId,
      lessonIds: newLessons[0] ? [newLessons[0].id] : [],
      allLessons: false,
    }));
  };

  const handleToggleLesson = (lessonId: string) => {
    setConfig((prev) => {
      if (prev.allLessons) {
        return { ...prev, allLessons: false, lessonIds: [lessonId] };
      }
      const exists = prev.lessonIds.includes(lessonId);
      if (exists) {
        if (prev.lessonIds.length <= 1) return prev;
        return { ...prev, lessonIds: prev.lessonIds.filter((id) => id !== lessonId) };
      }
      return { ...prev, lessonIds: [...prev.lessonIds, lessonId] };
    });
  };

  const handleToggleAllLessons = () => {
    setConfig((prev) => ({
      ...prev,
      allLessons: !prev.allLessons,
      lessonIds: !prev.allLessons ? [] : lessons[0] ? [lessons[0].id] : [],
    }));
  };

  const handleGenerateExam = useCallback(
    async (overrideConfig?: ExamConfig) => {
      const targetConfig = overrideConfig ?? config;
      setGenerateError(null);
      setIsGenerating(true);
      setCurrentResult(null);

      try {
        const subject = getSubjectById(targetConfig.subjectId);
        const gradeLessons = subject.lessonsByGrade[targetConfig.grade] ?? [];
        const selectedLessons = gradeLessons.filter((l) =>
          targetConfig.lessonIds.includes(l.id)
        );

        const payload = {
          gradeLabel: getGradeLabel(targetConfig.grade),
          subjectName: subject.name,
          lessonTitles: selectedLessons.map(
            (l) => `درس ${toPersianDigits(l.number)}: ${l.title}`
          ),
          lessonTopics: selectedLessons.map((l) => l.topics),
          allLessons: targetConfig.allLessons,
          customTopic: targetConfig.customTopic,
          questionCount: targetConfig.questionCount,
          difficultyLabel: getDifficultyLabel(targetConfig.difficulty),
          difficultyId: targetConfig.difficulty,
        };

        const response = await fetch('/api/exam/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || 'خطا در تولید سوالات آزمون.');
        }

        setActiveExam(data as GeneratedExam);
        setActiveConfig(targetConfig);

        window.setTimeout(() => {
          document.getElementById('sheet')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 80);
      } catch (err) {
        setGenerateError(
          err instanceof Error ? err.message : 'مشکلی در ارتباط با سرور پیش آمد.'
        );
      } finally {
        setIsGenerating(false);
      }
    },
    [config]
  );

  const runAnalysisForResult = useCallback(async (entry: ExamHistoryEntry) => {
    setIsAnalyzing(true);
    setAnalysisError(null);

    try {
      const subject = getSubjectById(entry.config.subjectId);
      const gradeLessons = subject.lessonsByGrade[entry.config.grade] ?? [];
      const selectedLessons = gradeLessons.filter((l) =>
        entry.config.lessonIds.includes(l.id)
      );
      const lessonScope = entry.config.allLessons
        ? 'کل کتاب درسی'
        : selectedLessons.map((l) => `درس ${l.number}: ${l.title}`).join('، ');

      const correctTopics: string[] = [];
      const wrongItems = entry.questions
        .map((q, idx) => {
          const studentAns = entry.answers[q.id];
          if (studentAns === q.correctIndex) {
            correctTopics.push(q.topicTag);
            return null;
          }
          return {
            questionId: q.id,
            questionNumber: idx + 1,
            question: q.question,
            options: q.options,
            studentAnswerIndex: studentAns !== undefined ? studentAns : null,
            correctAnswerIndex: q.correctIndex,
            topicTag: q.topicTag,
          };
        })
        .filter((item): item is NonNullable<typeof item> => item !== null);

      const response = await fetch('/api/exam/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gradeLabel: getGradeLabel(entry.config.grade),
          subjectName: subject.name,
          lessonScope,
          totalQuestions: entry.questions.length,
          correctCount: entry.correctCount,
          wrongCount: entry.wrongCount,
          unansweredCount: entry.unansweredCount,
          scorePercent: entry.scorePercent,
          timeSpentSeconds: entry.timeSpentSeconds,
          correctTopics: Array.from(new Set(correctTopics)),
          wrongItems,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'خطا در تحلیل اشتباهات آزمون.');
      }

      const analysis = data as ExamAnalysis;
      const updatedEntry: ExamHistoryEntry = { ...entry, analysis };

      setCurrentResult(updatedEntry);
      setHistory((prev) =>
        prev.map((h) => (h.id === updatedEntry.id ? updatedEntry : h))
      );
    } catch (err) {
      setAnalysisError(
        err instanceof Error ? err.message : 'تحلیل هوشمند با خطا مواجه شد.'
      );
    } finally {
      setIsAnalyzing(false);
    }
  }, []);

  const handleSubmitExam = useCallback(
    (answers: Record<string, number>, timeSpentSeconds: number) => {
      if (!activeExam) return;

      let correctCount = 0;
      let wrongCount = 0;
      let unansweredCount = 0;

      for (const q of activeExam.questions) {
        const ans = answers[q.id];
        if (ans === undefined) {
          unansweredCount += 1;
        } else if (ans === q.correctIndex) {
          correctCount += 1;
        } else {
          wrongCount += 1;
        }
      }

      const total = activeExam.questions.length;
      const scorePercent = total > 0 ? Math.round((correctCount / total) * 100) : 0;
      const scoreOutOf20 =
        total > 0 ? Number(((correctCount / total) * 20).toFixed(1)) : 0;

      const entry: ExamHistoryEntry = {
        id: `exam-${Date.now()}`,
        createdAt: new Date().toISOString(),
        config: activeConfig,
        examTitle: activeExam.examTitle,
        questions: activeExam.questions,
        answers,
        timeSpentSeconds,
        correctCount,
        wrongCount,
        unansweredCount,
        scorePercent,
        scoreOutOf20,
      };

      setHistory((prev) => [entry, ...prev]);
      setCurrentResult(entry);

      window.setTimeout(() => {
        document.getElementById('sheet')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 60);

      void runAnalysisForResult(entry);
    },
    [activeExam, activeConfig, runAnalysisForResult]
  );

  const handlePracticeWeakTopics = useCallback(
    (weakTopics: string[]) => {
      if (!currentResult) return;
      const nextConfig: ExamConfig = {
        ...currentResult.config,
        questionCount: Math.min(10, Math.max(5, weakTopics.length * 2)),
        customTopic: `تمرکز ویژه بر رفع اشکال در: ${weakTopics.join('، ')}`,
      };
      setConfig(nextConfig);
      void handleGenerateExam(nextConfig);
    },
    [currentResult, handleGenerateExam]
  );

  const resolvedTimeLimitMinutes =
    timeSelection === 'none'
      ? null
      : timeSelection === 'auto'
        ? activeExam?.recommendedMinutes ?? Math.max(5, Math.ceil(config.questionCount * 1.2))
        : Number(timeSelection);

  return (
    <div ref={wheelRef} className="wheel" id="wheel">
      {/* Panel 1: Hero */}
      <section className="panel" id="top">
        <h1 className="hero-title">
          آزمون‌ساز<span>هفتم تا نهم</span>
        </h1>
        <p className="mt-7 max-w-[34rem] text-base leading-relaxed text-[#8a8a8a] sm:text-lg">
          درس و فصل را انتخاب کن، تعداد سؤال را مشخص کن و در چند ثانیه آزمون چهارگزینه‌ای هوش مصنوعی بساز؛ در پایان هم تمام غلط‌هایت را دقیق یاد بگیر.
        </p>

        <div className="mt-10 flex flex-wrap items-center gap-6">
          <div className="flex items-center gap-3 text-sm text-[#8a8a8a]">
            <i className="block h-10 w-px bg-gradient-to-b from-white to-transparent" />
            <span>اسکرول کن</span>
          </div>

          <a
            href="#builder"
            className="min-h-[40px] rounded-full border border-[#2e2e2e] bg-[#0e0e0e] px-5 py-2 text-xs font-semibold text-white transition-colors hover:border-white"
          >
            رفتن مستقیم به ساخت آزمون ↓
          </a>
        </div>
      </section>

      {/* Panel 2: Features Rows */}
      <section className="panel">
        <h2 className="panel-heading">مخصوص دانش‌آموز</h2>
        <div className="max-w-[46rem]">
          <div className="flex flex-col gap-1 border-t border-[#2e2e2e] py-5 sm:flex-row sm:gap-6">
            <b className="font-display min-w-[9rem] text-xl text-white">سه پایه</b>
            <span className="text-[#8a8a8a]">
              سؤال‌های چهارگزینه‌ای بر اساس کتاب‌های رسمی هفتم، هشتم و نهم طراحی می‌شوند.
            </span>
          </div>
          <div className="flex flex-col gap-1 border-t border-[#2e2e2e] py-5 sm:flex-row sm:gap-6">
            <b className="font-display min-w-[9rem] text-xl text-white">انتخاب فصل</b>
            <span className="text-[#8a8a8a]">
              فقط فصل‌هایی را که خوانده‌ای انتخاب کن؛ یک درس، چند فصل یا کل کتاب.
            </span>
          </div>
          <div className="flex flex-col gap-1 border-t border-[#2e2e2e] py-5 sm:flex-row sm:gap-6">
            <b className="font-display min-w-[9rem] text-xl text-white">سطح دلخواه</b>
            <span className="text-[#8a8a8a]">
              از آسان تا چالشی؛ مدت آزمون را هم خودت تعیین می‌کنی.
            </span>
          </div>
          <div className="flex flex-col gap-1 border-y border-[#2e2e2e] py-5 sm:flex-row sm:gap-6">
            <b className="font-display min-w-[9rem] text-xl text-white">تحلیل غلط‌ها</b>
            <span className="text-[#8a8a8a]">
              برگه را روی صفحه حل یا چاپ کن؛ هوش مصنوعی اشتباهاتت را دانه به دانه توضیح می‌دهد.
            </span>
          </div>
        </div>
      </section>

      {/* Panel 3: 3 Steps */}
      <section className="panel">
        <h2 className="panel-heading">سه قدم تا آزمون</h2>
        <div className="grid max-w-[60rem] grid-cols-1 border border-[#2e2e2e] sm:grid-cols-3">
          <div className="bg-[#0e0e0e] p-6">
            <b className="font-display mb-1 block text-xl text-white">پایه و درس</b>
            <span className="text-sm text-[#8a8a8a]">هفتم، هشتم یا نهم و درس موردنظر</span>
          </div>
          <div className="border-t border-[#2e2e2e] bg-[#0e0e0e] p-6 sm:border-t-0 sm:border-r">
            <b className="font-display mb-1 block text-xl text-white">فصل‌ها</b>
            <span className="text-sm text-[#8a8a8a]">یک درس خاص یا چند فصل برای مرور</span>
          </div>
          <div className="border-t border-[#2e2e2e] bg-[#0e0e0e] p-6 sm:border-t-0 sm:border-r">
            <b className="font-display mb-1 block text-xl text-white">آزمون و تحلیل</b>
            <span className="text-sm text-[#8a8a8a]">حل چهارگزینه‌ای و توضیح کامل غلط‌ها</span>
          </div>
        </div>
      </section>

      {/* Panel 4: Builder + Interactive Exam Sheet */}
      <section
        className="panel tall bg-gradient-to-b from-black to-[#0b0b0b]"
        id="builder"
      >
        <h2 className="panel-heading">ساخت آزمون</h2>

        <div className="max-w-[62rem] rounded-[6px] border border-[#2e2e2e] bg-[#0e0e0e] p-5 sm:p-9">
          {/* Grade */}
          <div className="mb-6">
            <label className="mb-2.5 block text-sm text-[#8a8a8a]">پایه</label>
            <div className="flex flex-wrap gap-2">
              {GRADES.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  aria-pressed={config.grade === g.id}
                  onClick={() => handleGradeChange(g.id)}
                  className="chip"
                >
                  پایه‌ی {g.shortLabel}
                </button>
              ))}
            </div>
          </div>

          {/* Subject */}
          <div className="mb-6">
            <label className="mb-2.5 block text-sm text-[#8a8a8a]">درس</label>
            <div className="flex flex-wrap gap-2">
              {SUBJECTS.map((subj) => (
                <button
                  key={subj.id}
                  type="button"
                  aria-pressed={config.subjectId === subj.id}
                  onClick={() => handleSubjectChange(subj.id)}
                  className="chip"
                >
                  {subj.name}
                </button>
              ))}
            </div>
          </div>

          {/* Chapters */}
          <div className="mb-6">
            <label className="mb-2.5 block text-sm text-[#8a8a8a]">
              فصل‌ها (می‌توانی یک درس یا چند فصل انتخاب کنی)
            </label>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                aria-pressed={config.allLessons}
                onClick={handleToggleAllLessons}
                className="chip"
              >
                همه فصل‌ها
              </button>
              {lessons.map((lesson) => {
                const pressed = !config.allLessons && config.lessonIds.includes(lesson.id);
                return (
                  <button
                    key={lesson.id}
                    type="button"
                    aria-pressed={pressed}
                    onClick={() => handleToggleLesson(lesson.id)}
                    className="chip text-xs sm:text-sm"
                  >
                    درس {toPersianDigits(lesson.number)}: {lesson.title}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Count & Time */}
          <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="count-select" className="mb-2 block text-sm text-[#8a8a8a]">
                تعداد سؤال
              </label>
              <select
                id="count-select"
                value={config.questionCount}
                onChange={(e) =>
                  setConfig((prev) => ({
                    ...prev,
                    questionCount: Number(e.target.value),
                  }))
                }
                className="mono-select min-h-[44px] w-full rounded-[6px] border border-[#2e2e2e] bg-[#1a1a1a] px-3 py-2 text-[#e6e6e6]"
              >
                <option value={5}>۵ سؤال</option>
                <option value={10}>۱۰ سؤال</option>
                <option value={15}>۱۵ سؤال</option>
                <option value={20}>۲۰ سؤال</option>
              </select>
            </div>

            <div>
              <label htmlFor="time-select" className="mb-2 block text-sm text-[#8a8a8a]">
                زمان آزمون
              </label>
              <select
                id="time-select"
                value={timeSelection}
                onChange={(e) => {
                  const val = e.target.value;
                  setTimeSelection(val);
                  setConfig((prev) => ({ ...prev, timedMode: val !== 'none' }));
                }}
                className="mono-select min-h-[44px] w-full rounded-[6px] border border-[#2e2e2e] bg-[#1a1a1a] px-3 py-2 text-[#e6e6e6]"
              >
                <option value="auto">خودکار (متناسب با تعداد سؤال)</option>
                <option value="15">۱۵ دقیقه</option>
                <option value="30">۳۰ دقیقه</option>
                <option value="45">۴۵ دقیقه</option>
                <option value="none">بدون محدودیت زمان</option>
              </select>
            </div>
          </div>

          {/* Level */}
          <div className="mb-6">
            <label className="mb-2.5 block text-sm text-[#8a8a8a]">سطح</label>
            <div className="flex flex-wrap gap-2">
              {DIFFICULTIES.map((diff) => {
                const label =
                  diff.id === 'easy' ? 'آسان' : diff.id === 'standard' ? 'متوسط' : 'چالشی';
                return (
                  <button
                    key={diff.id}
                    type="button"
                    aria-pressed={config.difficulty === diff.id}
                    onClick={() => setConfig((prev) => ({ ...prev, difficulty: diff.id }))}
                    className="chip"
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Optional custom focus */}
          <div className="mb-6">
            <label htmlFor="custom-topic-input" className="mb-2 block text-sm text-[#8a8a8a]">
              تمرکز ویژه (اختیاری)
            </label>
            <input
              id="custom-topic-input"
              type="text"
              value={config.customTopic}
              onChange={(e) =>
                setConfig((prev) => ({ ...prev, customTopic: e.target.value }))
              }
              placeholder="مثلاً: فقط عدد اتمی و ایزوتوپ‌ها یا معادله‌های کسری"
              className="mono-input min-h-[44px] w-full rounded-[6px] border border-[#2e2e2e] bg-[#1a1a1a] px-3.5 py-2 text-sm text-[#e6e6e6] placeholder:text-[#666]"
            />
          </div>

          {generateError && (
            <div
              role="alert"
              className="mb-5 flex items-start gap-2 rounded-[6px] border border-rose-500/40 bg-rose-500/10 p-3 text-xs text-rose-300"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{generateError}</span>
            </div>
          )}

          <button
            type="button"
            disabled={isGenerating}
            onClick={() => handleGenerateExam()}
            className="go flex min-h-[52px] w-full items-center justify-center gap-2 rounded-[6px] bg-white p-3.5 text-base font-extrabold text-black transition-transform active:scale-[0.99] disabled:opacity-60"
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                <span>در حال ساخت آزمون با هوش مصنوعی...</span>
              </>
            ) : (
              <span>بساز آزمون</span>
            )}
          </button>
        </div>

        {/* Light Paper Exam Sheet + Results & Mistake Analysis */}
        <ExamSheet
          exam={activeExam}
          config={activeConfig}
          result={currentResult}
          timeLimitMinutes={resolvedTimeLimitMinutes}
          isAnalyzing={isAnalyzing}
          analysisError={analysisError}
          onSubmitExam={handleSubmitExam}
          onRetryAnalysis={() => currentResult && runAnalysisForResult(currentResult)}
          onPracticeWeakTopics={handlePracticeWeakTopics}
          onResetToNew={() => {
            setActiveExam(null);
            setCurrentResult(null);
            document.getElementById('builder')?.scrollIntoView({ behavior: 'smooth' });
          }}
        />

        {/* Minimal History */}
        {history.length > 0 && (
          <div className="mt-12 max-w-[62rem] border-t border-[#2e2e2e] pt-8">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-display text-2xl text-white">کارنامه‌های قبلی</h3>
              <button
                type="button"
                onClick={() => setHistory([])}
                className="inline-flex items-center gap-1.5 text-xs text-[#8a8a8a] hover:text-white"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>پاک کردن</span>
              </button>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {history.map((entry) => (
                <button
                  key={entry.id}
                  type="button"
                  onClick={() => {
                    setActiveExam(null);
                    setCurrentResult(entry);
                    if (!entry.analysis) {
                      void runAnalysisForResult(entry);
                    }
                    window.setTimeout(() => {
                      document.getElementById('sheet')?.scrollIntoView({ behavior: 'smooth' });
                    }, 60);
                  }}
                  className="flex items-center justify-between gap-4 rounded-[6px] border border-[#2e2e2e] bg-[#0e0e0e] p-4 text-right transition-colors hover:border-[#666]"
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-bold text-white">
                      {entry.examTitle}
                    </div>
                    <div className="mt-0.5 text-xs text-[#8a8a8a]">
                      {getGradeLabel(entry.config.grade)} · {getSubjectById(entry.config.subjectId).name}
                    </div>
                  </div>
                  <div className="shrink-0 text-left text-xs font-bold text-white tabular-nums">
                    {toPersianDigits(entry.scoreOutOf20)} از ۲۰
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </section>

      <footer className="px-[7vw] py-10 text-xs text-[#8a8a8a]">
        آزمونا · آزمون‌ساز هوشمند هفتم تا نهم با تحلیل پاسخ‌های غلط
      </footer>
    </div>
  );
}
