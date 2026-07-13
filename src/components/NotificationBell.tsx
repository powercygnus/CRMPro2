import { useState, useEffect, useRef, useCallback } from 'react';
import { Bell, Check, X, KeyRound, PackagePlus, PackageMinus, Wrench, Truck, WrenchIcon } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { showToast } from './Toast';
import { useStore } from '../context/StoreContext';
import type { SystemNotification, SysNotifType } from '../services/systemNotifications';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60_000) return 'just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

function genTempPassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#';
  return Array.from({ length: 10 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

interface TypeMeta { icon: React.ReactNode; iconBg: string }

const TYPE_META: Record<SysNotifType, TypeMeta> = {
  password_reset: {
    icon: <KeyRound className="h-3.5 w-3.5" />,
    iconBg: 'bg-violet-100 dark:bg-violet-900/40 text-violet-600 dark:text-violet-400',
  },
  inventory_in: {
    icon: <PackagePlus className="h-3.5 w-3.5" />,
    iconBg: 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400',
  },
  inventory_out: {
    icon: <PackageMinus className="h-3.5 w-3.5" />,
    iconBg: 'bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400',
  },
  repair_in: {
    icon: <Wrench className="h-3.5 w-3.5" />,
    iconBg: 'bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400',
  },
  repair_out: {
    icon: <WrenchIcon className="h-3.5 w-3.5" />,
    iconBg: 'bg-teal-100 dark:bg-teal-900/40 text-teal-600 dark:text-teal-400',
  },
  delivery: {
    icon: <Truck className="h-3.5 w-3.5" />,
    iconBg: 'bg-orange-100 dark:bg-orange-900/40 text-orange-600 dark:text-orange-400',
  },
};

// ─── Component ────────────────────────────────────────────────────────────────

interface ResetRequest {
  id: string;
  username: string;
  status: string;
}

export function NotificationBell() {
  const { service } = useStore();
  const user = service.getCurrentUser();
  const isAdmin = user?.role === 'admin';

  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<SystemNotification[]>([]);
  const [pendingResets, setPendingResets] = useState<Record<string, ResetRequest>>({});

  const panelRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  const unreadCount = notifications.filter((n) => n.status === 'unread').length;

  // ── Load ──────────────────────────────────────────────────────────────────

  const loadNotifications = useCallback(async () => {
    const { data, error } = await supabase
      .from('system_notifications')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);
    if (!error && data) setNotifications(data as SystemNotification[]);
  }, []);

  const loadResetRequests = useCallback(async (notifs: SystemNotification[]) => {
    const ids = notifs
      .filter((n) => n.type === 'password_reset' && n.related_id)
      .map((n) => n.related_id!);
    if (!ids.length) return;
    const { data } = await supabase
      .from('password_reset_requests')
      .select('id, username, status')
      .in('id', ids);
    if (data) {
      const map: Record<string, ResetRequest> = {};
      (data as ResetRequest[]).forEach((r) => { map[r.id] = r; });
      setPendingResets(map);
    }
  }, []);

  useEffect(() => { loadNotifications(); }, [loadNotifications]);

  useEffect(() => {
    if (notifications.length) loadResetRequests(notifications);
  }, [notifications, loadResetRequests]);

  // ── Realtime subscription ─────────────────────────────────────────────────

  useEffect(() => {
    const channel = supabase
      .channel('notif_bell_realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'system_notifications' },
        () => loadNotifications()
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [loadNotifications]);

  // ── Close on outside click ────────────────────────────────────────────────

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (
        panelRef.current && !panelRef.current.contains(e.target as Node) &&
        btnRef.current  && !btnRef.current.contains(e.target as Node)
      ) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // ── Actions ───────────────────────────────────────────────────────────────

  const markRead = async (id: string) => {
    await supabase.from('system_notifications').update({ status: 'read' }).eq('id', id);
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, status: 'read' } : n)));
  };

  const markAllRead = async () => {
    const unreadIds = notifications.filter((n) => n.status === 'unread').map((n) => n.id);
    if (!unreadIds.length) return;
    await supabase.from('system_notifications').update({ status: 'read' }).in('id', unreadIds);
    setNotifications((prev) => prev.map((n) => ({ ...n, status: 'read' as const })));
  };

  const handleAccept = async (notif: SystemNotification) => {
    if (!notif.related_id || !user) return;
    const tempPass = genTempPassword();
    const now = new Date().toISOString();
    const reqUsername = pendingResets[notif.related_id]?.username ?? 'user';

    // 1. Write temp password + status to the reset-request row
    await supabase.from('password_reset_requests').update({
      status: 'approved',
      temp_password: tempPass,
      resolved_at: now,
      resolved_by: user.username,
    }).eq('id', notif.related_id);

    // 2. Update the matching user's password so they can actually log in.
    //    Passwords are stored as plain text; we write the temp password directly.
    const targetUser = service.getState().users.find(
      (u) => u.username === reqUsername
    );
    if (targetUser) {
      // Update in-memory state + sync to Supabase users table immediately
      service.updateUser(targetUser.id, { password: tempPass });
    } else {
      // User not in local state (e.g. localStorage cleared) — write directly to DB
      const { error } = await supabase
        .from('users')
        .update({ password: tempPass })
        .eq('username', reqUsername);
      if (error) console.error('[NotificationBell] Failed to update user password:', error.message);
    }

    await markRead(notif.id);
    setPendingResets((prev) => ({
      ...prev,
      [notif.related_id!]: { ...prev[notif.related_id!], status: 'approved' },
    }));
    showToast('success', `✅ Approved! Temp password for ${reqUsername}: ${tempPass}`);
  };

  const handleReject = async (notif: SystemNotification) => {
    if (!notif.related_id || !user) return;
    await supabase.from('password_reset_requests').update({
      status: 'rejected',
      resolved_at: new Date().toISOString(),
      resolved_by: user.username,
    }).eq('id', notif.related_id);
    await markRead(notif.id);
    const reqUsername = pendingResets[notif.related_id]?.username ?? 'user';
    setPendingResets((prev) => ({
      ...prev,
      [notif.related_id!]: { ...prev[notif.related_id!], status: 'rejected' },
    }));
    showToast('info', `Request from ${reqUsername} rejected.`);
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="relative">
      {/* Bell button */}
      <button
        ref={btnRef}
        onClick={() => setOpen((o) => !o)}
        className="relative flex items-center justify-center rounded-lg border border-gray-200 dark:border-slate-600 p-2 text-gray-600 dark:text-gray-300 transition-colors hover:bg-gray-50 dark:hover:bg-slate-800"
        title="Notifications"
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-1.5 -right-1.5 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-red-500 px-0.5 text-[10px] font-bold text-white leading-none shadow-sm">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div
          ref={panelRef}
          className="absolute right-0 top-full mt-2 w-96 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xl shadow-black/10 dark:shadow-black/50 z-50 overflow-hidden"
        >
          {/* Panel header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-gray-500 dark:text-gray-400" />
              <span className="text-sm font-semibold text-gray-800 dark:text-white">Notifications</span>
              {unreadCount > 0 && (
                <span className="rounded-full bg-red-100 dark:bg-red-900/40 px-2 py-0.5 text-[11px] font-bold text-red-600 dark:text-red-400">
                  {unreadCount} new
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  onClick={markAllRead}
                  className="text-[11px] font-medium text-brand-600 dark:text-brand-400 hover:underline"
                >
                  Mark all read
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                className="rounded p-0.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* Notification list */}
          <div className="max-h-[440px] overflow-y-auto divide-y divide-gray-50 dark:divide-slate-800/60">
            {notifications.length === 0 ? (
              <div className="py-12 text-center">
                <Bell className="h-8 w-8 mx-auto mb-2 text-gray-300 dark:text-slate-600" />
                <p className="text-sm text-gray-400 dark:text-gray-500">No notifications yet</p>
              </div>
            ) : (
              notifications.map((notif) => {
                const meta = TYPE_META[notif.type] ?? TYPE_META.delivery;
                const isUnread = notif.status === 'unread';
                const resetReq = notif.related_id ? pendingResets[notif.related_id] : null;
                const canAct = isAdmin && notif.type === 'password_reset' && resetReq?.status === 'pending';

                return (
                  <div
                    key={notif.id}
                    onClick={() => isUnread && !canAct && markRead(notif.id)}
                    className={`px-4 py-3 transition-colors cursor-default ${
                      isUnread ? 'bg-brand-50/40 dark:bg-brand-900/10' : ''
                    } hover:bg-gray-50 dark:hover:bg-slate-800/50`}
                  >
                    <div className="flex items-start gap-3">
                      {/* Type icon */}
                      <span className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${meta.iconBg}`}>
                        {meta.icon}
                      </span>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <p className={`text-sm font-medium truncate ${
                            isUnread ? 'text-gray-900 dark:text-white' : 'text-gray-600 dark:text-gray-400'
                          }`}>
                            {notif.title}
                          </p>
                          {isUnread && (
                            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-red-500" />
                          )}
                        </div>
                        <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400 line-clamp-2">
                          {notif.body}
                        </p>
                        <p className="mt-1 text-[10px] text-gray-400 dark:text-gray-500 tabular-nums">
                          {timeAgo(notif.created_at)}
                          {notif.created_by && ` · by ${notif.created_by}`}
                        </p>

                        {/* Accept / Reject — admin only, password_reset pending */}
                        {canAct && (
                          <div className="mt-2.5 flex items-center gap-2">
                            <span className="flex-1 text-xs text-gray-500 dark:text-gray-400">
                              Request from{' '}
                              <strong className="font-semibold text-gray-700 dark:text-gray-300">
                                {resetReq?.username}
                              </strong>
                            </span>
                            <button
                              onClick={(e) => { e.stopPropagation(); handleAccept(notif); }}
                              className="flex items-center gap-1 rounded-md bg-emerald-100 dark:bg-emerald-900/30 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-400 hover:bg-emerald-200 dark:hover:bg-emerald-800/50 transition-colors"
                            >
                              <Check className="h-3 w-3" /> Accept
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); handleReject(notif); }}
                              className="flex items-center gap-1 rounded-md bg-red-100 dark:bg-red-900/30 px-2.5 py-1 text-xs font-semibold text-red-700 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-800/50 transition-colors"
                            >
                              <X className="h-3 w-3" /> Reject
                            </button>
                          </div>
                        )}

                        {/* Resolved badge */}
                        {notif.type === 'password_reset' && resetReq && resetReq.status !== 'pending' && (
                          <span className={`mt-1.5 inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                            resetReq.status === 'approved'
                              ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
                              : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                          }`}>
                            {resetReq.status === 'approved' ? <Check className="h-2.5 w-2.5" /> : <X className="h-2.5 w-2.5" />}
                            {resetReq.status === 'approved' ? 'Approved' : 'Rejected'}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
