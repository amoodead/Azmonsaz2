import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Bookmark,
  CheckCircle2,
  Clock,
  HelpCircle,
  Lightbulb,
} from 'lucide-react';
import {
  OPTION_LETTERS,
  formatDurationPersian,
  getGradeLabel,
  getSubjectById,
  toPersianDigits,
} from '../data/curriculum';
import type { ExamConfig, GeneratedExam } from '../types/exam';

interface ExamRunnerProps {
  exam: GeneratedExam;
  config: ExamConfig;
  onFinishExam: (answers: Record<string, number>, timeSpentSeconds: number) => void;
  onCancelExam: () => void;
}

export const ExamRunner: React.FC<ExamRunnerProps> = ({
  exam,
  config,
  onFinishExam,
  onCancelExam,
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [flaggedIds, setFlaggedIds] = useState<Record<string, boolean>>({});
  const [revealedHints, setRevealedHints] = useState<Record<string, boolean>>({});
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  const totalSecondsLimit = exam.recommendedMinutes * 60;
  const remainingSeconds = Math.max(0, totalSecondsLimit - elapsedSeconds);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (config.timedMode && elapsedSeconds >= totalSecondsLimit) {
      onFinishExam(answers, totalSecondsLimit);
    }
  }, [config.timedMode, elapsedSeconds, totalSecondsLimit, answers, onFinishExam]);

  const currentQuestion = exam.questions[currentIndex];
  const answeredCount = Object.keys(answers).length;
  const totalCount = exam.questions.length;
  const unansweredCount = totalCount - answeredCount;
  const progressPercent = Math.round(((currentIndex + 1) / totalCount) * 100);

  const subject = getSubjectById(config.subjectId);

  const handleSelectOption = (optionIdx: number) => {
    setAnswers((prev) => ({
      ...prev,
      [currentQuestion.id]: optionIdx,
    }));
  };

  const handleToggleFlag = () => {
    setFlaggedIds((prev) => ({
      ...prev,
      [currentQuestion.id]: !prev[currentQuestion.id],
    }));
  };

  const handleToggleHint = () => {
    setRevealedHints((prev) => ({
      ...prev,
      [currentQuestion.id]: !prev[currentQuestion.id],
    }));
  };

  const handleRequestSubmit = () => {
    if (unansweredCount > 0) {
      setShowConfirmModal(true);
    } else {
      onFinishExam(answers, elapsedSeconds);
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-5 px-4 py-5 sm:px-6 sm:py-8">
      {/* Top Exam Status Bar */}
      <div className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-[#0D151F] p-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="min-w-0">
          <div className="text-xs text-slate-400">
            <span>{getGradeLabel(config.grade)}</span>
            <span className="mx-1.5" aria-hidden="true">·</span>
            <span>{subject.name}</span>
            <span className="mx-1.5" aria-hidden="true">·</span>
            <span className="tabular-nums">
              {toPersianDigits(answeredCount)} از {toPersianDigits(totalCount)} پاسخ
            </span>
          </div>
          <h1 className="mt-1 truncate text-base font-bold text-white">
            {exam.examTitle}
          </h1>
        </div>

        <div className="flex items-center justify-between gap-2.5 sm:justify-end shrink-0">
          <div
            className={`flex min-h-[38px] items-center gap-2 rounded-xl border px-3 py-1.5 text-xs font-bold tabular-nums sm:text-sm ${
              config.timedMode && remainingSeconds <= 60
                ? 'border-rose-500/40 bg-rose-500/15 text-rose-300'
                : 'border-emerald-400/25 bg-emerald-500/10 text-emerald-300'
            }`}
          >
            <Clock className="h-4 w-4" />
            <span>
              {config.timedMode
                ? formatDurationPersian(remainingSeconds)
                : formatDurationPersian(elapsedSeconds)}
            </span>
          </div>

          <button
            type="button"
            onClick={onCancelExam}
            className="min-h-[38px] rounded-xl border border-white/15 px-3.5 py-1.5 text-xs font-semibold text-slate-300 transition-colors hover:border-white/30 hover:text-white whitespace-nowrap shrink-0"
          >
            خروج
          </button>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-gradient-to-l from-emerald-400 to-teal-500 transition-all duration-200"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {/* Main Split Workspace */}
      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
        {/* Question Card */}
        <div className="space-y-6 rounded-2xl border border-white/10 bg-[#0D151F] p-4 sm:p-8 lg:col-span-8">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-4">
            <div className="text-xs text-slate-400">
              <span className="font-bold text-emerald-400">
                سوال {toPersianDigits(currentIndex + 1)} از {toPersianDigits(totalCount)}
              </span>
              <span className="mx-1.5" aria-hidden="true">·</span>
              <span>{currentQuestion.topicTag}</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleToggleHint}
                className={`inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border px-3 py-1 text-xs font-semibold transition-colors ${
                  revealedHints[currentQuestion.id]
                    ? 'border-amber-400/50 bg-amber-500/15 text-amber-300'
                    : 'border-white/15 bg-white/[0.03] text-slate-300 hover:border-white/30'
                }`}
              >
                <Lightbulb className="h-3.5 w-3.5" />
                <span>راهنمایی</span>
              </button>

              <button
                type="button"
                onClick={handleToggleFlag}
                className={`inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border px-3 py-1 text-xs font-semibold transition-colors ${
                  flaggedIds[currentQuestion.id]
                    ? 'border-amber-400/50 bg-amber-500/15 text-amber-300'
                    : 'border-white/15 bg-white/[0.03] text-slate-300 hover:border-white/30'
                }`}
              >
                <Bookmark className="h-3.5 w-3.5" />
                <span>{flaggedIds[currentQuestion.id] ? 'نشان‌شده' : 'مرور'}</span>
              </button>
            </div>
          </div>

          {revealedHints[currentQuestion.id] && (
            <div className="flex items-start gap-2.5 rounded-xl border border-amber-400/30 bg-amber-500/10 p-3.5 text-sm leading-relaxed text-amber-200">
              <HelpCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
              <div>
                <span className="font-bold">راهنمایی: </span>
                <span>{currentQuestion.hint}</span>
              </div>
            </div>
          )}

          <div className="text-base font-semibold leading-8 text-white sm:text-xl sm:leading-9">
            {currentQuestion.question}
          </div>

          <div className="space-y-3">
            {currentQuestion.options.map((optionText, idx) => {
              const isSelected = answers[currentQuestion.id] === idx;
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleSelectOption(idx)}
                  className={`flex min-h-[54px] w-full items-center gap-3.5 rounded-xl border px-3.5 py-3 text-right transition-colors sm:gap-4 sm:px-4 ${
                    isSelected
                      ? 'border-emerald-400 bg-emerald-500/15 text-white'
                      : 'border-white/10 bg-[#121D2B] text-slate-200 hover:border-emerald-400/40'
                  }`}
                >
                  <span
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border text-sm font-bold transition-colors ${
                      isSelected
                        ? 'border-emerald-400 bg-emerald-400 text-slate-950'
                        : 'border-white/15 bg-white/[0.04] text-slate-300'
                    }`}
                  >
                    {OPTION_LETTERS[idx]}
                  </span>
                  <span className="flex-1 text-sm leading-relaxed sm:text-base">{optionText}</span>
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-5">
            <button
              type="button"
              disabled={currentIndex === 0}
              onClick={() => setCurrentIndex((prev) => Math.max(0, prev - 1))}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-white/15 bg-white/[0.03] px-4 py-2 text-sm font-semibold text-slate-200 transition-colors hover:border-white/30 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ArrowRight className="h-4 w-4" />
              <span>قبلی</span>
            </button>

            {currentIndex < totalCount - 1 ? (
              <button
                type="button"
                onClick={() => setCurrentIndex((prev) => Math.min(totalCount - 1, prev + 1))}
                className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-gradient-to-l from-emerald-500 to-teal-600 px-5 py-2 text-sm font-bold text-slate-950 transition-transform hover:-translate-y-0.5"
              >
                <span>سوال بعدی</span>
                <ArrowLeft className="h-4 w-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleRequestSubmit}
                className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-gradient-to-l from-emerald-500 to-teal-600 px-5 py-2 text-sm font-extrabold text-slate-950"
              >
                <CheckCircle2 className="h-4 w-4" />
                <span>پایان و تصحیح</span>
              </button>
            )}
          </div>
        </div>

        {/* Question Map Sidebar */}
        <aside className="space-y-4 rounded-2xl border border-white/10 bg-[#0D151F] p-5 lg:col-span-4">
          <div className="text-xs font-bold text-slate-400">نقشه سوالات</div>

          <div className="grid grid-cols-5 gap-2">
            {exam.questions.map((q, idx) => {
              const isCurrent = idx === currentIndex;
              const isAnswered = answers[q.id] !== undefined;
              const isFlagged = Boolean(flaggedIds[q.id]);

              let btnClass = 'border-white/10 bg-[#121D2B] text-slate-400 hover:border-white/30';
              if (isCurrent) {
                btnClass = 'border-emerald-400 bg-emerald-400 text-slate-950';
              } else if (isFlagged) {
                btnClass = 'border-amber-400/60 bg-amber-500/15 text-amber-300';
              } else if (isAnswered) {
                btnClass = 'border-emerald-400/40 bg-emerald-500/15 text-emerald-300';
              }

              return (
                <button
                  key={q.id}
                  type="button"
                  onClick={() => setCurrentIndex(idx)}
                  aria-label={`سوال ${idx + 1}`}
                  className={`flex min-h-[42px] items-center justify-center rounded-xl border text-sm font-bold tabular-nums transition-colors ${btnClass}`}
                >
                  {toPersianDigits(idx + 1)}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={handleRequestSubmit}
            className="flex min-h-[46px] w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-l from-emerald-500 to-teal-600 px-4 py-2.5 text-sm font-extrabold text-slate-950 transition-transform hover:-translate-y-0.5"
          >
            <CheckCircle2 className="h-4 w-4" />
            <span>ثبت نهایی و تحلیل غلط‌ها</span>
          </button>
        </aside>
      </div>

      {/* Confirm Early Submit Modal */}
      {showConfirmModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-xs"
        >
          <div className="w-full max-w-md rounded-2xl border border-white/15 bg-[#0D151F] p-6">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
              <div>
                <h3 className="text-base font-bold text-white">
                  سوالات بدون پاسخ داری!
                </h3>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-400">
                  هنوز به {toPersianDigits(unansweredCount)} سوال پاسخ نداده‌ای. آیا آزمون را همین الان تصحیح کنیم؟
                </p>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                className="min-h-[42px] rounded-xl border border-white/15 px-4 py-2 text-sm font-semibold text-slate-300 hover:border-white/30"
              >
                بازگشت
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowConfirmModal(false);
                  onFinishExam(answers, elapsedSeconds);
                }}
                className="min-h-[42px] rounded-xl bg-emerald-500 px-4 py-2 text-sm font-extrabold text-slate-950 hover:bg-emerald-400"
              >
                تصحیح و تحلیل
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
