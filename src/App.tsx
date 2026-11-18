/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  Loader2,
  LogOut,
  Trash2,
  User as UserIcon,
  X,
} from 'lucide-react';
import { onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth';
import { ExamSheet } from './components/ExamSheet';
import { auth, googleAuthProvider } from './lib/firebase';
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
const AUTH_TOKEN_KEY = 'azmoona_auth_token_v1';

interface AuthUser {
  id: string;
  email: string;
}

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

function loadGuestHistory(): ExamHistoryEntry[] {
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
  const [examSessionKey, setExamSessionKey] = useState<string>('init');

  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [authToken, setAuthToken] = useState<string | null>(() => {
    try {
      return window.localStorage.getItem(AUTH_TOKEN_KEY);
    } catch {
      return null;
    }
  });

  const [history, setHistory] = useState<ExamHistoryEntry[]>(() => loadGuestHistory());
  const [currentResult, setCurrentResult] = useState<ExamHistoryEntry | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  // Modals: About & Auth
  const [showAboutModal, setShowAboutModal] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<'login' | 'register' | null>(null);
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authConfirmPassword, setAuthConfirmPassword] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const wheelRef = useRef<HTMLDivElement | null>(null);

  // Close open modals with Escape key
  useEffect(() => {
    if (!showAboutModal && !authModalMode) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowAboutModal(false);
        setAuthModalMode(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [showAboutModal, authModalMode]);

  // Listen to Firebase Auth state (token kept strictly in React state memory, never localStorage)
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      if (!fbUser) return;
      try {
        const idToken = await fbUser.getIdToken();
        setAuthToken(idToken);
        setAuthUser({
          id: fbUser.uid,
          email: fbUser.email || 'کاربر گوگل',
        });
        const examsRes = await fetch('/api/user/exams', {
          headers: { Authorization: `Bearer ${idToken}` },
        });
        if (examsRes.ok) {
          const examsData = (await examsRes.json()) as { exams: ExamHistoryEntry[] };
          if (Array.isArray(examsData.exams)) {
            setHistory(examsData.exams);
          }
        }
      } catch {
        // Ignore transient sync error
      }
    });
    return () => unsubscribe();
  }, []);

  // Verify saved email/password auth session and load account report cards from Cloud SQL
  useEffect(() => {
    if (!authToken) return;
    let cancelled = false;

    const loadSession = async () => {
      try {
        const meRes = await fetch('/api/auth/me', {
          headers: { Authorization: `Bearer ${authToken}` },
        });
        if (!meRes.ok) {
          throw new Error('expired');
        }
        const meData = (await meRes.json()) as { user: AuthUser };
        if (cancelled) return;
        setAuthUser(meData.user);

        const examsRes = await fetch('/api/user/exams', {
          headers: { Authorization: `Bearer ${authToken}` },
        });
        if (examsRes.ok) {
          const examsData = (await examsRes.json()) as { exams: ExamHistoryEntry[] };
          if (!cancelled && Array.isArray(examsData.exams)) {
            setHistory(examsData.exams);
          }
        }
      } catch {
        if (!cancelled) {
          setAuthToken(null);
          setAuthUser(null);
          try {
            window.localStorage.removeItem(AUTH_TOKEN_KEY);
          } catch {
            // ignore
          }
        }
      }
    };

    void loadSession();
    return () => {
      cancelled = true;
    };
  }, [authToken]);

  // Persist guest history only when not logged into a server account
  useEffect(() => {
    if (authUser) return;
    try {
      window.localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(history.slice(0, 15)));
    } catch {
      // ignore storage quota
    }
  }, [history, authUser]);

  // Desktop-only 3D drum-roller effect (disabled on mobile <= 767px for clean native scrolling)
  useEffect(() => {
    const wheel = wheelRef.current;
    if (!wheel) return;

    const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (calm) return;

    const panels = Array.from(wheel.querySelectorAll<HTMLElement>('.panel'));
    let cur = window.scrollY;
    let raf = 0;

    const resetStyles = () => {
      for (const p of panels) {
        p.style.transform = '';
        p.style.opacity = '';
      }
    };

    const roll = () => {
      raf = 0;
      if (window.innerWidth < 768) {
        resetStyles();
        return;
      }

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
          p.style.transform = '';
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
      resetStyles();
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

  const persistExamToAccount = useCallback(
    async (entry: ExamHistoryEntry, tokenOverride?: string | null) => {
      const token = tokenOverride ?? authToken;
      if (!token) return;
      try {
        await fetch('/api/user/exams', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(entry),
        });
      } catch {
        // Ignore network hiccup
      }
    },
    [authToken]
  );

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authModalMode) return;
    setAuthError(null);

    if (!authEmail.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(authEmail.trim())) {
      setAuthError('لطفاً یک ایمیل معتبر وارد کنید.');
      return;
    }
    if (authPassword.length < 6) {
      setAuthError('رمز عبور باید حداقل ۶ کاراکتر باشد.');
      return;
    }
    if (authModalMode === 'register' && authPassword !== authConfirmPassword) {
      setAuthError('رمز عبور و تکرار آن با هم برابر نیستند.');
      return;
    }

    setAuthLoading(true);
    try {
      const endpoint =
        authModalMode === 'register' ? '/api/auth/register' : '/api/auth/login';
      const body =
        authModalMode === 'register'
          ? {
              email: authEmail.trim(),
              password: authPassword,
              confirmPassword: authConfirmPassword,
            }
          : { email: authEmail.trim(), password: authPassword };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'خطا در احراز هویت.');
      }

      const token = data.token as string;
      const user = data.user as AuthUser;
      setAuthToken(token);
      setAuthUser(user);
      try {
        window.localStorage.setItem(AUTH_TOKEN_KEY, token);
      } catch {
        // ignore
      }

      // Fetch saved exams for this account
      const examsRes = await fetch('/api/user/exams', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (examsRes.ok) {
        const examsData = (await examsRes.json()) as { exams: ExamHistoryEntry[] };
        setHistory(Array.isArray(examsData.exams) ? examsData.exams : []);
      } else {
        setHistory([]);
      }

      setAuthModalMode(null);
      setAuthEmail('');
      setAuthPassword('');
      setAuthConfirmPassword('');
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'عملیات ناموفق بود.');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setAuthError(null);
    setAuthLoading(true);
    try {
      const cred = await signInWithPopup(auth, googleAuthProvider);
      const idToken = await cred.user.getIdToken();
      setAuthToken(idToken);
      setAuthUser({
        id: cred.user.uid,
        email: cred.user.email || 'کاربر گوگل',
      });
      // Do not store Firebase ID token in localStorage; load saved exams from Cloud SQL
      const examsRes = await fetch('/api/user/exams', {
        headers: { Authorization: `Bearer ${idToken}` },
      });
      if (examsRes.ok) {
        const examsData = (await examsRes.json()) as { exams: ExamHistoryEntry[] };
        setHistory(Array.isArray(examsData.exams) ? examsData.exams : []);
      }
      setAuthModalMode(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      if (!msg.includes('popup-closed-by-user')) {
        setAuthError('ورود با حساب گوگل انجام نشد. لطفاً دوباره امتحان کنید.');
      }
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      if (auth.currentUser) {
        await signOut(auth);
      }
    } catch {
      // ignore
    }
    setAuthToken(null);
    setAuthUser(null);
    setHistory(loadGuestHistory());
    try {
      window.localStorage.removeItem(AUTH_TOKEN_KEY);
    } catch {
      // ignore
    }
  };

  const handleClearHistory = async () => {
    setHistory([]);
    if (authToken) {
      try {
        await fetch('/api/user/exams', {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${authToken}` },
        });
      } catch {
        // ignore
      }
    } else {
      try {
        window.localStorage.removeItem(HISTORY_STORAGE_KEY);
      } catch {
        // ignore
      }
    }
  };

  const handleGenerateExam = useCallback(
    async (overrideConfig?: ExamConfig) => {
      const targetConfig = overrideConfig ?? config;
      setGenerateError(null);
      setIsGenerating(true);
      // Clear any previous active exam or result immediately so sessions never mix
      setActiveExam(null);
      setCurrentResult(null);

      try {
        const subject = getSubjectById(targetConfig.subjectId);
        const gradeLessons = subject.lessonsByGrade[targetConfig.grade] ?? [];
        const selectedLessons = gradeLessons.filter((l) =>
          targetConfig.lessonIds.includes(l.id)
        );

        const recentQuestions = history
          .filter(
            (h) =>
              h.config.grade === targetConfig.grade &&
              h.config.subjectId === targetConfig.subjectId
          )
          .flatMap((h) => h.questions.map((q) => q.question))
          .slice(0, 14);

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
          recentQuestions,
          variationSeed: Date.now(),
        };

        const response = await fetch('/api/exam/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || 'خطا در تولید سؤالات آزمون.');
        }

        setExamSessionKey(`exam-${Date.now()}`);
        setActiveExam(data as GeneratedExam);
        setActiveConfig(targetConfig);

        window.setTimeout(() => {
          document.getElementById('builder')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 80);
      } catch (err) {
        setGenerateError(
          err instanceof Error ? err.message : 'مشکلی در ارتباط با سرور پیش آمد.'
        );
      } finally {
        setIsGenerating(false);
      }
    },
    [config, history]
  );

  const runAnalysisForResult = useCallback(
    async (entry: ExamHistoryEntry) => {
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
        void persistExamToAccount(updatedEntry);
      } catch (err) {
        setAnalysisError(
          err instanceof Error ? err.message : 'تحلیل هوشمند با خطا مواجه شد.'
        );
      } finally {
        setIsAnalyzing(false);
      }
    },
    [persistExamToAccount]
  );

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
      void persistExamToAccount(entry);

      window.setTimeout(() => {
        document.getElementById('sheet')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 60);

      void runAnalysisForResult(entry);
    },
    [activeExam, activeConfig, persistExamToAccount, runAnalysisForResult]
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
    <div className="min-h-screen bg-black text-[#e6e6e6]">
      {/* Minimalist Top Bar: Corner Book Icon + Brand | About + Login/Register */}
      <header className="sticky top-0 z-40 border-b border-[#1c1c1c] bg-black/90 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-[62rem] items-center justify-between gap-2 px-4 sm:h-16 sm:px-6">
          <a
            href="#top"
            className="flex items-center gap-2 text-white shrink-0"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white p-1">
              <img
                src="/assets/aistudio/Open_Book_Icon_27f3a556.png"
                alt="لوگوی آزمونا"
                referrerPolicy="no-referrer"
                className="h-full w-full object-contain"
              />
            </span>
            <span className="font-display text-xl tracking-tight sm:text-2xl">آزمونا</span>
          </a>

          <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => setShowAboutModal(true)}
              className="min-h-[36px] rounded-[6px] px-2 py-1.5 text-xs font-medium text-[#b5b5b5] transition-colors hover:text-white sm:px-2.5 sm:text-sm whitespace-nowrap"
            >
              درباره ما
            </button>

            {authUser ? (
              <div className="flex items-center gap-1.5 sm:gap-2">
                <a
                  href="#history-list"
                  className="hidden sm:inline-flex min-h-[36px] items-center gap-1.5 rounded-[6px] border border-[#2e2e2e] bg-[#0e0e0e] px-3 py-1.5 text-xs font-medium text-white hover:border-[#666]"
                >
                  <UserIcon className="h-3.5 w-3.5" />
                  <span className="max-w-[140px] truncate">{authUser.email}</span>
                </a>
                <button
                  type="button"
                  onClick={handleLogout}
                  aria-label="خروج از حساب"
                  className="inline-flex min-h-[36px] items-center gap-1 rounded-[6px] border border-[#2e2e2e] bg-[#0e0e0e] px-2.5 py-1.5 text-xs font-medium text-[#ccc] hover:border-white hover:text-white whitespace-nowrap"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  <span>خروج</span>
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 sm:gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setAuthError(null);
                    setAuthModalMode('login');
                  }}
                  className="min-h-[36px] rounded-[6px] border border-[#2e2e2e] bg-[#0e0e0e] px-2.5 py-1.5 text-xs font-semibold text-white transition-colors hover:border-[#666] sm:px-3 whitespace-nowrap"
                >
                  ورود
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAuthError(null);
                    setAuthModalMode('register');
                  }}
                  className="min-h-[36px] rounded-[6px] bg-white px-2.5 py-1.5 text-xs font-bold text-black transition-opacity hover:opacity-90 sm:px-3 whitespace-nowrap"
                >
                  ساخت اکانت
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <main ref={wheelRef} className="wheel" id="wheel">
        {/* Panel 1: Hero */}
        <section className="panel hero-panel" id="top">
          <div className="mx-auto w-full max-w-[62rem]">
            <h1 className="hero-title">
              آزمونا<span>هفتم تا نهم</span>
            </h1>
            <p className="mt-6 max-w-[34rem] text-sm leading-8 text-[#9a9a9a] sm:text-lg">
              پایه، درس و فصل کتاب درسی‌ات را انتخاب کن؛ آزمونا در چند ثانیه آزمون چهارگزینه‌ای اختصاصی می‌سازد و در پایان، تک‌تک اشتباهاتت را تحلیل و آموزش می‌دهد.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-5 sm:mt-10">
              <div className="hidden md:flex items-center gap-3 text-sm text-[#8a8a8a]">
                <i className="block h-10 w-px bg-gradient-to-b from-white to-transparent" />
                <span>اسکرول کن</span>
              </div>

              <a
                href="#builder"
                className="min-h-[44px] inline-flex items-center justify-center rounded-[6px] bg-white px-5 py-2.5 text-xs font-extrabold text-black transition-opacity hover:opacity-90 sm:text-sm"
              >
                شروع ساخت آزمون ↓
              </a>
            </div>
          </div>
        </section>

        {/* Panel 2: Features Rows */}
        <section className="panel">
          <div className="mx-auto w-full max-w-[62rem]">
            <h2 className="panel-heading">مخصوص دانش‌آموز</h2>
            <div className="max-w-[46rem]">
              <div className="flex flex-col gap-1 border-t border-[#2e2e2e] py-4 sm:flex-row sm:gap-6 sm:py-5">
                <b className="font-display min-w-[9rem] text-xl text-white">سه پایه</b>
                <span className="text-sm text-[#9a9a9a] sm:text-base">
                  سؤال‌های چهارگزینه‌ای دقیق بر اساس کتاب‌های رسمی هفتم، هشتم و نهم طراحی می‌شوند.
                </span>
              </div>
              <div className="flex flex-col gap-1 border-t border-[#2e2e2e] py-4 sm:flex-row sm:gap-6 sm:py-5">
                <b className="font-display min-w-[9rem] text-xl text-white">انتخاب فصل</b>
                <span className="text-sm text-[#9a9a9a] sm:text-base">
                  فقط درس‌ها و فصل‌هایی را که خوانده‌ای انتخاب کن؛ یک درس، چند فصل یا کل کتاب.
                </span>
              </div>
              <div className="flex flex-col gap-1 border-t border-[#2e2e2e] py-4 sm:flex-row sm:gap-6 sm:py-5">
                <b className="font-display min-w-[9rem] text-xl text-white">سطح دلخواه</b>
                <span className="text-sm text-[#9a9a9a] sm:text-base">
                  از سطح مروری آسان تا چالشی تیزهوشان؛ زمان آزمون را هم خودت تعیین می‌کنی.
                </span>
              </div>
              <div className="flex flex-col gap-1 border-y border-[#2e2e2e] py-4 sm:flex-row sm:gap-6 sm:py-5">
                <b className="font-display min-w-[9rem] text-xl text-white">تحلیل و PDF</b>
                <span className="text-sm text-[#9a9a9a] sm:text-base">
                  روی صفحه آزمون بده، تحلیل کامل غلط‌ها را ببین و برگه یا کارنامه را به صورت PDF دانلود کن.
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* Panel 3: 3 Steps */}
        <section className="panel">
          <div className="mx-auto w-full max-w-[62rem]">
            <h2 className="panel-heading">سه قدم تا آزمون</h2>
            <div className="grid max-w-[60rem] grid-cols-1 border border-[#2e2e2e] sm:grid-cols-3">
              <div className="bg-[#0e0e0e] p-5 sm:p-6">
                <b className="font-display mb-1 block text-xl text-white">پایه و درس</b>
                <span className="text-sm text-[#9a9a9a]">هفتم، هشتم یا نهم و درس موردنظر</span>
              </div>
              <div className="border-t border-[#2e2e2e] bg-[#0e0e0e] p-5 sm:border-t-0 sm:border-r sm:p-6">
                <b className="font-display mb-1 block text-xl text-white">فصل‌ها</b>
                <span className="text-sm text-[#9a9a9a]">یک فصل خاص یا چند فصل برای مرور</span>
              </div>
              <div className="border-t border-[#2e2e2e] bg-[#0e0e0e] p-5 sm:border-t-0 sm:border-r sm:p-6">
                <b className="font-display mb-1 block text-xl text-white">آزمون و تحلیل</b>
                <span className="text-sm text-[#9a9a9a]">حل چهارگزینه‌ای و توضیح کامل غلط‌ها</span>
              </div>
            </div>
          </div>
        </section>

        {/* Panel 4: Builder (collapses cleanly when an exam or report card is open) */}
        <section
          className="panel tall bg-gradient-to-b from-black to-[#0b0b0b]"
          id="builder"
        >
          <div className="mx-auto w-full max-w-[62rem]">
            {!activeExam && !currentResult && (
              <>
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <h2 className="panel-heading !mb-0">ساخت آزمون</h2>
                </div>

                <div className="rounded-[6px] border border-[#2e2e2e] bg-[#0e0e0e] p-4 sm:p-8">
            {/* Grade */}
            <div className="mb-5 sm:mb-6">
              <label className="mb-2 block text-sm text-[#9a9a9a]">پایه تحصیلی</label>
              <div className="flex flex-wrap gap-2">
                {GRADES.map((g) => (
                  <button
                    key={g.id}
                    type="button"
                    aria-pressed={config.grade === g.id}
                    onClick={() => handleGradeChange(g.id)}
                    className="chip text-xs sm:text-sm"
                  >
                    پایه‌ی {g.shortLabel}
                  </button>
                ))}
              </div>
            </div>

            {/* Subject */}
            <div className="mb-5 sm:mb-6">
              <label className="mb-2 block text-sm text-[#9a9a9a]">نام درس</label>
              <div className="flex flex-wrap gap-2">
                {SUBJECTS.map((subj) => (
                  <button
                    key={subj.id}
                    type="button"
                    aria-pressed={config.subjectId === subj.id}
                    onClick={() => handleSubjectChange(subj.id)}
                    className="chip text-xs sm:text-sm"
                  >
                    {subj.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Chapters */}
            <div className="mb-5 sm:mb-6">
              <label className="mb-2 block text-sm text-[#9a9a9a]">
                فصل‌ها (می‌توانی یک یا چند فصل انتخاب کنی)
              </label>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  aria-pressed={config.allLessons}
                  onClick={handleToggleAllLessons}
                  className="chip text-xs sm:text-sm"
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
            <div className="mb-5 grid grid-cols-1 gap-4 sm:mb-6 sm:grid-cols-2">
              <div>
                <label htmlFor="count-select" className="mb-2 block text-sm text-[#9a9a9a]">
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
                  className="mono-select min-h-[44px] w-full rounded-[6px] border border-[#2e2e2e] bg-[#1a1a1a] px-3 py-2 text-sm text-[#e6e6e6]"
                >
                  <option value={5}>۵ سؤال</option>
                  <option value={10}>۱۰ سؤال</option>
                  <option value={15}>۱۵ سؤال</option>
                  <option value={20}>۲۰ سؤال</option>
                </select>
              </div>

              <div>
                <label htmlFor="time-select" className="mb-2 block text-sm text-[#9a9a9a]">
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
                  className="mono-select min-h-[44px] w-full rounded-[6px] border border-[#2e2e2e] bg-[#1a1a1a] px-3 py-2 text-sm text-[#e6e6e6]"
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
            <div className="mb-5 sm:mb-6">
              <label className="mb-2 block text-sm text-[#9a9a9a]">سطح دشواری</label>
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
                      className="chip text-xs sm:text-sm"
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Custom topic focus */}
            <div className="mb-6">
              <label htmlFor="custom-topic-input" className="mb-2 block text-sm text-[#9a9a9a]">
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
                  <span>در حال طراحی سریع آزمون...</span>
                </>
              ) : (
                <span>ساخت آزمون</span>
              )}
            </button>
          </div>
          </>
          )}

          {/* Light Paper Exam Sheet + Results & Mistake Analysis */}
          <ExamSheet
            key={currentResult ? `result-${currentResult.id}` : examSessionKey}
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
              setExamSessionKey(`exam-${Date.now()}`);
              document.getElementById('builder')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }}
          />

          {/* Account / Local History */}
          <div id="history-list" className="mt-12 border-t border-[#2e2e2e] pt-8">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="font-display text-2xl text-white">
                  {authUser ? `کارنامه‌های حساب شما` : 'کارنامه‌های اخیر'}
                </h3>
                {!authUser && (
                  <p className="mt-0.5 text-xs text-[#8a8a8a]">
                    برای ذخیره دائمی کارنامه‌ها روی حساب خودت، از بالا وارد شو یا اکانت بساز.
                  </p>
                )}
              </div>

              {history.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearHistory}
                  className="inline-flex items-center gap-1.5 text-xs text-[#8a8a8a] hover:text-white"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>پاک کردن</span>
                </button>
              )}
            </div>

            {history.length === 0 ? (
              <div className="rounded-[6px] border border-dashed border-[#2e2e2e] p-6 text-center text-xs text-[#8a8a8a]">
                هنوز کارنامه‌ای در این {authUser ? 'حساب کاربری' : 'مرورگر'} ثبت نشده است.
              </div>
            ) : (
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
                        {getGradeLabel(entry.config.grade)} ·{' '}
                        {getSubjectById(entry.config.subjectId).name}
                      </div>
                    </div>
                    <div className="shrink-0 text-left text-xs font-bold text-white tabular-nums">
                      {toPersianDigits(entry.scoreOutOf20)} از ۲۰
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-[#1c1c1c] px-4 py-8 text-center text-xs text-[#8a8a8a] sm:px-6">
        <div className="mx-auto flex max-w-[62rem] flex-col items-center justify-between gap-2 sm:flex-row">
          <span>© ۲۰۲۶ آزمونا (Azmona). تمامی حقوق محفوظ است.</span>
          <span className="text-[#666]">آزمون‌ساز هوشمند دوره اول متوسطه (هفتم تا نهم)</span>
        </div>
      </footer>

      {/* About Modal */}
      {showAboutModal && (
        <div
          dir="rtl"
          role="dialog"
          aria-modal="true"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowAboutModal(false);
          }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3 sm:p-4 backdrop-blur-xs"
        >
          <div className="w-full max-w-[27rem] max-h-[90dvh] overflow-y-auto rounded-[6px] border border-[#2e2e2e] bg-[#0e0e0e] p-5 text-right sm:p-6">
            <div className="flex items-center justify-between border-b border-[#2e2e2e] pb-3">
              <div className="flex items-center gap-2.5">
                <span className="flex h-7 w-7 items-center justify-center rounded bg-white p-1">
                  <img
                    src="/assets/aistudio/Open_Book_Icon_27f3a556.png"
                    alt="لوگوی آزمونا"
                    className="h-full w-full object-contain"
                  />
                </span>
                <h2 className="font-display text-2xl text-white">درباره آزمونا</h2>
              </div>
              <button
                type="button"
                onClick={() => setShowAboutModal(false)}
                aria-label="بستن"
                className="rounded p-1 text-[#8a8a8a] hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-4 space-y-3 text-sm leading-7 text-[#bdbdbd]">
              <p>
                <strong className="text-white">آزمونا (Azmona)</strong> یک دستیار هوشمند آموزش برای دانش‌آموزان پایه‌های <strong className="text-white">هفتم، هشتم و نهم</strong> است.
              </p>
              <p>
                کافی است پایه، درس و فصل دقیق کتاب درسی‌ات را انتخاب کنی تا سؤالات چهارگزینه‌ای استاندارد طراحی شود. در پایان هم تمام پاسخ‌های اشتباهت به زبان ساده تحلیل می‌شوند و می‌توانی کارنامه یا برگه آزمون را با فرمت PDF دانلود کنی.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setShowAboutModal(false)}
              className="mt-6 min-h-[42px] w-full rounded-[6px] bg-white py-2 text-sm font-bold text-black hover:opacity-90"
            >
              متوجه شدم
            </button>
          </div>
        </div>
      )}

      {/* Auth Modal (Login / Sign Up with Email, Password, Confirm Password) */}
      {authModalMode && (
        <div
          dir="rtl"
          role="dialog"
          aria-modal="true"
          onClick={(e) => {
            if (e.target === e.currentTarget) setAuthModalMode(null);
          }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3 sm:p-4 backdrop-blur-xs"
        >
          <div className="w-full max-w-[27rem] max-h-[90dvh] overflow-y-auto rounded-[6px] border border-[#2e2e2e] bg-[#0e0e0e] p-5 text-right sm:p-6">
            <div className="flex items-center justify-between border-b border-[#2e2e2e] pb-3">
              <h2 className="font-display text-2xl text-white">
                {authModalMode === 'register' ? 'ساخت اکانت آزمونا' : 'ورود به حساب'}
              </h2>
              <button
                type="button"
                onClick={() => setAuthModalMode(null)}
                aria-label="بستن"
                className="rounded p-1 text-[#8a8a8a] hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-4">
              <button
                type="button"
                disabled={authLoading}
                onClick={handleGoogleSignIn}
                className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-[6px] border border-[#3a3a3a] bg-[#1a1a1a] px-4 py-2 text-xs font-bold text-white transition-colors hover:border-white disabled:opacity-60 sm:text-sm"
              >
                <span>ورود یا ساخت اکانت با گوگل (Google)</span>
              </button>

              <div className="my-4 flex items-center gap-3 text-[11px] text-[#666]">
                <span className="h-px flex-1 bg-[#2e2e2e]" />
                <span>یا با ایمیل و رمز عبور</span>
                <span className="h-px flex-1 bg-[#2e2e2e]" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 rounded-[6px] bg-[#1a1a1a] p-1">
              <button
                type="button"
                onClick={() => {
                  setAuthError(null);
                  setAuthModalMode('login');
                }}
                className={`min-h-[38px] rounded-[4px] text-xs font-bold transition-colors ${
                  authModalMode === 'login'
                    ? 'bg-white text-black'
                    : 'text-[#8a8a8a] hover:text-white'
                }`}
              >
                ورود به اکانت
              </button>
              <button
                type="button"
                onClick={() => {
                  setAuthError(null);
                  setAuthModalMode('register');
                }}
                className={`min-h-[38px] rounded-[4px] text-xs font-bold transition-colors ${
                  authModalMode === 'register'
                    ? 'bg-white text-black'
                    : 'text-[#8a8a8a] hover:text-white'
                }`}
              >
                ساخت اکانت جدید
              </button>
            </div>

            <form onSubmit={handleAuthSubmit} className="mt-5 space-y-4 text-right">
              <div>
                <label htmlFor="auth-email" className="mb-1.5 block text-xs text-[#9a9a9a]">
                  ایمیل
                </label>
                <input
                  id="auth-email"
                  type="email"
                  required
                  dir={authEmail ? 'ltr' : 'rtl'}
                  value={authEmail}
                  onChange={(e) => setAuthEmail(e.target.value)}
                  placeholder="مثلاً student@gmail.com"
                  className="mono-input min-h-[44px] w-full rounded-[6px] border border-[#2e2e2e] bg-[#1a1a1a] px-3.5 py-2 text-right text-sm text-white placeholder:text-[#666]"
                />
              </div>

              <div>
                <label htmlFor="auth-pass" className="mb-1.5 block text-xs text-[#9a9a9a]">
                  رمز عبور (حداقل ۶ کاراکتر)
                </label>
                <input
                  id="auth-pass"
                  type="password"
                  required
                  minLength={6}
                  dir="rtl"
                  value={authPassword}
                  onChange={(e) => setAuthPassword(e.target.value)}
                  placeholder="رمز عبور را وارد کنید"
                  className="mono-input min-h-[44px] w-full rounded-[6px] border border-[#2e2e2e] bg-[#1a1a1a] px-3.5 py-2 text-right text-sm text-white placeholder:text-[#666]"
                />
              </div>

              {authModalMode === 'register' && (
                <div>
                  <label htmlFor="auth-confirm" className="mb-1.5 block text-xs text-[#9a9a9a]">
                    تکرار رمز عبور
                  </label>
                  <input
                    id="auth-confirm"
                    type="password"
                    required
                    minLength={6}
                    dir="rtl"
                    value={authConfirmPassword}
                    onChange={(e) => setAuthConfirmPassword(e.target.value)}
                    placeholder="رمز عبور را دوباره وارد کنید"
                    className="mono-input min-h-[44px] w-full rounded-[6px] border border-[#2e2e2e] bg-[#1a1a1a] px-3.5 py-2 text-right text-sm text-white placeholder:text-[#666]"
                  />
                </div>
              )}

              {authError && (
                <div
                  role="alert"
                  className="flex items-start gap-2 rounded-[6px] border border-rose-500/40 bg-rose-500/10 p-3 text-xs text-rose-300"
                >
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{authError}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={authLoading}
                className="flex min-h-[46px] w-full items-center justify-center gap-2 rounded-[6px] bg-white py-2.5 text-sm font-extrabold text-black transition-opacity hover:opacity-90 disabled:opacity-60"
              >
                {authLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <span>
                    {authModalMode === 'register' ? 'ایجاد حساب و ورود' : 'ورود به حساب'}
                  </span>
                )}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
