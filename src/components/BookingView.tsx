import React, {useEffect, useMemo, useState} from 'react';
import {
  Armchair,
  ArrowRight,
  Banknote,
  Boxes,
  Building2,
  CalendarClock,
  Car,
  CheckCircle2,
  Container,
  Cpu,
  CreditCard,
  Landmark,
  MapPin,
  MessageSquareText,
  Package,
  Phone,
  Refrigerator,
  Scale,
  Send,
  ShieldAlert,
  ShieldCheck,
  Tag,
  Truck,
  User,
  Users,
  Wallet,
} from 'lucide-react';
import {
  CANADIAN_BANKS,
  CARGO_CATEGORIES,
  HUBS,
  TIERS,
  calculateDistanceKm,
  calculateFareQuote,
  detectCardBrand,
  formatMoney,
  isValidCanadianBankDetails,
  isValidCanadianPostalCode,
  isValidCardExpiry,
  recommendTierByWeight,
  validateLuhnCard,
  type CargoCategory,
  type HubKey,
  type OrderRecord,
  type PaymentMethod,
  type PublicUser,
  type TierKey,
} from '../shared/logistics';

interface BookingViewProps {
  user: PublicUser | null;
  token: string | null;
  isOnline: boolean;
  initialDraft?: Partial<OrderRecord> | null;
  onOrderCreated: (order: OrderRecord, updatedUser?: PublicUser) => void;
  onQueueOfflineOrder: (payload: Record<string, unknown>) => void;
  onNeedAuth: () => void;
  onNeedWallet: () => void;
  onNavigateRoleHome?: () => void;
  onToast: (msg: string, isError?: boolean) => void;
}

interface DriverBid {
  name: string;
  tierLabel: string;
  price: number;
  eta: string;
}

const CARGO_ICONS: Record<CargoCategory, React.ComponentType<{className?: string}>> = {
  'Parcels & Express': Package,
  Appliances: Refrigerator,
  'Furniture & Moving': Armchair,
  'Commercial Pallets': Boxes,
  'Fragile Electronics': Cpu,
};

const TIER_ICONS: Record<TierKey, React.ComponentType<{className?: string}>> = {
  suv: Car,
  van: Truck,
  cube: Package,
  truck: Container,
};

const PAYMENT_OPTIONS: Array<{
  method: PaymentMethod;
  label: string;
  desc: string;
  Icon: React.ComponentType<{className?: string}>;
}> = [
  {method: 'Wallet', label: 'HMK Wallet', desc: 'Instant escrow hold', Icon: Wallet},
  {method: 'Card', label: 'Credit / Debit', desc: 'Visa, MC, Amex', Icon: CreditCard},
  {method: 'Bank Transfer (EFT)', label: 'Bank EFT', desc: 'Canadian direct debit', Icon: Building2},
  {method: 'Interac e-Transfer', label: 'Interac e-Transfer', desc: 'Instant reference', Icon: Landmark},
  {method: 'Cash on Delivery', label: 'Cash on Delivery', desc: 'Pay at handoff', Icon: Banknote},
];

