export type HubKey = 'gta' | 'ottawa' | 'van' | 'calgary' | 'montreal';
export type TierKey = 'suv' | 'van' | 'cube' | 'truck';
export type UserRole = 'customer' | 'driver' | 'admin';
export type OrderStatus = 'Confirmed' | 'Driver Assigned' | 'In Transit' | 'Delivered' | 'Cancelled';
export type PaymentMethod =
  | 'Wallet'
  | 'Card'
  | 'Interac e-Transfer'
  | 'Bank Transfer (EFT)'
  | 'Cash on Delivery';
export type CargoCategory =
  | 'Parcels & Express'
  | 'Appliances'
  | 'Furniture & Moving'
  | 'Commercial Pallets'
  | 'Fragile Electronics';

export interface HubDefinition {
  key: HubKey;
  label: string;
  taxRate: number;
  taxLabel: string;
  pickupPoints: string[];
  dropoffPoints: string[];
}

export interface TierDefinition {
  key: TierKey;
  label: string;
  baseRate: number;
  maxKg: number;
  capacity: string;
}

export interface OrderLogEntry {
  status: string;
  at: string;
  actor?: string;
}

export interface ChatMessage {
  id: string;
  senderName: string;
  senderRole: UserRole;
  text: string;
  at: string;
}

export interface DriverBidRecord {
  id: string;
  driverEmail: string;
  driverName: string;
  amount: number;
  etaMins: number;
  note?: string;
  createdAt: string;
}

export interface OrderRecord {
  id: string;
  pin: string;
  hubKey: HubKey;
  tierKey: TierKey;
  hub: string;
  tier: string;
  pk: string;
  dp: string;
  pa: string;
  da: string;
  pickupPostal?: string;
  dropoffPostal?: string;
  cargoCategory?: CargoCategory;
  weightKg?: number;
  pieces?: number;
  sub: number;
  disc: number;
  tax: number;
  total: number;
  taxLabel: string;
  promoCode: string;
  pm: PaymentMethod;
  ps: string;
  paymentRef?: string;
  status: OrderStatus;
  log: OrderLogEntry[];
  km: number;
  driver: string;
  driverEmail?: string;
  telemetryStage?: string;
  rn: string;
  rp: string;
  nt: string;
  when: string;
  owner: string;
  at: string;
  createdAtIso: string;
  rev: string;
  rate: number;
  rated?: boolean;
  dis: string;
  tip?: number;
  pod?: string;
  signature?: string;
  bids?: DriverBidRecord[];
  msgs: ChatMessage[];
  progressPct?: number;
}

export interface TransactionRecord {
  id: string;
  at: string;
  userEmail: string;
  type: 'TOPUP' | 'ESCROW_HOLD' | 'REFUND' | 'DRIVER_EARN' | 'TIP' | 'PAYOUT';
  method: string;
  amountCad: number;
  orderId?: string;
  reference: string;
}

export interface UserNotification {
  id: string;
  text: string;
  at: string;
  category: 'order' | 'bid' | 'chat' | 'payout' | 'system';
}

export interface NotificationPrefs {
  orderUpdates: boolean;
  bidAlerts: boolean;
  chatMessages: boolean;
  payoutAlerts: boolean;
  dailyGoalReminders: boolean;
  browserPush: boolean;
}

export interface BankAccountSummary {
  institutionName: string;
  institutionNo: string;
  transitNo: string;
  accountLast4: string;
  accountHolder: string;
}

export interface PublicUser {
  email: string;
  name: string;
  phone: string;
  role: UserRole;
  wallet: number;
  earn: number;
  ban?: boolean;
  online?: boolean;
  assignedHub?: HubKey;
  assignedTier?: TierKey;
  provisionedBy?: string;
  provisionedAt?: string;
  passkeyCount?: number;
  unread: number;
  notes: UserNotification[];
  notifPrefs: NotificationPrefs;
  dailyGoalTarget?: number;
  bankAccount?: BankAccountSummary;
}

export interface AuditEntry {
  id: string;
  at: string;
  actorEmail: string;
  actorRole: UserRole | 'system';
  action: string;
  target: string;
  detail: string;
  hash: string;
}

export const CRA_BN = '84920 1948 RT0001';
export const COMPANY_DRIVER_DOMAIN = '@hmktrading.ca';

export const CARGO_CATEGORIES: CargoCategory[] = [
  'Parcels & Express',
  'Appliances',
  'Furniture & Moving',
  'Commercial Pallets',
  'Fragile Electronics',
];

