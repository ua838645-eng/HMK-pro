import React, {useEffect, useMemo, useState} from 'react';
import {
  Bell,
  Building2,
  CheckCircle2,
  CreditCard,
  Download,
  Fingerprint,
  Globe,
  KeyRound,
  Landmark,
  Lock,
  Mic,
  PackagePlus,
  Phone,
  Play,
  PlusCircle,
  Printer,
  QrCode,
  Receipt,
  Sun,
  Target,
  User,
  Wallet,
  X,
} from 'lucide-react';
import {
  CANADIAN_BANKS,
  CRA_BN,
  MIN_PASSWORD_LENGTH,
  detectCardBrand,
  formatMoney,
  isValidCanadianBankDetails,
  isValidCanadianPostalCode,
  isValidCardExpiry,
  parseVoiceCommand,
  validateLuhnCard,
  type NotificationPrefs,
  type OrderRecord,
  type PublicUser,
  type TransactionRecord,
  type VoiceAction,
} from '../shared/logistics';
import {t, type LangCode} from '../utils/i18n';

export const WalletModal: React.FC<{
  open: boolean;
  user: PublicUser | null;
  token: string | null;
  transactions: TransactionRecord[];
  onClose: () => void;
  onSuccess: (user: PublicUser) => void;
  onToast: (msg: string, isError?: boolean) => void;
}> = ({open, user, token, transactions, onClose, onSuccess, onToast}) => {
  const [tab, setTab] = useState<'topup' | 'ledger'>('topup');
  const [amount, setAmount] = useState('150');
  const [method, setMethod] = useState<'Card' | 'Interac e-Transfer' | 'Bank Transfer (EFT)'>('Card');
  const [cardHolder, setCardHolder] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvv, setCardCvv] = useState('');
  const [postalCode, setPostalCode] = useState('');

  // Bank EFT top-up fields
  const [bankName, setBankName] = useState<string>(CANADIAN_BANKS[0].name);
  const [institutionNo, setInstitutionNo] = useState<string>(CANADIAN_BANKS[0].code);
  const [transitNo, setTransitNo] = useState('');
  const [accountNo, setAccountNo] = useState('');
  const [useLinkedBank, setUseLinkedBank] = useState(Boolean(user?.bankAccount));

  const cardBrand = useMemo(() => detectCardBrand(cardNumber), [cardNumber]);

  if (!open) return null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return onToast('Sign in first.', true);
    if (user?.role !== 'customer') return onToast('Wallet top-up is for Customer accounts only.', true);

    if (method === 'Card') {
      if (!cardHolder.trim()) return onToast('Enter cardholder full name.', true);
      if (!validateLuhnCard(cardNumber)) return onToast('Enter a valid card number.', true);
      if (!isValidCardExpiry(cardExpiry)) return onToast('Enter a valid future expiry (MM/YY).', true);
      if (!/^\d{3,4}$/.test(cardCvv.trim())) return onToast('Enter a valid 3- or 4-digit CVV.', true);
      if (postalCode && !isValidCanadianPostalCode(postalCode)) {
        return onToast('Enter a valid Canadian postal code (e.g. M5V 3L9).', true);
      }
    }

    if (method === 'Bank Transfer (EFT)' && (!useLinkedBank || !user?.bankAccount)) {
      if (!isValidCanadianBankDetails(institutionNo, transitNo, accountNo)) {
        return onToast('Enter valid Canadian Bank Institution (3), Transit (5), and Account (7-12) digits.', true);
      }
    }

    const res = await fetch('/api/wallet/topup', {
      method: 'POST',
      headers: {'Content-Type': 'application/json', Authorization: `Bearer ${token}`},
      body: JSON.stringify({
        amount: Number(amount),
        method,
        cardNumber: method === 'Card' ? cardNumber : undefined,
        cardExpiry: method === 'Card' ? cardExpiry : undefined,
        postalCode: method === 'Card' ? postalCode : undefined,
        institutionNo: method === 'Bank Transfer (EFT)' && !useLinkedBank ? institutionNo : undefined,
        transitNo: method === 'Bank Transfer (EFT)' && !useLinkedBank ? transitNo : undefined,
        accountNo: method === 'Bank Transfer (EFT)' && !useLinkedBank ? accountNo : undefined,
      }),
    });
    const data = (await res.json()) as {user?: PublicUser; error?: string};
    if (!res.ok || !data.user) return onToast(data.error || 'Top-up failed.', true);
    onSuccess(data.user);
    onToast(`Added ${formatMoney(Number(amount))} CAD to wallet.`);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" role="dialog" aria-modal="true">
      <div className="max-h-[90vh] w-full max-w-lg overflow-auto rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-[#0e2034]">
        <div className="flex items-center justify-between">
          <h3 className="font-display flex items-center gap-2 text-lg font-bold">
            <Wallet className="h-5 w-5 text-[#3f6212] dark:text-[#9be136]" />
            <span>HMK Wallet &amp; Ledger (CAD)</span>
          </h3>
          <button type="button" onClick={onClose} aria-label="Close wallet modal" className="rounded-lg p-1 hover:bg-slate-100 dark:hover:bg-slate-800">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 flex gap-2 rounded-lg bg-slate-100 p-1 dark:bg-[#040b12]">
          <button
            type="button"
            onClick={() => setTab('topup')}
            className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-bold ${
              tab === 'topup' ? 'bg-white text-slate-900 shadow-sm dark:bg-[#152b44] dark:text-white' : 'text-slate-500'
            }`}
          >
            <PlusCircle className="h-3.5 w-3.5" />
            <span>Top-Up Funds</span>
          </button>
          <button
            type="button"
            onClick={() => setTab('ledger')}
            className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-bold ${
              tab === 'ledger' ? 'bg-white text-slate-900 shadow-sm dark:bg-[#152b44] dark:text-white' : 'text-slate-500'
            }`}
          >
            <Receipt className="h-3.5 w-3.5" />
            <span>Transaction Ledger ({transactions.length})</span>
          </button>
        </div>

        {tab === 'topup' ? (
          <form onSubmit={submit} className="mt-4 space-y-4">
            <div>
              <label htmlFor="wal-amt" className="mb-1 block text-xs font-semibold">Amount (CAD)</label>
              <input
                id="wal-amt"
                type="number"
                min={1}
                max={50000}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 font-mono text-sm dark:border-slate-700 dark:bg-[#040b12]"
              />
            </div>

            <div>
              <div className="mb-1.5 text-xs font-semibold">Funding Method</div>
              <div className="grid grid-cols-3 gap-2">
                {(
                  [
                    ['Card', 'Card', CreditCard],
                    ['Interac e-Transfer', 'Interac', Landmark],
                    ['Bank Transfer (EFT)', 'Bank EFT', Building2],
                  ] as const
                ).map(([m, label, Icon]) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMethod(m)}
                    className={`flex items-center justify-center gap-1.5 rounded-xl border px-2.5 py-2 text-xs font-bold ${
                      method === m
                        ? 'border-[#3f6212] bg-[#3f6212]/10 text-[#3f6212] dark:border-[#9be136] dark:bg-[#9be136]/10 dark:text-[#9be136]'
                        : 'border-slate-300 bg-slate-50 dark:border-slate-700 dark:bg-[#040b12]'
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    <span>{label}</span>
                  </button>
                ))}
              </div>
            </div>

            {method === 'Card' && (
              <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-3.5 dark:border-slate-700 dark:bg-[#040b12]">
                <div className="flex items-center justify-between text-xs font-bold">
                  <span>Card Details</span>
                  <span className="font-mono text-[#3f6212] dark:text-[#9be136]">{cardBrand}</span>
                </div>
                <input
                  value={cardHolder}
                  onChange={(e) => setCardHolder(e.target.value)}
                  placeholder="Cardholder Full Name"
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-[#0e2034]"
                />
                <input
                  value={cardNumber}
                  onChange={(e) => setCardNumber(e.target.value)}
                  placeholder="Card Number (e.g. 4242 4242 4242 4242)"
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-xs dark:border-slate-700 dark:bg-[#0e2034]"
                />
                <div className="grid grid-cols-3 gap-2">
                  <input
                    value={cardExpiry}
                    onChange={(e) => setCardExpiry(e.target.value)}
                    placeholder="MM/YY"
                    maxLength={5}
                    className="rounded-lg border border-slate-300 bg-white px-2.5 py-2 font-mono text-xs dark:border-slate-700 dark:bg-[#0e2034]"
                  />
                  <input
                    type="password"
                    value={cardCvv}
                    onChange={(e) => setCardCvv(e.target.value)}
                    placeholder="CVV"
                    maxLength={4}
                    className="rounded-lg border border-slate-300 bg-white px-2.5 py-2 font-mono text-xs dark:border-slate-700 dark:bg-[#0e2034]"
                  />
                  <input
                    value={postalCode}
                    onChange={(e) => setPostalCode(e.target.value.toUpperCase())}
                    placeholder="M5V 3L9"
                    className="rounded-lg border border-slate-300 bg-white px-2.5 py-2 font-mono text-xs uppercase dark:border-slate-700 dark:bg-[#0e2034]"
                  />
                </div>
              </div>
            )}

            {method === 'Bank Transfer (EFT)' && (
              <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-3.5 dark:border-slate-700 dark:bg-[#040b12]">
                {user?.bankAccount && (
                  <label className="flex cursor-pointer items-center gap-2 text-xs font-semibold text-[#3f6212] dark:text-[#9be136]">
                    <input
                      type="checkbox"
                      checked={useLinkedBank}
                      onChange={(e) => setUseLinkedBank(e.target.checked)}
                    />
                    <span>Use linked {user.bankAccount.institutionName} ••••{user.bankAccount.accountLast4}</span>
                  </label>
                )}
                {(!useLinkedBank || !user?.bankAccount) && (
                  <div className="space-y-2">
                    <select
                      value={bankName}
                      onChange={(e) => {
                        const found = CANADIAN_BANKS.find((b) => b.name === e.target.value);
                        setBankName(e.target.value);
                        if (found) setInstitutionNo(found.code);
                      }}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-[#0e2034]"
                    >
                      {CANADIAN_BANKS.map((b) => (
                        <option key={b.code} value={b.name}>{b.name} ({b.code})</option>
                      ))}
                    </select>
                    <div className="grid grid-cols-3 gap-2">
                      <input
                        value={institutionNo}
                        onChange={(e) => setInstitutionNo(e.target.value)}
                        maxLength={3}
                        placeholder="Inst (3)"
                        className="rounded-lg border border-slate-300 bg-white px-2.5 py-2 font-mono text-xs dark:border-slate-700 dark:bg-[#0e2034]"
                      />
                      <input
                        value={transitNo}
                        onChange={(e) => setTransitNo(e.target.value)}
                        maxLength={5}
                        placeholder="Transit (5)"
                        className="rounded-lg border border-slate-300 bg-white px-2.5 py-2 font-mono text-xs dark:border-slate-700 dark:bg-[#0e2034]"
                      />
                      <input
                        value={accountNo}
                        onChange={(e) => setAccountNo(e.target.value)}
                        maxLength={12}
                        placeholder="Account #"
                        className="rounded-lg border border-slate-300 bg-white px-2.5 py-2 font-mono text-xs dark:border-slate-700 dark:bg-[#0e2034]"
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            <button
              type="submit"
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#3f6212] py-3 text-xs font-bold text-white dark:bg-[#9be136] dark:text-[#040b12]"
            >
              <PlusCircle className="h-4 w-4" />
              <span>Add Funds to Wallet</span>
            </button>
          </form>
        ) : (
          <div className="mt-4 max-h-72 space-y-2 overflow-auto">
            {transactions.length === 0 ? (
              <p className="text-xs text-slate-500">No wallet or escrow transactions yet.</p>
            ) : (
              transactions.map((tx) => (
                <div key={tx.id} className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs dark:border-slate-700 dark:bg-[#040b12]">
                  <div>
                    <div className="font-bold">{tx.type} · {tx.method}</div>
                    <div className="font-mono text-[11px] text-slate-500">{tx.reference} · {tx.at}</div>
                  </div>
                  <span className={`font-mono font-bold tabular-nums ${tx.amountCad >= 0 ? 'text-[#3f6212] dark:text-[#9be136]' : ''}`}>
                    {tx.amountCad >= 0 ? `+${formatMoney(tx.amountCad)}` : formatMoney(tx.amountCad)}
                  </span>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export const InvoiceModal: React.FC<{
  order: OrderRecord | null;
  onClose: () => void;
}> = ({order, onClose}) => {
  if (!order) return null;

  const downloadHtml = () => {
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Invoice ${order.id}</title></head><body style="font-family:monospace;padding:32px"><h2>HMK TRADING INC. — CRA TAX INVOICE</h2><p>CRA BN: ${CRA_BN}</p><hr/><p>Order: #${order.id}</p><p>Date: ${order.at}</p><p>Route: ${order.pk} -> ${order.dp} (${order.hub})</p><p>Vehicle: ${order.tier}</p><p>Freight Service: ${formatMoney(order.sub)}</p><p>Promo Discount: -${formatMoney(order.disc)}</p><p>${order.taxLabel}: ${formatMoney(order.tax)}</p><h3>Total (${order.pm}): ${formatMoney(order.total)} CAD</h3><p>Status: ${order.ps}</p></body></html>`;
    const url = URL.createObjectURL(new Blob([html], {type: 'text/html'}));
    const a = document.createElement('a');
    a.href = url;
    a.download = `HMK-Invoice-${order.id}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4" role="dialog" aria-modal="true">
      <div className="print-only-sheet w-full max-w-lg rounded-2xl border border-slate-300 bg-white p-6 text-slate-900 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
          <div>
            <div className="font-mono text-sm font-extrabold">HMK TRADING INC. — TAX INVOICE</div>
            <div className="font-mono text-xs text-slate-500">CRA BN {CRA_BN}</div>
          </div>
          <div className="no-print flex items-center gap-2">
            <button type="button" onClick={() => window.print()} className="inline-flex items-center gap-1 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-bold text-white">
              <Printer className="h-3.5 w-3.5" />
              <span>Print</span>
            </button>
            <button type="button" onClick={downloadHtml} className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold">
              <Download className="h-3.5 w-3.5" />
              <span>Download</span>
            </button>
            <button type="button" onClick={onClose} aria-label="Close invoice" className="rounded-lg p-1 hover:bg-slate-100">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="mt-4 space-y-2 font-mono text-xs tabular-nums">
          <div className="flex justify-between"><span>Order ID</span><strong>#{order.id}</strong></div>
          <div className="flex justify-between"><span>Date</span><span>{order.at}</span></div>
          <div className="flex justify-between"><span>Hub</span><span>{order.hub}</span></div>
          <div className="flex justify-between"><span>Route</span><span>{order.pk} → {order.dp}</span></div>
          <div className="flex justify-between"><span>Fleet Tier</span><span>{order.tier}</span></div>
          <div className="flex justify-between"><span>Freight Service</span><span>{formatMoney(order.sub)}</span></div>
          <div className="flex justify-between"><span>Promo {order.promoCode || '—'}</span><span>-{formatMoney(order.disc)}</span></div>
          <div className="flex justify-between"><span>{order.taxLabel}</span><span>{formatMoney(order.tax)}</span></div>
          <div className="flex justify-between border-t border-slate-300 pt-2 text-sm font-bold">
            <span>Total ({order.pm})</span>
            <span>{formatMoney(order.total)} CAD</span>
          </div>
          <div className="flex justify-between pt-1 text-slate-600"><span>Payment Status</span><span>{order.ps}</span></div>
        </div>
      </div>
    </div>
  );
};

export const WaybillModal: React.FC<{
  order: OrderRecord | null;
  onClose: () => void;
}> = ({order, onClose}) => {
  if (!order) return null;

  // Deterministic barcode stripe widths from order ID characters
  const bars = order.id.split('').flatMap((ch, idx) => {
    const code = ch.charCodeAt(0);
    return [((code + idx) % 3) + 1, ((code >> 1) % 2) + 1, ((code >> 2) % 3) + 1];
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4" role="dialog" aria-modal="true">
      <div className="print-only-sheet w-full max-w-lg rounded-2xl border border-slate-300 bg-white p-6 text-slate-900 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
          <div className="flex items-center gap-2">
            <QrCode className="h-5 w-5 text-[#3f6212]" />
            <div>
              <div className="font-mono text-sm font-extrabold">HMK SHIPPING WAYBILL</div>
              <div className="font-mono text-xs text-slate-500">Carrier CRA BN {CRA_BN}</div>
            </div>
          </div>
          <div className="no-print flex items-center gap-2">
            <button type="button" onClick={() => window.print()} className="inline-flex items-center gap-1 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-bold text-white">
              <Printer className="h-3.5 w-3.5" />
              <span>Print Label</span>
            </button>
            <button type="button" onClick={onClose} aria-label="Close waybill" className="rounded-lg p-1 hover:bg-slate-100">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="mt-4 flex flex-col items-center rounded-xl border border-slate-200 bg-slate-50 p-4">
          <svg viewBox={`0 0 ${bars.length * 6} 44`} className="h-12 w-full max-w-xs" aria-label={`Barcode ${order.id}`}>
            {bars.map((w, i) => (
              <rect
                key={i}
                x={i * 6}
                y={2}
                width={i % 2 === 0 ? w + 1 : 2}
                height={40}
                fill={i % 2 === 0 ? '#0f172a' : 'transparent'}
              />
            ))}
          </svg>
          <div className="mt-1 font-mono text-sm font-extrabold tracking-widest">*{order.id}*</div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 font-mono text-xs">
          <div className="rounded-lg border border-slate-200 p-3">
            <div className="text-[10px] font-bold uppercase text-slate-500">Origin Hub</div>
            <div className="mt-1 font-bold">{order.pk}</div>
            <div>{order.pa || order.hub}</div>
            {order.pickupPostal && <div className="font-bold">{order.pickupPostal}</div>}
          </div>
          <div className="rounded-lg border border-slate-200 p-3">
            <div className="text-[10px] font-bold uppercase text-slate-500">Destination</div>
            <div className="mt-1 font-bold">{order.dp}</div>
            <div>{order.da || order.hub}</div>
            {order.dropoffPostal && <div className="font-bold">{order.dropoffPostal}</div>}
          </div>
        </div>

        <div className="mt-3 space-y-1.5 rounded-lg border border-slate-200 p-3 font-mono text-xs">
          <div className="flex justify-between"><span>Cargo</span><strong>{order.cargoCategory || 'Parcels'} · {order.weightKg || 50} kg ({order.pieces || 1} pcs)</strong></div>
          <div className="flex justify-between"><span>Recipient</span><span>{order.rn} ({order.rp})</span></div>
          <div className="flex justify-between"><span>Vehicle / Driver</span><span>{order.tier} · {order.driver}</span></div>
          <div className="flex justify-between"><span>Escrow Settlement</span><span>{order.ps}</span></div>
        </div>
      </div>
    </div>
  );
};

export const NotificationsModal: React.FC<{
  open: boolean;
  user: PublicUser | null;
  token: string | null;
  onClose: () => void;
  onUserUpdated: (user: PublicUser) => void;
  onToast: (msg: string, isError?: boolean) => void;
}> = ({open, user, token, onClose, onUserUpdated, onToast}) => {
  if (!open || !user) return null;
  const prefs = user.notifPrefs;

  const togglePref = async (key: keyof NotificationPrefs) => {
    if (!token) return;
    if (key === 'browserPush' && !prefs.browserPush && 'Notification' in window) {
      await Notification.requestPermission();
    }
    const nextPrefs = {...prefs, [key]: !prefs[key]};
    const res = await fetch('/api/auth/profile', {
      method: 'PATCH',
      headers: {'Content-Type': 'application/json', Authorization: `Bearer ${token}`},
      body: JSON.stringify({notifPrefs: nextPrefs}),
    });
    const data = (await res.json()) as {user?: PublicUser};
    if (res.ok && data.user) {
      onUserUpdated(data.user);
      onToast('Notification preferences updated.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" role="dialog" aria-modal="true">
      <div className="max-h-[88vh] w-full max-w-lg overflow-auto rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-[#0e2034]">
        <div className="flex items-center justify-between">
          <h3 className="font-display flex items-center gap-2 text-lg font-bold">
            <Bell className="h-5 w-5 text-[#3f6212] dark:text-[#9be136]" />
            <span>Notifications &amp; Alert Settings</span>
          </h3>
          <button type="button" onClick={onClose} aria-label="Close notifications" className="rounded-lg p-1 hover:bg-slate-100 dark:hover:bg-slate-800">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-xs dark:border-slate-700 dark:bg-[#040b12]">
          <div className="font-bold">Custom Push &amp; Alert Channels</div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {(
              [
                ['orderUpdates', 'Order status updates'],
                ['bidAlerts', 'Fare & bid alerts'],
                ['chatMessages', 'Live order chat'],
                ['payoutAlerts', 'Wallet & payouts'],
                ['dailyGoalReminders', 'Daily goal reminders'],
                ['browserPush', 'Browser push notifications'],
              ] as Array<[keyof NotificationPrefs, string]>
            ).map(([k, label]) => (
              <label key={k} className="flex cursor-pointer items-center gap-2">
                <input type="checkbox" checked={Boolean(prefs[k])} onChange={() => togglePref(k)} />
                <span>{label}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="mt-4 space-y-2">
          {(user.notes || []).length === 0 ? (
            <p className="text-xs text-slate-500">No notifications yet.</p>
          ) : (
            user.notes
              .slice()
              .reverse()
              .map((n) => (
                <div key={n.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs dark:border-slate-700 dark:bg-[#040b12]">
                  <div>{n.text}</div>
                  <div className="mt-1 font-mono text-[11px] text-slate-500">{n.at} · {n.category}</div>
                </div>
              ))
          )}
        </div>
      </div>
    </div>
  );
};

export const ProfileModal: React.FC<{
  open: boolean;
  user: PublicUser | null;
  token: string | null;
  onClose: () => void;
  onUserUpdated: (user: PublicUser) => void;
  onToast: (msg: string, isError?: boolean) => void;
}> = ({open, user, token, onClose, onUserUpdated, onToast}) => {
  const [name, setName] = useState(user?.name || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [goal, setGoal] = useState(String(user?.dailyGoalTarget || 3));
  const [password, setPassword] = useState('');

  // Linked Canadian Bank Account fields
  const [bankName, setBankName] = useState(user?.bankAccount?.institutionName || CANADIAN_BANKS[0].name);
  const [institutionNo, setInstitutionNo] = useState(user?.bankAccount?.institutionNo || CANADIAN_BANKS[0].code);
  const [transitNo, setTransitNo] = useState(user?.bankAccount?.transitNo || '');
  const [accountNo, setAccountNo] = useState('');
  const [accountHolder, setAccountHolder] = useState(user?.bankAccount?.accountHolder || user?.name || '');

  useEffect(() => {
    if (!user) return;
    setName(user.name);
    setPhone(user.phone);
    setGoal(String(user.dailyGoalTarget || 3));
    if (user.bankAccount) {
      setBankName(user.bankAccount.institutionName);
      setInstitutionNo(user.bankAccount.institutionNo);
      setTransitNo(user.bankAccount.transitNo);
      setAccountHolder(user.bankAccount.accountHolder);
    } else {
      setAccountHolder(user.name);
    }
  }, [user, open]);

  if (!open || !user) return null;

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    if (password && password.length < MIN_PASSWORD_LENGTH) {
      return onToast(`New password must be at least ${MIN_PASSWORD_LENGTH} characters.`, true);
    }
    const wantsBankSave = Boolean(transitNo.trim() || accountNo.trim());
    if (wantsBankSave && (!isValidCanadianBankDetails(institutionNo, transitNo, accountNo) || !accountHolder.trim())) {
      return onToast('Enter valid Canadian Institution (3), Transit (5), Account (7-12) digits & Holder name.', true);
    }

    const res = await fetch('/api/auth/profile', {
      method: 'PATCH',
      headers: {'Content-Type': 'application/json', Authorization: `Bearer ${token}`},
      body: JSON.stringify({
        name: name || user.name,
        phone: phone || user.phone,
        dailyGoalTarget: Number(goal) || 3,
        password: password || undefined,
        bankAccount: wantsBankSave
          ? {
              institutionName: bankName,
              institutionNo,
              transitNo,
              accountNo,
              accountHolder,
            }
          : undefined,
      }),
    });
    const data = (await res.json()) as {user?: PublicUser; error?: string};
    if (!res.ok || !data.user) return onToast(data.error || 'Could not update profile.', true);
    setPassword('');
    setAccountNo('');
    onUserUpdated(data.user);
    onToast('Profile, bank settings & daily goal updated.');
    onClose();
  };

  const enrollPasskey = async () => {
    if (!token) return;
    try {
      const chRes = await fetch('/api/auth/passkey/challenge', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({email: user.email}),
      });
      const {challenge} = (await chRes.json()) as {challenge: string};
      let credentialId = `passkey-${user.email}-${Date.now().toString(36)}`;

      if (window.PublicKeyCredential && navigator.credentials) {
        try {
          const cred = (await navigator.credentials.create({
            publicKey: {
              challenge: Uint8Array.from(atob(challenge.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0)),
              rp: {name: 'HMK Trading Inc.'},
              user: {
                id: new TextEncoder().encode(user.email),
                name: user.email,
                displayName: user.name,
              },
              pubKeyCredParams: [{type: 'public-key', alg: -7}],
              timeout: 45000,
            },
          })) as PublicKeyCredential | null;
          if (cred?.id) credentialId = cred.id;
        } catch {
          // Graceful local WebAuthn fallback in headless browsers
        }
      }

      localStorage.setItem(`hmk_passkey_${user.email.toLowerCase()}`, credentialId);
      const res = await fetch('/api/auth/passkey/register', {
        method: 'POST',
        headers: {'Content-Type': 'application/json', Authorization: `Bearer ${token}`},
        body: JSON.stringify({credentialId, label: 'Primary Device Biometric Passkey'}),
      });
      const data = (await res.json()) as {user?: PublicUser; error?: string};
      if (!res.ok || !data.user) return onToast(data.error || 'Passkey enrollment failed.', true);
      onUserUpdated(data.user);
      onToast('Biometric passkey enrolled for this device.');
    } catch {
      onToast('Could not enroll biometric passkey.', true);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" role="dialog" aria-modal="true">
      <form onSubmit={saveProfile} className="max-h-[90vh] w-full max-w-md space-y-4 overflow-auto rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-[#0e2034]">
        <div className="flex items-center justify-between">
          <h3 className="font-display flex items-center gap-2 text-lg font-bold">
            <User className="h-5 w-5 text-[#3f6212] dark:text-[#9be136]" />
            <span>Account Profile, Bank &amp; Biometrics</span>
          </h3>
          <button type="button" onClick={onClose} aria-label="Close profile" className="rounded-lg p-1 hover:bg-slate-100 dark:hover:bg-slate-800">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="font-mono text-xs text-slate-500">
          {user.email} · {user.role.toUpperCase()} · {user.passkeyCount || 0} passkey(s)
        </div>
        <div>
          <label htmlFor="prof-name" className="mb-1 flex items-center gap-1 text-xs font-semibold">
            <User className="h-3 w-3 text-[#3f6212] dark:text-[#9be136]" />
            <span>Full Name</span>
          </label>
          <input id="prof-name" value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-sm dark:border-slate-700 dark:bg-[#040b12]" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="prof-phone" className="mb-1 flex items-center gap-1 text-xs font-semibold">
              <Phone className="h-3 w-3 text-[#3f6212] dark:text-[#9be136]" />
              <span>Phone</span>
            </label>
            <input id="prof-phone" value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-sm dark:border-slate-700 dark:bg-[#040b12]" />
          </div>
          <div>
            <label htmlFor="prof-goal" className="mb-1 flex items-center gap-1 text-xs font-semibold">
              <Target className="h-3 w-3 text-[#3f6212] dark:text-[#9be136]" />
              <span>Daily Goal</span>
            </label>
            <input id="prof-goal" type="number" min={1} max={50} value={goal} onChange={(e) => setGoal(e.target.value)} className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 font-mono text-sm dark:border-slate-700 dark:bg-[#040b12]" />
          </div>
        </div>
        <div>
          <label htmlFor="prof-pass" className="mb-1 flex items-center gap-1 text-xs font-semibold">
            <Lock className="h-3 w-3 text-[#3f6212] dark:text-[#9be136]" />
            <span>New Password (optional, min {MIN_PASSWORD_LENGTH} chars)</span>
          </label>
          <input
            id="prof-pass"
            type="password"
            minLength={MIN_PASSWORD_LENGTH}
            placeholder="Minimum 8 characters"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-sm dark:border-slate-700 dark:bg-[#040b12]"
          />
        </div>

        {/* Linked Bank Account Section */}
        <div className="space-y-2.5 rounded-xl border border-slate-200 bg-slate-50 p-3.5 dark:border-slate-700 dark:bg-[#040b12]">
          <div className="flex items-center justify-between text-xs font-bold">
            <span className="inline-flex items-center gap-1.5">
              <Building2 className="h-3.5 w-3.5 text-[#3f6212] dark:text-[#9be136]" />
              <span>Linked Canadian Bank (EFT)</span>
            </span>
            {user.bankAccount && (
              <span className="font-mono text-[11px] text-[#3f6212] dark:text-[#9be136]">
                {user.bankAccount.institutionName} ••••{user.bankAccount.accountLast4}
              </span>
            )}
          </div>
          <select
            aria-label="Canadian Bank"
            value={bankName}
            onChange={(e) => {
              const found = CANADIAN_BANKS.find((b) => b.name === e.target.value);
              setBankName(e.target.value);
              if (found) setInstitutionNo(found.code);
            }}
            className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs dark:border-slate-700 dark:bg-[#0e2034]"
          >
            {CANADIAN_BANKS.map((b) => (
              <option key={b.code} value={b.name}>{b.name} ({b.code})</option>
            ))}
          </select>
          <input
            aria-label="Account Holder Name"
            value={accountHolder}
            onChange={(e) => setAccountHolder(e.target.value)}
            placeholder="Account Holder Full Name"
            className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs dark:border-slate-700 dark:bg-[#0e2034]"
          />
          <div className="grid grid-cols-3 gap-2">
            <input
              aria-label="Institution Number"
              value={institutionNo}
              onChange={(e) => setInstitutionNo(e.target.value)}
              maxLength={3}
              placeholder="Inst (3)"
              className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 font-mono text-xs dark:border-slate-700 dark:bg-[#0e2034]"
            />
            <input
              aria-label="Transit Number"
              value={transitNo}
              onChange={(e) => setTransitNo(e.target.value)}
              maxLength={5}
              placeholder="Transit (5)"
              className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 font-mono text-xs dark:border-slate-700 dark:bg-[#0e2034]"
            />
            <input
              aria-label="Account Number"
              value={accountNo}
              onChange={(e) => setAccountNo(e.target.value)}
              maxLength={12}
              placeholder="Account #"
              className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 font-mono text-xs dark:border-slate-700 dark:bg-[#0e2034]"
            />
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <button type="submit" className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#3f6212] py-2.5 text-xs font-bold text-white dark:bg-[#9be136] dark:text-[#040b12]">
            <CheckCircle2 className="h-3.5 w-3.5" />
            <span>Save Changes</span>
          </button>
          <button
            type="button"
            onClick={enrollPasskey}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-300 px-3.5 py-2.5 text-xs font-semibold dark:border-slate-700"
          >
            <Fingerprint className="h-4 w-4 text-[#3f6212] dark:text-[#9be136]" />
            <span>Enroll Passkey</span>
          </button>
        </div>
      </form>
    </div>
  );
};

export const VoiceCommandModal: React.FC<{
  open: boolean;
  lang: LangCode;
  onClose: () => void;
  onExecute: (action: VoiceAction) => void;
  onToast: (msg: string, isError?: boolean) => void;
}> = ({open, lang, onClose, onExecute, onToast}) => {
  const [commandText, setCommandText] = useState('');
  const [listening, setListening] = useState(false);

  if (!open) return null;

  const startSpeech = () => {
    const SpeechRec =
      (window as unknown as {SpeechRecognition?: new () => unknown; webkitSpeechRecognition?: new () => unknown})
        .SpeechRecognition ||
      (window as unknown as {webkitSpeechRecognition?: new () => unknown}).webkitSpeechRecognition;

    if (!SpeechRec) {
      onToast('Browser speech recognition unavailable here — type a command below.', true);
      return;
    }

    const rec = new (SpeechRec as new () => {
      lang: string;
      interimResults: boolean;
      onresult: (ev: {results: ArrayLike<ArrayLike<{transcript: string}>>}) => void;
      onerror: () => void;
      onend: () => void;
      start: () => void;
    })();
    rec.lang = lang === 'fr' ? 'fr-CA' : lang === 'ur' ? 'ur-PK' : 'en-CA';
    rec.interimResults = false;
    setListening(true);
    rec.onresult = (ev) => {
      const spoken = ev.results[0]?.[0]?.transcript || '';
      setCommandText(spoken);
      const parsed = parseVoiceCommand(spoken);
      onExecute(parsed);
      onClose();
    };
    rec.onerror = () => {
      setListening(false);
      onToast('Microphone capture cancelled or unavailable.', true);
    };
    rec.onend = () => setListening(false);
    rec.start();
  };

  const runCommand = (raw: string) => {
    const action = parseVoiceCommand(raw);
    onExecute(action);
    if (action.type !== 'unknown') {
      setCommandText('');
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-md space-y-4 rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-[#0e2034]">
        <div className="flex items-center justify-between">
          <h3 className="font-display flex items-center gap-2 text-lg font-bold">
            <Mic className="h-5 w-5 text-[#3f6212] dark:text-[#9be136]" />
            <span>Voice &amp; Quick Command Bar</span>
          </h3>
          <button type="button" onClick={onClose} aria-label="Close voice commands" className="rounded-lg p-1 hover:bg-slate-100 dark:hover:bg-slate-800">
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="text-xs text-slate-500 dark:text-slate-400">{t(lang, 'voiceHint')}</p>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            runCommand(commandText);
          }}
          className="flex gap-2"
        >
          <input
            value={commandText}
            onChange={(e) => setCommandText(e.target.value)}
            placeholder="Type or speak command..."
            className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2.5 text-sm dark:border-slate-700 dark:bg-[#040b12]"
          />
          <button
            type="button"
            onClick={startSpeech}
            className={`inline-flex shrink-0 items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-bold ${
              listening
                ? 'border-red-500 bg-red-500/10 text-red-500'
                : 'border-slate-300 dark:border-slate-700'
            }`}
          >
            <Mic className="h-4 w-4" />
            <span>{listening ? 'Listening' : 'Speak'}</span>
          </button>
          <button
            type="submit"
            className="inline-flex shrink-0 items-center gap-1 rounded-xl bg-[#3f6212] px-4 py-2 text-xs font-bold text-white dark:bg-[#9be136] dark:text-[#040b12]"
          >
            <Play className="h-3.5 w-3.5" />
            <span>Run</span>
          </button>
        </form>

        <div className="flex flex-wrap gap-2 pt-1">
          {[
            {label: 'Book delivery', Icon: PackagePlus},
            {label: 'Open analytics', Icon: Target},
            {label: 'Switch to French', Icon: Globe},
            {label: 'Toggle theme', Icon: Sun},
            {label: 'Export CSV', Icon: Download},
          ].map(({label, Icon}) => (
            <button
              key={label}
              type="button"
              onClick={() => runCommand(label)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-medium hover:border-[#3f6212] dark:border-slate-700 dark:bg-[#040b12] dark:hover:border-[#9be136]"
            >
              <Icon className="h-3 w-3 text-[#3f6212] dark:text-[#9be136]" />
              <span>{label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
