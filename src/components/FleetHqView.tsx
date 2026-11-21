import React, {useEffect, useState} from 'react';
import {
  Activity,
  ArrowRightCircle,
  Ban,
  Building2,
  Check,
  CheckCheck,
  CheckCircle2,
  Copy,
  DollarSign,
  Download,
  FileJson,
  FileSpreadsheet,
  HardDriveDownload,
  KeyRound,
  Lock,
  Mail,
  MapPin,
  Package,
  Phone,
  ShieldCheck,
  Truck,
  Upload,
  User,
  UserCheck,
  UserPlus,
  Users,
} from 'lucide-react';
import {
  HUBS,
  MIN_PASSWORD_LENGTH,
  NEXT_STAGE,
  TIERS,
  buildDispatchReport,
  buildOrdersCsv,
  buildReportCsv,
  formatMoney,
  type AuditEntry,
  type HubKey,
  type OrderRecord,
  type PublicUser,
  type TierKey,
} from '../shared/logistics';
import {t, type LangCode} from '../utils/i18n';

interface FleetHqViewProps {
  lang: LangCode;
  admin: PublicUser;
  token: string;
  orders: OrderRecord[];
  onOrderUpdated: (order: OrderRecord) => void;
  onOrdersRestored?: (orders: OrderRecord[]) => void;
  onToast: (msg: string, isError?: boolean) => void;
}