export const HUBS: Record<HubKey, HubDefinition> = {
  gta: {
    key: 'gta',
    label: 'Greater Toronto Area (ON)',
    taxRate: 0.13,
    taxLabel: 'HST 13%',
    pickupPoints: ['Toronto Downtown Hub', 'Scarborough Centre', 'Markham Hub'],
    dropoffPoints: ['Mississauga City Centre', 'Brampton Hub', 'Oakville South'],
  },
  ottawa: {
    key: 'ottawa',
    label: 'Ottawa - Gatineau (ON)',
    taxRate: 0.13,
    taxLabel: 'HST 13%',
    pickupPoints: ['Ottawa Downtown Hub', 'Orléans Hub', 'Nepean Hub'],
    dropoffPoints: ['Kanata Tech Park', 'Barrhaven South', 'Gatineau Sector'],
  },
  van: {
    key: 'van',
    label: 'Metro Vancouver (BC)',
    taxRate: 0.12,
    taxLabel: 'GST+PST 12%',
    pickupPoints: ['Vancouver Downtown', 'Richmond Terminal', 'Kitsilano'],
    dropoffPoints: ['Burnaby Metrotown', 'Surrey Central', 'North Vancouver'],
  },
  calgary: {
    key: 'calgary',
    label: 'Calgary (AB)',
    taxRate: 0.05,
    taxLabel: 'GST 5%',
    pickupPoints: ['Calgary Downtown', 'NE Industrial Park'],
    dropoffPoints: ['Airdrie Hub', 'Cochrane Gateway', 'SW Residential'],
  },
  montreal: {
    key: 'montreal',
    label: 'Greater Montreal (QC)',
    taxRate: 0.14975,
    taxLabel: 'GST+QST 14.975%',
    pickupPoints: ['Montreal Downtown', 'Vieux-Montréal', 'Laval Centre'],
    dropoffPoints: ['Longueuil Hub', 'Mont-Royal', 'West Island'],
  },
};

export const TIERS: Record<TierKey, TierDefinition> = {
  suv: {key: 'suv', label: 'Courier SUV', baseRate: 45, maxKg: 250, capacity: 'Up to 250 kg · Parcels & Appliances'},
  van: {key: 'van', label: 'Cargo Van', baseRate: 85, maxKg: 900, capacity: 'Up to 900 kg · Furniture & Pallets'},
  cube: {key: 'cube', label: '16ft Cube Truck', baseRate: 160, maxKg: 2200, capacity: 'Up to 2,200 kg · 2–3 Room Move'},
  truck: {key: 'truck', label: '26ft Heavy Truck', baseRate: 290, maxKg: 4500, capacity: 'Up to 4,500 kg · Commercial Freight'},
};

export const PROMOS: Record<string, number> = {
  HMK20: 0.2,
  CANADA15: 0.15,
};

export const STAGES: OrderStatus[] = ['Confirmed', 'Driver Assigned', 'In Transit', 'Delivered'];

export const NEXT_STAGE: Partial<Record<OrderStatus, OrderStatus>> = {
  Confirmed: 'Driver Assigned',
  'Driver Assigned': 'In Transit',
  'In Transit': 'Delivered',
};

export function formatMoney(n: number): string {
  return '$' + Number(n || 0).toFixed(2);
}

export function calculateDistanceKm(hubKey: HubKey, pk: string, dp: string): number {
  const h = HUBS[hubKey];
  if (!h) return 12;
  const pIdx = Math.max(0, h.pickupPoints.indexOf(pk));
  const dIdx = Math.max(0, h.dropoffPoints.indexOf(dp));
  return 8 + ((pIdx * 7 + dIdx * 5) % 24);
}

export function recommendTierByWeight(weightKg: number): TierKey {
  const w = Math.max(0, Number(weightKg) || 0);
  if (w <= 250) return 'suv';
  if (w <= 900) return 'van';
  if (w <= 2200) return 'cube';
  return 'truck';
}

export function isValidCanadianPostalCode(code: string): boolean {
  if (!code.trim()) return true;
  return /^[ABCEGHJ-NPRSTVXY]\d[ABCEGHJ-NPRSTV-Z][ -]?\d[ABCEGHJ-NPRSTV-Z]\d$/i.test(code.trim());
}

