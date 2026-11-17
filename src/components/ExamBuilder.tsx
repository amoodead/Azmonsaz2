import React from 'react';
import {
  Atom,
  BookOpen,
  Calculator,
  Check,
  Clock,
  Compass,
  FileText,
  FlaskConical,
  Globe,
  GraduationCap,
  Layers,
  Loader2,
  ScrollText,
  Sparkles,
  Star,
  Trash2,
  AlertCircle,
} from 'lucide-react';
import {
  DIFFICULTIES,
  GRADES,
  SUBJECTS,
  formatDurationPersian,
  getDifficultyLabel,
  getGradeLabel,
  getSubjectById,
  toPersianDigits,
} from '../data/curriculum';
import type {
  DifficultyLevel,
  ExamConfig,
  ExamHistoryEntry,
  GradeId,
  SubjectId,
} from '../types/exam';

interface ExamBuilderProps {
  config: ExamConfig;
  onChangeConfig: (next: ExamConfig) => void;
  onGenerateExam: (overrideConfig?: ExamConfig) => void;
  isGenerating: boolean;
  errorMessage: string | null;
  history: ExamHistoryEntry[];
  onOpenHistoryEntry: (entry: ExamHistoryEntry) => void;
  onClearHistory: () => void;
}

const SUBJECT_ICONS: Record<SubjectId, React.ReactNode> = {
  science: <Atom className="h-5 w-5" />,
  math: <Calculator className="h-5 w-5" />,
  persian: <BookOpen className="h-5 w-5" />,
  arabic: <ScrollText className="h-5 w-5" />,
  english: <Globe className="h-5 w-5" />,
  social: <Compass className="h-5 w-5" />,
  religion: <Layers className="h-5 w-5" />,
};

const QUICK_QUESTION_COUNTS = [5, 10, 15, 20];

interface PopularExamCard {
  id: string;
  grade: GradeId;
  subjectId: SubjectId;
  lessonId: string;
  categoryLabel: string;
  title: string;
  description: string;
  questionCount: number;
  minutes: number;
  difficulty: DifficultyLevel;
  levelLabel: string;
  accentColor: string;
  icon: React.ReactNode;
}

const POPULAR_EXAMS: PopularExamCard[] = [
  {
    id: 'pop-sci-8',
    grade: '8',
    subjectId: 'science',
    lessonId: 'sci-8-3',
    categoryLabel: 'علوم · پایه هشتم',
    title: 'درس سوم: از درون اتم چه خبر؟',
    description: 'سنجش مفاهیم اتم، الکترون، پروتون و مدل بور',
    questionCount: 10,
    minutes: 12,
    difficulty: 'standard',
    levelLabel: 'متوسط',
    accentColor: 'text-emerald-400',
    icon: <Atom className="h-6 w-6" />,
  },
  {
    id: 'pop-math-8',
    grade: '8',
    subjectId: 'math',
    lessonId: 'math-8-4',
    categoryLabel: 'ریاضی · پایه هشتم',
    title: 'آزمون جبر و معادله‌های کسری',
    description: 'خودت رو با سؤال‌های محاسباتی محک بزن',
    questionCount: 10,
    minutes: 15,
    difficulty: 'advanced',
    levelLabel: 'سخت',
    accentColor: 'text-sky-400',
    icon: <Calculator className="h-6 w-6" />,
  },
  {
    id: 'pop-eng-7',
    grade: '7',
    subjectId: 'english',
    lessonId: 'eng-7-1',
    categoryLabel: 'زبان · پایه هفتم',
    title: 'آزمون زبان انگلیسی (Prospect 1)',
    description: 'دانش لغات و گرامر پایه خودت رو بسنج',
    questionCount: 10,
    minutes: 12,
    difficulty: 'easy',
    levelLabel: 'آسان',
    accentColor: 'text-amber-300',
    icon: <Globe className="h-6 w-6" />,
  },
  {
    id: 'pop-per-9',
    grade: '9',
    subjectId: 'persian',
    lessonId: 'per-9-2',
    categoryLabel: 'فارسی · پایه نهم',
    title: 'آزمون فارسی و ساختمان واژه',
    description: 'تمرین ادبیات، آرایه‌ها و نکات دستوری',
    questionCount: 10,
    minutes: 12,
    difficulty: 'standard',
    levelLabel: 'متوسط',
    accentColor: 'text-orange-300',
    icon: <BookOpen className="h-6 w-6" />,
  },
  {
    id: 'pop-soc-7',
    grade: '7',
    subjectId: 'social',
    lessonId: 'soc-7-3',
    categoryLabel: 'مطالعات · پایه هفتم',
    title: 'آزمون تاریخ ایران باستان',
    description: 'دانش خودت رو در مطالعات اجتماعی بسنج',
    questionCount: 10,
    minutes: 12,
    difficulty: 'standard',
    levelLabel: 'متوسط',
    accentColor: 'text-teal-300',
    icon: <Compass className="h-6 w-6" />,
  },
  {
    id: 'pop-sci-9',
    grade: '9',
    subjectId: 'science',
    lessonId: 'sci-9-5',
    categoryLabel: 'علوم · پایه نهم',
    title: 'آزمون پیشرفته نیرو و حرکت',
    description: 'یک چالش جذاب برای آمادگی امتحانات نهم',
    questionCount: 10,
    minutes: 15,
    difficulty: 'advanced',
    levelLabel: 'سخت',
    accentColor: 'text-cyan-300',
    icon: <FlaskConical className="h-6 w-6" />,
  },
];

