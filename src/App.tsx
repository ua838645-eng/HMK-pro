import React, {useCallback, useEffect, useRef, useState} from 'react';
import {
  buildOrdersCsv,
  type OrderRecord,
  type PublicUser,
  type TransactionRecord,
  type VoiceAction,
} from './shared/logistics';
import {t, type LangCode} from './utils/i18n';
import {
  readEncryptedVaultRecord,
  saveEncryptedVaultRecord,
  type OfflineQueuedAction,
} from './utils/cryptoVault';
import {useOnlineStatus} from './hooks/usePWAInstall';
import {TopBar, type TabKey} from './components/TopBar';
import {WorkspaceBar} from './components/WorkspaceBar';
import {OverviewView} from './components/OverviewView';
import {AuthPortalView} from './components/AuthPortalView';
import {BookingView} from './components/BookingView';
import {TrackingView} from './components/TrackingView';
import {DashboardAnalyticsView, type WidgetConfig} from './components/DashboardAnalyticsView';
import {DriverConsoleView} from './components/DriverConsoleView';
import {FleetHqView} from './components/FleetHqView';
import {
  InvoiceModal,
  NotificationsModal,
  ProfileModal,
  VoiceCommandModal,
  WalletModal,
  WaybillModal,
} from './components/Modals';

interface ToastItem {
  id: string;
  text: string;
  isError?: boolean;
}

const DEFAULT_WIDGETS: WidgetConfig = {
  revenueByHub: true,
  tierBreakdown: true,
  dailyGoals: true,
  badges: true,
  leaderboard: true,
  recentTransactions: true,
  offlineVault: true,
  cloudExport: true,
};

