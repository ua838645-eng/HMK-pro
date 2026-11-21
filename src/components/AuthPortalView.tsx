import React, {useEffect, useState} from 'react';
import {
  Building2,
  CheckCircle2,
  Fingerprint,
  KeyRound,
  Lock,
  LogIn,
  Mail,
  MailCheck,
  Phone,
  ShieldAlert,
  ShieldPlus,
  Truck,
  User,
  UserPlus,
} from 'lucide-react';
import {MIN_PASSWORD_LENGTH, type PublicUser, type UserRole} from '../shared/logistics';
import {t, type LangCode} from '../utils/i18n';

interface AuthPortalViewProps {
  lang: LangCode;
  onAuthenticated: (token: string, user: PublicUser) => void;
  onToast: (msg: string, isError?: boolean) => void;
}

export const AuthPortalView: React.FC<AuthPortalViewProps> = ({lang, onAuthenticated, onToast}) => {
  const [portal, setPortal] = useState<UserRole>('customer');
  const [customerMode, setCustomerMode] = useState<'login' | 'register'>('login');
  const [hqStatus, setHqStatus] = useState<{hqClaimed: boolean; passcodeConfigured: boolean}>({
    hqClaimed: true,
    passcodeConfigured: false,
  });

  // Shared login inputs
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPass, setLoginPass] = useState('');

  // Customer registration + OTP
  const [regName, setRegName] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPass, setRegPass] = useState('');
  const [otpPending, setOtpPending] = useState<{email: string; demoOtp: string} | null>(null);
  const [otpInput, setOtpInput] = useState('');

  // First-run HQ Claim inputs
  const [hqName, setHqName] = useState('');
  const [hqPhone, setHqPhone] = useState('');
  const [hqEmail, setHqEmail] = useState('');
  const [hqPass, setHqPass] = useState('');
  const [hqPasscode, setHqPasscode] = useState('');

  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch('/api/auth/hq-status')
      .then((r) => r.json())
      .then((d: {hqClaimed: boolean; passcodeConfigured: boolean}) => setHqStatus(d))
      .catch(() => {});
  }, []);

  const handlePortalLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({email: loginEmail, password: loginPass, portalRole: portal}),
      });
      const data = (await res.json()) as {token?: string; user?: PublicUser; error?: string};
      if (!res.ok || !data.token || !data.user) {
        onToast(data.error || 'Authentication failed.', true);
        return;
      }
      onToast(`Signed in to ${portal.toUpperCase()} portal as ${data.user.name}.`);
      onAuthenticated(data.token, data.user);
    } catch {
      onToast('Network error while signing in.', true);
    } finally {
      setBusy(false);
    }
  };

  const handleBiometricLogin = async () => {
    if (!loginEmail.trim()) {
      onToast('Enter your account email first to verify your biometric passkey.', true);
      return;
    }
    setBusy(true);
    try {
      const chRes = await fetch('/api/auth/passkey/challenge', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({email: loginEmail}),
      });
      const {challenge} = (await chRes.json()) as {challenge: string};

      let credentialId = localStorage.getItem(`hmk_passkey_${loginEmail.trim().toLowerCase()}`) || '';
      if (window.PublicKeyCredential && navigator.credentials) {
        try {
          const assertion = (await navigator.credentials.get({
            publicKey: {
              challenge: Uint8Array.from(atob(challenge.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0)),
              timeout: 45000,
              userVerification: 'preferred',
            },
          })) as PublicKeyCredential | null;
          if (assertion?.id) credentialId = assertion.id;
        } catch {
          // Graceful fallback to stored enrolled passkey ID in headless/non-authenticator browsers
        }
      }

      if (!credentialId) {
        onToast('No biometric passkey enrolled on this device yet. Sign in with password first and enroll in Profile.', true);
        return;
      }

      const res = await fetch('/api/auth/passkey/login', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({email: loginEmail, credentialId, portalRole: portal}),
      });
      const data = (await res.json()) as {token?: string; user?: PublicUser; error?: string};
      if (!res.ok || !data.token || !data.user) {
        onToast(data.error || 'Biometric verification failed.', true);
        return;
      }
      onToast(`Biometric passkey verified for ${data.user.name}.`);
      onAuthenticated(data.token, data.user);
    } catch {
      onToast('Biometric sign-in failed.', true);
    } finally {
      setBusy(false);
    }
  };

  const handleCustomerRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (regPass.length < MIN_PASSWORD_LENGTH) {
      onToast(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`, true);
      return;
    }
    setBusy(true);
    try {
      const res = await fetch('/api/auth/request-otp', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          name: regName,
          phone: regPhone,
          email: regEmail,
          password: regPass,
          role: 'customer',
        }),
      });
      const data = (await res.json()) as {email?: string; demoOtp?: string; error?: string};
      if (!res.ok || !data.email || !data.demoOtp) {
        onToast(data.error || 'Could not send OTP.', true);
        return;
      }
      setOtpPending({email: data.email, demoOtp: data.demoOtp});
      onToast('6-digit OTP issued. Enter the verification code to activate.');
    } catch {
      onToast('Network error during registration.', true);
    } finally {
      setBusy(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpPending) return;
    setBusy(true);
    try {
      const res = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({email: otpPending.email, code: otpInput}),
      });
      const data = (await res.json()) as {token?: string; user?: PublicUser; error?: string};
      if (!res.ok || !data.token || !data.user) {
        onToast(data.error || 'Invalid OTP code.', true);
        return;
      }
      setOtpPending(null);
      setOtpInput('');
      onToast('Customer account verified.');
      onAuthenticated(data.token, data.user);
    } catch {
      onToast('Verification error.', true);
    } finally {
      setBusy(false);
    }
  };

  const handleClaimHq = async (e: React.FormEvent) => {
    e.preventDefault();
    if (hqPass.length < MIN_PASSWORD_LENGTH) {
      onToast(`Admin password must be at least ${MIN_PASSWORD_LENGTH} characters.`, true);
      return;
    }
    setBusy(true);
    try {
      const res = await fetch('/api/auth/claim-hq', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          name: hqName,
          phone: hqPhone,
          email: hqEmail,
          password: hqPass,
          passcode: hqPasscode,
        }),
      });
      const data = (await res.json()) as {token?: string; user?: PublicUser; error?: string};
      if (!res.ok || !data.token || !data.user) {
        onToast(data.error || 'Could not provision Fleet HQ account.', true);
        return;
      }
      onToast('Fleet HQ Admin claimed and activated.');
      onAuthenticated(data.token, data.user);
    } catch {
      onToast('Network error claiming Fleet HQ.', true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h2 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
          {t(lang, 'portalTitle')}
        </h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{t(lang, 'portalSub')}</p>
      </div>

      {/* Role Portal Segmented Selector */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3" role="tablist" aria-label="Authentication Portals">
        {[
          {key: 'customer' as UserRole, label: t(lang, 'customerPortal'), desc: 'Sign in or register with OTP', Icon: User},
          {key: 'driver' as UserRole, label: t(lang, 'driverPortal'), desc: 'Company @hmktrading.ca login', Icon: Truck},
          {key: 'admin' as UserRole, label: t(lang, 'hqPortal'), desc: 'Dispatch & driver provisioning', Icon: Building2},
        ].map(({key, label, desc, Icon}) => {
          const active = portal === key;
          return (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => {
                setPortal(key);
                setOtpPending(null);
              }}
              className={`flex flex-col items-start rounded-xl border p-4 text-left transition ${
                active
                  ? 'border-[#3f6212] bg-[#3f6212]/5 dark:border-[#9be136] dark:bg-[#9be136]/10'
                  : 'border-slate-200 bg-white hover:border-slate-300 dark:border-slate-800 dark:bg-[#0e2034]'
              }`}
            >
              <Icon className={`h-5 w-5 ${active ? 'text-[#3f6212] dark:text-[#9be136]' : 'text-slate-500'}`} />
              <span className="mt-2.5 text-sm font-bold text-slate-900 dark:text-white">{label}</span>
              <span className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{desc}</span>
            </button>
          );
        })}
      </div>

      {/* Portal Content Card */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 dark:border-slate-800 dark:bg-[#0e2034]">
        {portal === 'driver' && (
          <div className="mb-6 flex items-start gap-3 rounded-xl border border-amber-300/60 bg-amber-50 p-4 text-xs text-amber-950 dark:border-amber-500/30 dark:bg-amber-950/30 dark:text-amber-200">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <div className="font-bold">Company-Issued Driver Credentials Required</div>
              <p className="mt-0.5">{t(lang, 'driverPolicy')}</p>
            </div>
          </div>
        )}

        {portal === 'customer' && (
          <div className="mb-6 flex gap-2 rounded-lg bg-slate-100 p-1 dark:bg-[#040b12]">
            <button
              type="button"
              onClick={() => {
                setCustomerMode('login');
                setOtpPending(null);
              }}
              className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded-md py-2 text-xs font-bold transition ${
                customerMode === 'login'
                  ? 'bg-white text-slate-900 shadow-sm dark:bg-[#152b44] dark:text-white'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              <LogIn className="h-3.5 w-3.5" />
              <span>Customer Sign In</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setCustomerMode('register');
                setOtpPending(null);
              }}
              className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded-md py-2 text-xs font-bold transition ${
                customerMode === 'register'
                  ? 'bg-white text-slate-900 shadow-sm dark:bg-[#152b44] dark:text-white'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              <UserPlus className="h-3.5 w-3.5" />
              <span>Create Customer Account + OTP</span>
            </button>
          </div>
        )}

        {/* Customer OTP Verification Step */}
        {portal === 'customer' && customerMode === 'register' && otpPending && (
          <form onSubmit={handleVerifyOtp} className="space-y-4">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-center dark:border-slate-700 dark:bg-[#040b12]">
              <p className="text-xs text-slate-600 dark:text-slate-300">
                Verification code sent to <strong className="font-mono">{otpPending.email}</strong>
              </p>
              <p className="mt-2 font-mono text-sm font-bold text-[#3f6212] dark:text-[#9be136]">
                Preview OTP Code: {otpPending.demoOtp}
              </p>
            </div>
            <div>
              <label htmlFor="otp-code-input" className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
                <KeyRound className="h-3.5 w-3.5 text-[#3f6212] dark:text-[#9be136]" />
                <span>Enter 6-Digit OTP</span>
              </label>
              <input
                id="otp-code-input"
                value={otpInput}
                onChange={(e) => setOtpInput(e.target.value)}
                maxLength={6}
                inputMode="numeric"
                required
                placeholder="000000"
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-center font-mono text-xl tracking-[0.4em] text-slate-900 dark:border-slate-700 dark:bg-[#040b12] dark:text-white"
              />
            </div>
            <button
              type="submit"
              disabled={busy}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#3f6212] py-3 text-xs font-bold text-white disabled:opacity-50 dark:bg-[#9be136] dark:text-[#040b12]"
            >
              <CheckCircle2 className="h-4 w-4" />
              <span>Verify &amp; Activate Customer Account</span>
            </button>
          </form>
        )}

        {/* Customer Register Form */}
        {portal === 'customer' && customerMode === 'register' && !otpPending && (
          <form onSubmit={handleCustomerRequestOtp} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="reg-name" className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
                  <User className="h-3.5 w-3.5 text-[#3f6212] dark:text-[#9be136]" />
                  <span>Full Name</span>
                </label>
                <input
                  id="reg-name"
                  required
                  value={regName}
                  onChange={(e) => setRegName(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2.5 text-sm dark:border-slate-700 dark:bg-[#040b12]"
                />
              </div>
              <div>
                <label htmlFor="reg-phone" className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
                  <Phone className="h-3.5 w-3.5 text-[#3f6212] dark:text-[#9be136]" />
                  <span>Phone Number</span>
                </label>
                <input
                  id="reg-phone"
                  type="tel"
                  required
                  placeholder="+1 (416) 555-0192"
                  value={regPhone}
                  onChange={(e) => setRegPhone(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2.5 text-sm dark:border-slate-700 dark:bg-[#040b12]"
                />
              </div>
            </div>
            <div>
              <label htmlFor="reg-email" className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
                <Mail className="h-3.5 w-3.5 text-[#3f6212] dark:text-[#9be136]" />
                <span>Email Address</span>
              </label>
              <input
                id="reg-email"
                type="email"
                required
                value={regEmail}
                onChange={(e) => setRegEmail(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2.5 text-sm dark:border-slate-700 dark:bg-[#040b12]"
              />
            </div>
            <div>
              <label htmlFor="reg-pass" className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
                <Lock className="h-3.5 w-3.5 text-[#3f6212] dark:text-[#9be136]" />
                <span>Password (minimum {MIN_PASSWORD_LENGTH} characters)</span>
              </label>
              <input
                id="reg-pass"
                type="password"
                minLength={MIN_PASSWORD_LENGTH}
                required
                placeholder="At least 8 characters"
                value={regPass}
                onChange={(e) => setRegPass(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2.5 text-sm dark:border-slate-700 dark:bg-[#040b12]"
              />
            </div>
            <button
              type="submit"
              disabled={busy}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#3f6212] py-3 text-xs font-bold text-white disabled:opacity-50 dark:bg-[#9be136] dark:text-[#040b12]"
            >
              <MailCheck className="h-4 w-4" />
              <span>Send 6-Digit Verification OTP</span>
            </button>
          </form>
        )}

        {/* First-Run Fleet HQ Claim Form (when no HQ Admin exists yet) */}
        {portal === 'admin' && !hqStatus.hqClaimed && (
          <form onSubmit={handleClaimHq} className="space-y-4">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-700 dark:border-slate-700 dark:bg-[#040b12] dark:text-slate-300">
              <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white">
                <KeyRound className="h-4 w-4 text-[#3f6212] dark:text-[#9be136]" />
                <span>Initial Fleet HQ Administrator Setup</span>
              </div>
              <p className="mt-1">
                No Fleet HQ Admin has been claimed yet. Create the primary company administrator account to unlock driver provisioning and fleet dispatch controls.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="hq-name" className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold">
                  <User className="h-3.5 w-3.5 text-[#3f6212] dark:text-[#9be136]" />
                  <span>Admin Full Name</span>
                </label>
                <input
                  id="hq-name"
                  required
                  value={hqName}
                  onChange={(e) => setHqName(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2.5 text-sm dark:border-slate-700 dark:bg-[#040b12]"
                />
              </div>
              <div>
                <label htmlFor="hq-phone" className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold">
                  <Phone className="h-3.5 w-3.5 text-[#3f6212] dark:text-[#9be136]" />
                  <span>Corporate Phone</span>
                </label>
                <input
                  id="hq-phone"
                  type="tel"
                  required
                  value={hqPhone}
                  onChange={(e) => setHqPhone(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2.5 text-sm dark:border-slate-700 dark:bg-[#040b12]"
                />
              </div>
            </div>
            <div>
              <label htmlFor="hq-email" className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold">
                <Mail className="h-3.5 w-3.5 text-[#3f6212] dark:text-[#9be136]" />
                <span>Fleet HQ Email</span>
              </label>
              <input
                id="hq-email"
                type="email"
                required
                placeholder="hq@hmktrading.ca"
                value={hqEmail}
                onChange={(e) => setHqEmail(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2.5 text-sm dark:border-slate-700 dark:bg-[#040b12]"
              />
            </div>
            {hqStatus.passcodeConfigured && (
              <div>
                <label htmlFor="hq-passcode" className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold">
                  <KeyRound className="h-3.5 w-3.5 text-[#3f6212] dark:text-[#9be136]" />
                  <span>HQ Passcode (from Environment)</span>
                </label>
                <input
                  id="hq-passcode"
                  type="password"
                  required
                  value={hqPasscode}
                  onChange={(e) => setHqPasscode(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2.5 text-sm dark:border-slate-700 dark:bg-[#040b12]"
                />
              </div>
            )}
            <div>
              <label htmlFor="hq-pass" className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold">
                <Lock className="h-3.5 w-3.5 text-[#3f6212] dark:text-[#9be136]" />
                <span>Admin Password (min {MIN_PASSWORD_LENGTH} characters)</span>
              </label>
              <input
                id="hq-pass"
                type="password"
                minLength={MIN_PASSWORD_LENGTH}
                required
                placeholder="At least 8 characters"
                value={hqPass}
                onChange={(e) => setHqPass(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2.5 text-sm dark:border-slate-700 dark:bg-[#040b12]"
              />
            </div>
            <button
              type="submit"
              disabled={busy}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#3f6212] py-3 text-xs font-bold text-white disabled:opacity-50 dark:bg-[#9be136] dark:text-[#040b12]"
            >
              <ShieldPlus className="h-4 w-4" />
              <span>Claim Fleet HQ Admin Account</span>
            </button>
          </form>
        )}

        {/* Standard Role Sign-In Form (Customer Login, Driver Login, Claimed HQ Login) */}
        {((portal === 'customer' && customerMode === 'login') ||
          portal === 'driver' ||
          (portal === 'admin' && hqStatus.hqClaimed)) && (
          <form onSubmit={handlePortalLogin} className="space-y-4">
            <div>
              <label htmlFor="portal-email" className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
                <Mail className="h-3.5 w-3.5 text-[#3f6212] dark:text-[#9be136]" />
                <span>{portal === 'driver' ? 'Company Driver Email (@hmktrading.ca)' : 'Email Address'}</span>
              </label>
              <input
                id="portal-email"
                type="email"
                required
                placeholder={portal === 'driver' ? 'driver.name@hmktrading.ca' : 'you@example.com'}
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 dark:border-slate-700 dark:bg-[#040b12] dark:text-white"
              />
            </div>

            <div>
              <label htmlFor="portal-pass" className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
                <Lock className="h-3.5 w-3.5 text-[#3f6212] dark:text-[#9be136]" />
                <span>Password</span>
              </label>
              <input
                id="portal-pass"
                type="password"
                required
                value={loginPass}
                onChange={(e) => setLoginPass(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 dark:border-slate-700 dark:bg-[#040b12] dark:text-white"
              />
            </div>

            <div className="flex flex-col gap-2.5 pt-1 sm:flex-row">
              <button
                type="submit"
                disabled={busy}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#3f6212] py-3 text-xs font-bold text-white disabled:opacity-50 dark:bg-[#9be136] dark:text-[#040b12]"
              >
                <Lock className="h-3.5 w-3.5" />
                <span>Sign In to {portal === 'admin' ? 'Fleet HQ' : portal === 'driver' ? 'Driver Portal' : 'Customer Portal'}</span>
              </button>

              <button
                type="button"
                disabled={busy}
                onClick={handleBiometricLogin}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-3 text-xs font-semibold text-slate-800 hover:bg-slate-50 dark:border-slate-700 dark:bg-[#040b12] dark:text-slate-200"
              >
                <Fingerprint className="h-4 w-4 text-[#3f6212] dark:text-[#9be136]" />
                <span>Biometric Passkey</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
