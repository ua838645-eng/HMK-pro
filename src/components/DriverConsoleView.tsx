import React, {useRef, useState} from 'react';
import {
  Award,
  Building2,
  Camera,
  CheckCircle2,
  ClipboardList,
  DollarSign,
  Eraser,
  Gavel,
  KeyRound,
  Landmark,
  Navigation,
  PenTool,
  Play,
  Power,
  Send,
  ShieldCheck,
  Truck,
} from 'lucide-react';
import {computeGamificationStats, formatMoney, type OrderRecord, type PublicUser} from '../shared/logistics';

interface DriverConsoleViewProps {
  user: PublicUser;
  token: string;
  orders: OrderRecord[];
  onOrderUpdated: (order: OrderRecord, updatedUser?: PublicUser) => void;
  onUserUpdated: (user: PublicUser) => void;
  onOpenProfile?: () => void;
  onToast: (msg: string, isError?: boolean) => void;
}

function compressPhoto(file: File): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const scale = Math.min(1, 360 / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;
      canvas.getContext('2d')?.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/jpeg', 0.6));
    };
    img.onerror = () => resolve('');
    img.src = url;
  });
}

const SignaturePad: React.FC<{
  orderId: string;
  onChange: (dataUrl: string) => void;
}> = ({orderId, onChange}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef(false);

  const getPoint = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * e.currentTarget.width,
      y: ((e.clientY - rect.top) / rect.height) * e.currentTarget.height,
    };
  };

  const handleDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    drawingRef.current = true;
    const p = getPoint(e);
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handleMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return;
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const p = getPoint(e);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
  };

  const handleUp = () => {
    if (!drawingRef.current || !canvasRef.current) return;
    drawingRef.current = false;
    onChange(canvasRef.current.toDataURL('image/png'));
  };

  const clearPad = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    onChange('');
  };

  return (
    <div className="w-full max-w-[320px] space-y-1.5">
      <div className="flex items-center justify-between text-xs font-semibold">
        <span className="inline-flex items-center gap-1.5">
          <PenTool className="h-3.5 w-3.5 text-[#3f6212] dark:text-[#9be136]" />
          <span>Recipient Signature Pad</span>
        </span>
        <button
          type="button"
          onClick={clearPad}
          className="inline-flex items-center gap-1 rounded-md border border-slate-300 px-2 py-0.5 text-[11px] font-medium dark:border-slate-700"
        >
          <Eraser className="h-3 w-3" />
          <span>Clear</span>
        </button>
      </div>
      <canvas
        ref={canvasRef}
        width={320}
        height={100}
        data-testid={`sig-pad-${orderId}`}
        onPointerDown={handleDown}
        onPointerMove={handleMove}
        onPointerUp={handleUp}
        onPointerLeave={handleUp}
        className="w-full max-w-[320px] touch-none rounded-lg border border-slate-300 bg-white dark:border-slate-600"
      />
    </div>
  );
};