export const FleetHqView: React.FC<FleetHqViewProps> = ({
  lang,
  admin,
  token,
  orders,
  onOrderUpdated,
  onOrdersRestored,
  onToast,
}) => {
  const [users, setUsers] = useState<PublicUser[]>([]);
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [orderFilter, setOrderFilter] = useState('');
  const [auditFilter, setAuditFilter] = useState('');

  // Company-only Driver Provisioning state
  const [drvName, setDrvName] = useState('');
  const [drvEmail, setDrvEmail] = useState('');
  const [drvPhone, setDrvPhone] = useState('');
  const [drvPass, setDrvPass] = useState('');
  const [drvHub, setDrvHub] = useState<HubKey>('gta');
  const [drvTier, setDrvTier] = useState<TierKey>('van');
  const [provisioning, setProvisioning] = useState(false);
  const [issuedCreds, setIssuedCreds] = useState<{name: string; email: string; pass: string} | null>(null);
  const [copiedCred, setCopiedCred] = useState(false);

  const loadOverview = async () => {
    try {
      const res = await fetch('/api/hq/overview', {
        headers: {Authorization: `Bearer ${token}`},
      });
      if (!res.ok) return;
      const data = (await res.json()) as {users: PublicUser[]; audit: AuditEntry[]};
      setUsers(data.users || []);
      setAudit(data.audit || []);
    } catch {
      // ignore offline
    }
  };

  useEffect(() => {
    loadOverview();
  }, [token, orders.length]);

  const handleProvisionDriver = async (e: React.FormEvent) => {
    e.preventDefault();
    if (drvPass.length < MIN_PASSWORD_LENGTH) {
      onToast(`Driver password must be at least ${MIN_PASSWORD_LENGTH} characters.`, true);
      return;
    }
    setProvisioning(true);
    try {
      const res = await fetch('/api/hq/provision-driver', {
        method: 'POST',
        headers: {'Content-Type': 'application/json', Authorization: `Bearer ${token}`},
        body: JSON.stringify({
          name: drvName,
          email: drvEmail,
          phone: drvPhone,
          password: drvPass,
          assignedHub: drvHub,
          assignedTier: drvTier,
        }),
      });
      const data = (await res.json()) as {driver?: PublicUser; error?: string};
      if (!res.ok || !data.driver) {
        onToast(data.error || 'Could not provision driver.', true);
        return;
      }
      setIssuedCreds({name: data.driver.name, email: data.driver.email, pass: drvPass});
      setDrvName('');
      setDrvEmail('');
      setDrvPhone('');
      setDrvPass('');
      onToast(`Issued company email ${data.driver.email} for driver ${data.driver.name}.`);
      loadOverview();
    } catch {
      onToast('Network error provisioning driver.', true);
    } finally {
      setProvisioning(false);
    }
  };

  const handleUpdateDriverAssignment = async (email: string, assignedHub: HubKey, assignedTier: TierKey) => {
    const res = await fetch(`/api/hq/drivers/${encodeURIComponent(email)}`, {
      method: 'PATCH',
      headers: {'Content-Type': 'application/json', Authorization: `Bearer ${token}`},
      body: JSON.stringify({assignedHub, assignedTier}),
    });
    const data = (await res.json()) as {driver?: PublicUser; error?: string};
    if (!res.ok || !data.driver) return onToast(data.error || 'Assignment update failed.', true);
    onToast(`Updated ${data.driver.name} to ${assignedHub.toUpperCase()} / ${TIERS[assignedTier].label}.`);
    loadOverview();
  };

  const handleToggleBan = async (email: string) => {
    const res = await fetch(`/api/hq/users/${encodeURIComponent(email)}/ban`, {
      method: 'POST',
      headers: {Authorization: `Bearer ${token}`},
    });
    const data = (await res.json()) as {user?: PublicUser; error?: string};
    if (!res.ok || !data.user) return onToast(data.error || 'Action failed.', true);
    onToast(data.user.ban ? `Suspended ${email}.` : `Reactivated ${email}.`);
    loadOverview();
  };

  const handleAdvanceOrder = async (o: OrderRecord) => {
    const next = NEXT_STAGE[o.status];
    if (!next) return;
    const res = await fetch(`/api/orders/${o.id}/status`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json', Authorization: `Bearer ${token}`},
      body: JSON.stringify({status: next}),
    });
    const data = (await res.json()) as {order?: OrderRecord; error?: string};
    if (!res.ok || !data.order) return onToast(data.error || 'Advance failed.', true);
    onOrderUpdated(data.order);
    loadOverview();
  };

  const handleResolveDispute = async (o: OrderRecord) => {
    const res = await fetch(`/api/orders/${o.id}/resolve`, {
      method: 'POST',
      headers: {Authorization: `Bearer ${token}`},
    });
    const data = (await res.json()) as {order?: OrderRecord; error?: string};
    if (!res.ok || !data.order) return onToast(data.error || 'Resolve failed.', true);
    onOrderUpdated(data.order);
    onToast(`Dispute resolved for ${o.id}.`);
    loadOverview();
  };

  const handleDownloadBackup = async () => {
    const res = await fetch('/api/hq/backup', {
      headers: {Authorization: `Bearer ${token}`},
    });
    if (!res.ok) return onToast('Backup export failed.', true);
    const data = await res.json();
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], {type: 'application/json'}));
    const a = document.createElement('a');
    a.href = url;
    a.download = `hmk-hq-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    onToast('Full HQ JSON backup downloaded.');
  };

  const handleRestoreBackup = async (file: File) => {
    try {
      const parsed = JSON.parse(await file.text()) as {
        orders?: OrderRecord[];
        audit?: AuditEntry[];
        transactions?: unknown[];
      };
      const res = await fetch('/api/hq/restore', {
        method: 'POST',
        headers: {'Content-Type': 'application/json', Authorization: `Bearer ${token}`},
        body: JSON.stringify(parsed),
      });
      const data = (await res.json()) as {orders?: OrderRecord[]; audit?: AuditEntry[]; error?: string};
      if (!res.ok || !data.orders) return onToast(data.error || 'Backup restore failed.', true);
      if (onOrdersRestored) onOrdersRestored(data.orders);
      setAudit(data.audit || []);
      onToast(`Restored ${data.orders.length} orders from backup.`);
    } catch {
      onToast('Invalid backup JSON file.', true);
    }
  };

  const handleDownloadCsv = () => {
    if (!orders.length) return onToast('No orders to export.', true);
    const url = URL.createObjectURL(new Blob([buildOrdersCsv(orders)], {type: 'text/csv'}));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'hmk-hq-orders.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleAutomatedReport = (format: 'json' | 'csv') => {
    const rep = buildDispatchReport(orders);
    const blob =
      format === 'csv'
        ? new Blob([buildReportCsv(rep)], {type: 'text/csv'})
        : new Blob([JSON.stringify(rep, null, 2)], {type: 'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `hmk-dispatch-tax-report-${new Date().toISOString().slice(0, 10)}.${format}`;
    a.click();
    URL.revokeObjectURL(url);
    onToast(`Automated dispatch & CRA tax report (${format.toUpperCase()}) exported.`);
  };

  const report = buildDispatchReport(orders);
  const filteredOrders = orderFilter.trim()
    ? orders.filter((o) =>
        [o.id, o.hub, o.driver, o.status, o.owner].join(' ').toLowerCase().includes(orderFilter.toLowerCase()),
      )
    : orders;
  const filteredAudit = auditFilter.trim()
    ? audit.filter((a) =>
        [a.action, a.actorEmail, a.target, a.detail].join(' ').toLowerCase().includes(auditFilter.toLowerCase()),
      )
    : audit;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-[#0e2034]">
        <div>
          <div className="flex items-center gap-1.5 text-xs font-semibold text-[#3f6212] dark:text-[#9be136]">
            <Building2 className="h-3.5 w-3.5" />
            <span>Fleet HQ Operations · {admin.email}</span>
          </div>
          <h2 className="font-display mt-0.5 text-xl font-bold text-slate-900 dark:text-white">
            Dispatch Ledger, Driver Provisioning &amp; Audit Trail
          </h2>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleDownloadCsv}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 px-3 py-2 text-xs font-semibold dark:border-slate-700"
          >
            <FileSpreadsheet className="h-3.5 w-3.5" />
            <span>CSV Ledger</span>
          </button>
          <button
            type="button"
            onClick={() => handleAutomatedReport('csv')}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 px-3 py-2 text-xs font-semibold dark:border-slate-700"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Tax Report CSV</span>
          </button>
          <button
            type="button"
            onClick={() => handleAutomatedReport('json')}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 px-3 py-2 text-xs font-semibold dark:border-slate-700"
          >
            <FileJson className="h-3.5 w-3.5" />
            <span>Tax Report JSON</span>
          </button>
          <button
            type="button"
            onClick={handleDownloadBackup}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#3f6212] px-3.5 py-2 text-xs font-bold text-white dark:bg-[#9be136] dark:text-[#040b12]"
          >
            <HardDriveDownload className="h-3.5 w-3.5" />
            <span>Export HQ Backup</span>
          </button>
          <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-slate-300 px-3 py-2 text-xs font-semibold dark:border-slate-700">
            <Upload className="h-3.5 w-3.5 text-[#3f6212] dark:text-[#9be136]" />
            <span>Restore Backup</span>
            <input
              type="file"
              accept="application/json"
              aria-label="Restore HQ backup JSON"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleRestoreBackup(file);
              }}
              className="sr-only"
            />
          </label>
        </div>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-[#0e2034]">
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <Package className="h-3.5 w-3.5 text-[#3f6212] dark:text-[#9be136]" />
            <span>Orders</span>
          </div>
          <div className="mt-1 font-mono text-2xl font-bold tabular-nums">{report.totalOrders}</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-[#0e2034]">
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <Activity className="h-3.5 w-3.5 text-[#3f6212] dark:text-[#9be136]" />
            <span>Active</span>
          </div>
          <div className="mt-1 font-mono text-2xl font-bold tabular-nums text-[#3f6212] dark:text-[#9be136]">
            {report.activeOrders}
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-[#0e2034]">
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <CheckCircle2 className="h-3.5 w-3.5 text-[#3f6212] dark:text-[#9be136]" />
            <span>Delivered</span>
          </div>
          <div className="mt-1 font-mono text-2xl font-bold tabular-nums">{report.deliveredOrders}</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-[#0e2034]">
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <DollarSign className="h-3.5 w-3.5 text-[#3f6212] dark:text-[#9be136]" />
            <span>Gross Volume</span>
          </div>
          <div className="mt-1 font-mono text-2xl font-bold tabular-nums text-[#3f6212] dark:text-[#9be136]">
            {formatMoney(report.grossVolumeCad)}
          </div>
        </div>
      </div>

      {/* Company-Only Driver Email Provisioning */}
      <form
        onSubmit={handleProvisionDriver}
        className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-[#0e2034]"
      >
        <div className="flex items-center gap-2">
          <UserPlus className="h-4 w-4 text-[#3f6212] dark:text-[#9be136]" />
          <h3 className="font-display text-lg font-bold text-slate-900 dark:text-white">
            {t(lang, 'provisionTitle')}
          </h3>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Drivers cannot self-register. Issue a corporate <span className="font-mono font-bold">@hmktrading.ca</span> driver email and minimum 8-character password here.
        </p>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <label htmlFor="drv-name" className="mb-1 flex items-center gap-1 text-xs font-semibold">
              <User className="h-3 w-3 text-[#3f6212] dark:text-[#9be136]" />
              <span>Driver Full Name</span>
            </label>
            <input
              id="drv-name"
              required
              value={drvName}
              onChange={(e) => setDrvName(e.target.value)}
              placeholder="e.g. Tariq Mahmood"
              className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-xs dark:border-slate-700 dark:bg-[#040b12]"
            />
          </div>
          <div>
            <label htmlFor="drv-email" className="mb-1 flex items-center gap-1 text-xs font-semibold">
              <Mail className="h-3 w-3 text-[#3f6212] dark:text-[#9be136]" />
              <span>Company Email (@hmktrading.ca)</span>
            </label>
            <input
              id="drv-email"
              type="email"
              required
              value={drvEmail}
              onChange={(e) => setDrvEmail(e.target.value)}
              placeholder="tariq.driver@hmktrading.ca"
              className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 font-mono text-xs dark:border-slate-700 dark:bg-[#040b12]"
            />
          </div>
          <div>
            <label htmlFor="drv-phone" className="mb-1 flex items-center gap-1 text-xs font-semibold">
              <Phone className="h-3 w-3 text-[#3f6212] dark:text-[#9be136]" />
              <span>Phone</span>
            </label>
            <input
              id="drv-phone"
              type="tel"
              required
              value={drvPhone}
              onChange={(e) => setDrvPhone(e.target.value)}
              placeholder="+1 416 555 0188"
              className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-xs dark:border-slate-700 dark:bg-[#040b12]"
            />
          </div>
          <div>
            <label htmlFor="drv-hub" className="mb-1 flex items-center gap-1 text-xs font-semibold">
              <MapPin className="h-3 w-3 text-[#3f6212] dark:text-[#9be136]" />
              <span>Assigned Hub</span>
            </label>
            <select
              id="drv-hub"
              value={drvHub}
              onChange={(e) => setDrvHub(e.target.value as HubKey)}
              className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-xs dark:border-slate-700 dark:bg-[#040b12]"
            >
              {Object.values(HUBS).map((h) => (
                <option key={h.key} value={h.key}>{h.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="drv-tier" className="mb-1 flex items-center gap-1 text-xs font-semibold">
              <Truck className="h-3 w-3 text-[#3f6212] dark:text-[#9be136]" />
              <span>Vehicle Tier</span>
            </label>
            <select
              id="drv-tier"
              value={drvTier}
              onChange={(e) => setDrvTier(e.target.value as TierKey)}
              className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-xs dark:border-slate-700 dark:bg-[#040b12]"
            >
              {Object.values(TIERS).map((tr) => (
                <option key={tr.key} value={tr.key}>{tr.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="drv-pass" className="mb-1 flex items-center gap-1 text-xs font-semibold">
              <Lock className="h-3 w-3 text-[#3f6212] dark:text-[#9be136]" />
              <span>Initial Password (min {MIN_PASSWORD_LENGTH} chars)</span>
            </label>
            <input
              id="drv-pass"
              type="password"
              minLength={MIN_PASSWORD_LENGTH}
              required
              placeholder="At least 8 characters"
              value={drvPass}
              onChange={(e) => setDrvPass(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-xs dark:border-slate-700 dark:bg-[#040b12]"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={provisioning}
          className="inline-flex items-center gap-1.5 rounded-xl bg-[#3f6212] px-5 py-2.5 text-xs font-bold text-white disabled:opacity-50 dark:bg-[#9be136] dark:text-[#040b12]"
        >
          <KeyRound className="h-3.5 w-3.5" />
          <span>Issue Company Driver Account</span>
        </button>

        {issuedCreds && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#3f6212]/40 bg-[#3f6212]/10 p-4 text-xs dark:border-[#9be136]/40 dark:bg-[#9be136]/10">
            <div>
              <div className="font-bold text-slate-900 dark:text-white">Issued Credentials for {issuedCreds.name}</div>
              <div className="mt-1 font-mono text-slate-700 dark:text-slate-200">
                Email: {issuedCreds.email} · Initial Password: {issuedCreds.pass}
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                navigator.clipboard?.writeText(`HMK Driver Portal Login\nEmail: ${issuedCreds.email}\nPassword: ${issuedCreds.pass}`);
                setCopiedCred(true);
                setTimeout(() => setCopiedCred(false), 2000);
                onToast('Driver credentials copied to clipboard.');
              }}
              className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 font-bold text-white dark:bg-[#040b12]"
            >
              {copiedCred ? <Check className="h-3.5 w-3.5 text-[#9be136]" /> : <Copy className="h-3.5 w-3.5" />}
              <span>{copiedCred ? 'Copied' : 'Copy Credentials'}</span>
            </button>
          </div>
        )}
      </form>

      {/* Users Directory with inline Driver Hub/Tier Reassignment */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-[#0e2034]">
        <h3 className="font-display mb-3 flex items-center gap-2 text-base font-bold text-slate-900 dark:text-white">
          <Users className="h-4 w-4 text-[#3f6212] dark:text-[#9be136]" />
          <span>User &amp; Provisioned Driver Directory ({users.length})</span>
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500 dark:border-slate-800">
                <th className="py-2 pr-3">Name</th>
                <th className="py-2 pr-3">Email</th>
                <th className="py-2 pr-3">Role</th>
                <th className="py-2 pr-3">Assignment</th>
                <th className="py-2 pr-3">Wallet / Earn</th>
                <th className="py-2 pr-3">Status</th>
                <th className="py-2">Action</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.email} className="border-b border-slate-100 dark:border-slate-800/60">
                  <td className="py-2.5 pr-3 font-medium">{u.name}</td>
                  <td className="py-2.5 pr-3 font-mono">{u.email}</td>
                  <td className="py-2.5 pr-3">{u.role}</td>
                  <td className="py-2.5 pr-3">
                    {u.role === 'driver' ? (
                      <div className="flex flex-wrap gap-1.5">
                        <select
                          aria-label={`Hub for ${u.email}`}
                          value={u.assignedHub || 'gta'}
                          onChange={(e) =>
                            handleUpdateDriverAssignment(u.email, e.target.value as HubKey, u.assignedTier || 'van')
                          }
                          className="rounded border border-slate-300 bg-slate-50 px-1.5 py-1 text-[11px] dark:border-slate-700 dark:bg-[#040b12]"
                        >
                          {Object.values(HUBS).map((h) => (
                            <option key={h.key} value={h.key}>{h.key.toUpperCase()}</option>
                          ))}
                        </select>
                        <select
                          aria-label={`Tier for ${u.email}`}
                          value={u.assignedTier || 'van'}
                          onChange={(e) =>
                            handleUpdateDriverAssignment(u.email, u.assignedHub || 'gta', e.target.value as TierKey)
                          }
                          className="rounded border border-slate-300 bg-slate-50 px-1.5 py-1 text-[11px] dark:border-slate-700 dark:bg-[#040b12]"
                        >
                          {Object.values(TIERS).map((tr) => (
                            <option key={tr.key} value={tr.key}>{tr.label}</option>
                          ))}
                        </select>
                      </div>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="py-2.5 pr-3 font-mono tabular-nums">
                    {formatMoney(u.role === 'driver' ? u.earn : u.wallet)}
                  </td>
                  <td className="py-2.5 pr-3">{u.ban ? 'Suspended' : 'Active'}</td>
                  <td className="py-2.5">
                    {u.email !== admin.email && (
                      <button
                        type="button"
                        onClick={() => handleToggleBan(u.email)}
                        className="inline-flex items-center gap-1 rounded-md border border-slate-300 px-2.5 py-1 text-xs font-semibold dark:border-slate-700"
                      >
                        {u.ban ? <UserCheck className="h-3 w-3 text-[#3f6212] dark:text-[#9be136]" /> : <Ban className="h-3 w-3 text-red-500" />}
                        <span>{u.ban ? 'Reactivate' : 'Suspend'}</span>
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Orders Ledger */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-[#0e2034]">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h3 className="font-display flex items-center gap-2 text-base font-bold text-slate-900 dark:text-white">
            <Package className="h-4 w-4 text-[#3f6212] dark:text-[#9be136]" />
            <span>Dispatch Orders Ledger</span>
          </h3>
          <input
            value={orderFilter}
            onChange={(e) => setOrderFilter(e.target.value)}
            placeholder="Filter orders by ID, hub, status..."
            className="w-64 rounded-lg border border-slate-300 bg-slate-50 px-3 py-1.5 text-xs dark:border-slate-700 dark:bg-[#040b12]"
          />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500 dark:border-slate-800">
                <th className="py-2 pr-3">Order</th>
                <th className="py-2 pr-3">Hub</th>
                <th className="py-2 pr-3">Tier</th>
                <th className="py-2 pr-3">Driver</th>
                <th className="py-2 pr-3">Total</th>
                <th className="py-2 pr-3">Status</th>
                <th className="py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredOrders.map((o) => (
                <tr key={o.id} className="border-b border-slate-100 dark:border-slate-800/60">
                  <td className="py-2.5 pr-3 font-mono font-bold text-[#3f6212] dark:text-[#9be136]">#{o.id}</td>
                  <td className="py-2.5 pr-3">{o.hub}</td>
                  <td className="py-2.5 pr-3">{o.tier}</td>
                  <td className="py-2.5 pr-3">{o.driver}</td>
                  <td className="py-2.5 pr-3 font-mono tabular-nums">{formatMoney(o.total)}</td>
                  <td className="py-2.5 pr-3">{o.dis ? 'Disputed' : o.status}</td>
                  <td className="flex gap-1.5 py-2.5">
                    {NEXT_STAGE[o.status] && (
                      <button
                        type="button"
                        onClick={() => handleAdvanceOrder(o)}
                        className="inline-flex items-center gap-1 rounded-md border border-slate-300 px-2.5 py-1 text-xs font-semibold dark:border-slate-700"
                      >
                        <ArrowRightCircle className="h-3 w-3" />
                        <span>Advance</span>
                      </button>
                    )}
                    {o.dis && (
                      <button
                        type="button"
                        onClick={() => handleResolveDispute(o)}
                        className="inline-flex items-center gap-1 rounded-md border border-red-400 px-2.5 py-1 text-xs font-semibold text-red-600 dark:text-red-400"
                      >
                        <CheckCheck className="h-3 w-3" />
                        <span>Resolve</span>
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Immutable Audit Trail */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-[#0e2034]">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h3 className="font-display flex items-center gap-2 text-base font-bold text-slate-900 dark:text-white">
            <ShieldCheck className="h-4 w-4 text-[#3f6212] dark:text-[#9be136]" />
            <span>{t(lang, 'auditTitle')} ({filteredAudit.length})</span>
          </h3>
          <input
            value={auditFilter}
            onChange={(e) => setAuditFilter(e.target.value)}
            placeholder="Search audit events..."
            className="w-64 rounded-lg border border-slate-300 bg-slate-50 px-3 py-1.5 text-xs dark:border-slate-700 dark:bg-[#040b12]"
          />
        </div>
        <div className="max-h-72 overflow-auto">
          <table className="w-full text-left font-mono text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500 dark:border-slate-800">
                <th className="py-2 pr-3">Time</th>
                <th className="py-2 pr-3">Actor</th>
                <th className="py-2 pr-3">Action</th>
                <th className="py-2 pr-3">Target</th>
                <th className="py-2 pr-3">Detail</th>
                <th className="py-2">Hash</th>
              </tr>
            </thead>
            <tbody>
              {filteredAudit.slice(0, 60).map((a) => (
                <tr key={a.id} className="border-b border-slate-100 dark:border-slate-800/60">
                  <td className="py-2 pr-3 whitespace-nowrap text-slate-500">{new Date(a.at).toLocaleTimeString()}</td>
                  <td className="py-2 pr-3">{a.actorEmail}</td>
                  <td className="py-2 pr-3 font-bold">{a.action}</td>
                  <td className="py-2 pr-3">{a.target}</td>
                  <td className="py-2 pr-3">{a.detail}</td>
                  <td className="py-2 text-slate-400">{a.hash}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
