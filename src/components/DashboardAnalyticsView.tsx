import React, {useMemo, useState} from 'react';
import {
  Award,
  CheckCircle2,
  Cloud,
  Download,
  Lock,
  MapPin,
  Receipt,
  RefreshCw,
  ShieldCheck,
  Sliders,
  Target,
  Trophy,
  Truck,
  Unlock,
} from 'lucide-react';
import {
  buildDispatchReport,
  computeGamificationStats,
  formatMoney,
  type OrderRecord,
  type PublicUser,
  type TransactionRecord,
} from '../shared/logistics';
import {t, type LangCode} from '../utils/i18n';

export interface WidgetConfig {
  revenueByHub: boolean;
  tierBreakdown: boolean;
  dailyGoals: boolean;
  badges: boolean;
  leaderboard: boolean;
  recentTransactions: boolean;
  offlineVault: boolean;
  cloudExport: boolean;
}

interface DashboardAnalyticsViewProps {
  lang: LangCode;
  orders: OrderRecord[];
  transactions: TransactionRecord[];
  user: PublicUser | null;
  widgets: WidgetConfig;
  vaultMeta: {updatedAt: string; byteLength: number} | null;
  offlineQueueCount: number;
  onToggleWidget: (key: keyof WidgetConfig) => void;
  onSyncOfflineVault: () => void;
  onDecryptInspectVault: () => Promise<{ordersCount: number; queueCount: number; savedAt: string} | null>;
  onExportCloudBundle: () => void;
  onToast: (msg: string, isError?: boolean) => void;
}

