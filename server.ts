import express from 'express';
import http from 'http';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import {WebSocketServer, WebSocket} from 'ws';
import {createServer as createViteServer} from 'vite';
import {
  HUBS,
  TIERS,
  calculateFareQuote,
  calculateDistanceKm,
  isValidCompanyDriverEmail,
  isValidCanadianPostalCode,
  isValidCanadianBankDetails,
  isValidCardExpiry,
  isValidPassword,
  detectCardBrand,
  validateLuhnCard,
  type HubKey,
  type TierKey,
  type UserRole,
  type OrderStatus,
  type PaymentMethod,
  type CargoCategory,
  type OrderRecord,
  type PublicUser,
  type AuditEntry,
  type NotificationPrefs,
  type TransactionRecord,
  type BankAccountSummary,
} from './src/shared/logistics.ts';

dotenv.config();

interface StoredUser extends PublicUser {
  salt: string;
  passHash: string;
  passkeys: Array<{id: string; label: string; createdAt: string}>;
}

interface PendingOtp {
  email: string;
  name: string;
  phone: string;
  salt: string;
  passHash: string;
  code: string;
  tries: number;
  expiresAt: number;
}

interface StoreData {
  users: StoredUser[];
  orders: OrderRecord[];
  audit: AuditEntry[];
  transactions: TransactionRecord[];
}

const PORT = 3000;
const DATA_DIR = path.resolve(process.cwd(), '.hmk-data');
const STORE_PATH = path.join(DATA_DIR, 'store.json');
const SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');

const DEFAULT_NOTIF_PREFS: NotificationPrefs = {
  orderUpdates: true,
  bidAlerts: true,
  chatMessages: true,
  payoutAlerts: true,
  dailyGoalReminders: true,
  browserPush: true,
};

function hashPassword(password: string, salt: string): string {
  return crypto.scryptSync(password, salt, 64).toString('hex');
}

function verifyPassword(password: string, salt: string, expectedHash: string): boolean {
  const actual = Buffer.from(hashPassword(password, salt), 'hex');
  const expected = Buffer.from(expectedHash, 'hex');
  if (actual.length !== expected.length) return false;
  return crypto.timingSafeEqual(actual, expected);
}

function signToken(email: string, role: UserRole): string {
  const payload = Buffer.from(
    JSON.stringify({email, role, exp: Date.now() + 1000 * 60 * 60 * 12}),
  ).toString('base64url');
  const sig = crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

function verifyToken(token: string): {email: string; role: UserRole} | null {
  try {
    const [payload, sig] = token.split('.');
    if (!payload || !sig) return null;
    const expectedSig = crypto
      .createHmac('sha256', SESSION_SECRET)
      .update(payload)
      .digest('base64url');
    const a = Buffer.from(sig);
    const b = Buffer.from(expectedSig);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as {
      email: string;
      role: UserRole;
      exp: number;
    };
    if (!parsed.email || !parsed.role || parsed.exp < Date.now()) return null;
    return {email: parsed.email, role: parsed.role};
  } catch {
    return null;
  }
}

function toPublicUser(u: StoredUser): PublicUser {
  return {
    email: u.email,
    name: u.name,
    phone: u.phone,
    role: u.role,
    wallet: u.wallet,
    earn: u.earn,
    ban: u.ban,
    online: u.online,
    assignedHub: u.assignedHub,
    assignedTier: u.assignedTier,
    provisionedBy: u.provisionedBy,
    provisionedAt: u.provisionedAt,
    passkeyCount: (u.passkeys || []).length,
    unread: u.unread || 0,
    notes: u.notes || [],
    notifPrefs: u.notifPrefs || {...DEFAULT_NOTIF_PREFS},
    dailyGoalTarget: u.dailyGoalTarget || 3,
    bankAccount: u.bankAccount,
  };
}

function createInitialStore(): StoreData {
  const nowIso = new Date().toISOString();
  const nowStr = new Date().toLocaleString('en-CA');
  const sampleOrders: OrderRecord[] = [
    {
      id: 'HMK-48210',
      pin: '7391',
      hubKey: 'gta',
      tierKey: 'van',
      hub: HUBS.gta.label,
      tier: TIERS.van.label,
      pk: 'Toronto Downtown Hub',
      dp: 'Mississauga City Centre',
      pa: '120 King St W',
      da: '100 City Centre Dr',
      pickupPostal: 'M5X 1A9',
      dropoffPostal: 'L5B 2C9',
      cargoCategory: 'Appliances',
      weightKg: 340,
      pieces: 2,
      sub: 95,
      disc: 0,
      tax: 12.35,
      total: 107.35,
      taxLabel: HUBS.gta.taxLabel,
      promoCode: '',
      pm: 'Wallet',
      ps: 'Paid from wallet (escrow held)',
      status: 'In Transit',
      telemetryStage: 'Highway 401 Corridor',
      log: [
        {status: 'Order placed', at: nowStr, actor: 'system'},
        {status: 'Driver Assigned', at: nowStr, actor: 'system'},
        {status: 'In Transit', at: nowStr, actor: 'system'},
      ],
      km: 24,
      driver: 'Marc Tremblay (HMK Fleet)',
      rn: 'Priya Sharma',
      rp: '+1 416 555 0148',
      nt: 'Loading dock B, call on arrival',
      when: '',
      owner: 'showcase@hmktrading.ca',
      at: nowStr,
      createdAtIso: nowIso,
      rev: '',
      rate: 5,
      dis: '',
      bids: [],
      msgs: [],
      progressPct: 72,
    },
    {
      id: 'HMK-48211',
      pin: '4028',
      hubKey: 'montreal',
      tierKey: 'cube',
      hub: HUBS.montreal.label,
      tier: TIERS.cube.label,
      pk: 'Montreal Downtown',
      dp: 'Longueuil Hub',
      pa: '800 Rue de la Gauchetière O',
      da: '200 Rue Saint-Charles O',
      pickupPostal: 'H3B 1X9',
      dropoffPostal: 'J4H 1C9',
      cargoCategory: 'Fragile Electronics',
      weightKg: 620,
      pieces: 6,
      sub: 180,
      disc: 27,
      tax: 22.91,
      total: 175.91,
      taxLabel: HUBS.montreal.taxLabel,
      promoCode: 'CANADA15',
      pm: 'Card',
      ps: 'Settled (escrow released)',
      paymentRef: 'VISA-4242',
      status: 'Delivered',
      telemetryStage: 'Delivered & Signed',
      log: [
        {status: 'Order placed', at: nowStr, actor: 'system'},
        {status: 'Delivered (PIN verified)', at: nowStr, actor: 'system'},
      ],
      km: 15,
      driver: 'Sophie Lavoie (HMK Fleet)',
      rn: 'Jean-Luc Moreau',
      rp: '+1 514 555 0199',
      nt: 'Fragile studio monitors',
      when: '',
      owner: 'showcase@hmktrading.ca',
      at: nowStr,
      createdAtIso: nowIso,
      rev: 'On-time bilingual courier, spotless delivery.',
      rate: 5,
      rated: true,
      dis: '',
      bids: [],
      msgs: [],
      progressPct: 100,
    },
  ];

  return {
    users: [],
    orders: sampleOrders,
    audit: [
      {
        id: 'AUD-1',
        at: nowIso,
        actorEmail: 'system@hmktrading.ca',
        actorRole: 'system',
        action: 'SYSTEM_BOOT',
        target: 'HMK Dispatch Core',
        detail: 'Initialized Canadian logistics engine and CRA tax rules',
        hash: crypto.createHash('sha256').update(`SYSTEM_BOOT:${nowIso}`).digest('hex').slice(0, 16),
      },
    ],
    transactions: [],
  };
}

function loadStore(): StoreData {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, {recursive: true});
    if (fs.existsSync(STORE_PATH)) {
      const parsed = JSON.parse(fs.readFileSync(STORE_PATH, 'utf8')) as StoreData;
      if (Array.isArray(parsed.users) && Array.isArray(parsed.orders)) {
        return {
          users: parsed.users,
          orders: parsed.orders,
          audit: Array.isArray(parsed.audit) ? parsed.audit : [],
          transactions: Array.isArray(parsed.transactions) ? parsed.transactions : [],
        };
      }
    }
  } catch (err) {
    console.error('Failed to read store, reinitializing:', err);
  }
  const initial = createInitialStore();
  saveStore(initial);
  return initial;
}

