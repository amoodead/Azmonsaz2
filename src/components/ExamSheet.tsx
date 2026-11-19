import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Download,
  HelpCircle,
  Lightbulb,
  Loader2,
  RefreshCw,
  RotateCcw,
  Target,
  XCircle,
} from 'lucide-react';
import {
  OPTION_LETTERS,
  formatDurationPersian,
  getDifficultyLabel,
  getGradeLabel,
  getSubjectById,
  toPersianDigits,
} from '../data/curriculum';
import { downloadExamAsPdf } from '../utils/pdfExport';
import { parseStructuredQuestion, segmentExamText } from '../utils/mathText';
import type {
  ExamAnalysis,
  ExamConfig,
  ExamHistoryEntry,
  GeneratedExam,
} from '../types/exam';

function FormattedText({ text }: { text: string }) {
  const segments = segmentExamText(text);
  return (
    <>
      {segments.map((seg, i) => {
        if (seg.kind === 'math') {
          return (
            <span key={i} dir="ltr" className="math-token">
              {seg.text}
            </span>
          );
        }
        if (seg.kind === 'latin') {
          return (
            <span key={i} dir="ltr" className="latin-token">
              {seg.text}
            </span>
          );
        }
        return <React.Fragment key={i}>{seg.text}</React.Fragment>;
      })}
    </>
  );
}

function FormattedQuestion({ text }: { text: string }) {
  const parsed = parseStructuredQuestion(text);
  if (parsed.items.length === 0) {
    return (
      <p className="mb-4 whitespace-pre-line text-[15px] font-bold leading-8 text-[#111] sm:text-[17px]">
        <FormattedText text={text} />
      </p>
    );
  }

  return (
    <div className="mb-4 space-y-2.5">
      {parsed.intro && (
        <p className="whitespace-pre-line text-[15px] font-bold leading-8 text-[#111] sm:text-[17px]">
          <FormattedText text={parsed.intro} />
        </p>
      )}
      <ul className="space-y-2 rounded-[6px] border border-[#e3e3e3] bg-[#f8f8f8] p-3 sm:p-3.5">
        {parsed.items.map((item, idx) => (
          <li
            key={idx}
            className="flex items-start gap-2.5 text-[14px] font-medium leading-7 text-[#1a1a1a] sm:text-[15.5px]"
          >
            <span className="mt-0.5 inline-flex min-w-[1.85rem] shrink-0 items-center justify-center rounded bg-[#e8e8e8] px-1.5 py-0.5 text-xs font-extrabold text-[#111]">
              {item.label}
            </span>
            <span className="flex-1 whitespace-pre-line">
              <FormattedText text={item.text} />
            </span>
          </li>
        ))}
      </ul>
      {parsed.outro && (
        <p className="whitespace-pre-line text-[15px] font-bold leading-8 text-[#111] sm:text-[17px]">
          <FormattedText text={parsed.outro} />
        </p>
      )}
    </div>
  );
}

interface ExamSheetProps {
  exam: GeneratedExam | null;
  config: ExamConfig;
  result: ExamHistoryEntry | null;
  timeLimitMinutes: number | null;
  initialAnswers?: Record<string, number>;
  initialElapsedSeconds?: number;
  onDraftChange?: (answers: Record<string, number>, elapsedSeconds: number) => void;
  isAnalyzing: boolean;
  analysisError: string | null;
  onSubmitExam: (answers: Record<string, number>, timeSpentSeconds: number) => void;
  onRetryAnalysis: () => void;
  onPracticeWeakTopics: (weakTopics: string[]) => void;
  onResetToNew: () => void;
}