export function detectCardBrand(cardNumber: string): 'Visa' | 'Mastercard' | 'Amex' | 'Card' {
  const d = cardNumber.replace(/\D/g, '');
  if (d.startsWith('4')) return 'Visa';
  if (/^(5[1-5]|2[2-7])/.test(d)) return 'Mastercard';
  if (/^3[47]/.test(d)) return 'Amex';
  return 'Card';
}

export interface FareQuote {
  hub: HubDefinition;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  promoCode: string;
}

export function calculateFareQuote(hubKey: HubKey, offerAmount: number, promoCode = ''): FareQuote {
  const hub = HUBS[hubKey] || HUBS.gta;
  const cleanPromo = promoCode.trim().toUpperCase();
  const rate = PROMOS[cleanPromo] || 0;
  const subtotal = Math.max(20, Number(offerAmount) || 0);
  const discount = +(subtotal * rate).toFixed(2);
  const taxable = Math.max(0, subtotal - discount);
  const tax = +(taxable * hub.taxRate).toFixed(2);
  const total = +(taxable + tax).toFixed(2);
  return {
    hub,
    subtotal,
    discount,
    tax,
    total,
    promoCode: rate > 0 ? cleanPromo : '',
  };
}

export const MIN_PASSWORD_LENGTH = 8;

export function isValidPassword(password: string): boolean {
  return typeof password === 'string' && password.length >= MIN_PASSWORD_LENGTH;
}

export function isValidCompanyDriverEmail(email: string): boolean {
  const clean = email.trim().toLowerCase();
  if (!clean.endsWith(COMPANY_DRIVER_DOMAIN)) return false;
  const local = clean.slice(0, -COMPANY_DRIVER_DOMAIN.length);
  return /^[a-z0-9][a-z0-9._-]{1,48}$/.test(local);
}

export const CANADIAN_BANKS = [
  {code: '003', name: 'RBC Royal Bank'},
  {code: '004', name: 'TD Canada Trust'},
  {code: '001', name: 'BMO Bank of Montreal'},
  {code: '002', name: 'Scotiabank'},
  {code: '010', name: 'CIBC'},
  {code: '815', name: 'Desjardins'},
  {code: '006', name: 'National Bank of Canada'},
  {code: '614', name: 'Tangerine Bank'},
] as const;

export function isValidCanadianBankDetails(
  institutionNo: string,
  transitNo: string,
  accountNo: string,
): boolean {
  const inst = institutionNo.replace(/\D/g, '');
  const transit = transitNo.replace(/\D/g, '');
  const acct = accountNo.replace(/\D/g, '');
  return /^\d{3}$/.test(inst) && /^\d{5}$/.test(transit) && acct.length >= 7 && acct.length <= 12;
}

export function isValidCardExpiry(expiry: string): boolean {
  const m = expiry.trim().match(/^(\d{2})\/(\d{2})$/);
  if (!m) return false;
  const month = Number(m[1]);
  const year = 2000 + Number(m[2]);
  if (month < 1 || month > 12) return false;
  const now = new Date();
  const expEnd = new Date(year, month, 0, 23, 59, 59);
  return expEnd >= now;
}

export function validateLuhnCard(cardNumber: string): boolean {
  const digits = cardNumber.replace(/\D/g, '');
  if (digits.length < 13 || digits.length > 19) return false;
  let sum = 0;
  let doubleNext = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = Number(digits[i]);
    if (doubleNext) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    doubleNext = !doubleNext;
  }
  return sum % 10 === 0;
}

