import React, {useState} from 'react';
import {
  Bell,
  Building2,
  Download,
  Globe,
  LogIn,
  LogOut,
  Mic,
  Moon,
  Sun,
  Truck,
  UserCheck,
  Wallet,
  Wifi,
  WifiOff,
} from 'lucide-react';
import {formatMoney, type PublicUser} from '../shared/logistics';
import {type LangCode} from '../utils/i18n';
import {useOnlineStatus, usePWAInstall} from '../hooks/usePWAInstall';
import type {TabKey} from './TopBar';

interface WorkspaceBarProps {
  user: PublicUser | null;
  lang: LangCode;
  isDark: boolean;
  wsConnected: boolean;
  offlineQueueCount: number;
  onChangeLang: (lang: LangCode) => void;
  onToggleTheme: () => void;
  onOpenWallet: () => void;
  onOpenNotifications: () => void;
  onOpenProfile: () => void;
  onOpenVoice: () => void;
  onOpenAuth: () => void;
  onLogout: () => void;
  onSelectTab: (tab: TabKey) => void;
}

export const WorkspaceBar: React.FC<WorkspaceBarProps> = ({
  user,
  lang,
  isDark,
  wsConnected,
  offlineQueueCount,
  onChangeLang,
  onToggleTheme,
  onOpenWallet,
  onOpenNotifications,
  onOpenProfile,
  onOpenVoice,
  onOpenAuth,
  onLogout,
  onSelectTab,
}) => {
  const isOnline = useOnlineStatus();
  const {isInstallable, isInstalled, isIOS, install} = usePWAInstall();
  const [showIosGuide, setShowIosGuide] = useState(false);

  return (
    <div className="no-print border-b border-slate-200 bg-slate-100/80 dark:border-slate-800/80 dark:bg-[#040b12]">
      <div className="mx-auto flex max-w-[1200px] flex-wrap items-center justify-between gap-3 px-4 py-2 text-xs sm:px-6">
        <div className="flex flex-wrap items-center gap-2 text-slate-600 dark:text-slate-400">
          <span className="inline-flex items-center gap-1.5 font-mono font-semibold text-slate-900 dark:text-slate-200">
            {isOnline ? (
              <Wifi className="h-3.5 w-3.5 text-[#3f6212] dark:text-[#9be136]" />
            ) : (
              <WifiOff className="h-3.5 w-3.5 text-amber-500" />
            )}
            <span>{isOnline ? (wsConnected ? 'Live Sync Active' : 'Online') : 'Offline Mode'}</span>
          </span>
          <span aria-hidden="true">·</span>
          <span className="font-mono">CRA BN 84920 1948 RT0001</span>
          {offlineQueueCount > 0 && (
            <>
              <span aria-hidden="true">·</span>
              <span className="font-mono font-semibold text-amber-600 dark:text-amber-400">
                {offlineQueueCount} queued offline
              </span>
            </>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onOpenVoice}
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-2.5 py-1 font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-[#0e2034] dark:text-slate-200 dark:hover:bg-[#152b44]"
            aria-label="Open voice and command bar"
          >
            <Mic className="h-3.5 w-3.5 text-[#3f6212] dark:text-[#9be136]" />
            <span>Voice</span>
          </button>

          <label className="sr-only" htmlFor="lang-select">
            Language
          </label>
          <div className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2 py-1 dark:border-slate-700 dark:bg-[#0e2034]">
            <Globe className="h-3.5 w-3.5 text-slate-500 dark:text-slate-400" />
            <select
              id="lang-select"
              value={lang}
              onChange={(e) => onChangeLang(e.target.value as LangCode)}
              className="bg-transparent text-xs font-semibold text-slate-700 focus:outline-none dark:text-slate-200"
            >
              <option value="en">EN</option>
              <option value="fr">FR</option>
              <option value="ur">UR</option>
            </select>
          </div>

          <button
            type="button"
            onClick={onToggleTheme}
            aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
            className="inline-flex items-center justify-center rounded-md border border-slate-300 bg-white p-1.5 text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-[#0e2034] dark:text-slate-200 dark:hover:bg-[#152b44]"
          >
            {isDark ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
          </button>

          {!isInstalled && isInstallable && (
            <button
              type="button"
              onClick={install}
              className="inline-flex items-center gap-1 rounded-md border border-[#3f6212]/40 bg-[#3f6212]/10 px-2.5 py-1 font-semibold text-[#3f6212] dark:border-[#9be136]/40 dark:bg-[#9be136]/10 dark:text-[#9be136]"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Install App</span>
            </button>
          )}

          {!isInstalled && !isInstallable && isIOS && (
            <button
              type="button"
              onClick={() => setShowIosGuide(true)}
              className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2.5 py-1 font-medium text-slate-700 dark:border-slate-700 dark:bg-[#0e2034] dark:text-slate-200"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Install iOS</span>
            </button>
          )}

          {user ? (
            <>
              {user.role === 'customer' && (
                <button
                  type="button"
                  onClick={onOpenWallet}
                  aria-label={`Open Customer Wallet (${formatMoney(user.wallet)} CAD)`}
                  className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-2.5 py-1 font-mono font-semibold text-slate-800 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-[#0e2034] dark:text-slate-100"
                >
                  <Wallet className="h-3.5 w-3.5 text-[#3f6212] dark:text-[#9be136]" />
                  <span className="tabular-nums">{formatMoney(user.wallet)} CAD</span>
                </button>
              )}

              {user.role === 'driver' && (
                <button
                  type="button"
                  onClick={() => onSelectTab('driver')}
                  aria-label={`Open Driver Earnings Console (${formatMoney(user.earn)} CAD)`}
                  className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-2.5 py-1 font-mono font-semibold text-slate-800 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-[#0e2034] dark:text-slate-100"
                >
                  <Truck className="h-3.5 w-3.5 text-[#3f6212] dark:text-[#9be136]" />
                  <span className="tabular-nums">Earn: {formatMoney(user.earn)} CAD</span>
                </button>
              )}

              <button
                type="button"
                onClick={onOpenNotifications}
                aria-label="Notifications"
                className="relative inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2 py-1 font-mono font-semibold text-slate-700 dark:border-slate-700 dark:bg-[#0e2034] dark:text-slate-200"
              >
                <Bell className="h-3.5 w-3.5" />
                {user.unread > 0 && (
                  <span className="tabular-nums text-[#3f6212] dark:text-[#9be136]">{user.unread}</span>
                )}
              </button>

              <button
                type="button"
                onClick={onOpenProfile}
                className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-2.5 py-1 font-semibold text-slate-800 dark:border-slate-700 dark:bg-[#0e2034] dark:text-slate-100"
              >
                <UserCheck className="h-3.5 w-3.5 text-[#3f6212] dark:text-[#9be136]" />
                <span>{user.name}</span>
                <span className="text-slate-500 dark:text-slate-400">({user.role})</span>
              </button>

              {(user.role === 'driver' || user.role === 'admin') && (
                <button
                  type="button"
                  onClick={() => onSelectTab(user.role === 'driver' ? 'driver' : 'admin')}
                  className="inline-flex items-center gap-1 rounded-md bg-slate-900 px-2.5 py-1 font-semibold text-white dark:bg-slate-700"
                >
                  {user.role === 'driver' ? <Truck className="h-3.5 w-3.5" /> : <Building2 className="h-3.5 w-3.5" />}
                  <span>{user.role === 'driver' ? 'Console' : 'HQ'}</span>
                </button>
              )}

              <button
                type="button"
                onClick={onLogout}
                className="inline-flex items-center gap-1 rounded-md border border-slate-300 px-2.5 py-1 font-medium text-slate-700 hover:bg-slate-200 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span>Sign Out</span>
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={onOpenAuth}
              className="inline-flex items-center gap-1.5 rounded-md bg-slate-900 px-3 py-1 font-semibold text-white hover:bg-slate-800 dark:bg-[#152b44] dark:text-[#9be136]"
            >
              <LogIn className="h-3.5 w-3.5" />
              <span>Role Portals / Sign In</span>
            </button>
          )}
        </div>
      </div>

      {showIosGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-[#0e2034]">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">Install on iPhone / iPad</h3>
            <p className="mt-2 text-xs text-slate-600 dark:text-slate-300">
              1. Tap the Share icon in Safari.<br />
              2. Scroll down and tap Add to Home Screen.
            </p>
            <button
              type="button"
              onClick={() => setShowIosGuide(false)}
              className="mt-4 w-full rounded-lg bg-slate-900 py-2 text-xs font-semibold text-white dark:bg-[#9be136] dark:text-[#040b12]"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