export const ExamSheet: React.FC<ExamSheetProps> = ({
  exam,
  config,
  result,
  timeLimitMinutes,
  initialAnswers = {},
  initialElapsedSeconds = 0,
  onDraftChange,
  isAnalyzing,
  analysisError,
  onSubmitExam,
  onRetryAnalysis,
  onPracticeWeakTopics,
  onResetToNew,
}) => {
  const [answers, setAnswers] = useState<Record<string, number>>(initialAnswers);
  const [revealedHints, setRevealedHints] = useState<Record<string, boolean>>({});
  const [elapsedSeconds, setElapsedSeconds] = useState(initialElapsedSeconds);
  const [filterTab, setFilterTab] = useState<'mistakes' | 'all'>('mistakes');
  const [isExportingPdf, setIsExportingPdf] = useState(false);

  const onDraftChangeRef = React.useRef(onDraftChange);
  onDraftChangeRef.current = onDraftChange;

  useEffect(() => {
    if (!exam || result) return;
    onDraftChangeRef.current?.(answers, elapsedSeconds);
  }, [exam, result, answers, elapsedSeconds]);

  useEffect(() => {
    if (!exam || result) return;
    const timer = window.setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [exam, result]);

  useEffect(() => {
    if (!exam || result || !timeLimitMinutes) return;
    const limitSec = timeLimitMinutes * 60;
    if (elapsedSeconds >= limitSec) {
      onSubmitExam(answers, limitSec);
    }
  }, [exam, result, timeLimitMinutes, elapsedSeconds, answers, onSubmitExam]);

  if (!exam && !result) return null;

  const subject = getSubjectById(result ? result.config.subjectId : config.subjectId);
  const activeGrade = result ? result.config.grade : config.grade;
  const activeDifficulty = result ? result.config.difficulty : config.difficulty;
  const questions = result ? result.questions : exam!.questions;
  const examTitle = result ? result.examTitle : exam!.examTitle;

  const answeredCount = Object.keys(answers).length;
  const totalCount = questions.length;
  const remainingSeconds =
    timeLimitMinutes !== null ? Math.max(0, timeLimitMinutes * 60 - elapsedSeconds) : null;

  const lessons = subject.lessonsByGrade[activeGrade] ?? [];
  const selectedLessonsText = (result ? result.config.allLessons : config.allLessons)
    ? 'همه فصل‌ها'
    : lessons
        .filter((l) => (result ? result.config.lessonIds : config.lessonIds).includes(l.id))
        .map((l) => `فصل ${toPersianDigits(l.number)}`)
        .join('، ');

  const analysis: ExamAnalysis | undefined = result?.analysis;

  const visibleQuestions = result
    ? questions
        .map((q, idx) => ({ q, number: idx + 1 }))
        .filter(({ q }) => {
          if (filterTab === 'all') return true;
          return result.answers[q.id] !== q.correctIndex;
        })
    : questions.map((q, idx) => ({ q, number: idx + 1 }));

  const handleDownloadPdf = async () => {
    setIsExportingPdf(true);
    try {
      await downloadExamAsPdf({ exam, config, result });
    } finally {
      setIsExportingPdf(false);
    }
  };

  return (
    <div
      id="sheet"
      className="exam-sheet mt-2 max-w-[62rem] rounded-[6px] bg-[#ededed] p-4 text-[#111111] sm:p-8"
    >
      {/* Paper Sheet Header */}
      <header className="mb-6 flex flex-col gap-3 border-b-2 border-[#111111] pb-3.5 text-sm font-medium sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="text-base font-extrabold leading-7 sm:text-lg">
            {examTitle || `آزمون ${subject.name} — ${getGradeLabel(activeGrade)}`}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#444] tabular-nums">
            <span>{selectedLessonsText}</span>
            <span>سطح: {getDifficultyLabel(activeDifficulty)}</span>
            {!result ? (
              <span className="inline-flex items-center gap-1 font-bold text-[#111]">
                <Clock className="h-3.5 w-3.5" />
                {remainingSeconds !== null
                  ? `باقی‌مانده: ${formatDurationPersian(remainingSeconds)}`
                  : `زمان: ${formatDurationPersian(elapsedSeconds)}`}
              </span>
            ) : (
              <span className="font-bold text-[#111]">
                زمان: {formatDurationPersian(result.timeSpentSeconds)}
              </span>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={onResetToNew}
          className="inline-flex min-h-[38px] w-full shrink-0 items-center justify-center gap-1.5 rounded-[6px] border border-[#111] bg-white px-3 py-1.5 text-xs font-bold text-[#111] transition-colors hover:bg-[#111] hover:text-white sm:w-auto"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          <span>{result ? 'بستن کارنامه و ساخت آزمون جدید' : 'بستن آزمون و بازگشت'}</span>
        </button>
      </header>

      {/* Results Summary Banner */}
      {result && (
        <div className="mb-6 space-y-5 border-b border-[#ccc] pb-6">
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 sm:gap-3">
            <div className="rounded-[6px] bg-[#111111] p-3 text-center text-white sm:p-3.5">
              <span className="block text-xs text-[#bdbdbd]">نمره از ۲۰</span>
              <span className="mt-1 block text-2xl font-extrabold tabular-nums">
                {toPersianDigits(result.scoreOutOf20)}
              </span>
              <span className="block text-xs text-[#bdbdbd] tabular-nums">
                {toPersianDigits(result.scorePercent)}٪
              </span>
            </div>

            <div className="rounded-[6px] border border-[#ccc] bg-white p-3 text-center sm:p-3.5">
              <span className="block text-xs text-[#555]">صحیح</span>
              <span className="mt-1 block text-2xl font-extrabold text-emerald-700 tabular-nums">
                {toPersianDigits(result.correctCount)}
              </span>
            </div>

            <div className="rounded-[6px] border border-[#ccc] bg-white p-3 text-center sm:p-3.5">
              <span className="block text-xs text-[#555]">غلط</span>
              <span className="mt-1 block text-2xl font-extrabold text-rose-700 tabular-nums">
                {toPersianDigits(result.wrongCount)}
              </span>
            </div>

            <div className="rounded-[6px] border border-[#ccc] bg-white p-3 text-center sm:p-3.5">
              <span className="block text-xs text-[#555]">نزده</span>
              <span className="mt-1 block text-2xl font-extrabold text-[#444] tabular-nums">
                {toPersianDigits(result.unansweredCount)}
              </span>
            </div>
          </div>

          {/* AI Analysis Block */}
          <div className="rounded-[6px] border border-[#d0d0d0] bg-white p-4 sm:p-5">
            <h3 className="text-sm font-extrabold text-[#111]">
              تحلیل هوشمند عملکرد و اشتباهات
            </h3>

            {isAnalyzing && (
              <div className="flex items-center gap-2.5 py-4 text-sm text-[#444]">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>در حال تحلیل سریع پاسخ‌ها و نوشتن توضیح غلط‌ها...</span>
              </div>
            )}

            {!isAnalyzing && analysisError && (
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-[6px] border border-rose-300 bg-rose-50 p-3 text-xs text-rose-800">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{analysisError}</span>
                </div>
                <button
                  type="button"
                  onClick={onRetryAnalysis}
                  className="inline-flex items-center gap-1 rounded bg-[#111] px-3 py-1.5 text-xs font-semibold text-white"
                >
                  <RefreshCw className="h-3 w-3" />
                  <span>تلاش مجدد</span>
                </button>
              </div>
            )}

            {!isAnalyzing && analysis && (
              <div className="mt-3 space-y-4 text-sm leading-7 text-[#222]">
                <p>{analysis.overallSummary}</p>

                <div className="grid grid-cols-1 gap-4 border-t border-[#e5e5e5] pt-3 sm:grid-cols-2">
                  <div>
                    <div className="text-xs font-bold text-emerald-800">نقاط قوت</div>
                    <p className="mt-1 text-xs text-[#444]">
                      {analysis.strengthTopics.length > 0
                        ? analysis.strengthTopics.join(' · ')
                        : 'با تمرین بیشتر شکل می‌گیرد.'}
                    </p>
                  </div>
                  <div>
                    <div className="text-xs font-bold text-rose-800">مباحث نیازمند مرور</div>
                    <p className="mt-1 text-xs text-[#444]">
                      {analysis.weakTopics.length > 0
                        ? analysis.weakTopics.join(' · ')
                        : 'همه مباحث عالی بود!'}
                    </p>
                  </div>
                </div>

                {analysis.studyRecommendations.length > 0 && (
                  <div className="border-t border-[#e5e5e5] pt-3">
                    <div className="text-xs font-bold text-[#111]">پیشنهاد مطالعه</div>
                    <ul className="mt-1.5 list-disc pr-5 text-xs leading-6 text-[#444]">
                      {analysis.studyRecommendations.map((rec, i) => (
                        <li key={i}>{rec}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>

          {result.wrongCount + result.unansweredCount > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setFilterTab('mistakes')}
                className={`min-h-[38px] rounded-[6px] px-3.5 py-1.5 text-xs font-bold transition-colors ${
                  filterTab === 'mistakes'
                    ? 'bg-[#111] text-white'
                    : 'border border-[#bbb] bg-white text-[#333] hover:border-[#111]'
                }`}
              >
                فقط غلط‌ها و نزده‌ها ({toPersianDigits(result.wrongCount + result.unansweredCount)})
              </button>
              <button
                type="button"
                onClick={() => setFilterTab('all')}
                className={`min-h-[38px] rounded-[6px] px-3.5 py-1.5 text-xs font-bold transition-colors ${
                  filterTab === 'all'
                    ? 'bg-[#111] text-white'
                    : 'border border-[#bbb] bg-white text-[#333] hover:border-[#111]'
                }`}
              >
                همه سؤالات ({toPersianDigits(totalCount)})
              </button>
            </div>
          )}
        </div>
      )}

      {/* Questions List */}
      {result && visibleQuestions.length === 0 ? (
        <div className="rounded-[6px] border border-[#ccc] bg-white p-6 text-center text-sm font-bold text-emerald-800">
          همه سؤال‌ها را درست جواب دادی! تب «همه سؤالات» را بزن تا مرور کنی.
        </div>
      ) : (
        <ol
          onCopy={!result ? (e) => e.preventDefault() : undefined}
          onCut={!result ? (e) => e.preventDefault() : undefined}
          className={`space-y-5 ${!result ? 'exam-live-protected' : ''}`}
        >
          {visibleQuestions.map(({ q, number }) => {
            const studentAns = result ? result.answers[q.id] : answers[q.id];
            const isCorrect = result ? studentAns === q.correctIndex : false;
            const isUnanswered = result ? studentAns === undefined : false;

            const breakdown = result
              ? analysis?.wrongBreakdowns.find(
                  (item) => item.questionId === q.id || item.questionNumber === number
                )
              : undefined;

            return (
              <li
                key={q.id}
                className="rounded-[6px] border border-[#d4d4d4] bg-white p-4 sm:p-5"
              >
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs text-[#666]">
                  <div>
                    <span className="font-bold text-[#111]">سؤال {toPersianDigits(number)}</span>
                    <span className="mx-1.5" aria-hidden="true">·</span>
                    <span>{q.topicTag}</span>
                  </div>

                  {!result ? (
                    <button
                      type="button"
                      onClick={() =>
                        setRevealedHints((prev) => ({ ...prev, [q.id]: !prev[q.id] }))
                      }
                      className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-[#444] hover:bg-[#f0f0f0]"
                    >
                      <HelpCircle className="h-3.5 w-3.5" />
                      <span>{revealedHints[q.id] ? 'بستن راهنما' : 'راهنمایی'}</span>
                    </button>
                  ) : isCorrect ? (
                    <span className="inline-flex items-center gap-1 font-bold text-emerald-700">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      <span>صحیح</span>
                    </span>
                  ) : isUnanswered ? (
                    <span className="font-bold text-[#666]">نزده</span>
                  ) : (
                    <span className="inline-flex items-center gap-1 font-bold text-rose-700">
                      <XCircle className="h-3.5 w-3.5" />
                      <span>غلط</span>
                    </span>
                  )}
                </div>

                {!result && revealedHints[q.id] && (
                  <div className="mb-3.5 rounded bg-[#f5f5f5] p-3 text-xs leading-6 text-[#333] sm:text-sm">
                    <strong>راهنما: </strong>
                    <FormattedText text={q.hint} />
                  </div>
                )}

                <FormattedQuestion text={q.question} />

                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                  {q.options.map((opt, idx) => {
                    if (!result) {
                      const selected = answers[q.id] === idx;
                      return (
                        <button
                          key={idx}
                          type="button"
                          onClick={() =>
                            setAnswers((prev) => ({ ...prev, [q.id]: idx }))
                          }
                          className={`flex min-h-[48px] items-start gap-2.5 rounded-[6px] border px-3.5 py-2.5 text-right text-[14px] leading-7 transition-colors sm:text-[15px] ${
                            selected
                              ? 'option-selected border-[#111] bg-[#111] font-semibold text-white'
                              : 'border-[#d4d4d4] bg-[#fafafa] text-[#222] hover:border-[#111]'
                          }`}
                        >
                          <span className="shrink-0 font-bold opacity-80">{OPTION_LETTERS[idx]})</span>
                          <span className="flex-1 whitespace-pre-line">
                            <FormattedText text={opt} />
                          </span>
                        </button>
                      );
                    }

                    const isRight = idx === q.correctIndex;
                    const isPicked = idx === studentAns;
                    let cls = 'border-[#e0e0e0] bg-[#fafafa] text-[#333]';
                    let tag = '';
                    if (isRight) {
                      cls = 'border-emerald-600 bg-emerald-50 font-bold text-emerald-950';
                      tag = 'درست';
                    } else if (isPicked) {
                      cls = 'border-rose-500 bg-rose-50 font-bold text-rose-950';
                      tag = 'انتخاب شما';
                    }

                    return (
                      <div
                        key={idx}
                        className={`flex items-start justify-between gap-2 rounded-[6px] border px-3.5 py-2.5 text-[14px] leading-7 sm:text-[15px] ${cls}`}
                      >
                        <div className="flex items-start gap-2">
                          <span className="shrink-0 font-bold">{OPTION_LETTERS[idx]})</span>
                          <span>
                            <FormattedText text={opt} />
                          </span>
                        </div>
                        {tag && <span className="shrink-0 text-xs">{tag}</span>}
                      </div>
                    );
                  })}
                </div>

                {result && !isCorrect && breakdown && (
                  <div className="mt-4 space-y-2 border-t border-[#e5e5e5] pt-3 text-xs leading-7 sm:text-sm">
                    <div className="rounded bg-rose-50 p-3 text-[#222]">
                      <strong className="text-rose-800">
                        {breakdown.wasUnanswered ? 'نقطه شروع: ' : 'چرا این گزینه غلط بود؟ '}
                      </strong>
                      <span>
                        <FormattedText text={breakdown.whyWrongSelected} />
                      </span>
                    </div>
                    <div className="rounded bg-[#f5f5f5] p-3 text-[#222]">
                      <strong className="text-[#111]">توضیح مفهوم و روش حل: </strong>
                      <span>
                        <FormattedText text={breakdown.correctConceptExplanation} />
                      </span>
                    </div>
                    <div className="flex items-start gap-2 rounded border border-[#ccc] bg-white p-3 text-[#111]">
                      <Lightbulb className="mt-0.5 h-4 w-4 shrink-0" />
                      <div>
                        <strong>نکته طلایی: </strong>
                        <span>
                          <FormattedText text={breakdown.keyTakeaway} />
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {result && (isCorrect || !breakdown) && q.quickExplanation && (
                  <div className="mt-3 rounded bg-[#f5f5f5] p-3 text-xs leading-7 text-[#333] sm:text-sm">
                    <strong className="text-[#111]">توضیح: </strong>
                    <FormattedText text={q.quickExplanation} />
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      )}

      {/* Bottom Tools with direct PDF download */}
      <div className="mt-6 flex flex-col gap-3 border-t border-[#ccc] pt-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        {!result ? (
          <>
            <span className="text-xs font-medium text-[#555] tabular-nums">
              پاسخ‌داده‌شده: {toPersianDigits(answeredCount)} از {toPersianDigits(totalCount)}
            </span>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={onResetToNew}
                className="inline-flex min-h-[42px] flex-1 items-center justify-center gap-1.5 rounded-[6px] border border-[#bbb] bg-white px-3.5 py-2 text-xs font-bold text-[#333] hover:border-[#111] hover:text-[#111] sm:flex-none"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>لغو و ساخت جدید</span>
              </button>
              <button
                type="button"
                disabled={isExportingPdf}
                onClick={handleDownloadPdf}
                className="inline-flex min-h-[42px] flex-1 items-center justify-center gap-1.5 rounded-[6px] border border-[#111] bg-white px-4 py-2 text-xs font-bold text-[#111] hover:bg-[#e5e5e5] disabled:opacity-60 sm:flex-none"
              >
                {isExportingPdf ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Download className="h-3.5 w-3.5" />
                )}
                <span>{isExportingPdf ? 'در حال ساخت PDF...' : 'دانلود PDF'}</span>
              </button>
              <button
                type="button"
                onClick={() => onSubmitExam(answers, elapsedSeconds)}
                className="inline-flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded-[6px] bg-[#111111] px-5 py-2 text-sm font-bold text-white hover:bg-[#2a2a2a] sm:w-auto"
              >
                <CheckCircle2 className="h-4 w-4" />
                <span>پایان آزمون و تحلیل غلط‌ها</span>
              </button>
            </div>
          </>
        ) : (
          <>
            <button
              type="button"
              disabled={isExportingPdf}
              onClick={handleDownloadPdf}
              className="inline-flex min-h-[42px] w-full items-center justify-center gap-1.5 rounded-[6px] border border-[#111] bg-white px-4 py-2 text-xs font-bold text-[#111] hover:bg-[#e5e5e5] disabled:opacity-60 sm:w-auto"
            >
              {isExportingPdf ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Download className="h-3.5 w-3.5" />
              )}
              <span>{isExportingPdf ? 'در حال ساخت PDF...' : 'دانلود PDF کارنامه'}</span>
            </button>

            <div className="flex flex-wrap items-center gap-2">
              {analysis && analysis.weakTopics.length > 0 && (
                <button
                  type="button"
                  onClick={() => onPracticeWeakTopics(analysis.weakTopics)}
                  className="inline-flex min-h-[42px] flex-1 items-center justify-center gap-1.5 rounded-[6px] border border-[#111] bg-white px-4 py-2 text-xs font-bold text-[#111] hover:bg-[#e5e5e5] sm:flex-none"
                >
                  <Target className="h-3.5 w-3.5" />
                  <span>تمرین روی مباحث غلط</span>
                </button>
              )}
              <button
                type="button"
                onClick={onResetToNew}
                className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-[6px] bg-[#111111] px-4 py-2 text-xs font-bold text-white hover:bg-[#2a2a2a] sm:flex-none"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>پایان و ساخت آزمون جدید</span>
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
