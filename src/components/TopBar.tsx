import React from 'react';
import {
  ArrowRight,
  BarChart3,
  Building2,
  LayoutGrid,
  MapPin,
  PackagePlus,
  ShieldCheck,
  Truck,
} from 'lucide-react';
import type {PublicUser} from '../shared/logistics';
import {t, type LangCode} from '../utils/i18n';

export type TabKey = 'home' | 'book' | 'track' | 'analytics' | 'driver' | 'admin' | 'auth';

interface TopBarProps {
  activeTab: TabKey;
  user: PublicUser | null;
  lang: LangCode;
  onSelectTab: (tab: TabKey) => void;
}

export const TopBar: React.FC<TopBarProps> = ({activeTab, user, lang, onSelectTab}) => {
  const navItems: Array<{key: TabKey; label: string; Icon: React.ComponentType<{className?: string}>}> = [
    {key: 'home', label: t(lang, 'navOverview'), Icon: LayoutGrid},
  ];

  if (!user || user.role === 'customer') {
    navItems.push({key: 'book', label: t(lang, 'navBook'), Icon: PackagePlus});
  }

  navItems.push(
    {key: 'track', label: t(lang, 'navTrack'), Icon: MapPin},
    {key: 'analytics', label: t(lang, 'navAnalytics'), Icon: BarChart3},
  );

  if (user?.role === 'driver') {
    navItems.push({key: 'driver', label: t(lang, 'navDriver'), Icon: Truck});
  } else if (user?.role === 'admin') {
    navItems.push({key: 'admin', label: t(lang, 'navAdmin'), Icon: Building2});
  } else if (!user) {
    navItems.push({key: 'auth', label: t(lang, 'navAuth'), Icon: ShieldCheck});
  }

  const ctaTarget: TabKey =
    user?.role === 'driver' ? 'driver' : user?.role === 'admin' ? 'admin' : 'book';
  const ctaLabel =
    user?.role === 'driver' ? t(lang, 'navDriver') : user?.role === 'admin' ? t(lang, 'navAdmin') : t(lang, 'bookCta');

  return (
    <header className="no-print sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur-md dark:border-slate-800 dark:bg-[#081624]/95">
      <div className="mx-auto flex max-w-[1200px] flex-wrap items-center justify-between gap-x-3 gap-y-2 px-4 py-3 sm:px-6 md:flex-nowrap md:gap-8 md:py-3.5">
        <button
          type="button"
          onClick={() => onSelectTab('home')}
          className="font-display order-1 inline-flex shrink-0 items-center gap-2 whitespace-nowrap text-lg font-extrabold tracking-tight text-slate-900 focus-visible:outline-2 focus-visible:outline-[#3f6212] dark:text-white dark:focus-visible:outline-[#9be136]"
        >
          <Truck className="h-5 w-5 text-[#3f6212] dark:text-[#9be136]" />
          <span>{t(lang, 'brand')}</span>
        </button>

        <nav
          aria-label="Primary"
          className="order-3 flex w-full min-w-0 items-center gap-4 overflow-x-auto border-t border-slate-100 pt-2 text-xs font-medium text-slate-600 sm:text-sm md:order-2 md:w-auto md:gap-5 md:border-t-0 md:pt-0 dark:border-slate-800/80 dark:text-slate-300"
        >
          {navItems.map(({key, label, Icon}) => {
            const active = activeTab === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => onSelectTab(key)}
                aria-current={active ? 'page' : undefined}
                className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap border-b-2 py-1 transition-colors ${
                  active
                    ? 'border-[#3f6212] font-semibold text-slate-950 dark:border-[#9be136] dark:text-[#9be136]'
                    : 'border-transparent hover:text-slate-950 dark:hover:text-white'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{label}</span>
              </button>
            );
          })}
        </nav>

        <div className="order-2 shrink-0 md:order-3">
          <button
            type="button"
            onClick={() => onSelectTab(ctaTarget)}
            className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg bg-[#3f6212] px-3.5 py-2 text-xs font-bold text-white transition hover:brightness-110 sm:px-4 dark:bg-[#9be136] dark:text-[#040b12]"
          >
            <span>{ctaLabel}</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </header>
  );
};