function saveStore(data: StoreData): void {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, {recursive: true});
    const tmp = `${STORE_PATH}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
    fs.renameSync(tmp, STORE_PATH);
  } catch (err) {
    console.error('Failed to write store:', err);
  }
}

let store = loadStore();
const pendingOtps = new Map<string, PendingOtp>();
const passkeyChallenges = new Map<string, {challenge: string; expiresAt: number}>();
const wsClients = new Map<WebSocket, {email: string; role: UserRole}>();

function appendAudit(actorEmail: string, actorRole: UserRole | 'system', action: string, target: string, detail: string): AuditEntry {
  const at = new Date().toISOString();
  const prevHash = store.audit[0]?.hash || '0000';
  const hash = crypto
    .createHash('sha256')
    .update(`${prevHash}:${at}:${actorEmail}:${action}:${target}:${detail}`)
    .digest('hex')
    .slice(0, 16);
  const entry: AuditEntry = {
    id: `AUD-${Date.now().toString(36).toUpperCase()}`,
    at,
    actorEmail,
    actorRole,
    action,
    target,
    detail,
    hash,
  };
  store.audit.unshift(entry);
  if (store.audit.length > 500) store.audit.length = 500;
  broadcastEvent('audit:entry', entry, (c) => c.role === 'admin');
  return entry;
}

function recordTransaction(
  userEmail: string,
  type: TransactionRecord['type'],
  method: string,
  amountCad: number,
  reference: string,
  orderId?: string,
) {
  const tx: TransactionRecord = {
    id: `TX-${Date.now().toString(36).toUpperCase()}-${crypto.randomInt(100, 999)}`,
    at: new Date().toLocaleString('en-CA'),
    userEmail,
    type,
    method,
    amountCad: +Number(amountCad).toFixed(2),
    orderId,
    reference,
  };
  store.transactions.unshift(tx);
  if (store.transactions.length > 1000) store.transactions.length = 1000;
  return tx;
}

function pushUserNotification(
  email: string,
  text: string,
  category: 'order' | 'bid' | 'chat' | 'payout' | 'system' = 'order',
) {
  const user = store.users.find((u) => u.email === email);
  if (!user) return;
  const note = {
    id: `NT-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    text,
    at: new Date().toLocaleString('en-CA'),
    category,
  };
  user.notes = [...(user.notes || []), note].slice(-40);
  user.unread = (user.unread || 0) + 1;
  broadcastEvent('notification:new', {email, note, unread: user.unread}, (c) => c.email === email);
}

function broadcastEvent(
  type: string,
  payload: unknown,
  predicate?: (client: {email: string; role: UserRole}) => boolean,
) {
  const raw = JSON.stringify({type, payload});
  for (const [sock, meta] of wsClients.entries()) {
    if (sock.readyState !== WebSocket.OPEN) continue;
    if (predicate && !predicate(meta)) continue;
    sock.send(raw);
  }
}

function requireAuth(req: express.Request, res: express.Response): StoredUser | null {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  const verified = token ? verifyToken(token) : null;
  if (!verified) {
    res.status(401).json({error: 'Authentication required.'});
    return null;
  }
  const user = store.users.find((u) => u.email === verified.email && !u.ban);
  if (!user) {
    res.status(401).json({error: 'Account not found or suspended.'});
    return null;
  }
  return user;
}

