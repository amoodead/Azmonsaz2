import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BookOpen,
  Database,
  Download,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  StickyNote,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import { getGradeLabel, getSubjectById, toPersianDigits } from '../data/curriculum';

interface OwnerUserRow {
  id: number;
  uid: string;
  email: string;
  role: string;
  has_password: boolean;
  last_login_at: string | null;
  created_at: string;
  exam_count: number;
  avg_score_percent: number;
}

interface OwnerExamRow {
  id: number;
  exam_key: string;
  grade: string;
  subject_id: string;
  exam_title: string;
  score_out_of_20: string;
  score_percent: number;
  created_at: string;
  owner_email: string;
  payload?: Record<string, unknown>;
}

interface OwnerNoteRow {
  id: number;
  title: string;
  content: string;
  category: string;
  createdAt?: string;
  created_at?: string;
}

interface OwnerSnapshot {
  stats: {
    total_users: number;
    total_exams: number;
    avg_score_percent: number;
    exams_last_24h: number;
  };
  topSubjects: Array<{ subject_id: string; count: number }>;
  users: OwnerUserRow[];
  exams: OwnerExamRow[];
  notes: OwnerNoteRow[];
  generatedAt: string;
}

interface OwnerDatabaseModalProps {
  open: boolean;
  authToken: string | null;
  onClose: () => void;
}

function formatPersianDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    return new Intl.DateTimeFormat('fa-IR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export const OwnerDatabaseModal: React.FC<OwnerDatabaseModalProps> = ({
  open,
  authToken,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'users' | 'exams' | 'notes'>('users');
  const [snapshot, setSnapshot] = useState<OwnerSnapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [subjectFilter, setSubjectFilter] = useState<string>('all');
  const [busyId, setBusyId] = useState<string | null>(null);

  const [noteTitle, setNoteTitle] = useState('');
  const [noteContent, setNoteContent] = useState('');
  const [noteCategory, setNoteCategory] = useState('یادداشت مالک');
  const [savingNote, setSavingNote] = useState(false);

  const buildHeaders = useCallback((): Record<string, string> => {
    const headers: Record<string, string> = {};
    if (authToken) {
      headers.Authorization = `Bearer ${authToken}`;
    }
    return headers;
  }, [authToken]);

  const fetchSnapshot = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/owner/database', {
        credentials: 'include',
        headers: buildHeaders(),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'خطا در دریافت اطلاعات دیتابیس مالک.');
      }
      setSnapshot(data as OwnerSnapshot);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطا در اتصال به دیتابیس.');
    } finally {
      setLoading(false);
    }
  }, [buildHeaders]);

  useEffect(() => {
    if (!open) return;
    void fetchSnapshot();
  }, [open, fetchSnapshot]);

  const filteredUsers = useMemo(() => {
    if (!snapshot) return [];
    const q = searchQuery.trim().toLowerCase();
    if (!q) return snapshot.users;
    return snapshot.users.filter(
      (u) => u.email.toLowerCase().includes(q) || u.role.toLowerCase().includes(q)
    );
  }, [snapshot, searchQuery]);

  const filteredExams = useMemo(() => {
    if (!snapshot) return [];
    const q = searchQuery.trim().toLowerCase();
    return snapshot.exams.filter((e) => {
      if (subjectFilter !== 'all' && e.subject_id !== subjectFilter) return false;
      if (!q) return true;
      return (
        e.exam_title.toLowerCase().includes(q) ||
        e.owner_email.toLowerCase().includes(q) ||
        getSubjectById(e.subject_id as never).name.includes(q)
      );
    });
  }, [snapshot, searchQuery, subjectFilter]);

  const handleDeleteUser = async (userId: number) => {
    setBusyId(`user-${userId}`);
    setError(null);
    try {
      const res = await fetch(`/api/owner/users/${userId}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: buildHeaders(),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'حذف کاربر ناموفق بود.');
      await fetchSnapshot();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطا در حذف کاربر.');
    } finally {
      setBusyId(null);
    }
  };

  const handleDeleteExam = async (examId: number) => {
    setBusyId(`exam-${examId}`);
    setError(null);
    try {
      const res = await fetch(`/api/owner/exams/${examId}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: buildHeaders(),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'حذف آزمون ناموفق بود.');
      await fetchSnapshot();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطا در حذف آزمون.');
    } finally {
      setBusyId(null);
    }
  };

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteTitle.trim() || !noteContent.trim()) return;
    setSavingNote(true);
    setError(null);
    try {
      const res = await fetch('/api/owner/notes', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...buildHeaders(),
        },
        body: JSON.stringify({
          title: noteTitle,
          content: noteContent,
          category: noteCategory,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'ثبت یادداشت ناموفق بود.');
      setNoteTitle('');
      setNoteContent('');
      await fetchSnapshot();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطا در ذخیره یادداشت.');
    } finally {
      setSavingNote(false);
    }
  };

  const handleDeleteNote = async (noteId: number) => {
    setBusyId(`note-${noteId}`);
    try {
      const res = await fetch(`/api/owner/notes/${noteId}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: buildHeaders(),
      });
      if (res.ok) {
        await fetchSnapshot();
      }
    } finally {
      setBusyId(null);
    }
  };

  const handleDownloadBackup = async () => {
    try {
      const res = await fetch('/api/owner/export', {
        credentials: 'include',
        headers: buildHeaders(),
      });
      if (!res.ok) throw new Error('دریافت بکاپ ناموفق بود.');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `azmona-owner-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطا در دانلود بکاپ.');
    }
  };

  if (!open) return null;

  return (
    <div
      dir="rtl"
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 flex h-[100dvh] items-start justify-center overflow-y-auto overscroll-contain bg-black/85 p-2.5 pt-4 sm:items-center sm:p-5"
    >
      <div className="my-auto flex w-full max-w-[60rem] flex-col rounded-2xl border border-[#2a2a2a] bg-[#0b0b0b] p-4 text-right shadow-2xl sm:max-h-[90dvh] sm:p-6">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#222] pb-3.5">
          <div className="flex items-center gap-2.5">
            <span className="flex h-10 w-10 items-center justify-center rounded-full border border-emerald-500/40 bg-emerald-500/15 text-emerald-300">
              <ShieldCheck className="h-5 w-5" />
            </span>
            <div>
              <h2 className="font-display text-xl text-white sm:text-2xl">
                دیتابیس اختصاصی مالک
              </h2>
              <p className="text-[11px] text-[#8a8a8a]">
                فقط قابل دسترسی برای حساب مالک سایت (amoodead@gmail.com)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void fetchSnapshot()}
              disabled={loading}
              className="inline-flex min-h-[36px] items-center gap-1.5 rounded-full border border-[#2e2e2e] bg-[#141414] px-3 py-1.5 text-xs font-semibold text-white hover:border-[#666] disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>بروزرسانی</span>
            </button>
            <button
              type="button"
              onClick={() => void handleDownloadBackup()}
              className="inline-flex min-h-[36px] items-center gap-1.5 rounded-full bg-white px-3.5 py-1.5 text-xs font-bold text-black hover:opacity-90"
            >
              <Download className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">بکاپ JSON</span>
              <span className="sm:hidden">بکاپ</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="بستن"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-[#2a2a2a] bg-[#141414] text-[#aaa] hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {error && (
          <div className="mt-3 rounded-xl border border-rose-500/40 bg-rose-500/10 p-3 text-xs text-rose-300">
            {error}
          </div>
        )}

        {/* Stats Strip */}
        {snapshot && (
          <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            <div className="rounded-xl border border-[#222] bg-[#121212] p-3">
              <div className="text-[11px] text-[#8a8a8a]">کل کاربران</div>
              <div className="mt-0.5 text-xl font-extrabold text-white tabular-nums">
                {toPersianDigits(snapshot.stats.total_users)}
              </div>
            </div>
            <div className="rounded-xl border border-[#222] bg-[#121212] p-3">
              <div className="text-[11px] text-[#8a8a8a]">کل آزمون‌ها</div>
              <div className="mt-0.5 text-xl font-extrabold text-white tabular-nums">
                {toPersianDigits(snapshot.stats.total_exams)}
              </div>
            </div>
            <div className="rounded-xl border border-[#222] bg-[#121212] p-3">
              <div className="text-[11px] text-[#8a8a8a]">میانگین کل نمره</div>
              <div className="mt-0.5 text-xl font-extrabold text-emerald-400 tabular-nums">
                {toPersianDigits(snapshot.stats.avg_score_percent)}٪
              </div>
            </div>
            <div className="rounded-xl border border-[#222] bg-[#121212] p-3">
              <div className="text-[11px] text-[#8a8a8a]">آزمون‌های ۲۴ ساعت اخیر</div>
              <div className="mt-0.5 text-xl font-extrabold text-amber-300 tabular-nums">
                {toPersianDigits(snapshot.stats.exams_last_24h)}
              </div>
            </div>
          </div>
        )}

        {/* Navigation Tabs + Search */}
        <div className="mt-4 flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => setActiveTab('users')}
              className={`inline-flex min-h-[38px] items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-bold transition-colors ${
                activeTab === 'users'
                  ? 'bg-white text-black'
                  : 'border border-[#2a2a2a] bg-[#141414] text-[#bbb] hover:text-white'
              }`}
            >
              <Users className="h-3.5 w-3.5" />
              <span>کاربران ({toPersianDigits(snapshot?.users.length ?? 0)})</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('exams')}
              className={`inline-flex min-h-[38px] items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-bold transition-colors ${
                activeTab === 'exams'
                  ? 'bg-white text-black'
                  : 'border border-[#2a2a2a] bg-[#141414] text-[#bbb] hover:text-white'
              }`}
            >
              <BookOpen className="h-3.5 w-3.5" />
              <span>آزمون‌ها ({toPersianDigits(snapshot?.exams.length ?? 0)})</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('notes')}
              className={`inline-flex min-h-[38px] items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-bold transition-colors ${
                activeTab === 'notes'
                  ? 'bg-white text-black'
                  : 'border border-[#2a2a2a] bg-[#141414] text-[#bbb] hover:text-white'
              }`}
            >
              <StickyNote className="h-3.5 w-3.5" />
              <span>یادداشت‌های مالک ({toPersianDigits(snapshot?.notes.length ?? 0)})</span>
            </button>
          </div>

          {activeTab !== 'notes' && (
            <div className="relative flex-1 sm:max-w-[18rem]">
              <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#777]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="جست‌وجوی ایمیل یا درس..."
                className="min-h-[40px] w-full rounded-full border border-[#2a2a2a] bg-[#141414] pr-9 pl-3.5 text-base text-white placeholder:text-[#666] sm:text-xs"
              />
            </div>
          )}
        </div>

        {/* Content Body */}
        <div className="mt-4 flex-1 overflow-y-auto pr-0.5 sm:max-h-[46vh]">
          {loading && !snapshot ? (
            <div className="flex flex-col items-center justify-center gap-2 py-12 text-xs text-[#999]">
              <Loader2 className="h-6 w-6 animate-spin text-white" />
              <span>در حال بارگذاری اطلاعات دیتابیس...</span>
            </div>
          ) : activeTab === 'users' ? (
            <div className="space-y-2.5">
              {filteredUsers.map((u) => (
                <div
                  key={u.id}
                  className="flex flex-col justify-between gap-2.5 rounded-xl border border-[#222] bg-[#121212] p-3.5 sm:flex-row sm:items-center"
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span dir="ltr" className="truncate text-sm font-bold text-white">
                        {u.email}
                      </span>
                      {u.role === 'owner' ? (
                        <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
                          مالک (Owner)
                        </span>
                      ) : (
                        <span className="rounded-full bg-[#222] px-2 py-0.5 text-[10px] text-[#bbb]">
                          دانش‌آموز
                        </span>
                      )}
                      <span className="rounded-full border border-[#2b2b2b] px-2 py-0.5 text-[10px] text-[#9a9a9a]">
                        {u.has_password ? 'ایمیل + رمز' : 'گوگل'}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-[#8a8a8a] tabular-nums">
                      <span>آزمون‌ها: {toPersianDigits(u.exam_count)}</span>
                      <span>میانگین: {toPersianDigits(u.avg_score_percent)}٪</span>
                      <span>ثبت‌نام: {formatPersianDate(u.created_at)}</span>
                      {u.last_login_at && (
                        <span>آخرین ورود: {formatPersianDate(u.last_login_at)}</span>
                      )}
                    </div>
                  </div>

                  {u.role !== 'owner' && (
                    <button
                      type="button"
                      disabled={busyId === `user-${u.id}`}
                      onClick={() => void handleDeleteUser(u.id)}
                      className="inline-flex min-h-[34px] shrink-0 items-center justify-center gap-1 rounded-full border border-rose-500/30 bg-rose-500/10 px-3 py-1 text-xs font-semibold text-rose-300 hover:bg-rose-500/20 disabled:opacity-50"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      <span>حذف</span>
                    </button>
                  )}
                </div>
              ))}
              {filteredUsers.length === 0 && (
                <div className="rounded-xl border border-dashed border-[#242424] py-8 text-center text-xs text-[#8a8a8a]">
                  کاربری با این مشخصات پیدا نشد.
                </div>
              )}
            </div>
          ) : activeTab === 'exams' ? (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-1.5">
                {['all', 'math', 'science', 'persian', 'arabic', 'english', 'social', 'religion'].map(
                  (sid) => (
                    <button
                      key={sid}
                      type="button"
                      onClick={() => setSubjectFilter(sid)}
                      className={`rounded-full px-3 py-1 text-[11px] font-medium transition-colors ${
                        subjectFilter === sid
                          ? 'bg-white text-black font-bold'
                          : 'border border-[#262626] bg-[#141414] text-[#9a9a9a] hover:text-white'
                      }`}
                    >
                      {sid === 'all' ? 'همه درس‌ها' : getSubjectById(sid as never).name}
                    </button>
                  )
                )}
              </div>

              <div className="space-y-2.5">
                {filteredExams.map((ex) => (
                  <div
                    key={ex.id}
                    className="flex flex-col justify-between gap-2.5 rounded-xl border border-[#222] bg-[#121212] p-3.5 sm:flex-row sm:items-center"
                  >
                    <div className="min-w-0 space-y-1">
                      <div className="text-sm font-bold text-white">{ex.exam_title}</div>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-[#8a8a8a] tabular-nums">
                        <span dir="ltr" className="text-[#ccc]">
                          {ex.owner_email}
                        </span>
                        <span>{getGradeLabel(ex.grade as never)}</span>
                        <span>{getSubjectById(ex.subject_id as never).name}</span>
                        <span className="font-bold text-emerald-400">
                          نمره: {toPersianDigits(ex.score_out_of_20)} از ۲۰ ({toPersianDigits(ex.score_percent)}٪)
                        </span>
                        <span>{formatPersianDate(ex.created_at)}</span>
                      </div>
                    </div>

                    <button
                      type="button"
                      disabled={busyId === `exam-${ex.id}`}
                      onClick={() => void handleDeleteExam(ex.id)}
                      className="inline-flex min-h-[34px] shrink-0 items-center justify-center gap-1 rounded-full border border-rose-500/30 bg-rose-500/10 px-3 py-1 text-xs font-semibold text-rose-300 hover:bg-rose-500/20 disabled:opacity-50"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      <span>حذف</span>
                    </button>
                  </div>
                ))}
                {filteredExams.length === 0 && (
                  <div className="rounded-xl border border-dashed border-[#242424] py-8 text-center text-xs text-[#8a8a8a]">
                    آزمونی ثبت نشده است.
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <form
                onSubmit={handleAddNote}
                className="space-y-3 rounded-xl border border-[#242424] bg-[#121212] p-3.5"
              >
                <div className="flex items-center gap-2 text-xs font-bold text-white">
                  <Database className="h-4 w-4 text-emerald-400" />
                  <span>ثبت یادداشت یا داده شخصی مالک در دیتابیس</span>
                </div>
                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                  <input
                    type="text"
                    value={noteTitle}
                    onChange={(e) => setNoteTitle(e.target.value)}
                    placeholder="عنوان (مثلاً: برنامه امتحانی)"
                    className="min-h-[40px] rounded-xl border border-[#2a2a2a] bg-[#0b0b0b] px-3 py-2 text-base text-white placeholder:text-[#666] sm:col-span-2 sm:text-xs"
                  />
                  <input
                    type="text"
                    value={noteCategory}
                    onChange={(e) => setNoteCategory(e.target.value)}
                    placeholder="دسته‌بندی"
                    className="min-h-[40px] rounded-xl border border-[#2a2a2a] bg-[#0b0b0b] px-3 py-2 text-base text-white placeholder:text-[#666] sm:text-xs"
                  />
                </div>
                <textarea
                  rows={2}
                  value={noteContent}
                  onChange={(e) => setNoteContent(e.target.value)}
                  placeholder="متن یادداشت خصوصی (فقط خودتان می‌بینید)..."
                  className="w-full rounded-xl border border-[#2a2a2a] bg-[#0b0b0b] px-3 py-2 text-base text-white placeholder:text-[#666] sm:text-xs"
                />
                <button
                  type="submit"
                  disabled={savingNote || !noteTitle.trim() || !noteContent.trim()}
                  className="inline-flex min-h-[38px] items-center gap-1.5 rounded-full bg-white px-4 py-1.5 text-xs font-bold text-black hover:opacity-90 disabled:opacity-50"
                >
                  {savingNote ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Plus className="h-3.5 w-3.5" />
                  )}
                  <span>ذخیره در دیتابیس</span>
                </button>
              </form>

              <div className="space-y-2.5">
                {snapshot?.notes.map((n) => (
                  <div
                    key={n.id}
                    className="flex items-start justify-between gap-3 rounded-xl border border-[#222] bg-[#121212] p-3.5"
                  >
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-bold text-white">{n.title}</span>
                        <span className="rounded-full bg-[#222] px-2 py-0.5 text-[10px] text-[#bbb]">
                          {n.category}
                        </span>
                      </div>
                      <p className="whitespace-pre-line text-xs leading-6 text-[#ccc]">{n.content}</p>
                      <div className="text-[10px] text-[#777]">
                        {formatPersianDate(n.createdAt || n.created_at)}
                      </div>
                    </div>

                    <button
                      type="button"
                      disabled={busyId === `note-${n.id}`}
                      onClick={() => void handleDeleteNote(n.id)}
                      className="rounded-full p-2 text-[#888] hover:bg-rose-500/15 hover:text-rose-300"
                      aria-label="حذف یادداشت"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
