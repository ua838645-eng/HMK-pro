import React, {useState} from 'react';
import {
  ArrowRight,
  Building2,
  Car,
  CheckCircle2,
  Container,
  FileText,
  HelpCircle,
  Lock,
  MapPin,
  Package,
  Search,
  ShieldCheck,
  Truck,
  User,
} from 'lucide-react';
import {TIERS, formatMoney, type PublicUser, type TierKey} from '../shared/logistics';
import {t, type LangCode} from '../utils/i18n';
import type {TabKey} from './TopBar';

interface OverviewViewProps {
  lang: LangCode;
  user: PublicUser | null;
  onTrackId: (orderId: string) => void;
  onNavigate: (tab: TabKey) => void;
}

const TIER_ICONS: Record<TierKey, React.ComponentType<{className?: string}>> = {
  suv: Car,
  van: Truck,
  cube: Package,
  truck: Container,
};

export const OverviewView: React.FC<OverviewViewProps> = ({lang, user, onTrackId, onNavigate}) => {
  const [quickId, setQuickId] = useState('');
  const [imgFailed, setImgFailed] = useState(false);

  const handleTrackSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickId.trim()) return;
    onTrackId(quickId.trim());
  };

  const primaryCtaTarget: TabKey =
    user?.role === 'driver' ? 'driver' : user?.role === 'admin' ? 'admin' : 'book';
  const primaryCtaLabel =
    user?.role === 'driver'
      ? 'Open Driver Console'
      : user?.role === 'admin'
        ? 'Open Fleet HQ'
        : t(lang, 'launchBooking');

  return (
    <div className="space-y-10">
      <div className="grid grid-cols-1 items-stretch gap-6 lg:grid-cols-12">
        <div className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 lg:col-span-7 dark:border-slate-800 dark:bg-[#0e2034]">
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400">
              <MapPin className="h-3.5 w-3.5 text-[#3f6212] dark:text-[#9be136]" />
              <span>GTA</span>
              <span aria-hidden="true">·</span>
              <span>Ottawa</span>
              <span aria-hidden="true">·</span>
              <span>Vancouver</span>
              <span aria-hidden="true">·</span>
              <span>Calgary</span>
              <span aria-hidden="true">·</span>
              <span>Montreal</span>
            </div>

            <h1 className="font-display max-w-xl text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl dark:text-white">
              {t(lang, 'heroTitleA')}{' '}
              <span className="text-[#3f6212] dark:text-[#9be136]">{t(lang, 'heroTitleB')}</span>
            </h1>

            <p className="max-w-2xl text-sm leading-relaxed text-slate-600 sm:text-base dark:text-slate-300">
              {t(lang, 'heroSub')}
            </p>

            <form onSubmit={handleTrackSubmit} className="pt-1">
              <label htmlFor="quick-track-input" className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
                <Search className="h-3.5 w-3.5 text-[#3f6212] dark:text-[#9be136]" />
                <span>{t(lang, 'trackBtn')}</span>
              </label>
              <div className="flex gap-2">
                <input
                  id="quick-track-input"
                  value={quickId}
                  onChange={(e) => setQuickId(e.target.value)}
                  placeholder={t(lang, 'trackPlaceholder')}
                  className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2.5 font-mono text-sm text-slate-900 placeholder:text-slate-400 dark:border-slate-700 dark:bg-[#040b12] dark:text-white"
                />
                <button
                  type="submit"
                  className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl bg-[#3f6212] px-5 py-2.5 text-xs font-bold text-white transition hover:brightness-110 dark:bg-[#9be136] dark:text-[#040b12]"
                >
                  <Search className="h-3.5 w-3.5" />
                  <span>{t(lang, 'trackBtn')}</span>
                </button>
              </div>
            </form>
          </div>

          <div className="mt-8 grid grid-cols-1 gap-4 border-t border-slate-200 pt-5 sm:grid-cols-3 dark:border-slate-800">
            <div className="flex items-start gap-2.5">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#3f6212] dark:text-[#9be136]" />
              <div>
                <div className="text-xs font-bold text-slate-900 dark:text-white">4-Digit PIN Escrow</div>
                <div className="text-xs text-slate-500 dark:text-slate-400">Funds release on handoff</div>
              </div>
            </div>
            <div className="flex items-start gap-2.5">
              <Truck className="mt-0.5 h-4 w-4 shrink-0 text-[#3f6212] dark:text-[#9be136]" />
              <div>
                <div className="text-xs font-bold text-slate-900 dark:text-white">Company-Vetted Fleet</div>
                <div className="text-xs text-slate-500 dark:text-slate-400">HQ-issued driver IDs</div>
              </div>
            </div>
            <div className="flex items-start gap-2.5">
              <FileText className="mt-0.5 h-4 w-4 shrink-0 text-[#3f6212] dark:text-[#9be136]" />
              <div>
                <div className="text-xs font-bold text-slate-900 dark:text-white">CRA Tax Receipts</div>
                <div className="text-xs text-slate-500 dark:text-slate-400">GST / HST / QST ready</div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white lg:col-span-5 dark:border-slate-800 dark:bg-[#0e2034]">
          <div className="relative h-60 w-full flex-1 bg-slate-900 lg:h-full">
            {!imgFailed ? (
              <img
                src="/src/assets/images/hero_canadian_logistics_1795283938703.jpg"
                alt="HMK Trading electric cargo van at Toronto downtown logistics hub"
                referrerPolicy="no-referrer"
                onError={() => setImgFailed(true)}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full flex-col items-center justify-center bg-gradient-to-br from-[#081624] to-[#152b44] p-6 text-center text-white">
                <Truck className="mb-3 h-10 w-10 text-[#9be136]" />
                <p className="font-display text-lg font-bold">HMK Canadian Fleet Hub</p>
                <p className="mt-1 text-xs text-slate-300">Toronto · Ottawa · Vancouver · Calgary · Montreal</p>
              </div>
            )}
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/45 to-transparent p-5 text-white">
              <div className="text-xs font-medium text-slate-200">Canadian Metro Dispatch</div>
              <div className="mt-1 flex items-center justify-between gap-4">
                <span className="font-display text-base font-bold">Live Fare Bidding &amp; Escrow</span>
                <button
                  type="button"
                  onClick={() => onNavigate(primaryCtaTarget)}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-[#9be136] px-3.5 py-2 text-xs font-bold text-[#040b12] transition hover:brightness-105"
                >
                  <span>{primaryCtaLabel}</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Role Responsibilities Matrix */}
      <section aria-labelledby="role-matrix-heading" className="space-y-4">
        <div>
          <h2 id="role-matrix-heading" className="font-display flex items-center gap-2 text-xl font-bold text-slate-900 dark:text-white">
            <ShieldCheck className="h-5 w-5 text-[#3f6212] dark:text-[#9be136]" />
            <span>Dedicated Role Responsibilities</span>
          </h2>
          <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
            Strict role boundaries keep every booking, payout, and audit action secure.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-[#0e2034]">
            <div className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
              <User className="h-4 w-4 text-[#3f6212] dark:text-[#9be136]" />
              <span>Customer Portal</span>
            </div>
            <ul className="mt-3 space-y-1.5 text-xs text-slate-600 dark:text-slate-300">
              <li className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-[#3f6212] dark:text-[#9be136]" /><span>Book deliveries &amp; offer custom fares</span></li>
              <li className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-[#3f6212] dark:text-[#9be136]" /><span>Pay via Card, Bank EFT, Wallet, Interac, or COD</span></li>
              <li className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-[#3f6212] dark:text-[#9be136]" /><span>Accept driver counter-bids &amp; verify 4-digit PIN</span></li>
              <li className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-[#3f6212] dark:text-[#9be136]" /><span>Download CRA tax invoices &amp; shipping waybills</span></li>
            </ul>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-[#0e2034]">
            <div className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
              <Truck className="h-4 w-4 text-[#3f6212] dark:text-[#9be136]" />
              <span>Company Driver Partner</span>
            </div>
            <ul className="mt-3 space-y-1.5 text-xs text-slate-600 dark:text-slate-300">
              <li className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-[#3f6212] dark:text-[#9be136]" /><span>Sign in with HQ-issued @hmktrading.ca email</span></li>
              <li className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-[#3f6212] dark:text-[#9be136]" /><span>Submit live counter-bids &amp; accept dispatch jobs</span></li>
              <li className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-[#3f6212] dark:text-[#9be136]" /><span>Send live GPS telemetry, POD photo &amp; signature</span></li>
              <li className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-[#3f6212] dark:text-[#9be136]" /><span>Withdraw earnings to Interac or Bank Direct Deposit</span></li>
            </ul>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-[#0e2034]">
            <div className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
              <Building2 className="h-4 w-4 text-[#3f6212] dark:text-[#9be136]" />
              <span>Fleet HQ Administration</span>
            </div>
            <ul className="mt-3 space-y-1.5 text-xs text-slate-600 dark:text-slate-300">
              <li className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-[#3f6212] dark:text-[#9be136]" /><span>Provision driver @hmktrading.ca credentials</span></li>
              <li className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-[#3f6212] dark:text-[#9be136]" /><span>Assign metro hubs, fleet tiers &amp; resolve disputes</span></li>
              <li className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-[#3f6212] dark:text-[#9be136]" /><span>Audit immutable SHA-256 operational trail</span></li>
              <li className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-[#3f6212] dark:text-[#9be136]" /><span>Export CRA tax reports &amp; restore JSON backups</span></li>
            </ul>
          </div>
        </div>
      </section>

      <section aria-labelledby="fleet-tiers-heading" className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 id="fleet-tiers-heading" className="font-display flex items-center gap-2 text-xl font-bold text-slate-900 dark:text-white">
              <Truck className="h-5 w-5 text-[#3f6212] dark:text-[#9be136]" />
              <span>{t(lang, 'tiersHeading')}</span>
            </h2>
            <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
              Transparent starting fares in CAD before provincial GST/HST/QST.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('auth')}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#3f6212] underline-offset-4 hover:underline dark:text-[#9be136]"
          >
            <ShieldCheck className="h-3.5 w-3.5" />
            <span>Sign in to Customer, Driver, or Fleet HQ Portal →</span>
          </button>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Object.values(TIERS).map((tier) => {
            const TierIcon = TIER_ICONS[tier.key];
            return (
              <button
                key={tier.key}
                type="button"
                onClick={() => onNavigate(primaryCtaTarget)}
                className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-5 text-left transition hover:border-[#3f6212] dark:border-slate-800 dark:bg-[#0e2034] dark:hover:border-[#9be136]"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <TierIcon className="h-4 w-4 text-[#3f6212] dark:text-[#9be136]" />
                    <span className="text-sm font-bold text-slate-900 dark:text-white">{tier.label}</span>
                  </div>
                  <div className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">{tier.capacity}</div>
                </div>
                <div className="mt-4 font-mono text-lg font-bold tabular-nums text-[#3f6212] dark:text-[#9be136]">
                  {formatMoney(tier.baseRate)} CAD
                </div>
              </button>
            );
          })}
        </div>
      </section>

      <section aria-labelledby="faq-heading" className="space-y-3">
        <h2 id="faq-heading" className="font-display flex items-center gap-2 text-xl font-bold text-slate-900 dark:text-white">
          <HelpCircle className="h-5 w-5 text-[#3f6212] dark:text-[#9be136]" />
          <span>{t(lang, 'faqHeading')}</span>
        </h2>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {[
            {
              q: 'How do company driver accounts work?',
              a: 'Drivers cannot self-register. Only HMK Fleet HQ administrators can issue @hmktrading.ca corporate driver emails and credentials.',
              Icon: Truck,
            },
            {
              q: 'What is the 4-digit PIN escrow?',
              a: 'You receive a 4-digit PIN when booking. Share it with the driver only upon cargo handoff; entering the PIN settles escrow.',
              Icon: ShieldCheck,
            },
            {
              q: 'How is Canadian sales tax calculated?',
              a: 'Tax is computed automatically from the selected metro hub: 13% HST (ON), 12% GST+PST (BC), 5% GST (AB), 14.975% GST+QST (QC).',
              Icon: FileText,
            },
            {
              q: 'Does offline mode keep my shipments safe?',
              a: 'Yes. Orders and queued updates are encrypted locally using AES-GCM with PBKDF2 key derivation and synced automatically when online.',
              Icon: Lock,
            },
          ].map(({q, a, Icon}) => (
            <details
              key={q}
              className="rounded-xl border border-slate-200 bg-white px-5 py-3.5 dark:border-slate-800 dark:bg-[#0e2034]"
            >
              <summary className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
                <Icon className="h-4 w-4 shrink-0 text-[#3f6212] dark:text-[#9be136]" />
                <span>{q}</span>
              </summary>
              <p className="mt-2 text-xs leading-relaxed text-slate-600 dark:text-slate-300">{a}</p>
            </details>
          ))}
        </div>
      </section>
    </div>
  );
};