export const BookingView: React.FC<BookingViewProps> = ({
  user,
  token,
  isOnline,
  initialDraft,
  onOrderCreated,
  onQueueOfflineOrder,
  onNeedAuth,
  onNeedWallet,
  onNavigateRoleHome,
  onToast,
}) => {
  const [hubKey, setHubKey] = useState<HubKey>('gta');
  const [pk, setPk] = useState(HUBS.gta.pickupPoints[0]);
  const [dp, setDp] = useState(HUBS.gta.dropoffPoints[0]);
  const [pa, setPa] = useState('');
  const [da, setDa] = useState('');
  const [pickupPostal, setPickupPostal] = useState('');
  const [dropoffPostal, setDropoffPostal] = useState('');
  const [cargoCategory, setCargoCategory] = useState<CargoCategory>('Parcels & Express');
  const [weightKg, setWeightKg] = useState(80);
  const [pieces, setPieces] = useState(2);
  const [tierKey, setTierKey] = useState<TierKey>('van');
  const [extraHelper, setExtraHelper] = useState(false);
  const [extraCover, setExtraCover] = useState(false);
  const [whenType, setWhenType] = useState<'now' | 'later'>('now');
  const [whenTime, setWhenTime] = useState('');
  const [rn, setRn] = useState('');
  const [rp, setRp] = useState('');
  const [nt, setNt] = useState('');
  const [pm, setPm] = useState<PaymentMethod>('Wallet');

  // Full Card fields
  const [cardHolder, setCardHolder] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvv, setCardCvv] = useState('');
  const [cardPostal, setCardPostal] = useState('');

  // Full Bank EFT fields
  const [bankName, setBankName] = useState<string>(CANADIAN_BANKS[0].name);
  const [institutionNo, setInstitutionNo] = useState<string>(CANADIAN_BANKS[0].code);
  const [transitNo, setTransitNo] = useState('');
  const [accountNo, setAccountNo] = useState('');
  const [accountHolder, setAccountHolder] = useState('');
  const [useLinkedBank, setUseLinkedBank] = useState(false);

  const [promoInput, setPromoInput] = useState('');
  const [appliedPromo, setAppliedPromo] = useState('');
  const [offerAmount, setOfferAmount] = useState(TIERS.van.baseRate);
  const [bids, setBids] = useState<DriverBid[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!initialDraft) return;
    const nextHub = initialDraft.hubKey && HUBS[initialDraft.hubKey] ? initialDraft.hubKey : 'gta';
    setHubKey(nextHub);
    setPk(initialDraft.pk || HUBS[nextHub].pickupPoints[0]);
    setDp(initialDraft.dp || HUBS[nextHub].dropoffPoints[0]);
    setPa(initialDraft.pa || '');
    setDa(initialDraft.da || '');
    setPickupPostal(initialDraft.pickupPostal || '');
    setDropoffPostal(initialDraft.dropoffPostal || '');
    if (initialDraft.cargoCategory) setCargoCategory(initialDraft.cargoCategory);
    if (initialDraft.weightKg) setWeightKg(initialDraft.weightKg);
    if (initialDraft.pieces) setPieces(initialDraft.pieces);
    const nextTier = initialDraft.tierKey && TIERS[initialDraft.tierKey] ? initialDraft.tierKey : 'van';
    setTierKey(nextTier);
    setOfferAmount(initialDraft.sub || TIERS[nextTier].baseRate);
    setRn(initialDraft.rn || '');
    setRp(initialDraft.rp || '');
    setNt(initialDraft.nt || '');
    if (initialDraft.pm) setPm(initialDraft.pm);
  }, [initialDraft]);

  const hub = HUBS[hubKey];
  const km = useMemo(() => calculateDistanceKm(hubKey, pk, dp), [hubKey, pk, dp]);
  const quote = useMemo(
    () => calculateFareQuote(hubKey, offerAmount, appliedPromo),
    [hubKey, offerAmount, appliedPromo],
  );
  const suggestedTier = useMemo(() => recommendTierByWeight(weightKg), [weightKg]);
  const cardBrand = useMemo(() => detectCardBrand(cardNumber), [cardNumber]);

  const handleHubChange = (nextKey: HubKey) => {
    setHubKey(nextKey);
    setPk(HUBS[nextKey].pickupPoints[0]);
    setDp(HUBS[nextKey].dropoffPoints[0]);
  };

  const recalcOffer = (nextTier: TierKey, helper: boolean, cover: boolean) => {
    setOfferAmount(TIERS[nextTier].baseRate + (helper ? 40 : 0) + (cover ? 20 : 0));
  };

  const handleApplyPromo = () => {
    const clean = promoInput.trim().toUpperCase();
    const testQuote = calculateFareQuote(hubKey, offerAmount, clean);
    if (testQuote.promoCode) {
      setAppliedPromo(testQuote.promoCode);
      onToast(`Promo ${testQuote.promoCode} applied.`);
    } else {
      setAppliedPromo('');
      onToast('Invalid promo code. Try HMK20 or CANADA15.', true);
    }
  };

  const validateForm = (): boolean => {
    if (!user) {
      onNeedAuth();
      onToast('Sign in to the Customer Portal to book a delivery.', true);
      return false;
    }
    if (user.role !== 'customer') {
      onToast('Only Customer accounts can book deliveries.', true);
      return false;
    }
    if (pk === dp && pa.trim().toLowerCase() === da.trim().toLowerCase()) {
      onToast('Pickup and drop-off locations cannot be the same.', true);
      return false;
    }
    if ((pickupPostal && !isValidCanadianPostalCode(pickupPostal)) || (dropoffPostal && !isValidCanadianPostalCode(dropoffPostal))) {
      onToast('Postal codes must follow Canadian format (e.g. M5V 3L9).', true);
      return false;
    }
    if (!rn.trim()) {
      onToast('Enter the recipient name.', true);
      return false;
    }
    if (rp.replace(/\D/g, '').length < 10) {
      onToast('Enter a valid 10-digit recipient phone number.', true);
      return false;
    }
    if (whenType === 'later' && (!whenTime || new Date(whenTime) < new Date())) {
      onToast('Choose a future pickup date and time.', true);
      return false;
    }
    if (pm === 'Card') {
      if (!cardHolder.trim()) {
        onToast('Enter cardholder full name.', true);
        return false;
      }
      if (!validateLuhnCard(cardNumber)) {
        onToast('Enter a valid payment card number.', true);
        return false;
      }
      if (!isValidCardExpiry(cardExpiry)) {
        onToast('Enter a valid future card expiry (MM/YY).', true);
        return false;
      }
      if (!/^\d{3,4}$/.test(cardCvv.trim())) {
        onToast('Enter a valid 3- or 4-digit CVV security code.', true);
        return false;
      }
      if (cardPostal && !isValidCanadianPostalCode(cardPostal)) {
        onToast('Billing postal code must follow Canadian format (e.g. M5V 3L9).', true);
        return false;
      }
    }
    if (pm === 'Bank Transfer (EFT)') {
      if (useLinkedBank && user.bankAccount) {
        return true;
      }
      if (!isValidCanadianBankDetails(institutionNo, transitNo, accountNo) || !accountHolder.trim()) {
        onToast('Enter valid Canadian Bank Institution (3), Transit (5), Account (7-12) digits, and Holder name.', true);
        return false;
      }
    }
    return true;
  };

  const handleGetBids = () => {
    if (!validateForm()) return;
    setBids([
      {name: 'Sophie Lavoie (HMK Fleet)', tierLabel: 'Economy Window', price: Math.max(30, offerAmount - 5), eta: '14 mins'},
      {name: 'Marc Tremblay (HMK Fleet)', tierLabel: 'Standard Dispatch', price: offerAmount, eta: '9 mins'},
      {name: 'Devon Miller (HMK Fleet)', tierLabel: 'Priority Express', price: offerAmount + 10, eta: '5 mins'},
    ]);
  };

  const handleAcceptBid = async (bid: DriverBid) => {
    if (!validateForm()) return;
    const finalQuote = calculateFareQuote(hubKey, bid.price, appliedPromo);

    if (pm === 'Wallet' && user && user.wallet < finalQuote.total) {
      onToast(`Wallet balance (${formatMoney(user.wallet)}) is lower than ${formatMoney(finalQuote.total)}. Top up first.`, true);
      onNeedWallet();
      return;
    }

    const payload = {
      hubKey,
      tierKey,
      pk,
      dp,
      pa,
      da,
      pickupPostal,
      dropoffPostal,
      cargoCategory,
      weightKg,
      pieces,
      offerAmount: bid.price,
      promoCode: appliedPromo,
      pm,
      cardNumber: pm === 'Card' ? cardNumber : undefined,
      cardExpiry: pm === 'Card' ? cardExpiry : undefined,
      institutionNo: pm === 'Bank Transfer (EFT)' && !useLinkedBank ? institutionNo : undefined,
      transitNo: pm === 'Bank Transfer (EFT)' && !useLinkedBank ? transitNo : undefined,
      accountNo: pm === 'Bank Transfer (EFT)' && !useLinkedBank ? accountNo : undefined,
      driverName: bid.name,
      rn,
      rp,
      nt,
      when: whenType === 'later' ? whenTime : '',
    };

    if (!isOnline || !token) {
      onQueueOfflineOrder(payload);
      onToast('Offline mode: booking encrypted and queued for sync.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      const data = (await res.json()) as {order?: OrderRecord; user?: PublicUser; error?: string};
      if (!res.ok || !data.order) {
        onToast(data.error || 'Could not place booking.', true);
        return;
      }
      setBids([]);
      setPa('');
      setDa('');
      setPickupPostal('');
      setDropoffPostal('');
      setRn('');
      setRp('');
      setNt('');
      onToast(`Booked ${data.order.id} — Escrow PIN: ${data.order.pin}`);
      onOrderCreated(data.order, data.user);
    } catch {
      onQueueOfflineOrder(payload);
      onToast('Connection interrupted — booking encrypted locally and queued for sync.');
    } finally {
      setSubmitting(false);
    }
  };

  // Strict Role Separation Banner if signed in as Driver or HQ Admin
  if (user && user.role !== 'customer') {
    return (
      <div className="mx-auto max-w-xl rounded-2xl border border-slate-200 bg-white p-8 text-center dark:border-slate-800 dark:bg-[#0e2034]">
        <ShieldAlert className="mx-auto h-10 w-10 text-amber-500" />
        <h2 className="font-display mt-3 text-xl font-bold text-slate-900 dark:text-white">
          Customer Booking Portal Only
        </h2>
        <p className="mt-2 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
          Only Customer accounts can book new deliveries. You are signed in as{' '}
          <strong className="font-mono">{user.email}</strong> ({user.role.toUpperCase()}).
        </p>
        {onNavigateRoleHome && (
          <button
            type="button"
            onClick={onNavigateRoleHome}
            className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[#3f6212] px-5 py-2.5 text-xs font-bold text-white dark:bg-[#9be136] dark:text-[#040b12]"
          >
            <ArrowRight className="h-4 w-4" />
            <span>Go to {user.role === 'driver' ? 'Driver Console' : 'Fleet HQ'}</span>
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
      <div className="space-y-5 rounded-2xl border border-slate-200 bg-white p-6 lg:col-span-7 dark:border-slate-800 dark:bg-[#0e2034]">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-1.5 text-xs font-semibold text-[#3f6212] dark:text-[#9be136]">
              <Truck className="h-3.5 w-3.5" />
              <span>Customer Fare Bidding &amp; Dispatch Engine</span>
            </div>
            <h2 className="font-display mt-0.5 text-xl font-bold text-slate-900 dark:text-white">
              Book or offer your fare
            </h2>
          </div>
          {!user && (
            <button
              type="button"
              onClick={onNeedAuth}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold dark:border-slate-700"
            >
              <User className="h-3.5 w-3.5 text-[#3f6212] dark:text-[#9be136]" />
              <span>Sign In as Customer</span>
            </button>
          )}
        </div>

        <div>
          <label htmlFor="book-hub" className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
            <MapPin className="h-3.5 w-3.5 text-[#3f6212] dark:text-[#9be136]" />
            <span>Metro Hub &amp; Provincial Tax</span>
          </label>
          <select
            id="book-hub"
            value={hubKey}
            onChange={(e) => handleHubChange(e.target.value as HubKey)}
            className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-[#040b12]"
          >
            {Object.values(HUBS).map((h) => (
              <option key={h.key} value={h.key}>
                {h.label} — {h.taxLabel}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="book-pk" className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold">
              <MapPin className="h-3.5 w-3.5 text-[#3f6212] dark:text-[#9be136]" />
              <span>Pickup Hub</span>
            </label>
            <select
              id="book-pk"
              value={pk}
              onChange={(e) => setPk(e.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-[#040b12]"
            >
              {hub.pickupPoints.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="book-dp" className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold">
              <MapPin className="h-3.5 w-3.5 text-sky-500" />
              <span>Drop-off Hub</span>
            </label>
            <select
              id="book-dp"
              value={dp}
              onChange={(e) => setDp(e.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-[#040b12]"
            >
              {hub.dropoffPoints.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="book-pa" className="mb-1.5 block text-xs font-semibold">Pickup Street Address</label>
            <input
              id="book-pa"
              value={pa}
              onChange={(e) => setPa(e.target.value)}
              placeholder="e.g. 120 King St W"
              className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-[#040b12]"
            />
          </div>
          <div>
            <label htmlFor="book-da" className="mb-1.5 block text-xs font-semibold">Drop-off Street Address</label>
            <input
              id="book-da"
              value={da}
              onChange={(e) => setDa(e.target.value)}
              placeholder="e.g. 45 Main St"
              className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-[#040b12]"
            />
          </div>
          <div>
            <label htmlFor="book-pzip" className="mb-1.5 block text-xs font-semibold">Pickup Postal Code (Canada)</label>
            <input
              id="book-pzip"
              value={pickupPostal}
              onChange={(e) => setPickupPostal(e.target.value.toUpperCase())}
              placeholder="M5X 1A9"
              className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 font-mono text-sm uppercase dark:border-slate-700 dark:bg-[#040b12]"
            />
          </div>
          <div>
            <label htmlFor="book-dzip" className="mb-1.5 block text-xs font-semibold">Drop-off Postal Code (Canada)</label>
            <input
              id="book-dzip"
              value={dropoffPostal}
              onChange={(e) => setDropoffPostal(e.target.value.toUpperCase())}
              placeholder="L5B 2C9"
              className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 font-mono text-sm uppercase dark:border-slate-700 dark:bg-[#040b12]"
            />
          </div>
        </div>

        {/* Cargo Category Option Cards with Icons */}
        <div>
          <div className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
            <Package className="h-3.5 w-3.5 text-[#3f6212] dark:text-[#9be136]" />
            <span>Cargo Type</span>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {CARGO_CATEGORIES.map((cat) => {
              const Icon = CARGO_ICONS[cat];
              const active = cargoCategory === cat;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCargoCategory(cat)}
                  className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-left text-xs font-semibold transition ${
                    active
                      ? 'border-[#3f6212] bg-[#3f6212]/10 text-[#3f6212] dark:border-[#9be136] dark:bg-[#9be136]/10 dark:text-[#9be136]'
                      : 'border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-[#040b12] dark:text-slate-300'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{cat}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Weight & Pieces with Smart Vehicle Recommendation */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="book-weight" className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold">
              <Scale className="h-3.5 w-3.5 text-[#3f6212] dark:text-[#9be136]" />
              <span>Total Weight (kg)</span>
            </label>
            <input
              id="book-weight"
              type="number"
              min={1}
              max={10000}
              value={weightKg}
              onChange={(e) => setWeightKg(Number(e.target.value) || 1)}
              className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 font-mono text-sm dark:border-slate-700 dark:bg-[#040b12]"
            />
          </div>
          <div>
            <label htmlFor="book-pieces" className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold">
              <Boxes className="h-3.5 w-3.5 text-[#3f6212] dark:text-[#9be136]" />
              <span>Pieces / Pallets</span>
            </label>
            <input
              id="book-pieces"
              type="number"
              min={1}
              max={500}
              value={pieces}
              onChange={(e) => setPieces(Number(e.target.value) || 1)}
              className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 font-mono text-sm dark:border-slate-700 dark:bg-[#040b12]"
            />
          </div>
        </div>

        <div>
          <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
            <span className="inline-flex items-center gap-1.5">
              <Truck className="h-3.5 w-3.5 text-[#3f6212] dark:text-[#9be136]" />
              <span>Fleet Tier</span>
            </span>
            {suggestedTier !== tierKey && (
              <button
                type="button"
                onClick={() => {
                  setTierKey(suggestedTier);
                  recalcOffer(suggestedTier, extraHelper, extraCover);
                }}
                className="font-mono text-[11px] font-bold text-[#3f6212] underline dark:text-[#9be136]"
              >
                Recommended for {weightKg}kg: {TIERS[suggestedTier].label}
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            {Object.values(TIERS).map((tier) => {
              const selected = tier.key === tierKey;
              const TierIcon = TIER_ICONS[tier.key];
              return (
                <button
                  key={tier.key}
                  type="button"
                  onClick={() => {
                    setTierKey(tier.key);
                    recalcOffer(tier.key, extraHelper, extraCover);
                  }}
                  className={`rounded-xl border p-3 text-left transition ${
                    selected
                      ? 'border-[#3f6212] bg-[#3f6212]/10 dark:border-[#9be136] dark:bg-[#9be136]/10'
                      : 'border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-[#040b12]'
                  }`}
                >
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-900 dark:text-white">
                    <TierIcon className="h-4 w-4 text-[#3f6212] dark:text-[#9be136]" />
                    <span>{tier.label}</span>
                  </div>
                  <div className="mt-1 font-mono text-xs font-bold tabular-nums text-[#3f6212] dark:text-[#9be136]">
                    {formatMoney(tier.baseRate)} CAD
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs font-semibold dark:border-slate-700 dark:bg-[#040b12]">
            <input
              type="checkbox"
              checked={extraHelper}
              onChange={(e) => {
                setExtraHelper(e.target.checked);
                recalcOffer(tierKey, e.target.checked, extraCover);
              }}
            />
            <Users className="h-3.5 w-3.5 text-[#3f6212] dark:text-[#9be136]" />
            <span>Extra helper (+$40)</span>
          </label>
          <label className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs font-semibold dark:border-slate-700 dark:bg-[#040b12]">
            <input
              type="checkbox"
              checked={extraCover}
              onChange={(e) => {
                setExtraCover(e.target.checked);
                recalcOffer(tierKey, extraHelper, e.target.checked);
              }}
            />
            <ShieldCheck className="h-3.5 w-3.5 text-[#3f6212] dark:text-[#9be136]" />
            <span>$50k cargo cover (+$20)</span>
          </label>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="book-when" className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold">
              <CalendarClock className="h-3.5 w-3.5 text-[#3f6212] dark:text-[#9be136]" />
              <span>Pickup Schedule</span>
            </label>
            <select
              id="book-when"
              value={whenType}
              onChange={(e) => setWhenType(e.target.value as 'now' | 'later')}
              className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-[#040b12]"
            >
              <option value="now">As soon as possible</option>
              <option value="later">Schedule for later</option>
            </select>
          </div>
          {whenType === 'later' && (
            <div>
              <label htmlFor="book-when-dt" className="mb-1.5 block text-xs font-semibold">Pickup Date &amp; Time</label>
              <input
                id="book-when-dt"
                type="datetime-local"
                value={whenTime}
                onChange={(e) => setWhenTime(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-[#040b12]"
              />
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="book-rn" className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold">
              <User className="h-3.5 w-3.5 text-[#3f6212] dark:text-[#9be136]" />
              <span>Recipient Name</span>
            </label>
            <input
              id="book-rn"
              value={rn}
              onChange={(e) => setRn(e.target.value)}
              placeholder="Recipient full name"
              className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-[#040b12]"
            />
          </div>
          <div>
            <label htmlFor="book-rp" className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold">
              <Phone className="h-3.5 w-3.5 text-[#3f6212] dark:text-[#9be136]" />
              <span>Recipient Phone</span>
            </label>
            <input
              id="book-rp"
              type="tel"
              value={rp}
              onChange={(e) => setRp(e.target.value)}
              placeholder="+1 (416) 555-0192"
              className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-[#040b12]"
            />
          </div>
        </div>

        <div>
          <label htmlFor="book-nt" className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold">
            <MessageSquareText className="h-3.5 w-3.5 text-[#3f6212] dark:text-[#9be136]" />
            <span>Delivery Notes</span>
          </label>
          <textarea
            id="book-nt"
            rows={2}
            value={nt}
            onChange={(e) => setNt(e.target.value)}
            placeholder="Gate code, loading bay, fragile items..."
            className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-sm dark:border-slate-700 dark:bg-[#040b12]"
          />
        </div>

        {/* Payment Gateway Option Grid with Icons */}
        <div className="space-y-3">
          <div className="flex items-center gap-1.5 text-xs font-semibold">
            <CreditCard className="h-3.5 w-3.5 text-[#3f6212] dark:text-[#9be136]" />
            <span>Payment Gateway</span>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {PAYMENT_OPTIONS.map(({method, label, desc, Icon}) => {
              const active = pm === method;
              return (
                <button
                  key={method}
                  type="button"
                  onClick={() => setPm(method)}
                  className={`flex items-start gap-2 rounded-xl border p-2.5 text-left transition ${
                    active
                      ? 'border-[#3f6212] bg-[#3f6212]/10 dark:border-[#9be136] dark:bg-[#9be136]/10'
                      : 'border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-[#040b12]'
                  }`}
                >
                  <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${active ? 'text-[#3f6212] dark:text-[#9be136]' : 'text-slate-500'}`} />
                  <div className="min-w-0">
                    <div className="truncate text-xs font-bold text-slate-900 dark:text-white">{label}</div>
                    <div className="truncate text-[11px] text-slate-500">{desc}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Full Card Details Form */}
        {pm === 'Card' && (
          <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-[#040b12]">
            <div className="flex items-center justify-between text-xs font-bold">
              <span className="inline-flex items-center gap-1.5">
                <CreditCard className="h-4 w-4 text-[#3f6212] dark:text-[#9be136]" />
                <span>Full Payment Card Details</span>
              </span>
              <span className="font-mono text-[#3f6212] dark:text-[#9be136]">{cardBrand}</span>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label htmlFor="card-holder" className="mb-1 block text-xs font-semibold">Cardholder Name</label>
                <input
                  id="card-holder"
                  value={cardHolder}
                  onChange={(e) => setCardHolder(e.target.value)}
                  placeholder="Name as printed on card"
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-[#0e2034]"
                />
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="card-num" className="mb-1 block text-xs font-semibold">Card Number (Luhn Validated)</label>
                <input
                  id="card-num"
                  value={cardNumber}
                  onChange={(e) => setCardNumber(e.target.value)}
                  placeholder="4242 4242 4242 4242"
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-xs dark:border-slate-700 dark:bg-[#0e2034]"
                />
              </div>
              <div>
                <label htmlFor="card-exp" className="mb-1 block text-xs font-semibold">Expiry (MM/YY)</label>
                <input
                  id="card-exp"
                  value={cardExpiry}
                  onChange={(e) => setCardExpiry(e.target.value)}
                  placeholder="12/28"
                  maxLength={5}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-xs dark:border-slate-700 dark:bg-[#0e2034]"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label htmlFor="card-cvv" className="mb-1 block text-xs font-semibold">CVV</label>
                  <input
                    id="card-cvv"
                    type="password"
                    inputMode="numeric"
                    maxLength={4}
                    value={cardCvv}
                    onChange={(e) => setCardCvv(e.target.value)}
                    placeholder="123"
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-xs dark:border-slate-700 dark:bg-[#0e2034]"
                  />
                </div>
                <div>
                  <label htmlFor="card-postal" className="mb-1 block text-xs font-semibold">Billing Postal</label>
                  <input
                    id="card-postal"
                    value={cardPostal}
                    onChange={(e) => setCardPostal(e.target.value.toUpperCase())}
                    placeholder="M5V 3L9"
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-xs uppercase dark:border-slate-700 dark:bg-[#0e2034]"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Full Canadian Bank EFT Form */}
        {pm === 'Bank Transfer (EFT)' && (
          <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-[#040b12]">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-bold">
              <span className="inline-flex items-center gap-1.5">
                <Building2 className="h-4 w-4 text-[#3f6212] dark:text-[#9be136]" />
                <span>Canadian Bank Account Details (EFT Debit)</span>
              </span>
              {user?.bankAccount && (
                <label className="inline-flex cursor-pointer items-center gap-1.5 text-[11px] font-semibold text-[#3f6212] dark:text-[#9be136]">
                  <input
                    type="checkbox"
                    checked={useLinkedBank}
                    onChange={(e) => setUseLinkedBank(e.target.checked)}
                  />
                  <span>Use linked {user.bankAccount.institutionName} ••••{user.bankAccount.accountLast4}</span>
                </label>
              )}
            </div>

            {(!useLinkedBank || !user?.bankAccount) && (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label htmlFor="eft-bank" className="mb-1 block text-xs font-semibold">Canadian Bank / Institution</label>
                  <select
                    id="eft-bank"
                    value={bankName}
                    onChange={(e) => {
                      const next = CANADIAN_BANKS.find((b) => b.name === e.target.value);
                      setBankName(e.target.value);
                      if (next) setInstitutionNo(next.code);
                    }}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-[#0e2034]"
                  >
                    {CANADIAN_BANKS.map((b) => (
                      <option key={b.code} value={b.name}>{b.name} ({b.code})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="eft-holder" className="mb-1 block text-xs font-semibold">Account Holder Name</label>
                  <input
                    id="eft-holder"
                    value={accountHolder}
                    onChange={(e) => setAccountHolder(e.target.value)}
                    placeholder="Account holder legal name"
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-[#0e2034]"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label htmlFor="eft-inst" className="mb-1 block text-xs font-semibold">Institution (3)</label>
                    <input
                      id="eft-inst"
                      maxLength={3}
                      inputMode="numeric"
                      value={institutionNo}
                      onChange={(e) => setInstitutionNo(e.target.value)}
                      placeholder="003"
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-xs dark:border-slate-700 dark:bg-[#0e2034]"
                    />
                  </div>
                  <div>
                    <label htmlFor="eft-transit" className="mb-1 block text-xs font-semibold">Transit (5)</label>
                    <input
                      id="eft-transit"
                      maxLength={5}
                      inputMode="numeric"
                      value={transitNo}
                      onChange={(e) => setTransitNo(e.target.value)}
                      placeholder="12345"
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-xs dark:border-slate-700 dark:bg-[#0e2034]"
                    />
                  </div>
                </div>
                <div>
                  <label htmlFor="eft-acct" className="mb-1 block text-xs font-semibold">Account Number (7–12 digits)</label>
                  <input
                    id="eft-acct"
                    maxLength={12}
                    inputMode="numeric"
                    value={accountNo}
                    onChange={(e) => setAccountNo(e.target.value)}
                    placeholder="123456789"
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-xs dark:border-slate-700 dark:bg-[#0e2034]"
                  />
                </div>
              </div>
            )}
          </div>
        )}

        <div>
          <label htmlFor="book-promo" className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold">
            <Tag className="h-3.5 w-3.5 text-[#3f6212] dark:text-[#9be136]" />
            <span>Promo Code (HMK20 / CANADA15)</span>
          </label>
          <div className="flex gap-2">
            <input
              id="book-promo"
              value={promoInput}
              onChange={(e) => setPromoInput(e.target.value)}
              placeholder="Code"
              className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 font-mono text-sm uppercase dark:border-slate-700 dark:bg-[#040b12]"
            />
            <button
              type="button"
              onClick={handleApplyPromo}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-slate-300 px-3.5 py-2 text-xs font-bold dark:border-slate-700"
            >
              <CheckCircle2 className="h-3.5 w-3.5 text-[#3f6212] dark:text-[#9be136]" />
              <span>Apply</span>
            </button>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-[#040b12]">
          <div className="flex items-center justify-between text-xs font-semibold">
            <label htmlFor="fare-slider">Your Fare Offer (before tax)</label>
            <span className="font-mono text-sm font-bold tabular-nums text-[#3f6212] dark:text-[#9be136]">
              {formatMoney(offerAmount)} CAD
            </span>
          </div>
          <input
            id="fare-slider"
            type="range"
            min={30}
            max={800}
            step={5}
            value={offerAmount}
            onChange={(e) => setOfferAmount(Number(e.target.value))}
            className="mt-2.5 w-full accent-[#3f6212] dark:accent-[#9be136]"
          />
        </div>

        <button
          type="button"
          onClick={handleGetBids}
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#3f6212] py-3.5 text-xs font-bold text-white transition hover:brightness-110 dark:bg-[#9be136] dark:text-[#040b12]"
        >
          <Send className="h-4 w-4" />
          <span>Broadcast Fare &amp; View Fleet Bids →</span>
        </button>

        {bids.length > 0 && (
          <div className="space-y-2.5 pt-2">
            <div className="text-xs font-bold text-[#3f6212] dark:text-[#9be136]">Available Company Driver Bids</div>
            {bids.map((b) => (
              <div
                key={b.name}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3.5 dark:border-slate-700 dark:bg-[#040b12]"
              >
                <div>
                  <div className="flex items-center gap-1.5 text-sm font-bold text-slate-900 dark:text-white">
                    <Truck className="h-4 w-4 text-[#3f6212] dark:text-[#9be136]" />
                    <span>{b.name}</span>
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    {b.tierLabel} · ETA {b.eta}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-mono text-sm font-bold tabular-nums text-[#3f6212] dark:text-[#9be136]">
                    {formatMoney(b.price)}
                  </span>
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={() => handleAcceptBid(b)}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-[#3f6212] px-3.5 py-2 text-xs font-bold text-white disabled:opacity-50 dark:bg-[#9be136] dark:text-[#040b12]"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    <span>Accept &amp; Lock</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Right Column: Route Preview & Live Tax Breakdown */}
      <div className="space-y-5 rounded-2xl border border-slate-200 bg-white p-6 lg:sticky lg:top-20 lg:col-span-5 lg:self-start dark:border-slate-800 dark:bg-[#0e2034]">
        <div>
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">Route Corridor</div>
          <h3 className="font-display mt-0.5 text-lg font-bold text-slate-900 dark:text-white">{hub.label}</h3>
        </div>

        <svg
          viewBox="0 0 400 140"
          className="w-full rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-[#040b12]"
          aria-label="Estimated route curve"
        >
          <path d="M40 105 Q200 20 360 40" fill="none" stroke="#9be136" strokeWidth="4" strokeDasharray="8 6" />
          <circle cx="40" cy="105" r="8" fill="#9be136" />
          <circle cx="360" cy="40" r="8" fill="#38bdf8" />
          <text x="32" y="128" fill="currentColor" fontSize="10" className="fill-slate-500 font-mono">
            {pk.slice(0, 18)}
          </text>
          <text x="245" y="25" fill="currentColor" fontSize="10" className="fill-slate-500 font-mono">
            {dp.slice(0, 18)}
          </text>
        </svg>

        <div className="space-y-2.5 rounded-xl border border-slate-200 bg-slate-50 p-4 font-mono text-xs tabular-nums dark:border-slate-700 dark:bg-[#040b12]">
          <div className="flex justify-between">
            <span className="text-slate-500">Cargo / Weight</span>
            <span>{cargoCategory} · {weightKg} kg ({pieces} pcs)</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Est. Distance / ETA</span>
            <span>{km} km · {km * 2} min</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Fare Offer</span>
            <span>{formatMoney(quote.subtotal)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Promo {quote.promoCode || '—'}</span>
            <span>-{formatMoney(quote.discount)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">{hub.taxLabel}</span>
            <span>{formatMoney(quote.tax)}</span>
          </div>
          <div className="flex justify-between border-t border-dashed border-slate-300 pt-2.5 text-sm font-bold text-[#3f6212] dark:border-slate-700 dark:text-[#9be136]">
            <span>Total</span>
            <span>{formatMoney(quote.total)} CAD</span>
          </div>
        </div>
      </div>
    </div>
  );
};
