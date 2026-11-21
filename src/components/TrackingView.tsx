import React, {useState} from 'react';
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  Coins,
  Copy,
  Download,
  ExternalLink,
  FileText,
  Gavel,
  History,
  MessageCircle,
  MessageSquare,
  Navigation,
  PackageCheck,
  PenTool,
  QrCode,
  RotateCcw,
  Send,
  Share2,
  Star,
  Truck,
  XCircle,
} from 'lucide-react';
import {
  STAGES,
  buildOrdersCsv,
  formatMoney,
  type OrderRecord,
  type PublicUser,
} from '../shared/logistics';

interface TrackingViewProps {
  orders: OrderRecord[];
  selectedOrderId: string;
  user: PublicUser | null;
  token: string | null;
  onSelectOrder: (id: string) => void;
  onOrderUpdated: (order: OrderRecord, updatedUser?: PublicUser) => void;
  onShowInvoice: (order: OrderRecord) => void;
  onShowWaybill: (order: OrderRecord) => void;
  onRebook: (order: OrderRecord) => void;
  onNavigateBook: () => void;
  onToast: (msg: string, isError?: boolean) => void;
}

export const TrackingView: React.FC<TrackingViewProps> = ({
  orders,
  selectedOrderId,
  user,
  token,
  onSelectOrder,
  onOrderUpdated,
  onShowInvoice,
  onShowWaybill,
  onRebook,
  onNavigateBook,
  onToast,
}) => {
  const [chatText, setChatText] = useState('');
  const [confirmCancelId, setConfirmCancelId] = useState('');
  const [rating, setRating] = useState(5);
  const [reviewText, setReviewText] = useState('');
  const [disputeText, setDisputeText] = useState('');
  const [tipAmount, setTipAmount] = useState(5);

  const visibleOrders =
    user?.role === 'customer' ? orders.filter((o) => o.owner === user.email) : orders;
  const activeOrder = visibleOrders.find((o) => o.id === selectedOrderId) || visibleOrders[0] || null;

  const downloadCsv = () => {
    if (!visibleOrders.length) return onToast('No orders to export yet.', true);
    const csv = buildOrdersCsv(visibleOrders);
    const url = URL.createObjectURL(new Blob([csv], {type: 'text/csv'}));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'hmk-orders.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCopy = (text: string) => {
    if (!navigator.clipboard) return onToast('Clipboard unavailable.', true);
    navigator.clipboard.writeText(text).then(
      () => onToast('Copied to clipboard.'),
      () => onToast('Could not copy.', true),
    );
  };

  const handleNativeShare = async (o: OrderRecord) => {
    const shareText = `HMK Trading Order ${o.id} (${o.status}) · Route: ${o.pk} to ${o.dp}`;
    if (navigator.share) {
      try {
        await navigator.share({title: `HMK Order ${o.id}`, text: shareText, url: window.location.href});
        return;
      } catch {
        // user cancelled share sheet
      }
    }
    handleCopy(shareText);
  };

  const handleAcceptDriverBid = async (orderId: string, bidId: string) => {
    if (!token) return;
    const res = await fetch(`/api/orders/${orderId}/accept-bid`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json', Authorization: `Bearer ${token}`},
      body: JSON.stringify({bidId}),
    });
    const data = (await res.json()) as {order?: OrderRecord; error?: string};
    if (!res.ok || !data.order) return onToast(data.error || 'Could not accept driver bid.', true);
    onOrderUpdated(data.order);
    onToast(`Assigned ${data.order.driver} to ${orderId}.`);
  };

  const handleCancel = async (o: OrderRecord) => {
    if (!token) return onToast('Sign in to cancel.', true);
    if (confirmCancelId !== o.id) {
      setConfirmCancelId(o.id);
      setTimeout(() => setConfirmCancelId((prev) => (prev === o.id ? '' : prev)), 5000);
      return;
    }
    setConfirmCancelId('');
    const res = await fetch(`/api/orders/${o.id}/cancel`, {
      method: 'POST',
      headers: {Authorization: `Bearer ${token}`},
    });
    const data = (await res.json()) as {order?: OrderRecord; user?: PublicUser; error?: string};
    if (!res.ok || !data.order) return onToast(data.error || 'Could not cancel.', true);
    onOrderUpdated(data.order, data.user);
    onToast(`Order ${o.id} cancelled.`);
  };

  const handleSendChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeOrder || !token || !chatText.trim()) return;
    const res = await fetch(`/api/orders/${activeOrder.id}/chat`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json', Authorization: `Bearer ${token}`},
      body: JSON.stringify({text: chatText.trim()}),
    });
    const data = (await res.json()) as {order?: OrderRecord; error?: string};
    if (!res.ok || !data.order) return onToast(data.error || 'Could not send message.', true);
    setChatText('');
    onOrderUpdated(data.order);
  };

  const handleReview = async () => {
    if (!activeOrder || !token) return;
    const res = await fetch(`/api/orders/${activeOrder.id}/review`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json', Authorization: `Bearer ${token}`},
      body: JSON.stringify({rate: rating, rev: reviewText}),
    });
    const data = (await res.json()) as {order?: OrderRecord; error?: string};
    if (!res.ok || !data.order) return onToast(data.error || 'Failed to save review.', true);
    onOrderUpdated(data.order);
    onToast('Driver review saved.');
  };

  const handleTip = async () => {
    if (!activeOrder || !token) return;
    const res = await fetch(`/api/orders/${activeOrder.id}/tip`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json', Authorization: `Bearer ${token}`},
      body: JSON.stringify({amount: tipAmount}),
    });
    const data = (await res.json()) as {order?: OrderRecord; user?: PublicUser; error?: string};
    if (!res.ok || !data.order) return onToast(data.error || 'Could not send tip.', true);
    onOrderUpdated(data.order, data.user);
    onToast(`Sent ${formatMoney(tipAmount)} CAD tip to driver.`);
  };

  const handleDispute = async () => {
    if (!activeOrder || !token) return;
    const res = await fetch(`/api/orders/${activeOrder.id}/dispute`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json', Authorization: `Bearer ${token}`},
      body: JSON.stringify({reason: disputeText}),
    });
    const data = (await res.json()) as {order?: OrderRecord; error?: string};
    if (!res.ok || !data.order) return onToast(data.error || 'Could not submit issue.', true);
    onOrderUpdated(data.order);
    onToast('Issue reported to Fleet HQ.');
  };

  const deliveredCount = visibleOrders.filter((o) => o.status === 'Delivered').length;
  const totalSpent = visibleOrders
    .filter((o) => o.status !== 'Cancelled')
    .reduce((sum, o) => sum + o.total, 0);

  const stageIdx = activeOrder ? STAGES.indexOf(activeOrder.status) : -1;
  const pct = !activeOrder
    ? 0
    : activeOrder.status === 'Cancelled'
      ? 0
      : activeOrder.progressPct ?? [12, 40, 76, 100][Math.max(0, stageIdx)];
  const cancellable = activeOrder ? ['Confirmed', 'Driver Assigned'].includes(activeOrder.status) : false;

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-[#0e2034]">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-1.5 text-xs font-semibold text-[#3f6212] dark:text-[#9be136]">
              <Navigation className="h-3.5 w-3.5" />
              <span>My Orders &amp; Live Tracking</span>
            </div>
            <h2 className="font-display mt-0.5 text-xl font-bold text-slate-900 dark:text-white">Track your shipments</h2>
          </div>
          <button
            type="button"
            onClick={downloadCsv}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 px-3.5 py-2 text-xs font-semibold dark:border-slate-700"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Download CSV</span>
          </button>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-[#040b12]">
            <div className="text-xs text-slate-500">Orders</div>
            <div className="mt-1 font-mono text-2xl font-bold tabular-nums text-[#3f6212] dark:text-[#9be136]">
              {visibleOrders.length}
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-[#040b12]">
            <div className="text-xs text-slate-500">Delivered</div>
            <div className="mt-1 font-mono text-2xl font-bold tabular-nums text-slate-900 dark:text-white">
              {deliveredCount}
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-[#040b12]">
            <div className="text-xs text-slate-500">Total Volume</div>
            <div className="mt-1 font-mono text-2xl font-bold tabular-nums text-[#3f6212] dark:text-[#9be136]">
              {formatMoney(totalSpent)}
            </div>
          </div>
        </div>

        {visibleOrders.length === 0 ? (
          <div className="mt-6 rounded-xl border border-dashed border-slate-300 p-8 text-center dark:border-slate-700">
            <p className="text-sm text-slate-600 dark:text-slate-300">
              No shipments recorded for your account yet.
            </p>
            {(!user || user.role === 'customer') && (
              <button
                type="button"
                onClick={onNavigateBook}
                className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-[#3f6212] px-4 py-2 text-xs font-bold text-white dark:bg-[#9be136] dark:text-[#040b12]"
              >
                <PackageCheck className="h-4 w-4" />
                <span>Book First Delivery</span>
              </button>
            )}
          </div>
        ) : (
          <div className="mt-5 flex flex-wrap gap-2">
            {visibleOrders.slice(0, 12).map((o) => {
              const selected = activeOrder?.id === o.id;
              return (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => onSelectOrder(o.id)}
                  className={`rounded-lg border px-3 py-1.5 font-mono text-xs font-bold transition ${
                    selected
                      ? 'border-[#3f6212] bg-[#3f6212] text-white dark:border-[#9be136] dark:bg-[#9be136] dark:text-[#040b12]'
                      : 'border-slate-300 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-[#040b12] dark:text-slate-300'
                  }`}
                >
                  #{o.id}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {activeOrder && (
        <div className="space-y-5 rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-[#0e2034]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-mono text-lg font-bold text-slate-900 dark:text-white">
                Order #{activeOrder.id}
              </h3>
              <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                {activeOrder.pk} → {activeOrder.dp} · {activeOrder.tier} · {activeOrder.km} km
              </div>
              {activeOrder.telemetryStage && (
                <div className="mt-1 inline-flex items-center gap-1.5 font-mono text-xs font-semibold text-[#3f6212] dark:text-[#9be136]">
                  <Navigation className="h-3.5 w-3.5" />
                  <span>GPS Telemetry: {activeOrder.telemetryStage}</span>
                </div>
              )}
            </div>
            <div className="font-mono text-xs font-bold text-[#3f6212] dark:text-[#9be136]">
              Status: {activeOrder.dis ? 'Disputed' : activeOrder.status}
            </div>
          </div>

          {/* Live Route Progress Bar */}
          <div>
            <div className="mb-1.5 flex items-center justify-between font-mono text-xs text-slate-500 dark:text-slate-400">
              <span>{activeOrder.pk} {activeOrder.pickupPostal ? `(${activeOrder.pickupPostal})` : ''}</span>
              <span className="font-bold text-[#3f6212] dark:text-[#9be136]">{pct}%</span>
              <span>{activeOrder.dp} {activeOrder.dropoffPostal ? `(${activeOrder.dropoffPostal})` : ''}</span>
            </div>
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-[#152b44]">
              <div
                className="h-full rounded-full bg-[#3f6212] transition-all duration-500 dark:bg-[#9be136]"
                style={{width: `${pct}%`}}
              />
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 font-mono text-xs sm:grid-cols-4">
              {STAGES.map((stage, idx) => {
                const reached = idx <= stageIdx && activeOrder.status !== 'Cancelled';
                return (
                  <div
                    key={stage}
                    className={`rounded-lg border px-3 py-2 ${
                      reached
                        ? 'border-[#3f6212]/40 bg-[#3f6212]/10 font-bold text-[#3f6212] dark:border-[#9be136]/40 dark:bg-[#9be136]/10 dark:text-[#9be136]'
                        : 'border-slate-200 bg-slate-50 text-slate-400 dark:border-slate-800 dark:bg-[#040b12]'
                    }`}
                  >
                    {idx + 1}. {stage}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Incoming Live Driver Counter-Bids */}
          {activeOrder.status === 'Confirmed' && (activeOrder.bids || []).length > 0 && (
            <div className="space-y-2.5 rounded-xl border border-[#3f6212]/40 bg-[#3f6212]/5 p-4 dark:border-[#9be136]/40 dark:bg-[#9be136]/10">
              <div className="flex items-center gap-1.5 text-xs font-bold text-[#3f6212] dark:text-[#9be136]">
                <Gavel className="h-4 w-4" />
                <span>Live Company Driver Counter-Bids ({activeOrder.bids!.length})</span>
              </div>
              {activeOrder.bids!.map((b) => (
                <div
                  key={b.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white p-3 text-xs dark:border-slate-700 dark:bg-[#040b12]"
                >
                  <div>
                    <div className="flex items-center gap-1.5 font-bold text-slate-900 dark:text-white">
                      <Truck className="h-3.5 w-3.5 text-[#3f6212] dark:text-[#9be136]" />
                      <span>{b.driverName}</span>
                    </div>
                    <div className="text-slate-500">
                      ETA {b.etaMins} mins {b.note ? `· ${b.note}` : ''}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-sm font-bold tabular-nums text-[#3f6212] dark:text-[#9be136]">
                      {formatMoney(b.amount)} CAD
                    </span>
                    {user && (user.email === activeOrder.owner || user.role === 'admin') && (
                      <button
                        type="button"
                        onClick={() => handleAcceptDriverBid(activeOrder.id, b.id)}
                        className="inline-flex items-center gap-1 rounded-lg bg-[#3f6212] px-3 py-1.5 font-bold text-white dark:bg-[#9be136] dark:text-[#040b12]"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        <span>Accept Bid</span>
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* PIN & Details Grid */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-[#040b12]">
              <div className="text-xs font-medium text-slate-500">4-Digit Escrow Release PIN</div>
              <div className="mt-1 font-mono text-4xl font-extrabold tracking-widest text-[#3f6212] dark:text-[#9be136]">
                {activeOrder.pin}
              </div>
              <button
                type="button"
                onClick={() => handleCopy(`Order ${activeOrder.id} - ${activeOrder.status}. PIN: ${activeOrder.pin}`)}
                className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold dark:border-slate-700"
              >
                <Copy className="h-3.5 w-3.5" />
                <span>Copy Details &amp; PIN</span>
              </button>
            </div>

            <div className="space-y-1.5 rounded-xl border border-slate-200 bg-slate-50 p-4 font-mono text-xs dark:border-slate-700 dark:bg-[#040b12]">
              <div>Driver: <strong>{activeOrder.driver}</strong></div>
              <div>Cargo: {activeOrder.cargoCategory || 'Parcels & Express'} · {activeOrder.weightKg || 50} kg ({activeOrder.pieces || 1} pcs)</div>
              <div>Total: <strong className="text-[#3f6212] dark:text-[#9be136]">{formatMoney(activeOrder.total)} CAD</strong></div>
              <div>Payment: {activeOrder.ps}</div>
              <div>Recipient: {activeOrder.rn} ({activeOrder.rp})</div>
              {activeOrder.nt && <div>Notes: {activeOrder.nt}</div>}
              {(activeOrder.pa || activeOrder.da) && (
                <div>Addresses: {activeOrder.pa || activeOrder.pk} → {activeOrder.da || activeOrder.dp}</div>
              )}
            </div>
          </div>

          {/* Proof of Delivery Photo & Digital Signature */}
          {(activeOrder.pod || activeOrder.signature) && (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {activeOrder.pod && /^data:image\//.test(activeOrder.pod) && (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-[#040b12]">
                  <div className="mb-2 flex items-center gap-1.5 text-xs font-bold">
                    <Camera className="h-3.5 w-3.5 text-[#3f6212] dark:text-[#9be136]" />
                    <span>Proof of Delivery Photo</span>
                  </div>
                  <img src={activeOrder.pod} alt="Proof of delivery" className="max-h-56 rounded-lg object-contain" />
                </div>
              )}
              {activeOrder.signature && /^data:image\/png;base64,/.test(activeOrder.signature) && (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-[#040b12]">
                  <div className="mb-2 flex items-center gap-1.5 text-xs font-bold">
                    <PenTool className="h-3.5 w-3.5 text-[#3f6212] dark:text-[#9be136]" />
                    <span>Recipient Digital Signature</span>
                  </div>
                  <img
                    src={activeOrder.signature}
                    alt="Recipient digital signature"
                    className="max-h-56 rounded-lg border border-slate-200 bg-white object-contain p-2 dark:border-slate-700"
                  />
                </div>
              )}
            </div>
          )}

          {/* Action & Social Share Row */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => onShowInvoice(activeOrder)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#3f6212] px-3.5 py-2 text-xs font-bold text-white dark:bg-[#9be136] dark:text-[#040b12]"
            >
              <FileText className="h-3.5 w-3.5" />
              <span>CRA Tax Invoice</span>
            </button>
            <button
              type="button"
              onClick={() => onShowWaybill(activeOrder)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3.5 py-2 text-xs font-semibold dark:border-slate-700"
            >
              <QrCode className="h-3.5 w-3.5 text-[#3f6212] dark:text-[#9be136]" />
              <span>Shipping Waybill</span>
            </button>
            {(!user || user.role === 'customer') && (
              <button
                type="button"
                onClick={() => onRebook(activeOrder)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3.5 py-2 text-xs font-semibold dark:border-slate-700"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>Book Again</span>
              </button>
            )}
            <a
              target="_blank"
              rel="noopener noreferrer"
              href={`https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent((activeOrder.pa || activeOrder.pk) + ', ' + activeOrder.hub)}&destination=${encodeURIComponent((activeOrder.da || activeOrder.dp) + ', ' + activeOrder.hub)}`}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3.5 py-2 text-xs font-semibold dark:border-slate-700"
            >
              <Navigation className="h-3.5 w-3.5" />
              <span>Directions</span>
              <ExternalLink className="h-3 w-3" />
            </a>
            <button
              type="button"
              onClick={() => handleNativeShare(activeOrder)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3.5 py-2 text-xs font-semibold dark:border-slate-700"
            >
              <Share2 className="h-3.5 w-3.5" />
              <span>Share</span>
            </button>
            <a
              target="_blank"
              rel="noopener noreferrer"
              href={`https://wa.me/?text=${encodeURIComponent(`HMK order ${activeOrder.id} (${activeOrder.status}) - ${activeOrder.pk} to ${activeOrder.dp}`)}`}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold dark:border-slate-700"
            >
              <MessageCircle className="h-3.5 w-3.5 text-emerald-500" />
              <span>WhatsApp</span>
            </a>
            <a
              target="_blank"
              rel="noopener noreferrer"
              href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(`Shipping with HMK Trading Canada: ${activeOrder.pk} to ${activeOrder.dp} (${activeOrder.status})`)}`}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold dark:border-slate-700"
            >
              <Send className="h-3.5 w-3.5 text-sky-500" />
              <span>Post on X</span>
            </a>
            {cancellable && user && (user.role === 'admin' || activeOrder.owner === user.email) && (
              <button
                type="button"
                onClick={() => handleCancel(activeOrder)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-red-400 px-3.5 py-2 text-xs font-bold text-red-600 dark:text-red-400"
              >
                <XCircle className="h-3.5 w-3.5" />
                <span>{confirmCancelId === activeOrder.id ? 'Confirm Cancel' : 'Cancel Order'}</span>
              </button>
            )}
          </div>

          {/* Live Order Chat */}
          <details className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-[#040b12]">
            <summary className="flex cursor-pointer items-center gap-2 text-xs font-bold">
              <MessageSquare className="h-3.5 w-3.5 text-[#3f6212] dark:text-[#9be136]" />
              <span>Live Order Chat ({(activeOrder.msgs || []).length})</span>
            </summary>
            <div className="mt-3 space-y-2">
              {(activeOrder.msgs || []).map((m) => (
                <div key={m.id} className="rounded-lg border border-slate-200 bg-white p-2.5 text-xs dark:border-slate-800 dark:bg-[#0e2034]">
                  <span className="font-bold">{m.senderName}</span>{' '}
                  <span className="text-slate-500">· {m.senderRole} · {m.at}</span>
                  <div className="mt-1">{m.text}</div>
                </div>
              ))}
              {token && (
                <form onSubmit={handleSendChat} className="flex gap-2 pt-1">
                  <input
                    value={chatText}
                    onChange={(e) => setChatText(e.target.value)}
                    placeholder="Type message to driver or dispatch..."
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-[#0e2034]"
                  />
                  <button
                    type="submit"
                    className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-[#3f6212] px-4 py-2 text-xs font-bold text-white dark:bg-[#9be136] dark:text-[#040b12]"
                  >
                    <Send className="h-3.5 w-3.5" />
                    <span>Send</span>
                  </button>
                </form>
              )}
            </div>
          </details>

          {/* Timeline */}
          <details className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-[#040b12]">
            <summary className="flex cursor-pointer items-center gap-2 text-xs font-bold">
              <History className="h-3.5 w-3.5 text-[#3f6212] dark:text-[#9be136]" />
              <span>Shipment Timeline ({activeOrder.log.length} events)</span>
            </summary>
            <ul className="mt-2 space-y-1 font-mono text-xs text-slate-600 dark:text-slate-300">
              {activeOrder.log.map((l, idx) => (
                <li key={idx}>
                  {l.at} — {l.status}
                </li>
              ))}
            </ul>
          </details>

          {/* Post-Delivery Review, Tip & Issue Reporting */}
          {activeOrder.status === 'Delivered' && user?.email === activeOrder.owner && (
            <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-[#040b12]">
              <div className="flex items-center gap-1.5 text-xs font-bold">
                <Star className="h-4 w-4 text-[#3f6212] dark:text-[#9be136]" />
                <span>Driver Review, Tip &amp; Issue Reporting</span>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label htmlFor="rate-sel" className="mb-1 block text-xs">Rating</label>
                  <select
                    id="rate-sel"
                    value={rating}
                    onChange={(e) => setRating(Number(e.target.value))}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-[#0e2034]"
                  >
                    {[5, 4, 3, 2, 1].map((n) => (
                      <option key={n} value={n}>{'★'.repeat(n)}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="rev-inp" className="mb-1 block text-xs">Review Comment</label>
                  <input
                    id="rev-inp"
                    value={reviewText}
                    onChange={(e) => setReviewText(e.target.value)}
                    placeholder={activeOrder.rev || 'Share feedback...'}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-[#0e2034]"
                  />
                </div>
              </div>
              <div>
                <label htmlFor="disp-inp" className="mb-1 block text-xs">Report Issue (only if damaged/missing)</label>
                <input
                  id="disp-inp"
                  value={disputeText}
                  onChange={(e) => setDisputeText(e.target.value)}
                  placeholder={activeOrder.dis || 'Describe any delivery issue...'}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-[#0e2034]"
                />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <select
                  aria-label="Tip amount"
                  value={tipAmount}
                  onChange={(e) => setTipAmount(Number(e.target.value))}
                  className="rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs dark:border-slate-700 dark:bg-[#0e2034]"
                >
                  <option value={2}>$2</option>
                  <option value={5}>$5</option>
                  <option value={10}>$10</option>
                </select>
                <button
                  type="button"
                  disabled={Boolean(activeOrder.tip)}
                  onClick={handleTip}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold disabled:opacity-50 dark:border-slate-700"
                >
                  <Coins className="h-3.5 w-3.5 text-[#3f6212] dark:text-[#9be136]" />
                  <span>{activeOrder.tip ? `Tipped ${formatMoney(activeOrder.tip)}` : 'Tip Driver'}</span>
                </button>
                <button
                  type="button"
                  onClick={handleReview}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#3f6212] px-3.5 py-2 text-xs font-bold text-white dark:bg-[#9be136] dark:text-[#040b12]"
                >
                  <Star className="h-3.5 w-3.5" />
                  <span>Save Review</span>
                </button>
                <button
                  type="button"
                  onClick={handleDispute}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-red-400 px-3.5 py-2 text-xs font-bold text-red-600 dark:text-red-400"
                >
                  <AlertTriangle className="h-3.5 w-3.5" />
                  <span>Report Issue</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