async function startServer() {
  const app = express();
  app.use(express.json({limit: '4mb'}));

  const server = http.createServer(app);
  const wss = new WebSocketServer({server, path: '/ws'});

  wss.on('connection', (ws, req) => {
    try {
      const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
      const token = url.searchParams.get('token') || '';
      const verified = token ? verifyToken(token) : null;
      if (verified) {
        wsClients.set(ws, verified);
        ws.send(JSON.stringify({type: 'ws:ready', payload: {email: verified.email, role: verified.role}}));
      }
    } catch {
      // ignore malformed URL
    }

    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(String(raw)) as {type?: string; token?: string};
        if (msg.type === 'auth' && typeof msg.token === 'string') {
          const verified = verifyToken(msg.token);
          if (verified) {
            wsClients.set(ws, verified);
            ws.send(JSON.stringify({type: 'ws:ready', payload: verified}));
          }
        }
      } catch {
        // ignore invalid socket frames
      }
    });

    ws.on('close', () => {
      wsClients.delete(ws);
    });
  });

  // --- Auth & Portal Status ---
  app.get('/api/auth/hq-status', (_req, res) => {
    const hqClaimed = store.users.some((u) => u.role === 'admin' && !u.ban);
    const passcodeConfigured = Boolean((process.env.HMK_HQ_PASSCODE || '').trim());
    res.json({hqClaimed, passcodeConfigured});
  });

  app.post('/api/auth/claim-hq', (req, res) => {
    const {name, email, phone, password, passcode} = req.body as {
      name?: string;
      email?: string;
      phone?: string;
      password?: string;
      passcode?: string;
    };
    const configuredPasscode = (process.env.HMK_HQ_PASSCODE || '').trim();
    const hqExists = store.users.some((u) => u.role === 'admin');

    if (configuredPasscode) {
      const a = Buffer.from(String(passcode || ''));
      const b = Buffer.from(configuredPasscode);
      if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
        return res.status(403).json({error: 'Invalid Fleet HQ authorization passcode.'});
      }
    } else if (hqExists) {
      return res.status(403).json({error: 'Fleet HQ Admin is already claimed. Please sign in.'});
    }

    const cleanEmail = String(email || '').trim().toLowerCase();
    if (!cleanEmail.includes('@') || !name?.trim() || !password || !isValidPassword(password)) {
      return res.status(400).json({error: 'Valid name, email, and 8+ character password required.'});
    }
    if (store.users.some((u) => u.email === cleanEmail)) {
      return res.status(409).json({error: 'An account with this email already exists.'});
    }

    const salt = crypto.randomBytes(16).toString('hex');
    const adminUser: StoredUser = {
      email: cleanEmail,
      name: name.trim(),
      phone: String(phone || '').trim(),
      role: 'admin',
      wallet: 0,
      earn: 0,
      unread: 0,
      notes: [],
      notifPrefs: {...DEFAULT_NOTIF_PREFS},
      dailyGoalTarget: 5,
      salt,
      passHash: hashPassword(password, salt),
      passkeys: [],
    };
    store.users.push(adminUser);
    appendAudit(cleanEmail, 'admin', 'HQ_CLAIMED', cleanEmail, 'Initial Fleet HQ Admin account provisioned');
    saveStore(store);

    const token = signToken(adminUser.email, adminUser.role);
    res.json({token, user: toPublicUser(adminUser)});
  });

  app.post('/api/auth/request-otp', (req, res) => {
    const {name, phone, email, password, role} = req.body as {
      name?: string;
      phone?: string;
      email?: string;
      password?: string;
      role?: string;
    };

    if (role && role !== 'customer') {
      return res.status(403).json({
        error:
          role === 'driver'
            ? 'Driver accounts and @hmktrading.ca emails can only be provisioned by HMK Fleet HQ.'
            : 'Fleet HQ accounts cannot be self-registered via the customer flow.',
      });
    }

    const cleanEmail = String(email || '').trim().toLowerCase();
    if (!cleanEmail.includes('@') || !name?.trim() || !phone?.trim() || !password || !isValidPassword(password)) {
      return res.status(400).json({error: 'Complete name, phone, email, and 8+ char password are required.'});
    }
    if (store.users.some((u) => u.email === cleanEmail)) {
      return res.status(409).json({error: 'Email is already registered. Sign in instead.'});
    }

    const code = String(crypto.randomInt(100000, 999999));
    const salt = crypto.randomBytes(16).toString('hex');
    pendingOtps.set(cleanEmail, {
      email: cleanEmail,
      name: name.trim(),
      phone: phone.trim(),
      salt,
      passHash: hashPassword(password, salt),
      code,
      tries: 0,
      expiresAt: Date.now() + 1000 * 60 * 10,
    });

    res.json({email: cleanEmail, demoOtp: code});
  });

  app.post('/api/auth/verify-otp', (req, res) => {
    const {email, code} = req.body as {email?: string; code?: string};
    const cleanEmail = String(email || '').trim().toLowerCase();
    const pending = pendingOtps.get(cleanEmail);
    if (!pending || pending.expiresAt < Date.now()) {
      pendingOtps.delete(cleanEmail);
      return res.status(400).json({error: 'OTP expired or missing. Please register again.'});
    }
    if (String(code || '').trim() !== pending.code) {
      pending.tries += 1;
      if (pending.tries >= 5) {
        pendingOtps.delete(cleanEmail);
        return res.status(429).json({error: 'Too many invalid attempts. Please register again.'});
      }
      return res.status(400).json({error: 'Invalid 6-digit OTP code.'});
    }

    pendingOtps.delete(cleanEmail);
    const customer: StoredUser = {
      email: pending.email,
      name: pending.name,
      phone: pending.phone,
      role: 'customer',
      wallet: 0,
      earn: 0,
      unread: 0,
      notes: [],
      notifPrefs: {...DEFAULT_NOTIF_PREFS},
      dailyGoalTarget: 3,
      salt: pending.salt,
      passHash: pending.passHash,
      passkeys: [],
    };
    store.users.push(customer);
    appendAudit(customer.email, 'customer', 'CUSTOMER_REGISTERED', customer.email, 'Verified via 6-digit OTP');
    saveStore(store);

    const token = signToken(customer.email, customer.role);
    res.json({token, user: toPublicUser(customer)});
  });

  app.post('/api/auth/login', (req, res) => {
    const {email, password, portalRole} = req.body as {
      email?: string;
      password?: string;
      portalRole?: UserRole;
    };
    const cleanEmail = String(email || '').trim().toLowerCase();
    const user = store.users.find((u) => u.email === cleanEmail);
    if (user?.ban) {
      return res.status(403).json({error: 'This account has been suspended by Fleet HQ.'});
    }
    if (!user || !password || !verifyPassword(password, user.salt, user.passHash)) {
      return res.status(401).json({error: 'Invalid email or password.'});
    }
    if (portalRole && user.role !== portalRole) {
      return res.status(403).json({
        error: `This account belongs to the ${user.role.toUpperCase()} portal. Switch to the matching portal to sign in.`,
      });
    }

    appendAudit(user.email, user.role, 'USER_LOGIN', user.email, `Signed in via ${portalRole || user.role} portal`);
    saveStore(store);
    const token = signToken(user.email, user.role);
    res.json({token, user: toPublicUser(user)});
  });

  app.post('/api/auth/passkey/challenge', (req, res) => {
    const email = String((req.body as {email?: string}).email || '').trim().toLowerCase();
    const challenge = crypto.randomBytes(24).toString('base64url');
    passkeyChallenges.set(email || 'anon', {challenge, expiresAt: Date.now() + 120_000});
    res.json({challenge});
  });

  app.post('/api/auth/passkey/register', (req, res) => {
    const user = requireAuth(req, res);
    if (!user) return;
    const {credentialId, label} = req.body as {credentialId?: string; label?: string};
    if (!credentialId) return res.status(400).json({error: 'Credential ID required.'});
    user.passkeys = user.passkeys || [];
    if (!user.passkeys.some((p) => p.id === credentialId)) {
      user.passkeys.push({
        id: credentialId,
        label: label || 'Device Biometric Passkey',
        createdAt: new Date().toISOString(),
      });
    }
    appendAudit(user.email, user.role, 'PASSKEY_ENROLLED', user.email, 'Enrolled biometric passkey');
    saveStore(store);
    res.json({user: toPublicUser(user)});
  });

  app.post('/api/auth/passkey/login', (req, res) => {
    const {email, credentialId, portalRole} = req.body as {
      email?: string;
      credentialId?: string;
      portalRole?: UserRole;
    };
    const cleanEmail = String(email || '').trim().toLowerCase();
    const user = store.users.find((u) => u.email === cleanEmail && !u.ban);
    if (!user || !credentialId || !(user.passkeys || []).some((p) => p.id === credentialId)) {
      return res.status(401).json({error: 'No matching biometric passkey found for this account.'});
    }
    if (portalRole && user.role !== portalRole) {
      return res.status(403).json({error: `Use the ${user.role} portal for this account.`});
    }
    appendAudit(user.email, user.role, 'BIOMETRIC_LOGIN', user.email, 'Signed in with WebAuthn passkey');
    saveStore(store);
    res.json({token: signToken(user.email, user.role), user: toPublicUser(user)});
  });

  app.get('/api/auth/me', (req, res) => {
    const user = requireAuth(req, res);
    if (!user) return;
    res.json({user: toPublicUser(user)});
  });

  app.patch('/api/auth/profile', (req, res) => {
    const user = requireAuth(req, res);
    if (!user) return;
    const {name, phone, password, notifPrefs, dailyGoalTarget, bankAccount} = req.body as {
      name?: string;
      phone?: string;
      password?: string;
      notifPrefs?: NotificationPrefs;
      dailyGoalTarget?: number;
      bankAccount?: {
        institutionName?: string;
        institutionNo?: string;
        transitNo?: string;
        accountNo?: string;
        accountHolder?: string;
      };
    };
    if (name !== undefined) {
      if (!name.trim()) return res.status(400).json({error: 'Name cannot be empty.'});
      user.name = name.trim();
    }
    if (phone !== undefined) user.phone = phone.trim();
    if (password) {
      if (!isValidPassword(password)) return res.status(400).json({error: 'Password must be at least 8 characters.'});
      user.salt = crypto.randomBytes(16).toString('hex');
      user.passHash = hashPassword(password, user.salt);
    }
    if (notifPrefs) user.notifPrefs = notifPrefs;
    if (typeof dailyGoalTarget === 'number' && dailyGoalTarget >= 1 && dailyGoalTarget <= 50) {
      user.dailyGoalTarget = Math.round(dailyGoalTarget);
    }
    if (bankAccount) {
      const inst = String(bankAccount.institutionNo || '').replace(/\D/g, '');
      const transit = String(bankAccount.transitNo || '').replace(/\D/g, '');
      const acct = String(bankAccount.accountNo || '').replace(/\D/g, '');
      if (!isValidCanadianBankDetails(inst, transit, acct) || !bankAccount.accountHolder?.trim()) {
        return res.status(400).json({error: 'Valid Canadian Institution (3 digits), Transit (5 digits), Account (7-12 digits), and Holder name required.'});
      }
      const linked: BankAccountSummary = {
        institutionName: String(bankAccount.institutionName || 'Canadian Bank').trim(),
        institutionNo: inst,
        transitNo: transit,
        accountLast4: acct.slice(-4),
        accountHolder: bankAccount.accountHolder.trim(),
      };
      user.bankAccount = linked;
      appendAudit(user.email, user.role, 'BANK_ACCOUNT_LINKED', user.email, `${linked.institutionName} ••••${linked.accountLast4}`);
    }
    appendAudit(user.email, user.role, 'PROFILE_UPDATED', user.email, 'Updated profile or preferences');
    saveStore(store);
    res.json({user: toPublicUser(user)});
  });

  app.post('/api/auth/notifications/read', (req, res) => {
    const user = requireAuth(req, res);
    if (!user) return;
    user.unread = 0;
    saveStore(store);
    res.json({user: toPublicUser(user)});
  });

  // --- Company-Only Driver Provisioning & Assignment (HQ Admin Only) ---
  app.post('/api/hq/provision-driver', (req, res) => {
    const admin = requireAuth(req, res);
    if (!admin) return;
    if (admin.role !== 'admin') {
      return res.status(403).json({error: 'Only Fleet HQ administrators can provision driver emails.'});
    }

    const {name, email, phone, password, assignedHub, assignedTier} = req.body as {
      name?: string;
      email?: string;
      phone?: string;
      password?: string;
      assignedHub?: HubKey;
      assignedTier?: TierKey;
    };

    const cleanEmail = String(email || '').trim().toLowerCase();
    if (!isValidCompanyDriverEmail(cleanEmail)) {
      return res.status(400).json({
        error: 'Driver email must use the company @hmktrading.ca domain (e.g. driver.name@hmktrading.ca).',
      });
    }
    if (!name?.trim() || !phone?.trim() || !password || !isValidPassword(password)) {
      return res.status(400).json({error: 'Driver name, phone, and 8+ character initial password are required.'});
    }
    if (store.users.some((u) => u.email === cleanEmail)) {
      return res.status(409).json({error: 'This @hmktrading.ca email is already issued.'});
    }

    const salt = crypto.randomBytes(16).toString('hex');
    const driverUser: StoredUser = {
      email: cleanEmail,
      name: name.trim(),
      phone: phone.trim(),
      role: 'driver',
      wallet: 0,
      earn: 0,
      online: true,
      assignedHub: assignedHub && HUBS[assignedHub] ? assignedHub : 'gta',
      assignedTier: assignedTier && TIERS[assignedTier] ? assignedTier : 'van',
      provisionedBy: admin.email,
      provisionedAt: new Date().toISOString(),
      unread: 1,
      notes: [
        {
          id: `NT-${Date.now()}`,
          text: `Welcome to HMK Fleet. Your corporate driver account was provisioned by ${admin.name}.`,
          at: new Date().toLocaleString('en-CA'),
          category: 'system',
        },
      ],
      notifPrefs: {...DEFAULT_NOTIF_PREFS},
      dailyGoalTarget: 4,
      salt,
      passHash: hashPassword(password, salt),
      passkeys: [],
    };
    store.users.push(driverUser);
    appendAudit(
      admin.email,
      'admin',
      'DRIVER_PROVISIONED',
      cleanEmail,
      `Issued @hmktrading.ca driver credentials for ${driverUser.name} (${driverUser.assignedHub?.toUpperCase()})`,
    );
    saveStore(store);

    res.json({driver: toPublicUser(driverUser)});
  });

  app.patch('/api/hq/drivers/:email', (req, res) => {
    const admin = requireAuth(req, res);
    if (!admin || admin.role !== 'admin') return res.status(403).json({error: 'Admin required.'});
    const target = store.users.find((u) => u.email === req.params.email.toLowerCase() && u.role === 'driver');
    if (!target) return res.status(404).json({error: 'Driver not found.'});
    const {assignedHub, assignedTier} = req.body as {assignedHub?: HubKey; assignedTier?: TierKey};
    if (assignedHub && HUBS[assignedHub]) target.assignedHub = assignedHub;
    if (assignedTier && TIERS[assignedTier]) target.assignedTier = assignedTier;
    appendAudit(admin.email, 'admin', 'DRIVER_UPDATED', target.email, `Hub=${target.assignedHub}, Tier=${target.assignedTier}`);
    saveStore(store);
    res.json({driver: toPublicUser(target)});
  });

  // --- Wallet, Card Gateway & Transactions ---
  app.get('/api/transactions', (req, res) => {
    const user = requireAuth(req, res);
    if (!user) return;
    const list =
      user.role === 'admin'
        ? store.transactions
        : store.transactions.filter((tx) => tx.userEmail === user.email);
    res.json({transactions: list});
  });

  app.post('/api/wallet/topup', (req, res) => {
    const user = requireAuth(req, res);
    if (!user) return;
    if (user.role !== 'customer') {
      return res.status(403).json({error: 'Wallet top-up is available for Customer accounts only.'});
    }
    const {amount, method, cardNumber, cardExpiry, postalCode, institutionNo, transitNo, accountNo} = req.body as {
      amount?: number;
      method?: 'Card' | 'Interac e-Transfer' | 'Bank Transfer (EFT)';
      cardNumber?: string;
      cardExpiry?: string;
      postalCode?: string;
      institutionNo?: string;
      transitNo?: string;
      accountNo?: string;
    };
    const amt = Number(amount);
    if (!(amt > 0 && amt <= 50000)) {
      return res.status(400).json({error: 'Enter a valid amount between $1 and $50,000 CAD.'});
    }
    if (postalCode && !isValidCanadianPostalCode(postalCode)) {
      return res.status(400).json({error: 'Enter a valid Canadian postal code (e.g. M5V 3L9).'});
    }
    let ref = `INT-${crypto.randomInt(100000, 999999)}`;
    if (method === 'Card') {
      if (!cardNumber || !validateLuhnCard(cardNumber)) {
        return res.status(400).json({error: 'Enter a valid payment card number.'});
      }
      if (cardExpiry && !isValidCardExpiry(cardExpiry)) {
        return res.status(400).json({error: 'Card expiry must be valid future MM/YY.'});
      }
      const brand = detectCardBrand(cardNumber);
      const last4 = cardNumber.replace(/\D/g, '').slice(-4) || '0000';
      ref = `${brand.toUpperCase()}-${last4}`;
    } else if (method === 'Bank Transfer (EFT)') {
      if (institutionNo && transitNo && accountNo) {
        if (!isValidCanadianBankDetails(institutionNo, transitNo, accountNo)) {
          return res.status(400).json({error: 'Enter valid Canadian Bank Institution (3), Transit (5), and Account (7-12) numbers.'});
        }
        ref = `EFT-${institutionNo.replace(/\D/g, '')}-${accountNo.replace(/\D/g, '').slice(-4)}`;
      } else if (user.bankAccount) {
        ref = `EFT-${user.bankAccount.institutionNo}-${user.bankAccount.accountLast4}`;
      } else {
        return res.status(400).json({error: 'Provide Canadian bank EFT details or link a bank account in Profile.'});
      }
    }
    user.wallet = +(user.wallet + amt).toFixed(2);
    const tx = recordTransaction(user.email, 'TOPUP', method || 'Card', amt, ref);
    pushUserNotification(user.email, `Wallet topped up by $${amt.toFixed(2)} CAD (${ref}).`, 'payout');
    appendAudit(user.email, user.role, 'WALLET_TOPUP', user.email, `Added $${amt.toFixed(2)} CAD (${ref})`);
    saveStore(store);
    res.json({user: toPublicUser(user), transaction: tx});
  });

  // --- Orders, Live Bids, Telemetry & Real-Time Dispatch ---
  app.get('/api/orders', (req, res) => {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
    const verified = token ? verifyToken(token) : null;
    if (!verified) {
      return res.json({orders: [], publicCount: store.orders.length});
    }
    const user = store.users.find((u) => u.email === verified.email && !u.ban);
    if (!user) return res.status(401).json({error: 'Session invalid.'});

    let visible: OrderRecord[];
    if (user.role === 'admin') {
      visible = store.orders;
    } else if (user.role === 'driver') {
      visible = store.orders.filter(
        (o) => o.driverEmail === user.email || (!o.driverEmail && o.status === 'Confirmed'),
      );
    } else {
      visible = store.orders.filter((o) => o.owner === user.email);
    }
    res.json({orders: visible});
  });

  app.get('/api/orders/track/:id', (req, res) => {
    const id = String(req.params.id || '').trim().toUpperCase().replace(/^#/, '');
    const order = store.orders.find((o) => o.id === id);
    if (!order) return res.status(404).json({error: 'Order ID not found.'});
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
    const verified = token ? verifyToken(token) : null;
    const isOwnerOrStaff =
      verified && (verified.role === 'admin' || verified.email === order.owner || verified.email === order.driverEmail);
    res.json({
      order: isOwnerOrStaff ? order : {...order, pin: '****', msgs: []},
    });
  });

  app.post('/api/orders', (req, res) => {
    const user = requireAuth(req, res);
    if (!user) return;
    if (user.role !== 'customer') {
      return res.status(403).json({
        error: 'Only registered Customer accounts can book deliveries. Drivers manage dispatch jobs in Driver Console.',
      });
    }
    const {
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
      offerAmount,
      promoCode,
      pm,
      cardNumber,
      cardExpiry,
      institutionNo,
      transitNo,
      accountNo,
      driverName,
      rn,
      rp,
      nt,
      when,
    } = req.body as {
      hubKey: HubKey;
      tierKey: TierKey;
      pk: string;
      dp: string;
      pa?: string;
      da?: string;
      pickupPostal?: string;
      dropoffPostal?: string;
      cargoCategory?: CargoCategory;
      weightKg?: number;
      pieces?: number;
      offerAmount: number;
      promoCode?: string;
      pm: PaymentMethod;
      cardNumber?: string;
      cardExpiry?: string;
      institutionNo?: string;
      transitNo?: string;
      accountNo?: string;
      driverName?: string;
      rn: string;
      rp: string;
      nt?: string;
      when?: string;
    };

    if (!HUBS[hubKey] || !TIERS[tierKey]) {
      return res.status(400).json({error: 'Invalid hub or fleet tier.'});
    }
    if (!rn?.trim() || String(rp || '').replace(/\D/g, '').length < 10) {
      return res.status(400).json({error: 'Valid recipient name and 10-digit phone required.'});
    }
    if ((pickupPostal && !isValidCanadianPostalCode(pickupPostal)) || (dropoffPostal && !isValidCanadianPostalCode(dropoffPostal))) {
      return res.status(400).json({error: 'Postal codes must match Canadian format (e.g. M5V 3L9).'});
    }
    if (pk === dp && (pa || '').trim().toLowerCase() === (da || '').trim().toLowerCase()) {
      return res.status(400).json({error: 'Pickup and drop-off locations cannot be identical.'});
    }

    const quote = calculateFareQuote(hubKey, offerAmount, promoCode || '');
    const orderId = `HMK-${crypto.randomInt(10000, 99999)}`;
    let ps = 'Payment pending';
    let paymentRef: string | undefined;

    if (pm === 'Wallet') {
      if (user.wallet < quote.total) {
        return res.status(400).json({error: `Wallet balance too low ($${user.wallet.toFixed(2)} CAD).`});
      }
      user.wallet = +(user.wallet - quote.total).toFixed(2);
      paymentRef = `WAL-${orderId}`;
      ps = 'Paid from wallet (escrow held)';
      recordTransaction(user.email, 'ESCROW_HOLD', 'HMK Wallet', -quote.total, paymentRef, orderId);
    } else if (pm === 'Card') {
      if (!cardNumber || !validateLuhnCard(cardNumber)) {
        return res.status(400).json({error: 'Enter a valid payment card number.'});
      }
      if (cardExpiry && !isValidCardExpiry(cardExpiry)) {
        return res.status(400).json({error: 'Card expiry must be valid future MM/YY.'});
      }
      const digits = cardNumber.replace(/\D/g, '');
      const brand = detectCardBrand(cardNumber);
      paymentRef = `${brand.toUpperCase()}-${digits.slice(-4)}`;
      ps = `Authorized ${paymentRef} (escrow held)`;
      recordTransaction(user.email, 'ESCROW_HOLD', brand, -quote.total, paymentRef, orderId);
    } else if (pm === 'Bank Transfer (EFT)') {
      if (institutionNo && transitNo && accountNo) {
        if (!isValidCanadianBankDetails(institutionNo, transitNo, accountNo)) {
          return res.status(400).json({error: 'Enter valid Canadian bank Institution (3), Transit (5), and Account (7-12) numbers.'});
        }
        paymentRef = `EFT-${institutionNo.replace(/\D/g, '')}-${accountNo.replace(/\D/g, '').slice(-4)}`;
      } else if (user.bankAccount) {
        paymentRef = `EFT-${user.bankAccount.institutionNo}-${user.bankAccount.accountLast4}`;
      } else {
        return res.status(400).json({error: 'Enter Canadian bank EFT details or link a bank account in Profile.'});
      }
      ps = `Bank EFT ${paymentRef} (escrow held)`;
      recordTransaction(user.email, 'ESCROW_HOLD', 'Bank EFT', -quote.total, paymentRef, orderId);
    } else if (pm === 'Interac e-Transfer') {
      paymentRef = `INT-${crypto.randomInt(100000, 999999)}`;
      ps = `Interac ref ${paymentRef}`;
    } else {
      ps = 'Collect on delivery';
    }

    const nowStr = new Date().toLocaleString('en-CA');
    const order: OrderRecord = {
      id: orderId,
      pin: String(crypto.randomInt(1000, 9999)),
      hubKey,
      tierKey,
      hub: quote.hub.label,
      tier: TIERS[tierKey].label,
      pk,
      dp,
      pa: (pa || '').trim(),
      da: (da || '').trim(),
      pickupPostal: (pickupPostal || '').trim().toUpperCase(),
      dropoffPostal: (dropoffPostal || '').trim().toUpperCase(),
      cargoCategory: cargoCategory || 'Parcels & Express',
      weightKg: Number(weightKg) || 50,
      pieces: Number(pieces) || 1,
      sub: quote.subtotal,
      disc: quote.discount,
      tax: quote.tax,
      total: quote.total,
      taxLabel: quote.hub.taxLabel,
      promoCode: quote.promoCode,
      pm,
      ps,
      paymentRef,
      status: 'Confirmed',
      telemetryStage: 'Awaiting Driver Dispatch',
      log: [{status: 'Order placed', at: nowStr, actor: user.email}],
      km: calculateDistanceKm(hubKey, pk, dp),
      driver: driverName || 'Awaiting Company Driver',
      rn: rn.trim(),
      rp: rp.trim(),
      nt: (nt || '').trim(),
      when: when || '',
      owner: user.email,
      at: nowStr,
      createdAtIso: new Date().toISOString(),
      rev: '',
      rate: 5,
      dis: '',
      bids: [],
      msgs: [],
      progressPct: 12,
    };

    store.orders.unshift(order);
    pushUserNotification(user.email, `Order ${order.id} booked. Escrow PIN: ${order.pin}`, 'order');
    appendAudit(user.email, user.role, 'ORDER_CREATED', order.id, `$${order.total.toFixed(2)} CAD (${order.hub})`);
    saveStore(store);

    broadcastEvent(
      'order:created',
      order,
      (c) => c.role === 'admin' || c.role === 'driver' || c.email === user.email,
    );
    res.json({order, user: toPublicUser(user)});
  });

  // Live Company Driver Counter-Bid on open Confirmed orders
  app.post('/api/orders/:id/bid', (req, res) => {
    const driver = requireAuth(req, res);
    if (!driver || driver.role !== 'driver') {
      return res.status(403).json({error: 'Only company drivers can submit live bids.'});
    }
    const order = store.orders.find((o) => o.id === req.params.id);
    if (!order || order.status !== 'Confirmed') {
      return res.status(400).json({error: 'Order is no longer open for bidding.'});
    }
    const {amount, etaMins, note} = req.body as {amount?: number; etaMins?: number; note?: string};
    const bidAmt = Number(amount);
    if (!(bidAmt >= 25 && bidAmt <= 2000)) {
      return res.status(400).json({error: 'Bid amount must be between $25 and $2,000 CAD.'});
    }
    const bid = {
      id: `BID-${Date.now().toString(36)}`,
      driverEmail: driver.email,
      driverName: driver.name,
      amount: +bidAmt.toFixed(2),
      etaMins: Math.max(3, Math.min(180, Math.round(Number(etaMins) || 12))),
      note: String(note || '').trim().slice(0, 140),
      createdAt: new Date().toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'}),
    };
    order.bids = [...(order.bids || []).filter((b) => b.driverEmail !== driver.email), bid];
    pushUserNotification(order.owner, `New driver bid of $${bid.amount.toFixed(2)} CAD from ${driver.name} on ${order.id}`, 'bid');
    appendAudit(driver.email, 'driver', 'DRIVER_BID_SUBMITTED', order.id, `$${bid.amount.toFixed(2)} CAD · ETA ${bid.etaMins}m`);
    saveStore(store);

    broadcastEvent(
      'order:updated',
      order,
      (c) => c.role === 'admin' || c.email === order.owner || c.role === 'driver',
    );
    res.json({order});
  });

  app.post('/api/orders/:id/accept-bid', (req, res) => {
    const customer = requireAuth(req, res);
    if (!customer) return;
    if (customer.role !== 'customer') {
      return res.status(403).json({error: 'Only the ordering Customer can accept a driver counter-bid.'});
    }
    const order = store.orders.find((o) => o.id === req.params.id);
    if (!order || order.owner !== customer.email) {
      return res.status(403).json({error: 'Not authorized to accept bids on this order.'});
    }
    if (order.status !== 'Confirmed') {
      return res.status(400).json({error: 'Order already assigned.'});
    }
    const {bidId} = req.body as {bidId?: string};
    const bid = (order.bids || []).find((b) => b.id === bidId);
    if (!bid) return res.status(404).json({error: 'Bid not found.'});

    order.driver = bid.driverName;
    order.driverEmail = bid.driverEmail;
    order.status = 'Driver Assigned';
    order.progressPct = 40;
    order.telemetryStage = `En route to pickup (${bid.etaMins}m ETA)`;
    order.log.push({status: `Accepted bid from ${bid.driverName}`, at: new Date().toLocaleString('en-CA'), actor: customer.email});

    pushUserNotification(bid.driverEmail, `Your bid on ${order.id} was accepted by ${customer.name}.`, 'bid');
    appendAudit(customer.email, customer.role, 'BID_ACCEPTED', order.id, `${bid.driverEmail} ($${bid.amount.toFixed(2)})`);
    saveStore(store);

    broadcastEvent('order:updated', order);
    res.json({order});
  });

  app.post('/api/orders/:id/telemetry', (req, res) => {
    const driver = requireAuth(req, res);
    if (!driver || driver.role !== 'driver') return res.status(403).json({error: 'Driver account required.'});
    const order = store.orders.find((o) => o.id === req.params.id);
    if (!order || order.driverEmail !== driver.email) {
      return res.status(403).json({error: 'Only the assigned driver can update route telemetry.'});
    }
    const {progressPct, telemetryStage} = req.body as {progressPct?: number; telemetryStage?: string};
    if (typeof progressPct === 'number') {
      order.progressPct = Math.min(98, Math.max(15, Math.round(progressPct)));
    }
    if (telemetryStage?.trim()) {
      order.telemetryStage = telemetryStage.trim().slice(0, 80);
      order.log.push({status: `GPS: ${order.telemetryStage}`, at: new Date().toLocaleString('en-CA'), actor: driver.email});
    }
    saveStore(store);
    broadcastEvent('order:updated', order);
    res.json({order});
  });

  app.post('/api/orders/:id/status', (req, res) => {
    const user = requireAuth(req, res);
    if (!user) return;
    const order = store.orders.find((o) => o.id === req.params.id);
    if (!order) return res.status(404).json({error: 'Order not found.'});

    const {status} = req.body as {status?: OrderStatus};
    if (!status) return res.status(400).json({error: 'Status required.'});

    if (user.role === 'driver') {
      if (order.status === 'Cancelled') return res.status(400).json({error: 'Order was cancelled.'});
      if (order.driverEmail && order.driverEmail !== user.email) {
        return res.status(403).json({error: 'This job belongs to another driver.'});
      }
      if (status === 'Delivered') {
        return res.status(400).json({error: 'Deliveries must be verified with customer 4-digit PIN.'});
      }
      order.driverEmail = user.email;
      order.driver = user.name;
    } else if (user.role !== 'admin') {
      return res.status(403).json({error: 'Insufficient permissions.'});
    }

    order.status = status;
    order.progressPct = status === 'Confirmed' ? 12 : status === 'Driver Assigned' ? 40 : status === 'In Transit' ? 76 : 100;
    order.telemetryStage =
      status === 'Driver Assigned'
        ? 'Heading to pickup hub'
        : status === 'In Transit'
          ? 'In Transit to drop-off'
          : status === 'Delivered'
            ? 'Delivered'
            : order.telemetryStage;
    order.log.push({status, at: new Date().toLocaleString('en-CA'), actor: user.email});
    if (status === 'Delivered' && order.pm !== 'Cash on Delivery') {
      order.ps = 'Settled (escrow released)';
    }

    pushUserNotification(order.owner, `Order ${order.id} status: ${status}`, 'order');
    appendAudit(user.email, user.role, 'ORDER_STATUS', order.id, `Transitioned to ${status}`);
    saveStore(store);

    broadcastEvent(
      'order:updated',
      order,
      (c) => c.role === 'admin' || c.email === order.owner || c.email === order.driverEmail,
    );
    res.json({order});
  });

  app.post('/api/orders/:id/finish', (req, res) => {
    const user = requireAuth(req, res);
    if (!user) return;
    if (user.role !== 'driver') {
      return res.status(403).json({error: 'Only the assigned driver can verify PIN & deliver.'});
    }
    const order = store.orders.find((o) => o.id === req.params.id);
    if (!order || order.status === 'Cancelled') {
      return res.status(404).json({error: 'Order not available.'});
    }
    if (order.driverEmail !== user.email) {
      return res.status(403).json({error: 'Only the assigned driver can complete this job.'});
    }
    const {pin, pod, signature} = req.body as {pin?: string; pod?: string; signature?: string};
    if (String(pin || '').trim() !== order.pin) {
      return res.status(400).json({error: 'Wrong 4-digit customer PIN.'});
    }
    if (pod && /^data:image\//.test(pod)) {
      order.pod = pod;
    }
    if (signature && /^data:image\/png;base64,/.test(signature)) {
      order.signature = signature;
    }
    order.status = 'Delivered';
    order.progressPct = 100;
    order.telemetryStage = 'Delivered & PIN Verified';
    if (order.pm !== 'Cash on Delivery') order.ps = 'Settled (escrow released)';
    order.log.push({status: 'Delivered (PIN verified)', at: new Date().toLocaleString('en-CA'), actor: user.email});

    const payoutAmount = +(order.sub - order.disc).toFixed(2);
    user.earn = +(user.earn + payoutAmount).toFixed(2);
    recordTransaction(user.email, 'DRIVER_EARN', 'Escrow Release', payoutAmount, `PIN-${order.id}`, order.id);
    pushUserNotification(order.owner, `Order ${order.id} delivered and PIN verified.`, 'order');
    pushUserNotification(user.email, `Earned $${payoutAmount.toFixed(2)} CAD from ${order.id}.`, 'payout');
    appendAudit(user.email, 'driver', 'ORDER_DELIVERED_PIN', order.id, `PIN verified, credited $${payoutAmount.toFixed(2)}`);
    saveStore(store);

    broadcastEvent(
      'order:updated',
      order,
      (c) => c.role === 'admin' || c.email === order.owner || c.email === user.email,
    );
    res.json({order, user: toPublicUser(user)});
  });

  app.post('/api/orders/:id/cancel', (req, res) => {
    const user = requireAuth(req, res);
    if (!user) return;
    const order = store.orders.find((o) => o.id === req.params.id);
    if (!order) return res.status(404).json({error: 'Order not found.'});
    if (user.role !== 'admin' && order.owner !== user.email) {
      return res.status(403).json({error: 'Not authorized to cancel this order.'});
    }
    if (!['Confirmed', 'Driver Assigned'].includes(order.status)) {
      return res.status(400).json({error: 'In-transit or delivered orders cannot be cancelled.'});
    }
    const ownerUser = store.users.find((u) => u.email === order.owner);
    if (order.pm === 'Wallet' && ownerUser) {
      ownerUser.wallet = +(ownerUser.wallet + order.total).toFixed(2);
      order.ps = 'Refunded to wallet';
      recordTransaction(ownerUser.email, 'REFUND', 'HMK Wallet', order.total, `REF-${order.id}`, order.id);
    } else {
      order.ps = 'Cancelled (no charge)';
    }
    order.status = 'Cancelled';
    order.progressPct = 0;
    order.log.push({status: 'Cancelled', at: new Date().toLocaleString('en-CA'), actor: user.email});
    pushUserNotification(order.owner, `Order ${order.id} cancelled.`, 'order');
    appendAudit(user.email, user.role, 'ORDER_CANCELLED', order.id, order.ps);
    saveStore(store);

    broadcastEvent('order:updated', order);
    res.json({order, user: toPublicUser(user)});
  });

  app.post('/api/orders/:id/chat', (req, res) => {
    const user = requireAuth(req, res);
    if (!user) return;
    const order = store.orders.find((o) => o.id === req.params.id);
    if (!order) return res.status(404).json({error: 'Order not found.'});
    if (user.role !== 'admin' && order.owner !== user.email && order.driverEmail !== user.email) {
      return res.status(403).json({error: 'Not a participant on this order.'});
    }
    const text = String((req.body as {text?: string}).text || '').trim().slice(0, 300);
    if (!text) return res.status(400).json({error: 'Message cannot be empty.'});
    const msg = {
      id: `MSG-${Date.now().toString(36)}`,
      senderName: user.name,
      senderRole: user.role,
      text,
      at: new Date().toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'}),
    };
    order.msgs = [...(order.msgs || []), msg].slice(-50);
    [order.owner, order.driverEmail]
      .filter((e): e is string => Boolean(e && e !== user.email))
      .forEach((e) => pushUserNotification(e, `New message on ${order.id} from ${user.name}`, 'chat'));
    saveStore(store);

    broadcastEvent(
      'chat:message',
      {orderId: order.id, message: msg, order},
      (c) => c.role === 'admin' || c.email === order.owner || c.email === order.driverEmail,
    );
    res.json({order});
  });

  app.post('/api/orders/:id/review', (req, res) => {
    const user = requireAuth(req, res);
    if (!user) return;
    const order = store.orders.find((o) => o.id === req.params.id);
    if (!order || order.owner !== user.email) {
      return res.status(403).json({error: 'Only the order customer can submit a review.'});
    }
    const {rate, rev} = req.body as {rate?: number; rev?: string};
    order.rate = Math.min(5, Math.max(1, Number(rate) || 5));
    order.rated = true;
    order.rev = String(rev || '').trim();
    saveStore(store);
    res.json({order});
  });

  app.post('/api/orders/:id/tip', (req, res) => {
    const user = requireAuth(req, res);
    if (!user) return;
    const order = store.orders.find((o) => o.id === req.params.id);
    if (!order || order.owner !== user.email || order.status !== 'Delivered' || order.tip) {
      return res.status(400).json({error: 'Tip unavailable for this order.'});
    }
    const amount = Number((req.body as {amount?: number}).amount);
    if (!(amount > 0 && amount <= 500)) return res.status(400).json({error: 'Invalid tip amount.'});
    if (user.wallet < amount) return res.status(400).json({error: 'Wallet balance too low.'});
    const driver = store.users.find((u) => u.email === order.driverEmail);
    if (!driver) return res.status(404).json({error: 'Assigned driver account not found.'});

    user.wallet = +(user.wallet - amount).toFixed(2);
    driver.earn = +(driver.earn + amount).toFixed(2);
    order.tip = amount;
    recordTransaction(user.email, 'TIP', 'HMK Wallet', -amount, `TIP-${order.id}`, order.id);
    recordTransaction(driver.email, 'TIP', 'Customer Tip', amount, `TIP-${order.id}`, order.id);
    pushUserNotification(driver.email, `Received $${amount.toFixed(2)} CAD tip on ${order.id}.`, 'payout');
    appendAudit(user.email, user.role, 'DRIVER_TIPPED', order.id, `$${amount.toFixed(2)} CAD`);
    saveStore(store);
    res.json({order, user: toPublicUser(user)});
  });

  app.post('/api/orders/:id/dispute', (req, res) => {
    const user = requireAuth(req, res);
    if (!user) return;
    const order = store.orders.find((o) => o.id === req.params.id);
    if (!order || order.owner !== user.email) return res.status(403).json({error: 'Not authorized.'});
    const reason = String((req.body as {reason?: string}).reason || '').trim();
    if (!reason) return res.status(400).json({error: 'Describe the issue first.'});
    order.dis = reason;
    appendAudit(user.email, user.role, 'DISPUTE_OPENED', order.id, reason);
    saveStore(store);
    broadcastEvent('order:updated', order);
    res.json({order});
  });

  app.post('/api/orders/:id/resolve', (req, res) => {
    const admin = requireAuth(req, res);
    if (!admin || admin.role !== 'admin') return res.status(403).json({error: 'Admin required.'});
    const order = store.orders.find((o) => o.id === req.params.id);
    if (!order) return res.status(404).json({error: 'Order not found.'});
    order.dis = '';
    order.log.push({status: 'Issue resolved by HQ', at: new Date().toLocaleString('en-CA'), actor: admin.email});
    appendAudit(admin.email, 'admin', 'DISPUTE_RESOLVED', order.id, 'Resolved by Fleet HQ');
    saveStore(store);
    broadcastEvent('order:updated', order);
    res.json({order});
  });

  // --- Driver Duty & Payout ---
  app.post('/api/driver/duty', (req, res) => {
    const driver = requireAuth(req, res);
    if (!driver || driver.role !== 'driver') return res.status(403).json({error: 'Driver account required.'});
    driver.online = !driver.online;
    appendAudit(driver.email, 'driver', 'DRIVER_DUTY', driver.email, driver.online ? 'Went ONLINE' : 'Went OFFLINE');
    saveStore(store);
    broadcastEvent('driver:presence', {email: driver.email, online: driver.online});
    res.json({user: toPublicUser(driver)});
  });

  app.post('/api/driver/payout', (req, res) => {
    const driver = requireAuth(req, res);
    if (!driver || driver.role !== 'driver') return res.status(403).json({error: 'Driver account required.'});
    if (driver.earn <= 0) return res.status(400).json({error: 'No earnings available for payout.'});
    const {method} = (req.body || {}) as {method?: 'Interac e-Transfer' | 'Bank Direct Deposit (EFT)'};
    const payoutMethod = method === 'Bank Direct Deposit (EFT)' ? 'Bank Direct Deposit (EFT)' : 'Interac e-Transfer';
    if (payoutMethod === 'Bank Direct Deposit (EFT)' && !driver.bankAccount) {
      return res.status(400).json({error: 'Link your Canadian Bank Account in Profile before requesting Bank EFT payout.'});
    }
    const paid = driver.earn;
    driver.earn = 0;
    const ref =
      payoutMethod === 'Bank Direct Deposit (EFT)' && driver.bankAccount
        ? `EFT-${driver.bankAccount.institutionNo}-${driver.bankAccount.accountLast4}`
        : `INT-PAY-${crypto.randomInt(10000, 99999)}`;
    recordTransaction(driver.email, 'PAYOUT', payoutMethod, paid, ref);
    pushUserNotification(driver.email, `${payoutMethod} payout of $${paid.toFixed(2)} CAD processed (${ref}).`, 'payout');
    appendAudit(driver.email, 'driver', 'DRIVER_PAYOUT', driver.email, `${payoutMethod} $${paid.toFixed(2)} CAD (${ref})`);
    saveStore(store);
    res.json({paid, ref, method: payoutMethod, user: toPublicUser(driver)});
  });

  // --- Fleet HQ Users, Audit, Backup & Restore ---
  app.get('/api/hq/overview', (req, res) => {
    const admin = requireAuth(req, res);
    if (!admin || admin.role !== 'admin') return res.status(403).json({error: 'Fleet HQ privileges required.'});
    res.json({
      users: store.users.map(toPublicUser),
      audit: store.audit,
    });
  });

  app.post('/api/hq/users/:email/ban', (req, res) => {
    const admin = requireAuth(req, res);
    if (!admin || admin.role !== 'admin') return res.status(403).json({error: 'Fleet HQ privileges required.'});
    const target = store.users.find((u) => u.email === req.params.email.toLowerCase());
    if (!target) return res.status(404).json({error: 'User not found.'});
    if (target.email === admin.email) return res.status(400).json({error: 'Cannot suspend yourself.'});
    target.ban = !target.ban;
    appendAudit(admin.email, 'admin', target.ban ? 'USER_SUSPENDED' : 'USER_REACTIVATED', target.email, `Role: ${target.role}`);
    saveStore(store);
    res.json({user: toPublicUser(target)});
  });

  app.get('/api/hq/backup', (req, res) => {
    const admin = requireAuth(req, res);
    if (!admin || admin.role !== 'admin') return res.status(403).json({error: 'Fleet HQ privileges required.'});
    appendAudit(admin.email, 'admin', 'BACKUP_EXPORTED', 'HMK Store', 'Exported full fleet snapshot');
    saveStore(store);
    res.json({
      exportedAt: new Date().toISOString(),
      orders: store.orders,
      users: store.users.map(toPublicUser),
      audit: store.audit,
      transactions: store.transactions,
    });
  });

  app.post('/api/hq/restore', (req, res) => {
    const admin = requireAuth(req, res);
    if (!admin || admin.role !== 'admin') return res.status(403).json({error: 'Fleet HQ privileges required.'});
    const {orders, audit, transactions} = req.body as {
      orders?: OrderRecord[];
      audit?: AuditEntry[];
      transactions?: TransactionRecord[];
    };
    if (!Array.isArray(orders) || orders.some((o) => typeof o?.id !== 'string')) {
      return res.status(400).json({error: 'Invalid backup payload: orders array missing or malformed.'});
    }
    store = {
      users: store.users,
      orders,
      audit: Array.isArray(audit) ? audit : store.audit,
      transactions: Array.isArray(transactions) ? transactions : store.transactions,
    };
    appendAudit(admin.email, 'admin', 'BACKUP_RESTORED', 'HMK Store', `Restored ${orders.length} orders from backup`);
    saveStore(store);
    res.json({orders: store.orders, audit: store.audit});
  });

  if (process.env.NODE_ENV === 'production') {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: {middlewareMode: true},
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`HMK Trading server running on http://localhost:${PORT}`);
  });
}

startServer();