export default function App() {
  const isOnline = useOnlineStatus();
  const [activeTab, setActiveTab] = useState<TabKey>('home');
  const [lang, setLang] = useState<LangCode>(() => {
    try {
      const saved = localStorage.getItem('hmk_lang') as LangCode | null;
      return saved && ['en', 'fr', 'ur'].includes(saved) ? saved : 'en';
    } catch {
      return 'en';
    }
  });
  const [isDark, setIsDark] = useState<boolean>(() => {
    try {
      return localStorage.getItem('hmk_theme') !== 'light';
    } catch {
      return true;
    }
  });

  // Session held in JS memory only (never localStorage)
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<PublicUser | null>(null);
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [transactions, setTransactions] = useState<TransactionRecord[]>([]);
  const [selectedOrderId, setSelectedOrderId] = useState<string>('');
  const [rebookDraft, setRebookDraft] = useState<Partial<OrderRecord> | null>(null);
  const [wsConnected, setWsConnected] = useState(false);

  // Encrypted offline vault & queue
  const [offlineQueue, setOfflineQueue] = useState<OfflineQueuedAction[]>([]);
  const [vaultMeta, setVaultMeta] = useState<{updatedAt: string; byteLength: number} | null>(null);
  const [widgets, setWidgets] = useState<WidgetConfig>(() => {
    try {
      const raw = localStorage.getItem('hmk_widgets');
      return raw ? {...DEFAULT_WIDGETS, ...JSON.parse(raw)} : DEFAULT_WIDGETS;
    } catch {
      return DEFAULT_WIDGETS;
    }
  });

  // Modals & Toasts
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [walletOpen, setWalletOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [invoiceOrder, setInvoiceOrder] = useState<OrderRecord | null>(null);
  const [waybillOrder, setWaybillOrder] = useState<OrderRecord | null>(null);

  const wsRef = useRef<WebSocket | null>(null);

  const pushToast = useCallback((text: string, isError = false) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setToasts((prev) => {
      if (prev.some((t) => t.text === text)) return prev;
      return [...prev.slice(-1), {id, text, isError}];
    });
    setTimeout(() => {
      setToasts((prev) => prev.filter((item) => item.id !== id));
    }, 3200);
  }, []);

  // Sync theme class on <html>
  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark);
    try {
      localStorage.setItem('hmk_theme', isDark ? 'dark' : 'light');
    } catch {
      // ignore
    }
  }, [isDark]);

  // Sync language preference
  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ur' ? 'rtl' : 'ltr';
    try {
      localStorage.setItem('hmk_lang', lang);
    } catch {
      // ignore
    }
  }, [lang]);

  // Escape closes modals
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setWalletOpen(false);
        setNotifOpen(false);
        setProfileOpen(false);
        setVoiceOpen(false);
        setInvoiceOrder(null);
        setWaybillOrder(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  // 30-minute inactivity auto-signout
  useEffect(() => {
    if (!user) return;
    let timer: ReturnType<typeof setTimeout>;
    const arm = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        setToken(null);
        setUser(null);
        setOrders([]);
        setTransactions([]);
        setActiveTab('home');
        pushToast('Signed out after 30 minutes of inactivity.', true);
      }, 1_800_000);
    };
    const events = ['click', 'keydown', 'touchstart'];
    events.forEach((ev) => window.addEventListener(ev, arm, {passive: true}));
    arm();
    return () => {
      clearTimeout(timer);
      events.forEach((ev) => window.removeEventListener(ev, arm));
    };
  }, [user, pushToast]);

  const fetchOrders = useCallback(async (authToken: string | null) => {
    if (!authToken) {
      setOrders([]);
      setTransactions([]);
      return;
    }
    try {
      const [ordRes, txRes] = await Promise.all([
        fetch('/api/orders', {headers: {Authorization: `Bearer ${authToken}`}}),
        fetch('/api/transactions', {headers: {Authorization: `Bearer ${authToken}`}}),
      ]);
      if (ordRes.ok) {
        const data = (await ordRes.json()) as {orders: OrderRecord[]};
        setOrders(data.orders || []);
      }
      if (txRes.ok) {
        const txData = (await txRes.json()) as {transactions: TransactionRecord[]};
        setTransactions(txData.transactions || []);
      }
    } catch {
      // fallback to encrypted vault if offline
    }
  }, []);

  const refreshTransactions = useCallback(async (authToken: string | null) => {
    if (!authToken) return;
    try {
      const res = await fetch('/api/transactions', {headers: {Authorization: `Bearer ${authToken}`}});
      if (res.ok) {
        const data = (await res.json()) as {transactions: TransactionRecord[]};
        setTransactions(data.transactions || []);
      }
    } catch {
      // ignore offline
    }
  }, []);

  // Encrypt & persist user snapshot to IndexedDB vault
  const syncEncryptedVault = useCallback(
    async (currentUser: PublicUser | null, currentOrders: OrderRecord[], queue: OfflineQueuedAction[]) => {
      const passkey = currentUser?.email || 'hmk-guest-vault';
      try {
        const meta = await saveEncryptedVaultRecord('snapshot', passkey, {
          orders: currentOrders,
          queue,
          savedAt: new Date().toISOString(),
        });
        setVaultMeta(meta);
      } catch {
        // ignore if IndexedDB unavailable
      }
    },
    [],
  );

  const decryptInspectVault = useCallback(async () => {
    const passkey = user?.email || 'hmk-guest-vault';
    try {
      const res = await readEncryptedVaultRecord<{
        orders: OrderRecord[];
        queue: OfflineQueuedAction[];
        savedAt: string;
      }>('snapshot', passkey);
      if (!res?.data) return null;
      return {
        ordersCount: res.data.orders?.length || 0,
        queueCount: res.data.queue?.length || 0,
        savedAt: res.data.savedAt || res.updatedAt,
      };
    } catch {
      return null;
    }
  }, [user?.email]);

  // Restore offline snapshot on login when offline
  useEffect(() => {
    if (!user) return;
    if (isOnline) {
      fetchOrders(token);
    } else {
      readEncryptedVaultRecord<{orders: OrderRecord[]; queue: OfflineQueuedAction[]}>('snapshot', user.email)
        .then((res) => {
          if (res?.data?.orders) {
            setOrders(res.data.orders);
            setOfflineQueue(res.data.queue || []);
            setVaultMeta({updatedAt: res.updatedAt, byteLength: res.byteLength});
          }
        })
        .catch(() => {});
    }
  }, [user?.email, token, isOnline, fetchOrders]);

  // Auto-sync encrypted vault whenever orders or queue change
  useEffect(() => {
    if (user || orders.length > 0 || offlineQueue.length > 0) {
      syncEncryptedVault(user, orders, offlineQueue);
    }
  }, [user, orders, offlineQueue, syncEncryptedVault]);

  // Replay queued offline orders once reconnected
  useEffect(() => {
    if (!isOnline || !token || offlineQueue.length === 0) return;
    let cancelled = false;
    const flush = async () => {
      const remaining: OfflineQueuedAction[] = [];
      for (const item of offlineQueue) {
        try {
          const res = await fetch(item.endpoint, {
            method: item.method,
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(item.body),
          });
          if (res.ok) {
            const data = (await res.json()) as {order?: OrderRecord; user?: PublicUser};
            if (!cancelled && data.order) {
              setOrders((prev) => [data.order!, ...prev.filter((o) => o.id !== data.order!.id)]);
            }
            if (!cancelled && data.user) setUser(data.user);
          } else {
            remaining.push(item);
          }
        } catch {
          remaining.push(item);
        }
      }
      if (!cancelled) {
        setOfflineQueue(remaining);
        if (remaining.length < offlineQueue.length) {
          pushToast('Synced queued offline operations to Fleet server.');
          refreshTransactions(token);
        }
      }
    };
    flush();
    return () => {
      cancelled = true;
    };
  }, [isOnline, token, offlineQueue, pushToast, refreshTransactions]);

  // WebSocket Real-Time Connection
  useEffect(() => {
    if (!token) {
      setWsConnected(false);
      return;
    }
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${proto}//${window.location.host}/ws?token=${encodeURIComponent(token)}`);
    wsRef.current = ws;

    ws.onopen = () => setWsConnected(true);
    ws.onclose = () => setWsConnected(false);
    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data) as {type: string; payload: unknown};
        if (msg.type === 'order:created') {
          const created = msg.payload as OrderRecord;
          setOrders((prev) => (prev.some((o) => o.id === created.id) ? prev : [created, ...prev]));
        } else if (msg.type === 'order:updated') {
          const updated = msg.payload as OrderRecord;
          setOrders((prev) => {
            const exists = prev.some((o) => o.id === updated.id);
            return exists ? prev.map((o) => (o.id === updated.id ? updated : o)) : [updated, ...prev];
          });
        } else if (msg.type === 'chat:message') {
          const {order} = msg.payload as {order: OrderRecord};
          setOrders((prev) => prev.map((o) => (o.id === order.id ? order : o)));
        } else if (msg.type === 'notification:new') {
          const {note, unread} = msg.payload as {
            note: {id: string; text: string; at: string; category: 'order' | 'bid' | 'chat' | 'payout' | 'system'};
            unread: number;
          };
          setUser((prev) =>
            prev ? {...prev, unread, notes: [...(prev.notes || []), note].slice(-40)} : prev,
          );
          pushToast(note.text);
          if ('Notification' in window && Notification.permission === 'granted') {
            new Notification('HMK Trading Dispatch', {body: note.text});
          }
        }
      } catch {
        // ignore malformed frames
      }
    };

    return () => {
      ws.close();
      wsRef.current = null;
    };
  }, [token, pushToast]);

  const handleSelectTab = (next: TabKey) => {
    if (next === 'book' && user && user.role !== 'customer') {
      pushToast('Only Customer accounts can book deliveries.', true);
      setActiveTab(user.role === 'driver' ? 'driver' : 'admin');
      return;
    }
    if (next === 'driver' && user?.role !== 'driver') {
      pushToast('Sign in via the Driver Portal with a company @hmktrading.ca account.', true);
      setActiveTab('auth');
      return;
    }
    if (next === 'admin' && user?.role !== 'admin') {
      pushToast('Sign in via the Fleet HQ Portal to open operations.', true);
      setActiveTab('auth');
      return;
    }
    setActiveTab(next);
    window.scrollTo({top: 0, behavior: 'smooth'});
  };

  const handleAuthenticated = (nextToken: string, nextUser: PublicUser) => {
    setToken(nextToken);
    setUser(nextUser);
    fetchOrders(nextToken);
    if (nextUser.role === 'driver') setActiveTab('driver');
    else if (nextUser.role === 'admin') setActiveTab('admin');
    else setActiveTab('book');
  };

  const handleLogout = () => {
    setToken(null);
    setUser(null);
    setOrders([]);
    setTransactions([]);
    setRebookDraft(null);
    setActiveTab('home');
    pushToast('Signed out.');
  };

  const handleTrackById = async (orderId: string) => {
    const clean = orderId.trim().toUpperCase().replace(/^#/, '');
    const localMatch = orders.find((o) => o.id === clean);
    if (localMatch) {
      setSelectedOrderId(localMatch.id);
      setActiveTab('track');
      return;
    }
    try {
      const res = await fetch(`/api/orders/track/${encodeURIComponent(clean)}`, {
        headers: token ? {Authorization: `Bearer ${token}`} : {},
      });
      if (!res.ok) {
        pushToast(`Order ${clean} not found.`, true);
        return;
      }
      const data = (await res.json()) as {order: OrderRecord};
      setOrders((prev) => (prev.some((o) => o.id === data.order.id) ? prev : [data.order, ...prev]));
      setSelectedOrderId(data.order.id);
      setActiveTab('track');
    } catch {
      pushToast('Could not look up order while offline.', true);
    }
  };

  const handleOpenNotifications = async () => {
    setNotifOpen(true);
    if (token && user && user.unread > 0) {
      try {
        const res = await fetch('/api/auth/notifications/read', {
          method: 'POST',
          headers: {Authorization: `Bearer ${token}`},
        });
        const data = (await res.json()) as {user?: PublicUser};
        if (res.ok && data.user) setUser(data.user);
      } catch {
        // ignore
      }
    }
  };

  const handleExecuteVoiceCommand = (action: VoiceAction) => {
    if (action.type === 'navigate') {
      handleSelectTab(action.target);
      pushToast(`Navigated to ${action.target}.`);
    } else if (action.type === 'theme') {
      setIsDark((prev) => (action.mode === 'dark' ? true : action.mode === 'light' ? false : !prev));
      pushToast('Theme updated.');
    } else if (action.type === 'lang') {
      setLang(action.lang);
      pushToast(`Language switched to ${action.lang.toUpperCase()}.`);
    } else if (action.type === 'open_wallet') {
      if (!user) {
        setActiveTab('auth');
        pushToast('Sign in to open wallet.', true);
      } else if (user.role !== 'customer') {
        pushToast('Wallet top-up is for Customer accounts only.', true);
      } else {
        setWalletOpen(true);
      }
    } else if (action.type === 'export_csv') {
      if (!orders.length) return pushToast('No orders to export yet.', true);
      const url = URL.createObjectURL(new Blob([buildOrdersCsv(orders)], {type: 'text/csv'}));
      const a = document.createElement('a');
      a.href = url;
      a.download = 'hmk-orders.csv';
      a.click();
      URL.revokeObjectURL(url);
      pushToast('CSV downloaded.');
    } else if (action.type === 'track_order') {
      handleTrackById(action.orderId);
    } else {
      pushToast(`Command not recognized: "${action.raw}"`, true);
    }
  };

  const handleToggleWidget = (key: keyof WidgetConfig) => {
    setWidgets((prev) => {
      const next = {...prev, [key]: !prev[key]};
      try {
        localStorage.setItem('hmk_widgets', JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  const handleExportCloudBundle = () => {
    const bundle = {
      exportedAt: new Date().toISOString(),
      account: user?.email || 'guest',
      orders,
      transactions,
    };
    const url = URL.createObjectURL(new Blob([JSON.stringify(bundle, null, 2)], {type: 'application/json'}));
    const a = document.createElement('a');
    a.href = url;
    a.download = `hmk-cloud-archive-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    pushToast('Cloud-ready archive exported.');
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-[#081624] dark:text-slate-100">
      <TopBar activeTab={activeTab} user={user} lang={lang} onSelectTab={handleSelectTab} />
      <WorkspaceBar
        user={user}
        lang={lang}
        isDark={isDark}
        wsConnected={wsConnected}
        offlineQueueCount={offlineQueue.length}
        onChangeLang={setLang}
        onToggleTheme={() => setIsDark((d) => !d)}
        onOpenWallet={() => setWalletOpen(true)}
        onOpenNotifications={handleOpenNotifications}
        onOpenProfile={() => setProfileOpen(true)}
        onOpenVoice={() => setVoiceOpen(true)}
        onOpenAuth={() => setActiveTab('auth')}
        onLogout={handleLogout}
        onSelectTab={handleSelectTab}
      />

      {!isOnline && (
        <div className="no-print border-b border-amber-400/40 bg-amber-50 px-4 py-2 text-center text-xs font-semibold text-amber-950 dark:bg-amber-950/50 dark:text-amber-200">
          {t(lang, 'offlineBanner')}
        </div>
      )}

      {/* Toast stack */}
      <div aria-live="polite" className="no-print fixed right-4 bottom-4 z-50 flex max-w-sm flex-col gap-2">
        {toasts.map((item) => (
          <div
            key={item.id}
            className={`flex items-center justify-between gap-3 rounded-xl border px-4 py-2.5 text-xs font-bold shadow-lg ${
              item.isError
                ? 'border-red-400 bg-red-950/95 text-red-100'
                : 'border-[#3f6212] bg-slate-900 text-[#9be136] dark:border-[#9be136]'
            }`}
          >
            <span>{item.text}</span>
            <button
              type="button"
              onClick={() => setToasts((prev) => prev.filter((t) => t.id !== item.id))}
              aria-label="Dismiss notification"
              className="opacity-75 hover:opacity-100"
            >
              ×
            </button>
          </div>
        ))}
      </div>

      <main className="mx-auto max-w-[1200px] px-4 py-8 sm:px-6">
        {activeTab === 'home' && (
          <OverviewView lang={lang} user={user} onTrackId={handleTrackById} onNavigate={handleSelectTab} />
        )}

        {activeTab === 'auth' && (
          <AuthPortalView lang={lang} onAuthenticated={handleAuthenticated} onToast={pushToast} />
        )}

        {activeTab === 'book' && (
          <BookingView
            user={user}
            token={token}
            isOnline={isOnline}
            initialDraft={rebookDraft}
            onOrderCreated={(order, updatedUser) => {
              setOrders((prev) => [order, ...prev.filter((o) => o.id !== order.id)]);
              if (updatedUser) setUser(updatedUser);
              setRebookDraft(null);
              setSelectedOrderId(order.id);
              setActiveTab('track');
              refreshTransactions(token);
            }}
            onQueueOfflineOrder={(payload) => {
              const queued: OfflineQueuedAction = {
                id: `Q-${Date.now()}`,
                endpoint: '/api/orders',
                method: 'POST',
                body: payload,
                createdAt: new Date().toISOString(),
              };
              setOfflineQueue((prev) => [...prev, queued]);
            }}
            onNeedAuth={() => setActiveTab('auth')}
            onNeedWallet={() => setWalletOpen(true)}
            onNavigateRoleHome={() =>
              setActiveTab(user?.role === 'driver' ? 'driver' : user?.role === 'admin' ? 'admin' : 'home')
            }
            onToast={pushToast}
          />
        )}

        {activeTab === 'track' && (
          <TrackingView
            orders={orders}
            selectedOrderId={selectedOrderId}
            user={user}
            token={token}
            onSelectOrder={setSelectedOrderId}
            onOrderUpdated={(updated, updatedUser) => {
              setOrders((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
              if (updatedUser) setUser(updatedUser);
              refreshTransactions(token);
            }}
            onShowInvoice={(o) => setInvoiceOrder(o)}
            onShowWaybill={(o) => setWaybillOrder(o)}
            onRebook={(o) => {
              setRebookDraft(o);
              handleSelectTab('book');
              pushToast(`Prefilled booking form from #${o.id}.`);
            }}
            onNavigateBook={() => handleSelectTab('book')}
            onToast={pushToast}
          />
        )}

        {activeTab === 'analytics' && (
          <DashboardAnalyticsView
            lang={lang}
            orders={orders}
            transactions={transactions}
            user={user}
            widgets={widgets}
            vaultMeta={vaultMeta}
            offlineQueueCount={offlineQueue.length}
            onToggleWidget={handleToggleWidget}
            onSyncOfflineVault={() => {
              syncEncryptedVault(user, orders, offlineQueue);
              pushToast('Encrypted AES-GCM offline vault updated.');
            }}
            onDecryptInspectVault={decryptInspectVault}
            onExportCloudBundle={handleExportCloudBundle}
            onToast={pushToast}
          />
        )}

        {activeTab === 'driver' && user?.role === 'driver' && token && (
          <DriverConsoleView
            user={user}
            token={token}
            orders={orders}
            onOrderUpdated={(updated, updatedUser) => {
              setOrders((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
              if (updatedUser) setUser(updatedUser);
              refreshTransactions(token);
            }}
            onUserUpdated={(u) => {
              setUser(u);
              refreshTransactions(token);
            }}
            onOpenProfile={() => setProfileOpen(true)}
            onToast={pushToast}
          />
        )}

        {activeTab === 'admin' && user?.role === 'admin' && token && (
          <FleetHqView
            lang={lang}
            admin={user}
            token={token}
            orders={orders}
            onOrderUpdated={(updated) => {
              setOrders((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
            }}
            onOrdersRestored={(restored) => setOrders(restored)}
            onToast={pushToast}
          />
        )}
      </main>

      <footer className="no-print mx-auto max-w-[1200px] border-t border-slate-200 px-4 py-6 text-center text-xs text-slate-500 sm:px-6 dark:border-slate-800 dark:text-slate-400">
        © {new Date().getFullYear()} HMK Trading Inc. — Canadian Freight &amp; On-Demand Logistics · CRA BN 84920 1948 RT0001
      </footer>

      <WalletModal
        open={walletOpen}
        user={user}
        token={token}
        transactions={transactions}
        onClose={() => setWalletOpen(false)}
        onSuccess={(u) => {
          setUser(u);
          refreshTransactions(token);
        }}
        onToast={pushToast}
      />
      <InvoiceModal order={invoiceOrder} onClose={() => setInvoiceOrder(null)} />
      <WaybillModal order={waybillOrder} onClose={() => setWaybillOrder(null)} />
      <NotificationsModal
        open={notifOpen}
        user={user}
        token={token}
        onClose={() => setNotifOpen(false)}
        onUserUpdated={setUser}
        onToast={pushToast}
      />
      <ProfileModal
        open={profileOpen}
        user={user}
        token={token}
        onClose={() => setProfileOpen(false)}
        onUserUpdated={setUser}
        onToast={pushToast}
      />
      <VoiceCommandModal
        open={voiceOpen}
        lang={lang}
        onClose={() => setVoiceOpen(false)}
        onExecute={handleExecuteVoiceCommand}
        onToast={pushToast}
      />
    </div>
  );
}
