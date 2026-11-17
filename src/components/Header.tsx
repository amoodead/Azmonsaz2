import React from 'react';

interface HeaderProps {
  activeView: 'builder' | 'running' | 'results';
  onNavigateSection: (sectionId: string) => void;
  onStartNewExam: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeView,
  onNavigateSection,
  onStartNewExam,
}) => {
  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-[#060B10]/90 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:h-20 sm:gap-8 sm:px-6">
        {/* Zone 1: Brand wordmark */}
        <button
          type="button"
          onClick={onStartNewExam}
          className="text-2xl font-black tracking-tight text-white whitespace-nowrap shrink-0 transition-opacity hover:opacity-85"
        >
          آزمونا<span className="text-emerald-400">.</span>
        </button>

        {/* Zone 2: Nav links */}
        <nav
          aria-label="منوی اصلی"
          className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-400"
        >
          <button
            type="button"
            onClick={() => onNavigateSection('top-hero')}
            className="whitespace-nowrap shrink-0 py-1 transition-colors hover:text-emerald-300"
          >
            صفحه اصلی
          </button>
          <button
            type="button"
            onClick={() => onNavigateSection('subjects')}
            className="whitespace-nowrap shrink-0 py-1 transition-colors hover:text-emerald-300"
          >
            درس‌ها
          </button>
          <button
            type="button"
            onClick={() => onNavigateSection('exam-builder')}
            className="whitespace-nowrap shrink-0 py-1 transition-colors hover:text-emerald-300"
          >
            ساخت آزمون
          </button>
          <button
            type="button"
            onClick={() => onNavigateSection('exams')}
            className="whitespace-nowrap shrink-0 py-1 transition-colors hover:text-emerald-300"
          >
            آزمون‌های پیشنهادی
          </button>
        </nav>

        {/* Zone 3: 1 primary action */}
        <div className="flex items-center shrink-0">
          <button
            type="button"
            onClick={() =>
              activeView === 'builder'
                ? onNavigateSection('exam-builder')
                : onStartNewExam()
            }
            className="min-h-[40px] rounded-xl border border-emerald-400/35 bg-emerald-500/15 px-3.5 py-2 text-xs font-semibold text-emerald-300 transition-colors hover:bg-emerald-500/25 sm:px-5 sm:text-sm whitespace-nowrap shrink-0"
          >
            {activeView === 'builder' ? 'مشاهده آزمون‌ساز' : 'ساخت آزمون جدید'}
          </button>
        </div>
      </div>
    </header>
  );
};