export const DriverConsoleView: React.FC<DriverConsoleViewProps> = ({
  user,
  token,
  orders,
  onOrderUpdated,
  onUserUpdated,
  onOpenProfile,
  onToast,
}) => {
  const [pinInputs, setPinInputs] = useState<Record<string, string>>({});
  const [podPhotos, setPodPhotos] = useState<Record<string, string>>({});
  const [signatures, setSignatures] = useState<Record<string, string>>({});
  const [chatInputs, setChatInputs] = useState<Record<string, string>>({});
  const [bidPrices, setBidPrices] = useState<Record<string, string>>({});
  const [bidEtas, setBidEtas] = useState<Record<string, string>>({});
  const [bidNotes, setBidNotes] = useState<Record<string, string>>({});
  const [payoutMethod, setPayoutMethod] = useState<'Interac e-Transfer' | 'Bank Direct Deposit (EFT)'>('Interac e-Transfer');

  const openJobs = orders.filter(
    (o) => !['Delivered', 'Cancelled'].includes(o.status) && (!o.driverEmail || o.driverEmail === user.email),
  );
  const completedOrders = orders.filter((o) => o.status === 'Delivered' && o.driverEmail === user.email);
  const rated = completedOrders.filter((o) => o.rated);
  const avgRating = rated.length
    ? (rated.reduce((s, o) => s + o.rate, 0) / rated.length).toFixed(1) + ' ★'
    : '—';
  const gami = computeGamificationStats(orders, user.email, 'driver', user.dailyGoalTarget || 4);

  const handleToggleDuty = async () => {
    const res = await fetch('/api/driver/duty', {
      method: 'POST',
      headers: {Authorization: `Bearer ${token}`},
    });
    const data = (await res.json()) as {user?: PublicUser; error?: string};
    if (!res.ok || !data.user) return onToast(data.error || 'Could not update duty status.', true);
    onUserUpdated(data.user);
    onToast(data.user.online ? 'You are now ONLINE for dispatch.' : 'You are now OFFLINE.');
  };

  const handlePayout = async () => {
    const res = await fetch('/api/driver/payout', {
      method: 'POST',
      headers: {'Content-Type': 'application/json', Authorization: `Bearer ${token}`},
      body: JSON.stringify({method: payoutMethod}),
    });
    const data = (await res.json()) as {paid?: number; ref?: string; method?: string; user?: PublicUser; error?: string};
    if (!res.ok || !data.user) {
      if (payoutMethod === 'Bank Direct Deposit (EFT)' && !user.bankAccount && onOpenProfile) {
        onOpenProfile();
      }
      return onToast(data.error || 'Payout failed.', true);
    }
    onUserUpdated(data.user);
    onToast(`${data.method || payoutMethod} payout of ${formatMoney(data.paid || 0)} CAD processed (${data.ref || ''}).`);
  };

  const handleSubmitBid = async (o: OrderRecord) => {
    const amount = Number(bidPrices[o.id] || o.sub);
    const etaMins = Number(bidEtas[o.id] || 10);
    const note = bidNotes[o.id] || '';
    const res = await fetch(`/api/orders/${o.id}/bid`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json', Authorization: `Bearer ${token}`},
      body: JSON.stringify({amount, etaMins, note}),
    });
    const data = (await res.json()) as {order?: OrderRecord; error?: string};
    if (!res.ok || !data.order) return onToast(data.error || 'Bid submission failed.', true);
    onOrderUpdated(data.order);
    onToast(`Live bid $${amount.toFixed(2)} CAD submitted on ${o.id}.`);
  };

  const handleJobStage = async (orderId: string, status: 'Driver Assigned' | 'In Transit') => {
    const res = await fetch(`/api/orders/${orderId}/status`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json', Authorization: `Bearer ${token}`},
      body: JSON.stringify({status}),
    });
    const data = (await res.json()) as {order?: OrderRecord; error?: string};
    if (!res.ok || !data.order) return onToast(data.error || 'Status update failed.', true);
    onOrderUpdated(data.order);
    onToast(`Order ${orderId} updated to ${status}.`);
  };

  const handleTelemetry = async (orderId: string, progressPct: number, telemetryStage: string) => {
    const res = await fetch(`/api/orders/${orderId}/telemetry`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json', Authorization: `Bearer ${token}`},
      body: JSON.stringify({progressPct, telemetryStage}),
    });
    const data = (await res.json()) as {order?: OrderRecord; error?: string};
    if (!res.ok || !data.order) return onToast(data.error || 'Telemetry update failed.', true);
    onOrderUpdated(data.order);
    onToast(`GPS checkpoint updated: ${telemetryStage}`);
  };

  const handleFinishJob = async (orderId: string) => {
    const pin = (pinInputs[orderId] || '').trim();
    const res = await fetch(`/api/orders/${orderId}/finish`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json', Authorization: `Bearer ${token}`},
      body: JSON.stringify({
        pin,
        pod: podPhotos[orderId] || '',
        signature: signatures[orderId] || '',
      }),
    });
    const data = (await res.json()) as {order?: OrderRecord; user?: PublicUser; error?: string};
    if (!res.ok || !data.order) return onToast(data.error || 'PIN verification failed.', true);
    onOrderUpdated(data.order, data.user);
    onToast(`Order ${orderId} delivered and escrow released.`);
  };

  const handleSendChat = async (orderId: string) => {
    const text = (chatInputs[orderId] || '').trim();
    if (!text) return;
    const res = await fetch(`/api/orders/${orderId}/chat`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json', Authorization: `Bearer ${token}`},
      body: JSON.stringify({text}),
    });
    const data = (await res.json()) as {order?: OrderRecord; error?: string};
    if (!res.ok || !data.order) return onToast(data.error || 'Message failed.', true);
    setChatInputs((prev) => ({...prev, [orderId]: ''}));
    onOrderUpdated(data.order);
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-[#0e2034]">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-1.5 text-xs font-semibold text-[#3f6212] dark:text-[#9be136]">
              <Truck className="h-3.5 w-3.5" />
              <span>Company-Provisioned Driver Console · {user.email}</span>
            </div>
            <h2 className="font-display mt-0.5 text-xl font-bold text-slate-900 dark:text-white">{user.name}</h2>
            {user.bankAccount && (
              <div className="mt-1 inline-flex items-center gap-1.5 font-mono text-xs text-slate-500 dark:text-slate-400">
                <Building2 className="h-3.5 w-3.5 text-[#3f6212] dark:text-[#9be136]" />
                <span>Direct Deposit Linked: {user.bankAccount.institutionName} ••••{user.bankAccount.accountLast4}</span>
              </div>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleToggleDuty}
              className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold ${
                user.online
                  ? 'bg-[#3f6212] text-white dark:bg-[#9be136] dark:text-[#040b12]'
                  : 'border border-slate-300 text-slate-700 dark:border-slate-700 dark:text-slate-300'
              }`}
            >
              <Power className="h-3.5 w-3.5" />
              <span>{user.online ? 'Duty: ONLINE' : 'Duty: OFFLINE'}</span>
            </button>
            <select
              aria-label="Payout destination"
              value={payoutMethod}
              onChange={(e) => setPayoutMethod(e.target.value as 'Interac e-Transfer' | 'Bank Direct Deposit (EFT)')}
              className="rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-xs font-semibold dark:border-slate-700 dark:bg-[#040b12]"
            >
              <option value="Interac e-Transfer">Interac e-Transfer</option>
              <option value="Bank Direct Deposit (EFT)">Bank Direct Deposit (EFT)</option>
            </select>
            <button
              type="button"
              onClick={handlePayout}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 px-4 py-2 text-xs font-semibold dark:border-slate-700"
            >
              {payoutMethod === 'Bank Direct Deposit (EFT)' ? <Building2 className="h-3.5 w-3.5" /> : <Landmark className="h-3.5 w-3.5" />}
              <span>Withdraw Payout</span>
            </button>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-[#040b12]">
            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              <DollarSign className="h-3.5 w-3.5 text-[#3f6212] dark:text-[#9be136]" />
              <span>Earnings Balance</span>
            </div>
            <div className="mt-1 font-mono text-2xl font-bold tabular-nums text-[#3f6212] dark:text-[#9be136]">
              {formatMoney(user.earn)}
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-[#040b12]">
            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              <CheckCircle2 className="h-3.5 w-3.5 text-[#3f6212] dark:text-[#9be136]" />
              <span>Completed Jobs</span>
            </div>
            <div className="mt-1 font-mono text-2xl font-bold tabular-nums text-slate-900 dark:text-white">
              {completedOrders.length}
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-[#040b12]">
            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              <ClipboardList className="h-3.5 w-3.5 text-[#3f6212] dark:text-[#9be136]" />
              <span>Open Dispatch Queue</span>
            </div>
            <div className="mt-1 font-mono text-2xl font-bold tabular-nums text-slate-900 dark:text-white">
              {openJobs.length}
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-[#040b12]">
            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              <Award className="h-3.5 w-3.5 text-[#3f6212] dark:text-[#9be136]" />
              <span>Rating / Daily Goal</span>
            </div>
            <div className="mt-1 font-mono text-lg font-bold tabular-nums text-slate-900 dark:text-white">
              {avgRating} · {gami.dailyCompleted}/{gami.dailyGoal}
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {openJobs.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500 dark:border-slate-800 dark:bg-[#0e2034]">
            No open jobs assigned or queued in the dispatch pool right now.
          </div>
        ) : (
          openJobs.map((o) => (
            <div
              key={o.id}
              className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-[#0e2034]"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="font-mono text-sm font-bold text-[#3f6212] dark:text-[#9be136]">
                    #{o.id} · {o.status}
                  </div>
                  <div className="mt-0.5 text-xs text-slate-600 dark:text-slate-300">
                    {o.pk} → {o.dp} · {o.tier} · {o.cargoCategory || 'Parcels'} ({o.weightKg || 50} kg) · Recipient: {o.rn}
                  </div>
                </div>
                <div className="font-mono text-base font-bold tabular-nums text-slate-900 dark:text-white">
                  {formatMoney(o.sub - o.disc)} CAD
                </div>
              </div>

              {o.status === 'Confirmed' && (
                <div className="grid grid-cols-1 gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3.5 sm:grid-cols-4 dark:border-slate-700 dark:bg-[#040b12]">
                  <div>
                    <label className="mb-1 block text-[11px] font-semibold">Counter-Bid (CAD)</label>
                    <input
                      type="number"
                      min={25}
                      max={2000}
                      value={bidPrices[o.id] ?? String(o.sub)}
                      onChange={(e) => setBidPrices((p) => ({...p, [o.id]: e.target.value}))}
                      className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 font-mono text-xs dark:border-slate-700 dark:bg-[#0e2034]"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] font-semibold">ETA (mins)</label>
                    <input
                      type="number"
                      min={3}
                      max={180}
                      value={bidEtas[o.id] ?? '10'}
                      onChange={(e) => setBidEtas((p) => ({...p, [o.id]: e.target.value}))}
                      className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 font-mono text-xs dark:border-slate-700 dark:bg-[#0e2034]"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] font-semibold">Note to Customer</label>
                    <input
                      value={bidNotes[o.id] ?? ''}
                      onChange={(e) => setBidNotes((p) => ({...p, [o.id]: e.target.value}))}
                      placeholder="Available nearby"
                      className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs dark:border-slate-700 dark:bg-[#0e2034]"
                    />
                  </div>
                  <div className="flex items-end gap-2">
                    <button
                      type="button"
                      disabled={!user.online}
                      onClick={() => handleSubmitBid(o)}
                      className="inline-flex flex-1 items-center justify-center gap-1 rounded-lg border border-[#3f6212] px-3 py-1.5 text-xs font-bold text-[#3f6212] disabled:opacity-40 dark:border-[#9be136] dark:text-[#9be136]"
                    >
                      <Gavel className="h-3.5 w-3.5" />
                      <span>Submit Bid</span>
                    </button>
                    <button
                      type="button"
                      disabled={!user.online}
                      onClick={() => handleJobStage(o.id, 'Driver Assigned')}
                      className="inline-flex flex-1 items-center justify-center gap-1 rounded-lg bg-[#3f6212] px-3 py-1.5 text-xs font-bold text-white disabled:opacity-40 dark:bg-[#9be136] dark:text-[#040b12]"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      <span>Accept</span>
                    </button>
                  </div>
                </div>
              )}

              {o.status === 'Driver Assigned' && (
                <button
                  type="button"
                  onClick={() => handleJobStage(o.id, 'In Transit')}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#3f6212] px-4 py-2 text-xs font-bold text-white dark:bg-[#9be136] dark:text-[#040b12]"
                >
                  <Play className="h-3.5 w-3.5" />
                  <span>Start Transit</span>
                </button>
              )}

              {o.status === 'In Transit' && (
                <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-3.5 dark:border-slate-700 dark:bg-[#040b12]">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1 text-xs font-bold text-slate-700 dark:text-slate-200">
                      <Navigation className="h-3.5 w-3.5 text-[#3f6212] dark:text-[#9be136]" />
                      <span>GPS Checkpoints:</span>
                    </span>
                    {[
                      {pct: 55, label: 'Arrived at Pickup'},
                      {pct: 75, label: 'Highway Corridor'},
                      {pct: 92, label: 'Approaching Drop-off'},
                    ].map((cp) => (
                      <button
                        key={cp.label}
                        type="button"
                        onClick={() => handleTelemetry(o.id, cp.pct, cp.label)}
                        className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold hover:border-[#3f6212] dark:border-slate-700 dark:bg-[#0e2034]"
                      >
                        {cp.label} ({cp.pct}%)
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {o.status !== 'Confirmed' && (
                <div className="space-y-3 border-t border-slate-200 pt-3 dark:border-slate-800">
                  <SignaturePad
                    orderId={o.id}
                    onChange={(sig) => setSignatures((prev) => ({...prev, [o.id]: sig}))}
                  />
                  <div className="flex flex-wrap items-center gap-2.5">
                    <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold dark:border-slate-700">
                      <Camera className="h-3.5 w-3.5 text-[#3f6212] dark:text-[#9be136]" />
                      <span>{podPhotos[o.id] ? 'POD Attached' : 'POD Photo'}</span>
                      <input
                        type="file"
                        accept="image/*"
                        aria-label={`Proof of delivery photo for ${o.id}`}
                        onChange={async (e) => {
                          const f = e.target.files?.[0];
                          if (f) {
                            const dataUrl = await compressPhoto(f);
                            setPodPhotos((prev) => ({...prev, [o.id]: dataUrl}));
                          }
                        }}
                        className="sr-only"
                      />
                    </label>
                    <div className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-slate-50 px-2.5 py-1.5 dark:border-slate-700 dark:bg-[#040b12]">
                      <KeyRound className="h-3.5 w-3.5 text-[#3f6212] dark:text-[#9be136]" />
                      <input
                        value={pinInputs[o.id] || ''}
                        onChange={(e) => setPinInputs((prev) => ({...prev, [o.id]: e.target.value}))}
                        maxLength={4}
                        inputMode="numeric"
                        placeholder="4-digit PIN"
                        className="w-24 bg-transparent font-mono text-xs focus:outline-none"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => handleFinishJob(o.id)}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-[#3f6212] px-4 py-2 text-xs font-bold text-white dark:bg-[#9be136] dark:text-[#040b12]"
                    >
                      <ShieldCheck className="h-3.5 w-3.5" />
                      <span>Verify PIN &amp; Deliver</span>
                    </button>
                  </div>
                </div>
              )}

              <div className="flex gap-2">
                <input
                  value={chatInputs[o.id] || ''}
                  onChange={(e) => setChatInputs((prev) => ({...prev, [o.id]: e.target.value}))}
                  placeholder="Message customer..."
                  className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-xs dark:border-slate-700 dark:bg-[#040b12]"
                />
                <button
                  type="button"
                  onClick={() => handleSendChat(o.id)}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-300 px-3.5 py-2 text-xs font-semibold dark:border-slate-700"
                >
                  <Send className="h-3.5 w-3.5" />
                  <span>Send</span>
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