export function sanitizeCsvCell(v: unknown): string {
  let t = String(v ?? '');
  if (/^[=+\-@\t\r]/.test(t)) t = "'" + t;
  return '"' + t.replace(/"/g, '""') + '"';
}

export function buildOrdersCsv(orders: OrderRecord[]): string {
  const header = [
    'Order ID',
    'Hub',
    'Tier',
    'Cargo',
    'Weight kg',
    'Route',
    'Driver',
    'Subtotal CAD',
    'Discount CAD',
    'Tax CAD',
    'Total CAD',
    'Payment',
    'Status',
    'Created At',
  ];
  const rows = orders.map((o) => [
    o.id,
    o.hub,
    o.tier,
    o.cargoCategory || 'General Freight',
    o.weightKg ?? '',
    `${o.pk} -> ${o.dp}`,
    o.driver,
    o.sub.toFixed(2),
    o.disc.toFixed(2),
    o.tax.toFixed(2),
    o.total.toFixed(2),
    o.ps,
    o.status,
    o.at,
  ]);
  return [header, ...rows].map((row) => row.map(sanitizeCsvCell).join(',')).join('\n');
}

export interface DispatchReport {
  generatedAt: string;
  periodLabel: string;
  craBn: string;
  totalOrders: number;
  deliveredOrders: number;
  activeOrders: number;
  cancelledOrders: number;
  grossVolumeCad: number;
  totalTaxCad: number;
  netFreightCad: number;
  byHub: Array<{hub: string; count: number; revenue: number; tax: number}>;
  byTier: Array<{tier: string; count: number; revenue: number}>;
}

export function buildDispatchReport(orders: OrderRecord[], periodLabel = 'All Time'): DispatchReport {
  const nonCancelled = orders.filter((o) => o.status !== 'Cancelled');
  const byHubMap = new Map<string, {hub: string; count: number; revenue: number; tax: number}>();
  const byTierMap = new Map<string, {tier: string; count: number; revenue: number}>();

  for (const o of nonCancelled) {
    const existing = byHubMap.get(o.hub) || {hub: o.hub, count: 0, revenue: 0, tax: 0};
    existing.count += 1;
    existing.revenue = +(existing.revenue + o.total).toFixed(2);
    existing.tax = +(existing.tax + o.tax).toFixed(2);
    byHubMap.set(o.hub, existing);

    const tEntry = byTierMap.get(o.tier) || {tier: o.tier, count: 0, revenue: 0};
    tEntry.count += 1;
    tEntry.revenue = +(tEntry.revenue + o.total).toFixed(2);
    byTierMap.set(o.tier, tEntry);
  }

  const grossVolumeCad = +nonCancelled.reduce((s, o) => s + o.total, 0).toFixed(2);
  const totalTaxCad = +nonCancelled.reduce((s, o) => s + o.tax, 0).toFixed(2);
  return {
    generatedAt: new Date().toISOString(),
    periodLabel,
    craBn: CRA_BN,
    totalOrders: orders.length,
    deliveredOrders: orders.filter((o) => o.status === 'Delivered').length,
    activeOrders: orders.filter((o) => !['Delivered', 'Cancelled'].includes(o.status)).length,
    cancelledOrders: orders.filter((o) => o.status === 'Cancelled').length,
    grossVolumeCad,
    totalTaxCad,
    netFreightCad: +(grossVolumeCad - totalTaxCad).toFixed(2),
    byHub: Array.from(byHubMap.values()).sort((a, b) => b.revenue - a.revenue),
    byTier: Array.from(byTierMap.values()).sort((a, b) => b.revenue - a.revenue),
  };
}

export function buildReportCsv(report: DispatchReport): string {
  const lines = [
    ['HMK Trading Inc. Automated Dispatch & CRA Tax Report', report.periodLabel, report.generatedAt],
    ['CRA Business Number', report.craBn],
    ['Total Orders', report.totalOrders],
    ['Delivered Orders', report.deliveredOrders],
    ['Active Orders', report.activeOrders],
    ['Cancelled Orders', report.cancelledOrders],
    ['Gross Volume CAD', report.grossVolumeCad.toFixed(2)],
    ['Total Tax Collected CAD', report.totalTaxCad.toFixed(2)],
    ['Net Freight CAD', report.netFreightCad.toFixed(2)],
    [],
    ['Hub', 'Order Count', 'Gross Revenue CAD', 'Tax Collected CAD'],
    ...report.byHub.map((h) => [h.hub, h.count, h.revenue.toFixed(2), h.tax.toFixed(2)]),
  ];
  return lines.map((r) => r.map(sanitizeCsvCell).join(',')).join('\n');
}

export interface GamificationStats {
  xp: number;
  level: number;
  tierName: 'Bronze Courier' | 'Silver Fleet' | 'Gold Express' | 'Platinum Dispatch';
  nextLevelXp: number;
  dailyCompleted: number;
  dailyGoal: number;
  dailyProgressPct: number;
  streakDays: number;
  badges: Array<{id: string; label: string; earned: boolean; hint: string}>;
}

export function computeGamificationStats(
  orders: OrderRecord[],
  userEmail: string,
  role: UserRole,
  dailyGoal = 3,
): GamificationStats {
  const relevant = orders.filter((o) =>
    role === 'driver' ? o.driverEmail === userEmail : role === 'customer' ? o.owner === userEmail : true,
  );
  const delivered = relevant.filter((o) => o.status === 'Delivered');
  const todayStr = new Date().toISOString().slice(0, 10);
  const dailyCompleted = delivered.filter((o) => (o.createdAtIso || '').startsWith(todayStr)).length;
  const fiveStars = delivered.filter((o) => o.rated && o.rate === 5).length;
  const zeroDisputes = delivered.length > 0 && delivered.every((o) => !o.dis);

  const xp = relevant.length * 40 + delivered.length * 120 + fiveStars * 50;
  const level = Math.max(1, Math.floor(xp / 250) + 1);
  const nextLevelXp = level * 250;
  const tierName =
    level >= 8 ? 'Platinum Dispatch' : level >= 5 ? 'Gold Express' : level >= 3 ? 'Silver Fleet' : 'Bronze Courier';

  const uniqueDays = new Set(
    delivered.map((o) => (o.createdAtIso || '').slice(0, 10)).filter((d) => d.length === 10),
  );
  const streakDays = Math.max(dailyCompleted > 0 ? 1 : 0, uniqueDays.size);

  const badges = [
    {id: 'first', label: 'First Dispatch', earned: relevant.length >= 1, hint: 'Complete or place 1 order'},
    {id: 'pin', label: 'PIN Escrow Guardian', earned: delivered.length >= 1, hint: 'Verify 1 delivery via 4-digit PIN'},
    {id: 'five_star', label: '5-Star Partner', earned: fiveStars >= 1, hint: 'Earn or give a 5-star rating'},
    {id: 'clean', label: 'Zero-Dispute Record', earned: zeroDisputes && delivered.length >= 2, hint: '2+ deliveries with zero disputes'},
  ];

  return {
    xp,
    level,
    tierName,
    nextLevelXp,
    dailyCompleted,
    dailyGoal: Math.max(1, dailyGoal),
    dailyProgressPct: Math.min(100, Math.round((dailyCompleted / Math.max(1, dailyGoal)) * 100)),
    streakDays,
    badges,
  };
}

export type VoiceAction =
  | {type: 'navigate'; target: 'home' | 'book' | 'track' | 'analytics' | 'driver' | 'admin' | 'auth'}
  | {type: 'theme'; mode: 'toggle' | 'dark' | 'light'}
  | {type: 'lang'; lang: 'en' | 'fr' | 'ur'}
  | {type: 'export_csv'}
  | {type: 'open_wallet'}
  | {type: 'track_order'; orderId: string}
  | {type: 'unknown'; raw: string};

export function parseVoiceCommand(input: string): VoiceAction {
  const q = input.trim().toLowerCase();
  if (!q) return {type: 'unknown', raw: input};

  const orderMatch = q.match(/hmk[- ]?(\d{4,6})/i);
  if (orderMatch && (q.includes('track') || q.includes('order') || q.includes('find'))) {
    return {type: 'track_order', orderId: `HMK-${orderMatch[1]}`};
  }
  if (q.includes('book') || q.includes('fare') || q.includes('bid') || q.includes('shipment')) {
    return {type: 'navigate', target: 'book'};
  }
  if (q.includes('track') || q.includes('orders') || q.includes('suivi')) {
    return {type: 'navigate', target: 'track'};
  }
  if (q.includes('analytics') || q.includes('dashboard') || q.includes('widget') || q.includes('goal') || q.includes('stats')) {
    return {type: 'navigate', target: 'analytics'};
  }
  if (q.includes('driver')) {
    return {type: 'navigate', target: 'driver'};
  }
  if (q.includes('admin') || q.includes('hq') || q.includes('fleet') || q.includes('audit')) {
    return {type: 'navigate', target: 'admin'};
  }
  if (q.includes('login') || q.includes('sign in') || q.includes('portal') || q.includes('account')) {
    return {type: 'navigate', target: 'auth'};
  }
  if (q.includes('home') || q.includes('overview')) {
    return {type: 'navigate', target: 'home'};
  }
  if (q.includes('light')) return {type: 'theme', mode: 'light'};
  if (q.includes('dark')) return {type: 'theme', mode: 'dark'};
  if (q.includes('theme')) return {type: 'theme', mode: 'toggle'};
  if (q.includes('french') || q.includes('français') || q.includes('francais')) return {type: 'lang', lang: 'fr'};
  if (q.includes('urdu')) return {type: 'lang', lang: 'ur'};
  if (q.includes('english')) return {type: 'lang', lang: 'en'};
  if (q.includes('csv') || q.includes('export')) return {type: 'export_csv'};
  if (q.includes('wallet') || q.includes('top up')) return {type: 'open_wallet'};

  return {type: 'unknown', raw: input};
}
