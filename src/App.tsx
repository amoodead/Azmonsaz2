/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  Database,
  Loader2,
  LogOut,
  Menu,
  Trash2,
  User as UserIcon,
  X,
} from 'lucide-react';
import {
  getRedirectResult,
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  signOut,
} from 'firebase/auth';
import { ExamSheet } from './components/ExamSheet';
import { OwnerDatabaseModal } from './components/OwnerDatabaseModal';
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
const AUTH_USER_KEY = 'azmoona_auth_user_v1';
const ACTIVE_SESSION_STORAGE_KEY = 'azmoona_active_session_v1';

interface AuthUser {
  id: string;
  email: string;
  isOwner?: boolean;
}

function loadSavedAuthUser(): AuthUser | null {
  try {
    const raw = window.localStorage.getItem(AUTH_USER_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<AuthUser>;
    if (parsed && typeof parsed.id === 'string' && typeof parsed.email === 'string') {
      return {
        id: parsed.id,
        email: parsed.email,
        isOwner: Boolean(parsed.isOwner),
      };
    }
    return null;
  } catch {
    return null;
  }
}

function saveAuthSession(token: string | null, user: AuthUser | null): void {
  try {
    if (token) {
      window.localStorage.setItem(AUTH_TOKEN_KEY, token);
    } else {
      window.localStorage.removeItem(AUTH_TOKEN_KEY);
    }
    if (user) {
      window.localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
    } else {
      window.localStorage.removeItem(AUTH_USER_KEY);
    }
  } catch {
    // ignore storage quota errors
  }
}

interface PersistedSessionState {
  activeExam: GeneratedExam | null;
  activeConfig: ExamConfig;
  examSessionKey: string;
  currentResult: ExamHistoryEntry | null;
  draftAnswers: Record<string, number>;
  draftElapsedSeconds: number;
  timeSelection: string;
}

const DEFAULT_CONFIG: ExamConfig = {
  grade: '7',
  subjectId: 'science',
  lessonIds: ['sci-7-1'],
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

function loadActiveSession(): PersistedSessionState | null {
  try {
    const raw = window.localStorage.getItem(ACTIVE_SESSION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PersistedSessionState>;
    if (!parsed || (!parsed.activeExam && !parsed.currentResult)) return null;
    return {
      activeExam: parsed.activeExam ?? null,
      activeConfig: parsed.activeConfig ?? DEFAULT_CONFIG,
      examSessionKey: parsed.examSessionKey || `exam-${Date.now()}`,
      currentResult: parsed.currentResult ?? null,
      draftAnswers: parsed.draftAnswers ?? {},
      draftElapsedSeconds: Number(parsed.draftElapsedSeconds) || 0,
      timeSelection: parsed.timeSelection || 'auto',
    };
  } catch {
    return null;
  }
}

function writeActiveSessionSync(state: PersistedSessionState | null): void {
  try {
    if (!state || (!state.activeExam && !state.currentResult)) {
      window.localStorage.removeItem(ACTIVE_SESSION_STORAGE_KEY);
      return;
    }
    window.localStorage.setItem(ACTIVE_SESSION_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore storage quota errors
  }
}

async function safeParseJson(res: Response): Promise<Record<string, unknown>> {
  try {
    const text = await res.text();
    if (!text) return {};
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function mapFirebaseAuthError(code: string): string {
  if (code === 'auth/unauthorized-domain') {
    return 'این دامنه در بخش دامنه‌های مجاز (Authorized domains) تنظیمات Firebase ثبت نشده است.';
  }
  if (code === 'auth/operation-not-allowed') {
    return 'ورود با گوگل در کنسول Firebase فعال نشده است. از ایمیل و رمز عبور استفاده کنید.';
  }
  if (code === 'auth/network-request-failed') {
    return 'اتصال اینترنت یا دسترسی به سرویس گوگل برقرار نشد.';
  }
  if (code === 'auth/popup-blocked' || code === 'auth/operation-not-supported-in-this-environment') {
    return 'مرورگر اجازه باز شدن پنجره گوگل را نداد. لطفاً با ایمیل و رمز عبور وارد شوید.';
  }
  return 'ورود با حساب گوگل انجام نشد. لطفاً دوباره امتحان کنید یا با ایمیل اکانت بسازید.';
}

export default function App() {
  const initialSessionRef = useRef<PersistedSessionState | null | undefined>(undefined);
  if (initialSessionRef.current === undefined) {
    initialSessionRef.current = loadActiveSession();
  }
  const restoredSession = initialSessionRef.current;

  const [config, setConfig] = useState<ExamConfig>(
    restoredSession?.activeConfig ?? DEFAULT_CONFIG
  );
  const [timeSelection, setTimeSelection] = useState<string>(
    restoredSession?.timeSelection ?? 'auto'
  );

  const [isGenerating, setIsGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [activeExam, setActiveExam] = useState<GeneratedExam | null>(
    restoredSession?.activeExam ?? null
  );
  const [activeConfig, setActiveConfig] = useState<ExamConfig>(
    restoredSession?.activeConfig ?? DEFAULT_CONFIG
  );
  const [examSessionKey, setExamSessionKey] = useState<string>(
    restoredSession?.examSessionKey ?? 'init'
  );
  const [draftAnswers, setDraftAnswers] = useState<Record<string, number>>(
    restoredSession?.draftAnswers ?? {}
  );
  const [draftElapsedSeconds, setDraftElapsedSeconds] = useState<number>(
    restoredSession?.draftElapsedSeconds ?? 0
  );

  const [authUser, setAuthUser] = useState<AuthUser | null>(() => loadSavedAuthUser());
  const [authToken, setAuthToken] = useState<string | null>(() => {
    try {
      return window.localStorage.getItem(AUTH_TOKEN_KEY);
    } catch {
      return null;
    }
  });
  const [authSource, setAuthSource] = useState<'local' | 'firebase' | null>(() => {
    try {
      return window.localStorage.getItem(AUTH_TOKEN_KEY) || window.localStorage.getItem(AUTH_USER_KEY)
        ? 'local'
        : null;
    } catch {
      return null;
    }
  });

  const [history, setHistory] = useState<ExamHistoryEntry[]>(() => loadGuestHistory());
  const [currentResult, setCurrentResult] = useState<ExamHistoryEntry | null>(
    restoredSession?.currentResult ?? null
  );
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  // Modals: About, Auth, Owner Database & Mobile Drawer
  const [showAboutModal, setShowAboutModal] = useState(false);
  const [showOwnerDbModal, setShowOwnerDbModal] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<'login' | 'register' | null>(null);
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authConfirmPassword, setAuthConfirmPassword] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const wheelRef = useRef<HTMLDivElement | null>(null);

  // Close open modals & mobile menu with Escape key
  useEffect(() => {
    if (!showAboutModal && !authModalMode && !showOwnerDbModal && !showMobileMenu) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowAboutModal(false);
        setAuthModalMode(null);
        setShowOwnerDbModal(false);
        setShowMobileMenu(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [showAboutModal, authModalMode, showOwnerDbModal]);

  // Scroll directly to restored active exam/result after page refresh so it never looks lost
  useEffect(() => {
    if (!restoredSession?.activeExam && !restoredSession?.currentResult) return;
    const timer = window.setTimeout(() => {
      document.getElementById('sheet')?.scrollIntoView({ behavior: 'auto', block: 'start' });
    }, 80);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist active exam / report card across browser refresh + mobile pagehide
  useEffect(() => {
    const stateToSave: PersistedSessionState | null =
      !activeExam && !currentResult
        ? null
        : {
            activeExam,
            activeConfig,
            examSessionKey,
            currentResult,
            draftAnswers,
            draftElapsedSeconds,
            timeSelection,
          };

    writeActiveSessionSync(stateToSave);

    const flushSession = () => writeActiveSessionSync(stateToSave);
    window.addEventListener('pagehide', flushSession);
    window.addEventListener('beforeunload', flushSession);
    return () => {
      window.removeEventListener('pagehide', flushSession);
      window.removeEventListener('beforeunload', flushSession);
    };
  }, [
    activeExam,
    activeConfig,
    examSessionKey,
    currentResult,
    draftAnswers,
    draftElapsedSeconds,
    timeSelection,
  ]);

  // Exchange a Firebase ID token for a 180-day persistent server session + HttpOnly cookie
  const exchangeGoogleSession = useCallback(
    async (idToken: string, fallbackUser: AuthUser): Promise<{ token: string; user: AuthUser }> => {
      try {
        const res = await fetch('/api/auth/google', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ idToken }),
        });
        if (res.ok) {
          const data = (await res.json()) as { token?: string; user?: AuthUser };
          if (data.token && data.user?.email) {
            saveAuthSession(data.token, data.user);
            return { token: data.token, user: data.user };
          }
        }
      } catch {
        // Ignore transient network hiccup; keep Firebase token & cached user
      }
      saveAuthSession(null, fallbackUser);
      return { token: idToken, user: fallbackUser };
    },
    []
  );

  // Listen to Firebase Auth state & handle mobile redirect sign-in results
  useEffect(() => {
    let mounted = true;
    void getRedirectResult(auth).catch((err: unknown) => {
      if (!mounted) return;
      const code =
        typeof err === 'object' && err !== null && 'code' in err
          ? String((err as { code?: unknown }).code)
          : '';
      if (code && code !== 'auth/popup-closed-by-user' && code !== 'auth/cancelled-popup-request') {
        setAuthError(mapFirebaseAuthError(code));
        setAuthModalMode('login');
      }
    });

    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      if (!fbUser || !mounted) return;
      try {
        const idToken = await fbUser.getIdToken();
        if (!mounted) return;
        const fallbackUser: AuthUser = {
          id: fbUser.uid,
          email: fbUser.email || 'کاربر گوگل',
        };
        const session = await exchangeGoogleSession(idToken, fallbackUser);
        if (!mounted) return;

        setAuthSource(session.token === idToken ? 'firebase' : 'local');
        setAuthToken(session.token);
        setAuthUser(session.user);

        const examsRes = await fetch('/api/user/exams', {
          credentials: 'include',
          headers: { Authorization: `Bearer ${session.token}` },
        });
        if (examsRes.ok && mounted) {
          const examsData = (await examsRes.json()) as { exams: ExamHistoryEntry[] };
          if (Array.isArray(examsData.exams)) {
            setHistory(examsData.exams);
          }
        }
        if (mounted) {
          setAuthModalMode(null);
        }
      } catch {
        // Ignore transient sync error
      }
    });
    return () => {
      mounted = false;
      unsubscribe();
    };
  }, [exchangeGoogleSession]);

  // Restore saved account session once on mount via Bearer token OR persistent HttpOnly cookie
  // Never wipes local login on offline/cold-start network errors — only when server explicitly reports invalid session
  useEffect(() => {
    let cancelled = false;

    const loadSession = async () => {
      try {
        const headers: Record<string, string> = {};
        if (authToken) {
          headers.Authorization = `Bearer ${authToken}`;
        }

        const sessionRes = await fetch('/api/auth/session', {
          credentials: 'include',
          headers,
        });

        if (!sessionRes.ok) {
          // Transient 5xx (e.g. Render cold start) — keep saved session intact
          return;
        }

        const sessionData = (await sessionRes.json()) as {
          authenticated?: boolean;
          user?: AuthUser | null;
          token?: string;
        };
        if (cancelled) return;

        if (!sessionData.authenticated || !sessionData.user) {
          if (!auth.currentUser) {
            setAuthToken(null);
            setAuthUser(null);
            setAuthSource(null);
            saveAuthSession(null, null);
          }
          return;
        }

        const nextToken = sessionData.token || authToken;
        setAuthSource('local');
        setAuthToken(nextToken);
        setAuthUser(sessionData.user);
        saveAuthSession(nextToken, sessionData.user);

        const examHeaders: Record<string, string> = {};
        if (nextToken) {
          examHeaders.Authorization = `Bearer ${nextToken}`;
        }
        const examsRes = await fetch('/api/user/exams', {
          credentials: 'include',
          headers: examHeaders,
        });
        if (examsRes.ok) {
          const examsData = (await examsRes.json()) as { exams: ExamHistoryEntry[] };
          if (!cancelled && Array.isArray(examsData.exams)) {
            setHistory(examsData.exams);
          }
        }
      } catch {
        // Offline / network error — keep logged-in state on phone intact
      }
    };

    void loadSession();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist guest history only when not logged into a server account
  useEffect(() => {
    if (authUser) return;
    try {
      window.localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(history.slice(0, 15)));
    } catch {
      // ignore storage quota
    }
  }, [history, authUser]);

  // Smooth 3D drum-roller effect on both desktop (wheel damping) and mobile (1:1 finger-locked glide)
  useEffect(() => {
    const wheel = wheelRef.current;
    if (!wheel) return;

    const desktopMedia = window.matchMedia('(min-width: 768px) and (hover: hover)');
    const calmMedia = window.matchMedia('(prefers-reduced-motion: reduce)');
    const panels = Array.from(wheel.querySelectorAll<HTMLElement>('.panel'));

    const resetStyles = () => {
      for (const p of panels) {
        p.style.transform = '';
        p.style.transformOrigin = '';
        p.style.opacity = '';
      }
    };

    if (calmMedia.matches) {
      resetStyles();
      return;
    }

    let cur = window.scrollY;
    let raf = 0;
    let lastWidth = window.innerWidth;
    // Lock viewport height on mobile so browser address-bar show/hide doesn't cause jitter
    let stableHeight = window.innerHeight;

    const roll = () => {
      raf = 0;
      if (calmMedia.matches) {
        resetStyles();
        return;
      }

      const isDesktop = desktopMedia.matches;
      const y = window.scrollY;

      if (isDesktop) {
        cur += (y - cur) * 0.14;
        if (Math.abs(y - cur) < 0.4) cur = y;
      } else {
        // On touch devices, stay 1:1 with native momentum scroll so text never lags or jumps
        cur = y;
      }

      const vh = isDesktop ? window.innerHeight : stableHeight;
      const mid = vh / 2;
      const rad = vh * (isDesktop ? 0.95 : 1.05);
      const dy = isDesktop ? y - cur : 0;

      for (const p of panels) {
        const h = p.offsetHeight;
        const vt = p.offsetTop - cur;
        if (h > vh * 1.25 || p.classList.contains('tall')) {
          p.style.transform = '';
          p.style.transformOrigin = '';
          p.style.opacity = '';
          continue;
        }
        const off = vt + h / 2 - mid;
        const maxAngle = isDesktop ? 1.45 : 1.15;
        const th = Math.max(-maxAngle, Math.min(maxAngle, off / rad));
        p.style.transformOrigin = `50% ${mid - vt}px`;
        p.style.transform = `translate3d(0, ${dy}px, 0) perspective(1600px) translateZ(${-rad}px) rotateX(${-th}rad) translateZ(${rad}px) translateY(${-off}px)`;
        p.style.opacity = Math.max(0, 1 - Math.pow(Math.abs(th) / 1.3, 2.2)).toFixed(3);
      }

      if (isDesktop && cur !== y) {
        raf = window.requestAnimationFrame(roll);
      }
    };

    const kick = () => {
      if (!raf) raf = window.requestAnimationFrame(roll);
    };

    const handleResize = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      if (w !== lastWidth || Math.abs(h - stableHeight) > 140) {
        lastWidth = w;
        stableHeight = h;
      }
      kick();
    };

    window.addEventListener('scroll', kick, { passive: true });
    window.addEventListener('resize', handleResize, { passive: true });
    if (document.fonts) {
      document.fonts.ready.then(kick).catch(() => {});
    }
    roll();

    return () => {
      window.removeEventListener('scroll', kick);
      window.removeEventListener('resize', handleResize);
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
      if (!token && !authUser) return;
      try {
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
        };
        if (token) {
          headers.Authorization = `Bearer ${token}`;
        }
        await fetch('/api/user/exams', {
          method: 'POST',
          credentials: 'include',
          headers,
          body: JSON.stringify(entry),
        });
      } catch {
        // Ignore network hiccup
      }
    },
    [authToken, authUser]
  );

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authModalMode) return;
    setAuthError(null);

    const trimmedEmail = authEmail.replace(/[\u200B-\u200F\uFEFF\s]/g, '').toLowerCase();
    if (!trimmedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
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
              email: trimmedEmail,
              password: authPassword,
              confirmPassword: authConfirmPassword,
            }
          : { email: trimmedEmail, password: authPassword };

      const res = await fetch(endpoint, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await safeParseJson(res);
      if (!res.ok) {
        throw new Error(
          typeof data.error === 'string' && data.error
            ? data.error
            : 'خطا در برقراری ارتباط با سرور احراز هویت.'
        );
      }

      const token = String(data.token || '');
      const user = data.user as AuthUser;
      if (!token || !user?.email) {
        throw new Error('پاسخ سرور برای ورود کامل نبود. لطفاً دوباره امتحان کنید.');
      }

      saveAuthSession(token, user);
      setAuthSource('local');
      setAuthToken(token);
      setAuthUser(user);

      // Fetch saved exams for this account
      const examsRes = await fetch('/api/user/exams', {
        credentials: 'include',
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
    const inIframe = (() => {
      try {
        return window.self !== window.top;
      } catch {
        return true;
      }
    })();

    try {
      const cred = await signInWithPopup(auth, googleAuthProvider);
      const idToken = await cred.user.getIdToken();
      const fallbackUser: AuthUser = {
        id: cred.user.uid,
        email: cred.user.email || 'کاربر گوگل',
      };
      const session = await exchangeGoogleSession(idToken, fallbackUser);

      setAuthSource(session.token === idToken ? 'firebase' : 'local');
      setAuthToken(session.token);
      setAuthUser(session.user);

      const examsRes = await fetch('/api/user/exams', {
        credentials: 'include',
        headers: { Authorization: `Bearer ${session.token}` },
      });
      if (examsRes.ok) {
        const examsData = (await examsRes.json()) as { exams: ExamHistoryEntry[] };
        setHistory(Array.isArray(examsData.exams) ? examsData.exams : []);
      }
      setAuthModalMode(null);
    } catch (err: unknown) {
      const code =
        typeof err === 'object' && err !== null && 'code' in err
          ? String((err as { code?: unknown }).code)
          : '';
      if (
        !inIframe &&
        (code === 'auth/popup-blocked' ||
          code === 'auth/operation-not-supported-in-this-environment')
      ) {
        // Fallback only on top-level windows (mobile browsers that block popups)
        try {
          await signInWithRedirect(auth, googleAuthProvider);
          return;
        } catch {
          setAuthError('مرورگر گوشی اجازه باز شدن پنجره گوگل را نداد. لطفاً با ایمیل وارد شوید.');
        }
      } else if (code !== 'auth/popup-closed-by-user' && code !== 'auth/cancelled-popup-request') {
        setAuthError(mapFirebaseAuthError(code));
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
    try {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    } catch {
      // ignore
    }
    saveAuthSession(null, null);
    setShowOwnerDbModal(false);
    setAuthToken(null);
    setAuthUser(null);
    setAuthSource(null);
    setHistory(loadGuestHistory());
  };

  const handleClearHistory = async () => {
    setHistory([]);
    if (authToken || authUser) {
      try {
        const headers: Record<string, string> = {};
        if (authToken) {
          headers.Authorization = `Bearer ${authToken}`;
        }
        await fetch('/api/user/exams', {
          method: 'DELETE',
          credentials: 'include',
          headers,
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
      setDraftAnswers({});
      setDraftElapsedSeconds(0);

      try {
        const subject = getSubjectById(targetConfig.subjectId);
        const gradeLessons = subject.lessonsByGrade[targetConfig.grade] ?? [];
        const selectedLessons = targetConfig.allLessons
          ? gradeLessons
          : gradeLessons.filter((l) => targetConfig.lessonIds.includes(l.id));
        const excludedLessons = targetConfig.allLessons
          ? []
          : gradeLessons.filter((l) => !targetConfig.lessonIds.includes(l.id));

        const recentQuestions = history
          .filter(
            (h) =>
              h.config.grade === targetConfig.grade &&
              h.config.subjectId === targetConfig.subjectId &&
              (targetConfig.allLessons ||
                h.config.lessonIds.some((id) => targetConfig.lessonIds.includes(id)))
          )
          .flatMap((h) => h.questions.map((q) => q.question))
          .slice(0, 12);

        const payload = {
          gradeLabel: getGradeLabel(targetConfig.grade),
          subjectName: subject.name,
          lessonTitles: selectedLessons.map(
            (l) => `درس ${toPersianDigits(l.number)}: ${l.title}`
          ),
          lessonTopics: selectedLessons.map((l) => `${l.title}: ${l.topics}`),
          excludedLessonTitles: excludedLessons.map(
            (l) => `درس ${toPersianDigits(l.number)}: ${l.title}`
          ),
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

        const newKey = `exam-${Date.now()}`;
        const generated = data as GeneratedExam;
        writeActiveSessionSync({
          activeExam: generated,
          activeConfig: targetConfig,
          examSessionKey: newKey,
          currentResult: null,
          draftAnswers: {},
          draftElapsedSeconds: 0,
          timeSelection,
        });
        setExamSessionKey(newKey);
        setActiveExam(generated);
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

  const handleDraftChange = useCallback(
    (ans: Record<string, number>, elapsed: number) => {
      setDraftAnswers(ans);
      setDraftElapsedSeconds(elapsed);
      if (activeExam || currentResult) {
        writeActiveSessionSync({
          activeExam,
          activeConfig,
          examSessionKey,
          currentResult,
          draftAnswers: ans,
          draftElapsedSeconds: elapsed,
          timeSelection,
        });
      }
    },
    [activeExam, activeConfig, examSessionKey, currentResult, timeSelection]
  );

  const resolvedTimeLimitMinutes =
    timeSelection === 'none'
      ? null
      : timeSelection === 'auto'
        ? activeExam?.recommendedMinutes ?? Math.max(5, Math.ceil(config.questionCount * 1.2))
        : Number(timeSelection);

  return (
    <div className="min-h-screen bg-black text-[#e6e6e6]">
      {/* Minimalist Top Bar: Transparent White Book Icon + Brand | About + Pill Auth Buttons */}
      <header className="sticky top-0 z-40 border-b border-[#1c1c1c] bg-black/95 md:bg-black/90 md:backdrop-blur-md">
        <div className="mx-auto flex h-15 max-w-[62rem] items-center justify-between gap-2 px-3.5 sm:h-16 sm:px-6">
          <a
            href="#top"
            className="flex items-center gap-2 text-white shrink-0"
          >
            <span className="flex h-10 w-13 items-center justify-center overflow-hidden p-0 sm:h-9 sm:w-11">
              <img
                src="/assets/aistudio/White_Open_Book_Icon_10c198c9.png"
                alt="لوگوی آزمونا"
                referrerPolicy="no-referrer"
                className="h-full w-full scale-[1.15] object-contain mix-blend-screen"
              />
            </span>
            <div className="leading-none">
              <span className="font-display block text-xl tracking-tight sm:text-2xl">آزمونا</span>
              <span className="mt-1 inline-flex items-center gap-1 text-[10px] font-medium text-[#9a9a9a]">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                <span>نسخه آزمایشی · Demo</span>
              </span>
            </div>
          </a>

          {/* Desktop Navigation */}
          <div className="hidden sm:flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => setShowAboutModal(true)}
              className="min-h-[36px] rounded-full px-3 py-1.5 text-sm font-medium text-[#b5b5b5] transition-colors hover:text-white whitespace-nowrap"
            >
              درباره ما
            </button>

            {authUser ? (
              <div className="flex items-center gap-2">
                {authUser.isOwner && (
                  <button
                    type="button"
                    onClick={() => setShowOwnerDbModal(true)}
                    className="inline-flex min-h-[36px] items-center gap-1.5 rounded-full border border-emerald-500/45 bg-emerald-500/15 px-3.5 py-1.5 text-xs font-bold text-emerald-300 transition-colors hover:bg-emerald-500/25 whitespace-nowrap"
                  >
                    <Database className="h-3.5 w-3.5 shrink-0" />
                    <span>دیتابیس</span>
                  </button>
                )}
                <a
                  href="#history-list"
                  className="inline-flex min-h-[36px] items-center gap-1.5 rounded-full border border-[#2e2e2e] bg-[#0e0e0e] px-3.5 py-1.5 text-xs font-medium text-white hover:border-[#666]"
                >
                  <UserIcon className="h-3.5 w-3.5 shrink-0" />
                  <span className="max-w-[140px] truncate">{authUser.email}</span>
                </a>
                <button
                  type="button"
                  onClick={handleLogout}
                  aria-label="خروج از حساب"
                  className="inline-flex min-h-[36px] items-center gap-1 rounded-full border border-[#2e2e2e] bg-[#0e0e0e] px-3.5 py-1.5 text-xs font-medium text-[#ccc] hover:border-white hover:text-white whitespace-nowrap"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  <span>خروج</span>
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setAuthError(null);
                    setAuthModalMode('login');
                  }}
                  className="min-h-[36px] rounded-full border border-[#343434] bg-[#111] px-4 py-1.5 text-xs font-semibold text-white transition-colors hover:border-[#777] whitespace-nowrap"
                >
                  ورود
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAuthError(null);
                    setAuthModalMode('register');
                  }}
                  className="min-h-[36px] rounded-full bg-white px-4 py-1.5 text-xs font-bold text-black transition-opacity hover:opacity-90 whitespace-nowrap"
                >
                  ساخت اکانت
                </button>
              </div>
            )}
          </div>

          {/* Mobile 3-line Hamburger Button */}
          <button
            type="button"
            aria-label={showMobileMenu ? 'بستن منو' : 'باز کردن منو'}
            aria-expanded={showMobileMenu}
            onClick={() => setShowMobileMenu((prev) => !prev)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[#2e2e2e] bg-[#0e0e0e] text-white transition-colors hover:border-[#666] sm:hidden"
          >
            {showMobileMenu ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        {/* Mobile 3-line Dropdown Menu (About, Login, Sign Up / Account Actions) */}
        {showMobileMenu && (
          <>
            <div
              onClick={() => setShowMobileMenu(false)}
              className="fixed inset-0 top-15 z-30 bg-black/70 sm:hidden"
              aria-hidden="true"
            />
            <nav
              aria-label="منوی موبایل"
              className="absolute inset-x-0 top-full z-40 border-b border-[#252525] bg-[#0a0a0a] px-4 py-4 shadow-2xl sm:hidden"
            >
              <div className="mx-auto flex max-w-[62rem] flex-col gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    setShowMobileMenu(false);
                    setShowAboutModal(true);
                  }}
                  className="flex min-h-[44px] w-full items-center justify-center rounded-full border border-[#2a2a2a] bg-[#121212] px-4 py-2 text-sm font-medium text-[#e6e6e6] transition-colors hover:border-[#555]"
                >
                  درباره ما
                </button>

                {authUser ? (
                  <>
                    <a
                      href="#history-list"
                      onClick={() => setShowMobileMenu(false)}
                      className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-full border border-[#2a2a2a] bg-[#121212] px-4 py-2 text-xs font-medium text-white"
                    >
                      <UserIcon className="h-4 w-4 shrink-0" />
                      <span className="truncate">{authUser.email}</span>
                    </a>

                    {authUser.isOwner && (
                      <button
                        type="button"
                        onClick={() => {
                          setShowMobileMenu(false);
                          setShowOwnerDbModal(true);
                        }}
                        className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-full border border-emerald-500/45 bg-emerald-500/15 px-4 py-2 text-sm font-bold text-emerald-300"
                      >
                        <Database className="h-4 w-4 shrink-0" />
                        <span>دیتابیس</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => {
                        setShowMobileMenu(false);
                        void handleLogout();
                      }}
                      className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-full border border-[#2e2e2e] bg-[#141414] px-4 py-2 text-sm font-semibold text-[#d4d4d4]"
                    >
                      <LogOut className="h-4 w-4 shrink-0" />
                      <span>خروج از حساب</span>
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        setShowMobileMenu(false);
                        setAuthError(null);
                        setAuthModalMode('login');
                      }}
                      className="flex min-h-[44px] w-full items-center justify-center rounded-full border border-[#343434] bg-[#141414] px-4 py-2 text-sm font-semibold text-white"
                    >
                      ورود
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowMobileMenu(false);
                        setAuthError(null);
                        setAuthModalMode('register');
                      }}
                      className="flex min-h-[44px] w-full items-center justify-center rounded-full bg-white px-4 py-2 text-sm font-bold text-black"
                    >
                      ساخت اکانت
                    </button>
                  </>
                )}
              </div>
            </nav>
          </>
        )}
      </header>

      <main ref={wheelRef} className="wheel" id="wheel">
        {/* Panel 1: Hero */}
        <section className="panel hero-panel relative" id="top">
          <div className="mx-auto w-full max-w-[62rem]">
            <h1 className="hero-title">
              آزمونا<span>هفتم تا نهم</span>
            </h1>
            <p className="mt-5 max-w-[34rem] text-base leading-8 text-[#8a8a8a] sm:mt-6 sm:text-lg">
              پایه، درس و فصل کتاب درسی‌ات را انتخاب کن؛ آزمونا در چند ثانیه آزمون چهارگزینه‌ای اختصاصی می‌سازد و در پایان، تک‌تک اشتباهاتت را تحلیل و آموزش می‌دهد.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-6 sm:mt-10">
              <div className="hidden md:flex items-center gap-3 text-sm text-[#8a8a8a]">
                <i className="block h-10 w-px bg-gradient-to-b from-white to-transparent" />
                <span>اسکرول کن</span>
              </div>

              <button
                type="button"
                onClick={() => {
                  const target = document.getElementById(
                    activeExam || currentResult ? 'sheet' : 'builder'
                  );
                  if (!target) return;
                  const targetY = Math.max(
                    0,
                    target.getBoundingClientRect().top + window.scrollY - 68
                  );
                  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
                    window.scrollTo({ top: targetY, behavior: 'instant' as ScrollBehavior });
                    return;
                  }
                  const startY = window.scrollY;
                  const distance = targetY - startY;
                  const duration = Math.min(1150, Math.max(600, Math.abs(distance) * 0.55));
                  let startTime: number | null = null;
                  let rafId = 0;
                  let cancelled = false;

                  const stop = () => {
                    cancelled = true;
                    if (rafId) window.cancelAnimationFrame(rafId);
                    cleanup();
                  };
                  const cleanup = () => {
                    window.removeEventListener('wheel', stop);
                    window.removeEventListener('touchstart', stop);
                    window.removeEventListener('keydown', stop);
                  };

                  window.addEventListener('wheel', stop, { passive: true, once: true });
                  window.addEventListener('touchstart', stop, { passive: true, once: true });
                  window.addEventListener('keydown', stop, { once: true });

                  const step = (now: number) => {
                    if (cancelled) return;
                    if (startTime === null) startTime = now;
                    const t = Math.min(1, (now - startTime) / duration);
                    const eased = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
                    window.scrollTo({
                      top: startY + distance * eased,
                      behavior: 'instant' as ScrollBehavior,
                    });
                    if (t < 1) {
                      rafId = window.requestAnimationFrame(step);
                    } else {
                      cleanup();
                    }
                  };
                  rafId = window.requestAnimationFrame(step);
                }}
                className="min-h-[44px] inline-flex items-center justify-center rounded-[6px] bg-white px-5 py-2.5 text-sm font-extrabold text-black transition-opacity hover:opacity-90"
              >
                شروع ساخت آزمون ↓
              </button>
            </div>
          </div>
        </section>

        {/* Panel 2: Features */}
        <section className="panel">
          <div className="mx-auto w-full max-w-[62rem]">
            <h2 className="panel-heading">مخصوص دانش‌آموز</h2>
            <div className="max-w-[46rem]">
              <div className="flex flex-col gap-1 border-t border-[#2e2e2e] py-4 sm:flex-row sm:gap-6 sm:py-5">
                <b className="font-display min-w-[9rem] text-xl text-white">سه پایه</b>
                <span className="text-sm leading-7 text-[#a3a3a3] sm:text-base">
                  سؤال‌های چهارگزینه‌ای دقیق بر اساس کتاب‌های رسمی هفتم، هشتم و نهم طراحی می‌شوند.
                </span>
              </div>
              <div className="flex flex-col gap-1 border-t border-[#2e2e2e] py-4 sm:flex-row sm:gap-6 sm:py-5">
                <b className="font-display min-w-[9rem] text-xl text-white">انتخاب فصل</b>
                <span className="text-sm leading-7 text-[#a3a3a3] sm:text-base">
                  فقط درس‌ها و فصل‌هایی را که خوانده‌ای انتخاب کن؛ یک درس، چند فصل یا کل کتاب.
                </span>
              </div>
              <div className="flex flex-col gap-1 border-t border-[#2e2e2e] py-4 sm:flex-row sm:gap-6 sm:py-5">
                <b className="font-display min-w-[9rem] text-xl text-white">سطح دلخواه</b>
                <span className="text-sm leading-7 text-[#a3a3a3] sm:text-base">
                  از سطح مروری آسان تا چالشی تیزهوشان؛ زمان آزمون را هم خودت تعیین می‌کنی.
                </span>
              </div>
              <div className="flex flex-col gap-1 border-y border-[#2e2e2e] py-4 sm:flex-row sm:gap-6 sm:py-5">
                <b className="font-display min-w-[9rem] text-xl text-white">تحلیل و PDF</b>
                <span className="text-sm leading-7 text-[#a3a3a3] sm:text-base">
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
                <span className="text-sm text-[#8a8a8a]">
                  هفتم، هشتم یا نهم و درس موردنظر
                </span>
              </div>
              <div className="border-t border-[#2e2e2e] bg-[#0e0e0e] p-5 sm:border-r sm:border-t-0 sm:p-6">
                <b className="font-display mb-1 block text-xl text-white">فصل‌ها</b>
                <span className="text-sm text-[#8a8a8a]">
                  یک فصل خاص یا چند فصل برای مرور
                </span>
              </div>
              <div className="border-t border-[#2e2e2e] bg-[#0e0e0e] p-5 sm:border-r sm:border-t-0 sm:p-6">
                <b className="font-display mb-1 block text-xl text-white">آزمون و تحلیل</b>
                <span className="text-sm text-[#8a8a8a]">
                  حل چهارگزینه‌ای و توضیح کامل غلط‌ها
                </span>
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

                <div className="rounded-[6px] border border-[#2e2e2e] bg-[#0e0e0e] p-5 sm:p-8">
            {/* Grade */}
            <div className="mb-6">
              <label className="mb-2 block text-sm text-[#8a8a8a]">پایه تحصیلی</label>
              <div className="flex flex-wrap gap-2">
                {GRADES.map((g) => (
                  <button
                    key={g.id}
                    type="button"
                    aria-pressed={config.grade === g.id}
                    onClick={() => handleGradeChange(g.id)}
                    className="chip text-sm"
                  >
                    پایه‌ی {g.shortLabel}
                  </button>
                ))}
              </div>
            </div>

            {/* Subject */}
            <div className="mb-6">
              <label className="mb-2 block text-sm text-[#8a8a8a]">نام درس</label>
              <div className="flex flex-wrap gap-2">
                {SUBJECTS.map((subj) => (
                  <button
                    key={subj.id}
                    type="button"
                    aria-pressed={config.subjectId === subj.id}
                    onClick={() => handleSubjectChange(subj.id)}
                    className="chip text-sm"
                  >
                    {subj.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Chapters */}
            <div className="mb-6">
              <label className="mb-2 block text-sm text-[#8a8a8a]">
                فصل‌ها (یک یا چند فصل)
              </label>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  aria-pressed={config.allLessons}
                  onClick={handleToggleAllLessons}
                  className="chip text-sm"
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
                      className="chip text-sm"
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
                  className="mono-select min-h-[44px] w-full rounded-[6px] border border-[#2e2e2e] bg-[#1a1a1a] px-3 py-2 text-base text-[#e6e6e6] sm:text-sm"
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
                  className="mono-select min-h-[44px] w-full rounded-[6px] border border-[#2e2e2e] bg-[#1a1a1a] px-3 py-2 text-base text-[#e6e6e6] sm:text-sm"
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
              <label className="mb-2 block text-sm text-[#8a8a8a]">سطح دشواری</label>
              <div className="flex flex-wrap gap-2">
                {DIFFICULTIES.map((diff) => (
                  <button
                    key={diff.id}
                    type="button"
                    aria-pressed={config.difficulty === diff.id}
                    onClick={() => setConfig((prev) => ({ ...prev, difficulty: diff.id }))}
                    className="chip text-sm"
                  >
                    {diff.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Custom topic focus */}
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
                className="mono-input min-h-[44px] w-full rounded-[6px] border border-[#2e2e2e] bg-[#1a1a1a] px-3.5 py-2 text-base text-[#e6e6e6] placeholder:text-[#666] sm:text-sm"
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
              className="go flex min-h-[48px] w-full items-center justify-center gap-2 rounded-[6px] bg-white p-3.5 text-base font-extrabold text-black transition-opacity hover:opacity-90 disabled:opacity-60"
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
            initialAnswers={draftAnswers}
            initialElapsedSeconds={draftElapsedSeconds}
            onDraftChange={handleDraftChange}
            isAnalyzing={isAnalyzing}
            analysisError={analysisError}
            onSubmitExam={handleSubmitExam}
            onRetryAnalysis={() => currentResult && runAnalysisForResult(currentResult)}
            onPracticeWeakTopics={handlePracticeWeakTopics}
            onResetToNew={() => {
              setActiveExam(null);
              setCurrentResult(null);
              setDraftAnswers({});
              setDraftElapsedSeconds(0);
              setExamSessionKey(`exam-${Date.now()}`);
              document.getElementById('builder')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }}
          />

          {/* Account / Local History */}
          <div id="history-list" className="mt-12 border-t border-[#222] pt-8">
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
          className="fixed inset-0 z-50 flex h-[100dvh] items-center justify-center overflow-y-auto overscroll-contain bg-black/85 p-3 sm:p-4 md:backdrop-blur-xs"
        >
          <div className="w-full max-w-[27rem] max-h-[90dvh] overflow-y-auto rounded-2xl border border-[#2a2a2a] bg-[#0e0e0e] p-5 text-right sm:p-6">
            <div className="flex items-center justify-between border-b border-[#222] pb-3">
              <div className="flex items-center gap-2.5">
                <span className="flex h-9 w-11 items-center justify-center overflow-hidden p-0">
                  <img
                    src="/assets/aistudio/White_Open_Book_Icon_10c198c9.png"
                    alt="لوگوی آزمونا"
                    className="h-full w-full scale-[1.15] object-contain mix-blend-screen"
                  />
                </span>
                <h2 className="font-display text-2xl text-white">درباره آزمونا</h2>
              </div>
              <button
                type="button"
                onClick={() => setShowAboutModal(false)}
                aria-label="بستن"
                className="rounded-full p-1.5 text-[#8a8a8a] hover:bg-[#1a1a1a] hover:text-white"
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
              className="mt-6 min-h-[44px] w-full rounded-full bg-white py-2 text-sm font-bold text-black hover:opacity-90"
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
          className="fixed inset-0 z-50 flex h-[100dvh] items-start justify-center overflow-y-auto overscroll-contain bg-black/85 p-3 pt-6 pb-10 sm:items-center sm:p-4 md:backdrop-blur-xs"
        >
          <div className="my-auto w-full max-w-[27rem] rounded-2xl border border-[#2a2a2a] bg-[#0e0e0e] p-5 text-right sm:p-6">
            <div className="flex items-center justify-between border-b border-[#222] pb-3">
              <h2 className="font-display text-2xl text-white">
                {authModalMode === 'register' ? 'ساخت اکانت آزمونا' : 'ورود به حساب'}
              </h2>
              <button
                type="button"
                onClick={() => setAuthModalMode(null)}
                aria-label="بستن"
                className="rounded-full p-1.5 text-[#8a8a8a] hover:bg-[#1a1a1a] hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-4">
              <button
                type="button"
                disabled={authLoading}
                onClick={handleGoogleSignIn}
                className="flex min-h-[46px] w-full items-center justify-center gap-2.5 rounded-full border border-[#3a3a3a] bg-[#1a1a1a] px-4 py-2 text-xs font-bold text-white transition-colors hover:border-white disabled:opacity-60 sm:text-sm"
              >
                <svg
                  className="h-5 w-5 shrink-0"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    fill="#EA4335"
                    d="M12 10.2v3.9h5.5c-.24 1.25-.96 2.3-2.04 3l3.3 2.56c1.92-1.77 3.04-4.38 3.04-7.48 0-.72-.06-1.41-.18-2.08H12z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 22c2.7 0 4.96-.9 6.62-2.44l-3.3-2.56c-.9.6-2.05.96-3.32.96-2.55 0-4.71-1.72-5.48-4.04H3.12v2.64C4.77 19.83 8.13 22 12 22z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M6.52 13.92A5.98 5.98 0 0 1 6.2 12c0-.67.12-1.32.32-1.92V7.44H3.12A9.97 9.97 0 0 0 2 12c0 1.61.39 3.13 1.12 4.56l3.4-2.64z"
                  />
                  <path
                    fill="#4285F4"
                    d="M12 6.04c1.47 0 2.79.5 3.83 1.5l2.87-2.87C16.95 3.04 14.7 2 12 2 8.13 2 4.77 4.17 3.12 7.44l3.4 2.64C7.29 7.76 9.45 6.04 12 6.04z"
                  />
                </svg>
                <span>اتصال و ورود با حساب گوگل</span>
              </button>

              <div className="my-4 flex items-center gap-3 text-[11px] text-[#666]">
                <span className="h-px flex-1 bg-[#2e2e2e]" />
                <span>یا با ایمیل و رمز عبور</span>
                <span className="h-px flex-1 bg-[#2e2e2e]" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-1.5 rounded-full bg-[#1a1a1a] p-1">
              <button
                type="button"
                onClick={() => {
                  setAuthError(null);
                  setAuthModalMode('login');
                }}
                className={`min-h-[38px] rounded-full text-xs font-bold transition-colors ${
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
                className={`min-h-[38px] rounded-full text-xs font-bold transition-colors ${
                  authModalMode === 'register'
                    ? 'bg-white text-black'
                    : 'text-[#8a8a8a] hover:text-white'
                }`}
              >
                ساخت اکانت جدید
              </button>
            </div>

            <form noValidate onSubmit={handleAuthSubmit} className="mt-5 space-y-4 text-right">
              <div>
                <label htmlFor="auth-email" className="mb-1.5 block text-xs text-[#9a9a9a]">
                  ایمیل
                </label>
                <input
                  id="auth-email"
                  name="email"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  dir="ltr"
                  value={authEmail}
                  onChange={(e) => setAuthEmail(e.target.value)}
                  placeholder="student@gmail.com"
                  className="mono-input min-h-[46px] w-full rounded-xl border border-[#2e2e2e] bg-[#1a1a1a] px-3.5 py-2 text-left text-base text-white placeholder:text-[#666] sm:text-sm"
                />
              </div>

              <div>
                <label htmlFor="auth-pass" className="mb-1.5 block text-xs text-[#9a9a9a]">
                  رمز عبور (حداقل ۶ کاراکتر)
                </label>
                <input
                  id="auth-pass"
                  name="password"
                  type="password"
                  autoComplete={authModalMode === 'register' ? 'new-password' : 'current-password'}
                  dir="ltr"
                  value={authPassword}
                  onChange={(e) => setAuthPassword(e.target.value)}
                  placeholder="••••••"
                  className="mono-input min-h-[46px] w-full rounded-xl border border-[#2e2e2e] bg-[#1a1a1a] px-3.5 py-2 text-left text-base text-white placeholder:text-[#666] sm:text-sm"
                />
              </div>

              {authModalMode === 'register' && (
                <div>
                  <label htmlFor="auth-confirm" className="mb-1.5 block text-xs text-[#9a9a9a]">
                    تکرار رمز عبور
                  </label>
                  <input
                    id="auth-confirm"
                    name="confirmPassword"
                    type="password"
                    autoComplete="new-password"
                    dir="ltr"
                    value={authConfirmPassword}
                    onChange={(e) => setAuthConfirmPassword(e.target.value)}
                    placeholder="••••••"
                    className="mono-input min-h-[46px] w-full rounded-xl border border-[#2e2e2e] bg-[#1a1a1a] px-3.5 py-2 text-left text-base text-white placeholder:text-[#666] sm:text-sm"
                  />
                </div>
              )}

              {authError && (
                <div
                  role="alert"
                  className="flex items-start gap-2 rounded-xl border border-rose-500/40 bg-rose-500/10 p-3 text-xs text-rose-300"
                >
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{authError}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={authLoading}
                className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-full bg-white py-2.5 text-sm font-extrabold text-black transition-opacity hover:opacity-90 disabled:opacity-60"
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

      {/* Owner-exclusive Database Panel (Strictly rendered only for amoodead@gmail.com) */}
      {authUser?.isOwner && (
        <OwnerDatabaseModal
          open={showOwnerDbModal}
          authToken={authToken}
          onClose={() => setShowOwnerDbModal(false)}
        />
      )}
    </div>
  );
}