export const ExamBuilder: React.FC<ExamBuilderProps> = ({
  config,
  onChangeConfig,
  onGenerateExam,
  isGenerating,
  errorMessage,
  history,
  onOpenHistoryEntry,
  onClearHistory,
}) => {
  const selectedSubject = getSubjectById(config.subjectId);
  const lessons = selectedSubject.lessonsByGrade[config.grade] ?? [];

  const handleGradeChange = (grade: GradeId) => {
    const newLessons = selectedSubject.lessonsByGrade[grade] ?? [];
    const defaultLesson = newLessons[0] ? [newLessons[0].id] : [];
    onChangeConfig({
      ...config,
      grade,
      lessonIds: defaultLesson,
      allLessons: false,
    });
  };

  const handleSubjectChange = (subjectId: SubjectId) => {
    const subj = getSubjectById(subjectId);
    const newLessons = subj.lessonsByGrade[config.grade] ?? [];
    const defaultLesson = newLessons[0] ? [newLessons[0].id] : [];
    onChangeConfig({
      ...config,
      subjectId,
      lessonIds: defaultLesson,
      allLessons: false,
    });
  };

  const handleToggleLesson = (lessonId: string) => {
    const exists = config.lessonIds.includes(lessonId);
    const nextIds = exists
      ? config.lessonIds.filter((id) => id !== lessonId)
      : [...config.lessonIds, lessonId];
    onChangeConfig({
      ...config,
      allLessons: false,
      lessonIds: nextIds,
    });
  };

  const handleSelectAllLessons = () => {
    onChangeConfig({
      ...config,
      allLessons: !config.allLessons,
      lessonIds: !config.allLessons ? [] : lessons[0] ? [lessons[0].id] : [],
    });
  };

  const handleCategoryClick = (subjectId: SubjectId) => {
    handleSubjectChange(subjectId);
    document.getElementById('exam-builder')?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleLaunchPopular = (item: PopularExamCard) => {
    const presetConfig: ExamConfig = {
      grade: item.grade,
      subjectId: item.subjectId,
      lessonIds: [item.lessonId],
      allLessons: false,
      customTopic: '',
      questionCount: item.questionCount,
      difficulty: item.difficulty,
      timedMode: true,
    };
    onChangeConfig(presetConfig);
    onGenerateExam(presetConfig);
  };

  const selectedLessonsList = lessons.filter((l) => config.lessonIds.includes(l.id));
  const estimatedMinutes = Math.max(5, Math.ceil(config.questionCount * 1.2));
  const canSubmit = !isGenerating && (config.allLessons || config.lessonIds.length > 0);

  return (
    <div className="mx-auto max-w-6xl space-y-16 px-4 py-8 sm:space-y-20 sm:px-6 sm:py-14">
      {/* Hero Section matching attached layout with Emerald Teal dark palette */}
      <section className="grid grid-cols-1 items-center gap-10 lg:grid-cols-2">
        <div className="space-y-6 text-center lg:text-right">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/25 bg-emerald-500/10 px-4 py-2 text-xs font-medium text-emerald-300">
            <Sparkles className="h-3.5 w-3.5" />
            <span>آینده یادگیری از اینجا شروع میشه</span>
          </div>

          <h1 className="text-4xl font-black leading-[1.35] text-white sm:text-5xl lg:text-[56px]">
            آماده‌ای خودتو
            <span className="mt-1 block text-emerald-400 drop-shadow-[0_0_28px_rgba(16,185,129,0.35)]">
              به چالش بکشی؟
            </span>
          </h1>

          <p className="mx-auto max-w-lg text-sm leading-8 text-slate-400 sm:text-base lg:mx-0">
            با آزمونا درس و فصل کتاب درسی‌ات (پایه هفتم تا نهم) را انتخاب کن، آزمون چهارگزینه‌ای بده و در پایان تحلیل دقیق تک‌تک اشتباهاتت را ببین.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3 pt-1 lg:justify-start">
            <a
              href="#exam-builder"
              className="inline-flex min-h-[48px] items-center justify-center rounded-xl bg-gradient-to-l from-emerald-500 to-teal-600 px-6 py-3 text-sm font-bold text-slate-950 shadow-[0_8px_30px_rgba(16,185,129,0.28)] transition-transform hover:-translate-y-0.5"
            >
              شروع طراحی آزمون ←
            </a>
            <a
              href="#exams"
              className="inline-flex min-h-[48px] items-center justify-center rounded-xl border border-white/15 bg-white/[0.03] px-5 py-3 text-sm font-semibold text-slate-200 transition-colors hover:border-emerald-400/40 hover:text-white"
            >
              آزمون‌های پیشنهادی
            </a>
          </div>

          <div className="flex items-center justify-center gap-8 pt-4 sm:gap-12 lg:justify-start">
            <div className="flex flex-col gap-1">
              <strong className="text-xl font-extrabold text-emerald-400 tabular-nums">+۵۰</strong>
              <small className="text-xs text-slate-500">فصل کتاب درسی</small>
            </div>
            <div className="flex flex-col gap-1">
              <strong className="text-xl font-extrabold text-emerald-400 tabular-nums">۷ تا ۹</strong>
              <small className="text-xs text-slate-500">پایه متوسطه اول</small>
            </div>
            <div className="flex flex-col gap-1">
              <strong className="text-xl font-extrabold text-emerald-400">هوشمند</strong>
              <small className="text-xs text-slate-500">تحلیل خطاها</small>
            </div>
          </div>
        </div>

        {/* Visual Showcase Card (mobile-safe without horizontal overflow) */}
        <div className="relative flex min-h-[320px] items-center justify-center sm:min-h-[380px]">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute h-64 w-64 rounded-full bg-emerald-500/20 blur-[90px] sm:h-72 sm:w-72"
          />

          <div className="relative z-10 w-[265px] sm:w-[305px] -rotate-2 sm:-rotate-3 rounded-3xl border border-emerald-400/30 bg-gradient-to-br from-[#0F2027] to-[#0B121B] p-6 sm:p-8 text-center shadow-[0_0_60px_rgba(16,185,129,0.14)]">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-300">
              <GraduationCap className="h-9 w-9" />
            </div>
            <h2 className="text-xl font-extrabold text-white">وقت درخشیدنه!</h2>
            <p className="mt-2 text-xs text-slate-400">موفقیت از یک قدم کوچک شروع میشه.</p>

            <div className="mt-6 h-2 w-full overflow-hidden rounded-full bg-white/10">
              <div className="h-full w-[72%] rounded-full bg-gradient-to-l from-emerald-400 to-teal-500" />
            </div>
            <span className="mt-2 block text-[11px] text-slate-400">مسیر پیشرفت تو</span>

            <div className="mt-5 flex items-center justify-center gap-1.5 rounded-xl bg-emerald-500/10 py-2.5 text-xs font-semibold text-emerald-300">
              <Sparkles className="h-3.5 w-3.5" />
              <span>یادگیری هوشمند</span>
            </div>
          </div>

          <div className="absolute top-6 right-1 sm:top-10 sm:right-4 z-20 flex items-center gap-1.5 rounded-xl border border-emerald-400/35 bg-[#0D1B24] px-3 py-2 text-[11px] font-semibold text-emerald-200 sm:px-4 sm:py-2.5 sm:text-xs">
            <BookOpen className="h-3.5 w-3.5 text-emerald-400" />
            <span>یادگیری</span>
          </div>
          <div className="absolute bottom-6 left-1 sm:bottom-10 sm:left-4 z-20 flex items-center gap-1.5 rounded-xl border border-emerald-400/35 bg-[#0D1B24] px-3 py-2 text-[11px] font-semibold text-emerald-200 sm:px-4 sm:py-2.5 sm:text-xs">
            <Star className="h-3.5 w-3.5 text-amber-400" />
            <span>پیشرفت</span>
          </div>
        </div>
      </section>

      {/* Categories Section */}
      <section id="subjects" className="scroll-mt-24 space-y-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <span className="text-[10px] font-semibold tracking-[3px] text-emerald-400">
              CATEGORIES
            </span>
            <h2 className="mt-1.5 text-2xl font-extrabold text-white">دسته‌بندی درس‌ها</h2>
          </div>
          <p className="text-xs text-slate-400">موضوع مورد علاقه‌ات رو انتخاب کن</p>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 sm:gap-4">
          {[
            { id: 'science' as SubjectId, title: 'علوم', sub: 'آزمون‌های علمی', color: 'text-emerald-400' },
            { id: 'math' as SubjectId, title: 'ریاضی', sub: 'تمرین محاسبات', color: 'text-sky-400' },
            { id: 'english' as SubjectId, title: 'زبان انگلیسی', sub: 'تقویت زبان', color: 'text-amber-300' },
            { id: 'persian' as SubjectId, title: 'فارسی', sub: 'ادبیات و نگارش', color: 'text-orange-300' },
            { id: 'social' as SubjectId, title: 'مطالعات', sub: 'دانش اجتماعی', color: 'text-teal-300' },
          ].map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => handleCategoryClick(cat.id)}
              className="group flex flex-col items-start rounded-2xl border border-white/10 bg-[#0D151F] p-5 text-right transition-all hover:-translate-y-1 hover:border-emerald-400/50"
            >
              <span className={`mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-white/[0.05] ${cat.color}`}>
                {SUBJECT_ICONS[cat.id]}
              </span>
              <h3 className={`text-sm font-bold ${cat.color}`}>{cat.title}</h3>
              <small className="mt-1 text-xs text-slate-500">{cat.sub}</small>
            </button>
          ))}
        </div>
      </section>

      {/* Interactive AI Exam Builder Studio */}
      <section id="exam-builder" className="scroll-mt-24 space-y-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <span className="text-[10px] font-semibold tracking-[3px] text-emerald-400">
              AI EXAM STUDIO
            </span>
            <h2 className="mt-1.5 text-2xl font-extrabold text-white">ساخت آزمون اختصاصی</h2>
          </div>
          <p className="text-xs text-slate-400">
            پایه، درس، فصل کتاب و تعداد سوال رو بده تا فوری آزمون ساخته بشه
          </p>
        </div>

        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
          {/* Curriculum Controls */}
          <div className="space-y-6 rounded-2xl border border-white/10 bg-[#0D151F] p-4 sm:p-6 lg:col-span-8">
            {/* Grade */}
            <div className="space-y-2.5">
              <label className="block text-xs font-bold text-slate-400">۱. پایه تحصیلی</label>
              <div className="grid grid-cols-3 gap-2.5">
                {GRADES.map((g) => {
                  const active = config.grade === g.id;
                  return (
                    <button
                      key={g.id}
                      type="button"
                      onClick={() => handleGradeChange(g.id)}
                      className={`min-h-[46px] rounded-xl border px-2 py-2.5 text-xs font-bold transition-colors sm:text-sm ${
                        active
                          ? 'border-emerald-400 bg-emerald-500 text-slate-950'
                          : 'border-white/10 bg-[#121D2B] text-slate-300 hover:border-emerald-400/40 hover:text-white'
                      }`}
                    >
                      {g.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="border-t border-white/10" />

            {/* Subject */}
            <div className="space-y-2.5">
              <label className="block text-xs font-bold text-slate-400">۲. نام درس</label>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
                {SUBJECTS.map((subj) => {
                  const active = config.subjectId === subj.id;
                  return (
                    <button
                      key={subj.id}
                      type="button"
                      onClick={() => handleSubjectChange(subj.id)}
                      className={`flex min-h-[46px] items-center gap-2 rounded-xl border px-3 py-2 text-right text-xs font-bold transition-colors sm:text-sm ${
                        active
                          ? 'border-emerald-400 bg-emerald-500/20 text-emerald-300'
                          : 'border-white/10 bg-[#121D2B] text-slate-300 hover:border-emerald-400/40 hover:text-white'
                      }`}
                    >
                      <span className={active ? 'text-emerald-300' : 'text-slate-400'}>
                        {SUBJECT_ICONS[subj.id]}
                      </span>
                      <span className="truncate">{subj.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="border-t border-white/10" />

            {/* Chapters */}
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="text-xs font-bold text-slate-400">۳. فصل یا درس کتاب</label>
                <button
                  type="button"
                  onClick={handleSelectAllLessons}
                  className={`min-h-[36px] rounded-lg border px-3 py-1 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                    config.allLessons
                      ? 'border-emerald-400 bg-emerald-500 text-slate-950'
                      : 'border-white/15 bg-white/[0.04] text-slate-300 hover:border-emerald-400/40'
                  }`}
                >
                  {config.allLessons ? '✓ کل کتاب انتخاب شد' : 'انتخاب کل کتاب'}
                </button>
              </div>

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {lessons.map((lesson) => {
                  const isSelected = !config.allLessons && config.lessonIds.includes(lesson.id);
                  return (
                    <button
                      key={lesson.id}
                      type="button"
                      onClick={() => handleToggleLesson(lesson.id)}
                      className={`flex min-h-[46px] items-center gap-2.5 rounded-xl border px-3.5 py-2.5 text-right transition-colors ${
                        isSelected
                          ? 'border-emerald-400/60 bg-emerald-500/15 text-white'
                          : 'border-white/10 bg-[#121D2B] text-slate-300 hover:border-white/25 hover:text-white'
                      }`}
                    >
                      <span
                        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border text-xs ${
                          isSelected
                            ? 'border-emerald-400 bg-emerald-400 text-slate-950'
                            : 'border-white/25 bg-transparent text-transparent'
                        }`}
                      >
                        <Check className="h-3 w-3" />
                      </span>
                      <span className="truncate text-xs font-medium sm:text-sm">
                        درس {toPersianDigits(lesson.number)}: {lesson.title}
                      </span>
                    </button>
                  );
                })}
              </div>

              {!config.allLessons && config.lessonIds.length === 0 && (
                <p className="text-xs font-medium text-rose-400">
                  لطفاً حداقل یک درس یا گزینه «انتخاب کل کتاب» را بزنید.
                </p>
              )}
            </div>
          </div>

          {/* Launch & Parameters */}
          <div className="space-y-5 rounded-2xl border border-white/10 bg-[#0D151F] p-4 sm:p-6 lg:col-span-4 lg:sticky lg:top-24">
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <label htmlFor="question-count-slider" className="text-xs font-bold text-slate-400">
                  تعداد سوالات
                </label>
                <span className="text-sm font-extrabold text-emerald-400 tabular-nums">
                  {toPersianDigits(config.questionCount)} سوال
                </span>
              </div>

              <input
                id="question-count-slider"
                type="range"
                min={3}
                max={25}
                step={1}
                value={config.questionCount}
                onChange={(e) =>
                  onChangeConfig({ ...config, questionCount: Number(e.target.value) })
                }
                className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-white/10 accent-emerald-400"
              />

              <div className="grid grid-cols-4 gap-2">
                {QUICK_QUESTION_COUNTS.map((cnt) => {
                  const active = config.questionCount === cnt;
                  return (
                    <button
                      key={cnt}
                      type="button"
                      onClick={() => onChangeConfig({ ...config, questionCount: cnt })}
                      className={`min-h-[38px] rounded-lg border text-xs font-bold tabular-nums transition-colors ${
                        active
                          ? 'border-emerald-400 bg-emerald-500 text-slate-950'
                          : 'border-white/10 bg-[#121D2B] text-slate-300 hover:border-emerald-400/40'
                      }`}
                    >
                      {toPersianDigits(cnt)}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="border-t border-white/10" />

            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-400">سطح سوالات</label>
              <div className="grid grid-cols-3 gap-1.5 rounded-xl bg-[#121D2B] p-1">
                {DIFFICULTIES.map((diff) => {
                  const active = config.difficulty === diff.id;
                  const shortLabel =
                    diff.id === 'easy' ? 'آسان' : diff.id === 'standard' ? 'استاندارد' : 'تیزهوشان';
                  return (
                    <button
                      key={diff.id}
                      type="button"
                      onClick={() => onChangeConfig({ ...config, difficulty: diff.id })}
                      className={`min-h-[38px] rounded-lg px-2 py-1.5 text-xs font-bold transition-colors ${
                        active
                          ? 'bg-emerald-500 text-slate-950'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      {shortLabel}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center justify-between rounded-xl border border-white/10 bg-[#121D2B] px-3.5 py-3">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-emerald-400" />
                <span className="text-xs font-semibold text-slate-200 tabular-nums">
                  {config.timedMode
                    ? `تایمر (${toPersianDigits(estimatedMinutes)} دقیقه)`
                    : 'بدون محدودیت زمان'}
                </span>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={config.timedMode}
                onClick={() => onChangeConfig({ ...config, timedMode: !config.timedMode })}
                className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
                  config.timedMode ? 'bg-emerald-500' : 'bg-white/20'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-slate-950 transition-transform ${
                    config.timedMode ? '-translate-x-6' : '-translate-x-1'
                  }`}
                />
              </button>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="custom-focus" className="block text-xs font-bold text-slate-400">
                موضوع دلخواه (اختیاری)
              </label>
              <input
                id="custom-focus"
                type="text"
                value={config.customTopic}
                onChange={(e) => onChangeConfig({ ...config, customTopic: e.target.value })}
                placeholder="مثلاً: فقط عدد اتمی و ایزوتوپ‌ها"
                className="w-full rounded-xl border border-white/10 bg-[#121D2B] px-3.5 py-2.5 text-sm text-white placeholder:text-slate-500 focus:border-emerald-400 focus:outline-none"
              />
            </div>

            <div className="text-xs leading-relaxed text-slate-400">
              <span>{selectedSubject.name}</span>
              <span className="mx-1.5" aria-hidden="true">·</span>
              <span>{getGradeLabel(config.grade)}</span>
              <span className="mx-1.5" aria-hidden="true">·</span>
              <span>
                {config.allLessons
                  ? 'کل کتاب'
                  : selectedLessonsList.length > 0
                    ? selectedLessonsList.map((l) => `درس ${toPersianDigits(l.number)}`).join('، ')
                    : 'انتخاب نشده'}
              </span>
              <span className="mx-1.5" aria-hidden="true">·</span>
              <span>{getDifficultyLabel(config.difficulty)}</span>
            </div>

            {errorMessage && (
              <div
                role="alert"
                className="flex items-start gap-2 rounded-xl border border-rose-500/35 bg-rose-500/10 p-3 text-xs leading-relaxed text-rose-300"
              >
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-400" />
                <span>{errorMessage}</span>
              </div>
            )}

            <button
              type="button"
              disabled={!canSubmit}
              onClick={() => onGenerateExam()}
              className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-l from-emerald-500 to-teal-600 px-5 py-3 text-sm font-extrabold text-slate-950 shadow-[0_8px_28px_rgba(16,185,129,0.28)] transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>در حال ساخت سریع آزمون...</span>
                </>
              ) : (
                <>
                  <FileText className="h-4 w-4" />
                  <span>ساخت آزمون با هوش مصنوعی</span>
                </>
              )}
            </button>
          </div>
        </div>
      </section>

      {/* Popular Exams Grid matching attached layout */}
      <section id="exams" className="scroll-mt-24 space-y-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <span className="text-[10px] font-semibold tracking-[3px] text-emerald-400">
              POPULAR EXAMS
            </span>
            <h2 className="mt-1.5 text-2xl font-extrabold text-white">آزمون‌های پیشنهادی</h2>
          </div>
          <a href="#exam-builder" className="text-xs font-medium text-slate-400 hover:text-emerald-300">
            طراحی دلخواه ←
          </a>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {POPULAR_EXAMS.map((item) => {
            const levelClass =
              item.difficulty === 'advanced'
                ? 'bg-rose-500/15 text-rose-300'
                : item.difficulty === 'easy'
                  ? 'bg-emerald-500/15 text-emerald-300'
                  : 'bg-teal-500/15 text-teal-300';

            return (
              <article
                key={item.id}
                className="flex flex-col justify-between rounded-2xl border border-white/10 bg-gradient-to-br from-[#111B27] to-[#0B121B] p-5 transition-all hover:-translate-y-1 hover:border-emerald-400/45"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <div
                      className={`flex h-12 w-12 items-center justify-center rounded-xl bg-white/[0.06] ${item.accentColor}`}
                    >
                      {item.icon}
                    </div>
                    <span className={`rounded-full px-3 py-1 text-[11px] font-semibold ${levelClass}`}>
                      {item.levelLabel}
                    </span>
                  </div>

                  <small className="mt-4 block text-xs font-medium text-emerald-400">
                    {item.categoryLabel}
                  </small>
                  <h3 className="mt-1.5 text-base font-bold text-white">{item.title}</h3>
                  <p className="mt-1.5 text-xs leading-relaxed text-slate-400">
                    {item.description}
                  </p>
                </div>

                <div className="mt-5 space-y-4">
                  <div className="flex items-center gap-5 text-xs text-slate-400 tabular-nums">
                    <span>{toPersianDigits(item.questionCount)} سؤال</span>
                    <span>{toPersianDigits(item.minutes)} دقیقه</span>
                  </div>

                  <button
                    type="button"
                    disabled={isGenerating}
                    onClick={() => handleLaunchPopular(item)}
                    className="flex min-h-[42px] w-full items-center justify-center rounded-xl border border-emerald-400/30 bg-emerald-500/10 py-2.5 text-xs font-bold text-emerald-300 transition-colors hover:bg-emerald-500/25 disabled:opacity-50"
                  >
                    شروع آزمون ←
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {/* Saved History (if any) */}
      {history.length > 0 && (
        <section id="history-section" className="scroll-mt-24 space-y-5">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-xl font-bold text-white">کارنامه‌های اخیر تو</h2>
            <button
              type="button"
              onClick={onClearHistory}
              className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-slate-400 transition-colors hover:bg-white/5 hover:text-rose-300"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>پاک کردن سابقه</span>
            </button>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {history.map((entry) => {
              const subj = getSubjectById(entry.config.subjectId);
              return (
                <button
                  key={entry.id}
                  type="button"
                  onClick={() => onOpenHistoryEntry(entry)}
                  className="flex flex-col justify-between rounded-2xl border border-white/10 bg-[#0D151F] p-4 text-right transition-colors hover:border-emerald-400/50"
                >
                  <div>
                    <div className="text-xs text-slate-400">
                      <span>{getGradeLabel(entry.config.grade)}</span>
                      <span className="mx-1.5" aria-hidden="true">·</span>
                      <span>{subj.name}</span>
                      <span className="mx-1.5" aria-hidden="true">·</span>
                      <span className="tabular-nums">
                        {formatDurationPersian(entry.timeSpentSeconds)}
                      </span>
                    </div>
                    <h3 className="mt-1.5 line-clamp-1 text-sm font-bold text-white">
                      {entry.examTitle}
                    </h3>
                  </div>

                  <div className="mt-4 flex items-center justify-between border-t border-white/10 pt-3 text-xs">
                    <span className="font-bold text-emerald-400 tabular-nums">
                      {toPersianDigits(entry.scoreOutOf20)} از ۲۰ ({toPersianDigits(entry.scorePercent)}٪)
                    </span>
                    <span className="font-medium text-slate-300">مشاهده تحلیل ←</span>
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* About / Bottom CTA Card matching attached template */}
      <section
        id="about"
        className="rounded-3xl border border-emerald-400/25 bg-[radial-gradient(ellipse_at_center,rgba(16,185,129,0.16),#0B121B)] px-6 py-12 text-center"
      >
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-300">
          <Sparkles className="h-6 w-6" />
        </div>
        <h2 className="text-xl font-extrabold text-white sm:text-2xl">
          یادگیری رو به یک تجربه جذاب تبدیل کن!
        </h2>
        <p className="mt-2.5 text-sm text-slate-400">
          آزمونا؛ همراه هوشمند تو در مسیر یادگیری و پیشرفت.
        </p>
        <a
          href="#exam-builder"
          className="mt-6 inline-flex min-h-[46px] items-center justify-center rounded-xl bg-gradient-to-l from-emerald-500 to-teal-600 px-6 py-3 text-sm font-bold text-slate-950 shadow-[0_8px_28px_rgba(16,185,129,0.25)] transition-transform hover:-translate-y-0.5"
        >
          ساخت آزمون اختصاصی ←
        </a>
      </section>
    </div>
  );
};