export const DashboardAnalyticsView: React.FC<DashboardAnalyticsViewProps> = ({
  lang,
  orders,
  transactions,
  user,
  widgets,
  vaultMeta,
  offlineQueueCount,
  onToggleWidget,
  onSyncOfflineVault,
  onDecryptInspectVault,
  onExportCloudBundle,
  onToast,
}) => {
  const [customizeOpen, setCustomizeOpen] = useState(false);
  const [vaultInspect, setVaultInspect] = useState<{
    ordersCount: number;
    queueCount: number;
    savedAt: string;
  } | null>(null);

  const report = buildDispatchReport(orders);
  const gami = computeGamificationStats(
    orders,
    user?.email || '',
    user?.role || 'customer',
    user?.dailyGoalTarget || 3,
  );
  const maxHubRev = Math.max(1, ...report.byHub.map((h) => h.revenue));
  const maxTierRev = Math.max(1, ...report.byTier.map((tr) => tr.revenue));

  const leaderboard = useMemo(() => {
    const map = new Map<string, {name: string; delivered: number; volume: number; xp: number}>();
    for (const o of orders) {
      if (o.status === 'Cancelled') continue;
      const key = o.driver && o.driver !== 'Awaiting Company Driver' ? o.driver : o.owner;
      const cur = map.get(key) || {name: key, delivered: 0, volume: 0, xp: 0};
      if (o.status === 'Delivered') cur.delivered += 1;
      cur.volume = +(cur.volume + o.total).toFixed(2);
      cur.xp += o.status === 'Delivered' ? 160 : 40;
      map.set(key, cur);
    }
    return Array.from(map.values())
      .sort((a, b) => b.xp - a.xp || b.volume - a.volume)
      .slice(0, 5);
  }, [orders]);

  const downloadReportJson = () => {
    const blob = new Blob([JSON.stringify(report, null, 2)], {type: 'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `hmk-analytics-report-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    onToast('Analytics summary report downloaded.');
  };

  const handleInspectVault = async () => {
    const res = await onDecryptInspectVault();
    if (!res) {
      onToast('No encrypted vault record found yet. Sync vault first.', true);
      return;
    }
    setVaultInspect(res);
    onToast(`AES-GCM Vault verified (${res.ordersCount} orders decrypted).`);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-[#0e2034]">
        <div>
          <div className="flex items-center gap-1.5 text-xs font-semibold text-[#3f6212] dark:text-[#9be136]">
            <Target className="h-3.5 w-3.5" />
            <span>Performance &amp; Telemetry</span>
          </div>
          <h2 className="font-display mt-0.5 text-xl font-bold text-slate-900 dark:text-white">
            {t(lang, 'analyticsTitle')}
          </h2>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setCustomizeOpen((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 px-3.5 py-2 text-xs font-semibold dark:border-slate-700"
          >
            <Sliders className="h-3.5 w-3.5" />
            <span>Customize Widgets</span>
          </button>
          <button
            type="button"
            onClick={downloadReportJson}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#3f6212] px-3.5 py-2 text-xs font-bold text-white dark:bg-[#9be136] dark:text-[#040b12]"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Export Report</span>
          </button>
        </div>
      </div>

      {customizeOpen && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-[#0e2034]">
          <div className="mb-3 flex items-center gap-1.5 text-xs font-bold text-slate-900 dark:text-white">
            <Sliders className="h-3.5 w-3.5 text-[#3f6212] dark:text-[#9be136]" />
            <span>Toggle Dashboard Widgets</span>
          </div>
          <div className="flex flex-wrap gap-2.5 text-xs">
            {(
              [
                ['dailyGoals', 'Daily Goal & XP', Target],
                ['badges', 'Achievement Badges', Award],
                ['revenueByHub', 'Revenue by Metro Hub', MapPin],
                ['tierBreakdown', 'Revenue by Fleet Tier', Truck],
                ['leaderboard', 'Fleet Leaderboard', Trophy],
                ['recentTransactions', 'Financial Transactions', Receipt],
                ['offlineVault', 'Encrypted Offline Vault', Lock],
                ['cloudExport', 'Cloud Archive & Sync', Cloud],
              ] as Array<[keyof WidgetConfig, string, React.ComponentType<{className?: string}>]>
            ).map(([key, label, Icon]) => (
              <label
                key={key}
                className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-medium dark:border-slate-700 dark:bg-[#040b12]"
              >
                <input
                  type="checkbox"
                  checked={widgets[key]}
                  onChange={() => onToggleWidget(key)}
                />
                <Icon className="h-3.5 w-3.5 text-[#3f6212] dark:text-[#9be136]" />
                <span>{label}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Top KPI Summary */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-[#0e2034]">
          <div className="text-xs text-slate-500">Total Shipments</div>
          <div className="mt-1 font-mono text-2xl font-bold tabular-nums text-slate-900 dark:text-white">
            {report.totalOrders}
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-[#0e2034]">
          <div className="text-xs text-slate-500">Delivered</div>
          <div className="mt-1 font-mono text-2xl font-bold tabular-nums text-[#3f6212] dark:text-[#9be136]">
            {report.deliveredOrders}
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-[#0e2034]">
          <div className="text-xs text-slate-500">Gross Volume</div>
          <div className="mt-1 font-mono text-2xl font-bold tabular-nums text-slate-900 dark:text-white">
            {formatMoney(report.grossVolumeCad)}
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-[#0e2034]">
          <div className="text-xs text-slate-500">GST / HST Collected</div>
          <div className="mt-1 font-mono text-2xl font-bold tabular-nums text-[#3f6212] dark:text-[#9be136]">
            {formatMoney(report.totalTaxCad)}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {widgets.dailyGoals && (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-[#0e2034]">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs font-semibold text-[#3f6212] dark:text-[#9be136]">{gami.tierName}</div>
                <h3 className="font-display text-lg font-bold text-slate-900 dark:text-white">
                  Daily Dispatch Goal · Level {gami.level}
                </h3>
              </div>
              <div className="text-right font-mono text-xs tabular-nums">
                <div className="font-bold text-slate-900 dark:text-white">{gami.xp} XP</div>
                <div className="text-slate-500">{gami.streakDays} day streak</div>
              </div>
            </div>

            <div className="mt-5 flex items-center gap-6">
              <svg width="92" height="92" viewBox="0 0 100 100" className="shrink-0">
                <circle cx="50" cy="50" r="42" fill="none" stroke="currentColor" strokeWidth="10" className="text-slate-200 dark:text-[#152b44]" />
                <circle
                  cx="50"
                  cy="50"
                  r="42"
                  fill="none"
                  stroke="#9be136"
                  strokeWidth="10"
                  strokeLinecap="round"
                  strokeDasharray={`${(264 * gami.dailyProgressPct) / 100} 264`}
                  transform="rotate(-90 50 50)"
                />
                <text x="50" y="54" textAnchor="middle" className="fill-slate-900 font-mono text-base font-bold dark:fill-white">
                  {gami.dailyProgressPct}%
                </text>
              </svg>
              <div className="space-y-1.5 text-xs">
                <div className="font-semibold text-slate-900 dark:text-white">
                  {gami.dailyCompleted} of {gami.dailyGoal} completed today
                </div>
                <p className="text-slate-500 dark:text-slate-400">
                  Next milestone at <span className="font-mono font-bold">{gami.nextLevelXp} XP</span>. Complete PIN-verified deliveries to maintain your streak.
                </p>
              </div>
            </div>
          </div>
        )}

        {widgets.badges && (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-[#0e2034]">
            <div className="flex items-center gap-2">
              <Award className="h-4 w-4 text-[#3f6212] dark:text-[#9be136]" />
              <h3 className="font-display text-lg font-bold text-slate-900 dark:text-white">Milestones &amp; Badges</h3>
            </div>
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {gami.badges.map((b) => (
                <div
                  key={b.id}
                  className={`rounded-xl border p-3.5 text-xs ${
                    b.earned
                      ? 'border-[#3f6212]/40 bg-[#3f6212]/10 dark:border-[#9be136]/40 dark:bg-[#9be136]/10'
                      : 'border-slate-200 bg-slate-50 opacity-70 dark:border-slate-800 dark:bg-[#040b12]'
                  }`}
                >
                  <div className="flex items-center gap-1.5 font-bold text-slate-900 dark:text-white">
                    <CheckCircle2 className={`h-3.5 w-3.5 ${b.earned ? 'text-[#3f6212] dark:text-[#9be136]' : 'text-slate-400'}`} />
                    <span>{b.label} · {b.earned ? 'Unlocked' : 'Locked'}</span>
                  </div>
                  <div className="mt-1 text-slate-500 dark:text-slate-400">{b.hint}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {widgets.revenueByHub && (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-[#0e2034]">
            <h3 className="font-display flex items-center gap-2 text-lg font-bold text-slate-900 dark:text-white">
              <MapPin className="h-4 w-4 text-[#3f6212] dark:text-[#9be136]" />
              <span>Revenue by Canadian Hub</span>
            </h3>
            <div className="mt-4 space-y-3">
              {report.byHub.length === 0 ? (
                <p className="text-xs text-slate-500">No hub revenue recorded yet.</p>
              ) : (
                report.byHub.map((h) => (
                  <div key={h.hub}>
                    <div className="flex justify-between text-xs">
                      <span className="font-medium text-slate-700 dark:text-slate-200">{h.hub}</span>
                      <span className="font-mono font-bold tabular-nums text-slate-900 dark:text-white">
                        {formatMoney(h.revenue)} ({h.count})
                      </span>
                    </div>
                    <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-[#152b44]">
                      <div
                        className="h-full bg-[#3f6212] dark:bg-[#9be136]"
                        style={{width: `${Math.max(4, (h.revenue / maxHubRev) * 100)}%`}}
                      />
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {widgets.tierBreakdown && (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-[#0e2034]">
            <h3 className="font-display flex items-center gap-2 text-lg font-bold text-slate-900 dark:text-white">
              <Truck className="h-4 w-4 text-[#3f6212] dark:text-[#9be136]" />
              <span>Revenue by Fleet Tier</span>
            </h3>
            <div className="mt-4 space-y-3">
              {report.byTier.length === 0 ? (
                <p className="text-xs text-slate-500">No vehicle tier volume yet.</p>
              ) : (
                report.byTier.map((tr) => (
                  <div key={tr.tier}>
                    <div className="flex justify-between text-xs">
                      <span className="font-medium text-slate-700 dark:text-slate-200">{tr.tier}</span>
                      <span className="font-mono font-bold tabular-nums text-slate-900 dark:text-white">
                        {formatMoney(tr.revenue)} ({tr.count})
                      </span>
                    </div>
                    <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-[#152b44]">
                      <div
                        className="h-full bg-sky-500"
                        style={{width: `${Math.max(4, (tr.revenue / maxTierRev) * 100)}%`}}
                      />
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {widgets.leaderboard && (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-[#0e2034]">
            <h3 className="font-display flex items-center gap-2 text-lg font-bold text-slate-900 dark:text-white">
              <Trophy className="h-4 w-4 text-[#3f6212] dark:text-[#9be136]" />
              <span>Fleet &amp; Partner Leaderboard</span>
            </h3>
            <div className="mt-4 space-y-2.5">
              {leaderboard.length === 0 ? (
                <p className="text-xs text-slate-500">Complete deliveries to populate rankings.</p>
              ) : (
                leaderboard.map((entry, idx) => (
                  <div
                    key={entry.name}
                    className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs dark:border-slate-700 dark:bg-[#040b12]"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="font-mono font-bold text-[#3f6212] dark:text-[#9be136]">#{idx + 1}</span>
                      <div>
                        <div className="font-bold text-slate-900 dark:text-white">{entry.name}</div>
                        <div className="text-[11px] text-slate-500">{entry.delivered} delivered · {formatMoney(entry.volume)}</div>
                      </div>
                    </div>
                    <span className="font-mono font-bold tabular-nums text-slate-900 dark:text-white">{entry.xp} XP</span>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {widgets.recentTransactions && (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-[#0e2034]">
            <h3 className="font-display flex items-center gap-2 text-lg font-bold text-slate-900 dark:text-white">
              <Receipt className="h-4 w-4 text-[#3f6212] dark:text-[#9be136]" />
              <span>Recent Financial Transactions ({transactions.length})</span>
            </h3>
            <div className="mt-4 space-y-2">
              {transactions.length === 0 ? (
                <p className="text-xs text-slate-500">Sign in and complete wallet or order transactions to view ledger entries.</p>
              ) : (
                transactions.slice(0, 5).map((tx) => (
                  <div
                    key={tx.id}
                    className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs dark:border-slate-700 dark:bg-[#040b12]"
                  >
                    <div>
                      <div className="font-bold text-slate-900 dark:text-white">
                        {tx.type} · {tx.method}
                      </div>
                      <div className="font-mono text-[11px] text-slate-500">
                        {tx.reference} · {tx.at}
                      </div>
                    </div>
                    <span className={`font-mono font-bold tabular-nums ${tx.amountCad >= 0 ? 'text-[#3f6212] dark:text-[#9be136]' : 'text-slate-900 dark:text-white'}`}>
                      {tx.amountCad >= 0 ? `+${formatMoney(tx.amountCad)}` : formatMoney(tx.amountCad)}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {(widgets.offlineVault || widgets.cloudExport) && (
          <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 lg:col-span-2 dark:border-slate-800 dark:bg-[#0e2034]">
            {widgets.offlineVault && (
              <div className="space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Lock className="h-4 w-4 text-[#3f6212] dark:text-[#9be136]" />
                    <h3 className="font-display text-base font-bold text-slate-900 dark:text-white">
                      {t(lang, 'vaultTitle')}
                    </h3>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={onSyncOfflineVault}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold dark:border-slate-700"
                    >
                      <RefreshCw className="h-3 w-3" />
                      <span>Encrypt &amp; Sync Now</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleInspectVault}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-[#3f6212] px-3 py-1.5 text-xs font-semibold text-[#3f6212] dark:border-[#9be136] dark:text-[#9be136]"
                    >
                      <Unlock className="h-3 w-3" />
                      <span>Verify &amp; Decrypt Vault</span>
                    </button>
                  </div>
                </div>
                <p className="font-mono text-xs text-slate-500 dark:text-slate-400">
                  {vaultMeta
                    ? `Encrypted ${vaultMeta.byteLength} bytes · Updated ${new Date(vaultMeta.updatedAt).toLocaleTimeString()} · Queue: ${offlineQueueCount}`
                    : 'Not yet synced to encrypted IndexedDB vault.'}
                </p>
                {vaultInspect && (
                  <div className="flex items-center gap-2 rounded-lg border border-[#3f6212]/40 bg-[#3f6212]/10 px-3 py-2 font-mono text-xs text-[#3f6212] dark:border-[#9be136]/40 dark:bg-[#9be136]/10 dark:text-[#9be136]">
                    <ShieldCheck className="h-4 w-4 shrink-0" />
                    <span>
                      AES-GCM Decrypted OK: {vaultInspect.ordersCount} cached orders · {vaultInspect.queueCount} queued actions · Snapshot {new Date(vaultInspect.savedAt).toLocaleTimeString()}
                    </span>
                  </div>
                )}
              </div>
            )}

            {widgets.cloudExport && (
              <div className="border-t border-slate-200 pt-4 dark:border-slate-800">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <Cloud className="h-4 w-4 text-[#3f6212] dark:text-[#9be136]" />
                      <span className="text-sm font-bold text-slate-900 dark:text-white">Cloud Archive Export</span>
                    </div>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      Download portable JSON archive for Google Drive, OneDrive, or S3 backup.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={onExportCloudBundle}
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-slate-900 px-3.5 py-2 text-xs font-bold text-white dark:bg-[#152b44] dark:text-[#9be136]"
                  >
                    <Download className="h-3.5 w-3.5" />
                    <span>Export Bundle</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
