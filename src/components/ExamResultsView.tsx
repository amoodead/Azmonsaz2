import React, { useState } from 'react';
import {
  AlertCircle,
  BookOpenCheck,
  CheckCircle2,
  Compass,
  Loader2,
  MinusCircle,
  RefreshCw,
  RotateCcw,
  Target,
  XCircle,
  Lightbulb,
} from 'lucide-react';
import {
  OPTION_LETTERS,
  formatDurationPersian,
  getGradeLabel,
  getSubjectById,
  toPersianDigits,
} from '../data/curriculum';
import type { ExamHistoryEntry } from '../types/exam';

interface ExamResultsViewProps {
  result: ExamHistoryEntry;
  isAnalyzing: boolean;
  analysisError: string | null;
  onRetryAnalysis: () => void;
  onPracticeWeakTopics: (weakTopics: string[]) => void;
  onBackToBuilder: () => void;
}

type FilterTab = 'mistakes' | 'wrong_only' | 'all';

export const ExamResultsView: React.FC<ExamResultsViewProps> = ({
  result,
  isAnalyzing,
  analysisError,
  onRetryAnalysis,
  onPracticeWeakTopics,
  onBackToBuilder,
}) => {
  const [filterTab, setFilterTab] = useState<FilterTab>(
    result.wrongCount + result.unansweredCount > 0 ? 'mistakes' : 'all'
  );

  const subject = getSubjectById(result.config.subjectId);
  const analysis = result.analysis;

  const filteredQuestions = result.questions
    .map((q, index) => ({ q, number: index + 1 }))
    .filter(({ q }) => {
      const studentAns = result.answers[q.id];
      const isCorrect = studentAns === q.correctIndex;
      const isUnanswered = studentAns === undefined;
      if (filterTab === 'wrong_only') return !isCorrect && !isUnanswered;
      if (filterTab === 'mistakes') return !isCorrect;
      return true;
    });

  return (
    <div className="mx-auto max-w-5xl space-y-7 px-4 py-6 sm:px-6 sm:py-8">
      {/* Scoreboard & Summary Header */}
      <section className="rounded-2xl border border-white/10 bg-[#0D151F] p-5 sm:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-1.5">
            <div className="text-xs text-slate-400">
              <span>{getGradeLabel(result.config.grade)}</span>
              <span className="mx-1.5" aria-hidden="true">·</span>
              <span>{subject.name}</span>
              <span className="mx-1.5" aria-hidden="true">·</span>
              <span className="tabular-nums">
                زمان: {formatDurationPersian(result.timeSpentSeconds)}
              </span>
            </div>
            <h1 className="text-xl font-extrabold text-white sm:text-3xl">
              {result.examTitle}
            </h1>
          </div>

          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            <div className="rounded-xl border border-emerald-400/40 bg-emerald-500/15 px-4 py-3 text-center">
              <span className="block text-xs text-emerald-300">نمره از ۲۰</span>
              <span className="mt-1 block text-2xl font-extrabold text-white tabular-nums">
                {toPersianDigits(result.scoreOutOf20)}
              </span>
              <span className="block text-xs text-emerald-300 tabular-nums">
                {toPersianDigits(result.scorePercent)}٪
              </span>
            </div>

            <div className="rounded-xl border border-white/10 bg-[#121D2B] px-4 py-3 text-center">
              <span className="flex items-center justify-center gap-1 text-xs font-semibold text-emerald-400">
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span>صحیح</span>
              </span>
              <span className="mt-1 block text-2xl font-extrabold text-white tabular-nums">
                {toPersianDigits(result.correctCount)}
              </span>
            </div>

            <div className="rounded-xl border border-white/10 bg-[#121D2B] px-4 py-3 text-center">
              <span className="flex items-center justify-center gap-1 text-xs font-semibold text-rose-400">
                <XCircle className="h-3.5 w-3.5" />
                <span>غلط</span>
              </span>
              <span className="mt-1 block text-2xl font-extrabold text-white tabular-nums">
                {toPersianDigits(result.wrongCount)}
              </span>
            </div>

            <div className="rounded-xl border border-white/10 bg-[#121D2B] px-4 py-3 text-center">
              <span className="flex items-center justify-center gap-1 text-xs font-semibold text-slate-400">
                <MinusCircle className="h-3.5 w-3.5" />
                <span>نزده</span>
              </span>
              <span className="mt-1 block text-2xl font-extrabold text-white tabular-nums">
                {toPersianDigits(result.unansweredCount)}
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* AI Mistake Diagnostics */}
      <section className="rounded-2xl border border-white/10 bg-[#0D151F] p-5 sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-4">
          <div className="flex items-center gap-2.5">
            <BookOpenCheck className="h-5 w-5 text-emerald-400" />
            <h2 className="text-lg font-bold text-white">تحلیل عملکرد و اشتباهات</h2>
          </div>

          {analysis && analysis.weakTopics.length > 0 && (
            <button
              type="button"
              onClick={() => onPracticeWeakTopics(analysis.weakTopics)}
              className="inline-flex min-h-[40px] items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2 text-xs font-bold text-slate-950 transition-colors hover:bg-emerald-400 whitespace-nowrap shrink-0"
            >
              <Target className="h-3.5 w-3.5" />
              <span>تمرین روی مباحث غلط</span>
            </button>
          )}
        </div>

        {isAnalyzing && (
          <div className="flex flex-col items-center justify-center gap-2.5 py-10 text-center">
            <Loader2 className="h-6 w-6 animate-spin text-emerald-400" />
            <p className="text-sm font-bold text-white">
              در حال تحلیل پاسخ‌ها و توضیح اشتباهات...
            </p>
          </div>
        )}

        {!isAnalyzing && analysisError && (
          <div className="mt-5 flex flex-col items-start justify-between gap-4 rounded-xl border border-rose-500/35 bg-rose-500/10 p-4 sm:flex-row sm:items-center">
            <div className="flex items-start gap-2.5 text-sm text-rose-300">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-rose-400" />
              <span>{analysisError}</span>
            </div>
            <button
              type="button"
              onClick={onRetryAnalysis}
              className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg border border-rose-400/40 bg-rose-500/20 px-3 py-1.5 text-xs font-bold text-rose-200 hover:bg-rose-500/30 whitespace-nowrap shrink-0"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span>تلاش مجدد</span>
            </button>
          </div>
        )}

        {!isAnalyzing && analysis && (
          <div className="mt-6 space-y-5">
            <p className="rounded-xl border border-emerald-400/20 bg-emerald-500/10 p-4 text-sm leading-7 text-slate-200">
              {analysis.overallSummary}
            </p>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              <div className="rounded-xl border border-white/10 bg-[#121D2B] p-4">
                <h3 className="flex items-center gap-1.5 text-xs font-bold text-emerald-400">
                  <CheckCircle2 className="h-4 w-4" />
                  <span>نقاط قوت</span>
                </h3>
                {analysis.strengthTopics.length > 0 ? (
                  <ul className="mt-2.5 space-y-1.5 text-sm text-slate-300">
                    {analysis.strengthTopics.map((topic, i) => (
                      <li key={i}>
                        <span className="ml-1.5 font-bold text-emerald-400 tabular-nums">
                          {toPersianDigits(i + 1)}.
                        </span>
                        {topic}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2.5 text-xs text-slate-400">با تمرین بیشتر تقویت می‌شود.</p>
                )}
              </div>

              <div className="rounded-xl border border-white/10 bg-[#121D2B] p-4">
                <h3 className="flex items-center gap-1.5 text-xs font-bold text-rose-400">
                  <AlertCircle className="h-4 w-4" />
                  <span>نیازمند مرور</span>
                </h3>
                {analysis.weakTopics.length > 0 ? (
                  <ul className="mt-2.5 space-y-1.5 text-sm text-slate-300">
                    {analysis.weakTopics.map((topic, i) => (
                      <li key={i}>
                        <span className="ml-1.5 font-bold text-rose-400 tabular-nums">
                          {toPersianDigits(i + 1)}.
                        </span>
                        {topic}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2.5 text-xs font-medium text-emerald-400">
                    همه مباحث عالی بود!
                  </p>
                )}
              </div>

              <div className="rounded-xl border border-white/10 bg-[#121D2B] p-4">
                <h3 className="flex items-center gap-1.5 text-xs font-bold text-amber-300">
                  <Compass className="h-4 w-4" />
                  <span>پیشنهاد مطالعه</span>
                </h3>
                <ul className="mt-2.5 space-y-1.5 text-sm text-slate-300">
                  {analysis.studyRecommendations.map((rec, i) => (
                    <li key={i} className="leading-relaxed">
                      <span className="ml-1.5 font-bold text-amber-300 tabular-nums">
                        {toPersianDigits(i + 1)}.
                      </span>
                      {rec}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Wrong Answers & Solutions */}
      <section className="space-y-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-bold text-white">توضیح سوالات و غلط‌ها</h2>

          <div className="flex flex-wrap items-center gap-1 rounded-xl border border-white/10 bg-[#0D151F] p-1">
            <button
              type="button"
              onClick={() => setFilterTab('mistakes')}
              className={`min-h-[36px] flex-1 sm:flex-none rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap ${
                filterTab === 'mistakes'
                  ? 'bg-emerald-500 text-slate-950'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              غلط‌ها و نزده‌ها ({toPersianDigits(result.wrongCount + result.unansweredCount)})
            </button>
            <button
              type="button"
              onClick={() => setFilterTab('wrong_only')}
              className={`min-h-[36px] flex-1 sm:flex-none rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap ${
                filterTab === 'wrong_only'
                  ? 'bg-emerald-500 text-slate-950'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              فقط غلط‌ها ({toPersianDigits(result.wrongCount)})
            </button>
            <button
              type="button"
              onClick={() => setFilterTab('all')}
              className={`min-h-[36px] flex-1 sm:flex-none rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap ${
                filterTab === 'all'
                  ? 'bg-emerald-500 text-slate-950'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              همه ({toPersianDigits(result.questions.length)})
            </button>
          </div>
        </div>

        {filteredQuestions.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-[#0D151F] p-8 text-center">
            <CheckCircle2 className="mx-auto h-7 w-7 text-emerald-400" />
            <p className="mt-2 text-sm font-bold text-white">
              هیچ سوال غلطی در این بخش نداری!
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredQuestions.map(({ q, number }) => {
              const studentAns = result.answers[q.id];
              const isUnanswered = studentAns === undefined;
              const isCorrect = studentAns === q.correctIndex;

              const breakdown = analysis?.wrongBreakdowns.find(
                (item) => item.questionId === q.id || item.questionNumber === number
              );

              return (
                <article
                  key={q.id}
                  className="rounded-2xl border border-white/10 bg-[#0D151F] p-4 sm:p-6"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-3.5">
                    <div className="text-xs text-slate-400">
                      <span className="font-bold text-white">
                        سوال {toPersianDigits(number)}
                      </span>
                      <span className="mx-1.5" aria-hidden="true">·</span>
                      <span>{q.topicTag}</span>
                      {breakdown?.misconceptionReason && (
                        <>
                          <span className="mx-1.5" aria-hidden="true">·</span>
                          <span className="font-semibold text-rose-400">
                            {breakdown.misconceptionReason}
                          </span>
                        </>
                      )}
                    </div>

                    {isCorrect ? (
                      <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-400">
                        <CheckCircle2 className="h-4 w-4" />
                        <span>صحیح</span>
                      </span>
                    ) : isUnanswered ? (
                      <span className="inline-flex items-center gap-1 text-xs font-bold text-slate-400">
                        <MinusCircle className="h-4 w-4" />
                        <span>نزده</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs font-bold text-rose-400">
                        <XCircle className="h-4 w-4" />
                        <span>غلط</span>
                      </span>
                    )}
                  </div>

                  <h3 className="mt-4 text-sm font-bold leading-7 text-white sm:text-base sm:leading-8">
                    {q.question}
                  </h3>

                  <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {q.options.map((opt, idx) => {
                      const isRightOpt = idx === q.correctIndex;
                      const isStudentOpt = idx === studentAns;

                      let style = 'border-white/10 bg-[#121D2B] text-slate-300';
                      let label = '';

                      if (isRightOpt) {
                        style = 'border-emerald-400/50 bg-emerald-500/15 text-emerald-200 font-semibold';
                        label = 'پاسخ درست';
                      } else if (isStudentOpt && !isRightOpt) {
                        style = 'border-rose-400/50 bg-rose-500/15 text-rose-200 font-semibold';
                        label = 'انتخاب شما';
                      }

                      return (
                        <div
                          key={idx}
                          className={`flex items-start justify-between gap-2 rounded-xl border px-3.5 py-2.5 text-sm ${style}`}
                        >
                          <div className="flex items-start gap-2">
                            <span className="font-bold opacity-80">{OPTION_LETTERS[idx]})</span>
                            <span>{opt}</span>
                          </div>
                          {label && (
                            <span className="shrink-0 text-xs font-bold">{label}</span>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {!isCorrect && breakdown ? (
                    <div className="mt-5 space-y-2.5 border-t border-white/10 pt-4">
                      <div className="rounded-xl border border-rose-500/25 bg-rose-500/10 p-3.5">
                        <div className="text-xs font-bold text-rose-300">
                          {breakdown.wasUnanswered ? 'نقطه شروع حل:' : 'چرا این گزینه غلط بود؟'}
                        </div>
                        <p className="mt-1 text-sm leading-7 text-slate-200">
                          {breakdown.whyWrongSelected}
                        </p>
                      </div>

                      <div className="rounded-xl border border-white/10 bg-[#121D2B] p-3.5">
                        <div className="text-xs font-bold text-white">توضیح و روش حل</div>
                        <p className="mt-1 text-sm leading-7 text-slate-300">
                          {breakdown.correctConceptExplanation}
                        </p>
                      </div>

                      <div className="flex items-start gap-2 rounded-xl border border-emerald-400/30 bg-emerald-500/10 p-3.5">
                        <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
                        <p className="text-sm leading-relaxed text-emerald-100">
                          <strong className="font-bold text-emerald-300">نکته طلایی: </strong>
                          {breakdown.keyTakeaway}
                        </p>
                      </div>
                    </div>
                  ) : (
                    q.quickExplanation && (
                      <div className="mt-4 rounded-xl border border-white/10 bg-[#121D2B] p-3.5 text-sm leading-7 text-slate-300">
                        <strong className="text-white">پاسخ تشریحی: </strong>
                        {q.quickExplanation}
                      </div>
                    )
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>

      {/* Bottom Actions */}
      <div className="flex flex-wrap items-center justify-end gap-3 pt-2">
        {analysis && analysis.weakTopics.length > 0 && (
          <button
            type="button"
            onClick={() => onPracticeWeakTopics(analysis.weakTopics)}
            className="inline-flex min-h-[46px] items-center gap-2 rounded-xl border border-white/15 bg-white/[0.04] px-4 py-2 text-sm font-bold text-white hover:border-emerald-400/50"
          >
            <Target className="h-4 w-4 text-emerald-400" />
            <span>تمرین مجدد روی مباحث غلط</span>
          </button>
        )}
        <button
          type="button"
          onClick={onBackToBuilder}
          className="inline-flex min-h-[46px] items-center gap-2 rounded-xl bg-gradient-to-l from-emerald-500 to-teal-600 px-5 py-2 text-sm font-extrabold text-slate-950"
        >
          <RotateCcw className="h-4 w-4" />
          <span>آزمون جدید</span>
        </button>
      </div>
    </div>
  );
};
