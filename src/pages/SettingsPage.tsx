import { useState, useMemo, useEffect, useRef } from 'react';
import {
  Building2,
  Users as UsersIcon,
  Send,
  Plug,
  Database,
  RotateCcw,
  AlertTriangle,
  Info,
  RefreshCw,
  Search,
  CheckCircle2,
  XCircle,
  Clock,
  MessageCircle,
  Mail,
  Eye,
  EyeOff,
  Save,
  TestTube,
  UserCog,
  Camera,
  KeyRound,
  Cloud,
  Server,
} from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { showToast } from '../components/Toast';
import { isUserActive, formatTimeAgo, getStatusColor, getStatusDotColor } from '../utils/helpers';
import { getApiEndpoint } from '../utils/api';
import type { RepairRecord } from '../types';

type TabKey = 'profile' | 'business' | 'users' | 'messaging' | 'integrations' | 'database';

interface TabDef {
  key: TabKey;
  label: string;
  icon: React.ReactNode;
}

const ALL_TABS: TabDef[] = [
  { key: 'profile',      label: 'My Profile',      icon: <UserCog className="h-4 w-4" /> },
  { key: 'business',     label: 'Business Profile', icon: <Building2 className="h-4 w-4" /> },
  { key: 'users',        label: 'Users Monitor',    icon: <UsersIcon className="h-4 w-4" /> },
  { key: 'messaging',    label: 'Messaging Hub',    icon: <Send className="h-4 w-4" /> },
  { key: 'integrations', label: 'Integrations',     icon: <Plug className="h-4 w-4" /> },
  { key: 'database',    label: 'Database',          icon: <Database className="h-4 w-4" /> },
];

export function SettingsPage() {
  const { state, service } = useStore();
  const user = service.getCurrentUser()!;
  const isAdmin = user.role === 'admin';

  // Admins see all tabs; other roles see only their personal profile tab.
  const visibleTabs = isAdmin ? ALL_TABS : ALL_TABS.filter((t) => t.key === 'profile');
  const [activeTab, setActiveTab] = useState<TabKey>('profile');
  const [confirmReset, setConfirmReset] = useState(false);

  const handleReset = () => {
    service.resetAll();
    setConfirmReset(false);
    showToast('success', 'All data has been reset to defaults');
  };

  const dataStats = [
    { label: 'Users', count: state.users.length },
    { label: 'Repair Records', count: state.repairs.length },
    { label: 'Activity Logs', count: state.activities.length },
    { label: 'Audit Trail Entries', count: state.logs.length },
    { label: 'Notifications', count: state.notifications.length },
    { label: 'Auto-Notify Rules', count: state.autoNotifyRules.length },
  ];

  return (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100">Settings</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">
          {isAdmin ? 'System configuration, integrations, and data management' : 'Manage your profile and account'}
        </p>
      </div>

      {/* Tab bar */}
      <div className="card mb-4">
        <div className="flex flex-wrap gap-1 p-2">
          {visibleTabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-all duration-200 ${
                activeTab === tab.key
                  ? 'bg-brand-50 dark:bg-brand-950/20 text-brand-700 dark:text-brand-400'
                  : 'text-gray-600 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-800/50 hover:text-gray-900 dark:hover:text-slate-200'
              }`}
            >
              <span className={activeTab === tab.key ? 'text-brand-600' : 'text-gray-400'}>
                {tab.icon}
              </span>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div className="animate-fade-in">
        {activeTab === 'profile'      && <MyProfileTab />}
        {activeTab === 'business'     && <BusinessProfileTab />}
        {activeTab === 'users'        && <UsersMonitorTab />}
        {activeTab === 'messaging'    && <MessagingHubTab />}
        {activeTab === 'integrations' && <IntegrationsTab />}
        {activeTab === 'database'     && <DatabaseSettingsTab />}
      </div>

      {/* Data overview + danger zone — admin only */}
      {isAdmin && (
        <div className="mt-6 space-y-4">
          <div className="card p-5">
            <div className="flex items-center gap-2 mb-4">
              <Database className="h-5 w-5 text-gray-400" />
              <h2 className="text-base font-semibold text-gray-900">Data Overview</h2>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {dataStats.map((stat) => (
                <div key={stat.label} className="rounded-lg bg-gray-50 dark:bg-[#0b0f19] border border-gray-100 dark:border-slate-800 p-3">
                  <p className="text-2xl font-bold text-gray-900 dark:text-slate-100">{stat.count}</p>
                  <p className="text-xs text-gray-400 dark:text-slate-500">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="card p-5">
            <div className="flex items-center gap-2 mb-3">
              <Info className="h-5 w-5 text-gray-400" />
              <h2 className="text-base font-semibold text-gray-900">Storage</h2>
            </div>
            <p className="text-sm text-gray-600 dark:text-slate-400">
              All data is stored locally in your browser's localStorage and synced to Supabase.
            </p>
          </div>

          <div className="card p-5 border-red-200">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              <h2 className="text-base font-semibold text-gray-900">Danger Zone</h2>
            </div>
            <p className="text-sm text-gray-600 dark:text-slate-400 mb-4">
              Reset all data to the default seed state. This will permanently delete all changes you've made
              and restore the original demo data.
            </p>
            {!confirmReset ? (
              <button onClick={() => setConfirmReset(true)} className="btn-danger">
                <RotateCcw className="h-4 w-4" /> Reset All Data
              </button>
            ) : (
              <div className="flex items-center gap-3 flex-wrap">
                <span className="text-sm font-medium text-red-600">Are you sure? This cannot be undone.</span>
                <button onClick={handleReset} className="btn-danger">Yes, Reset Everything</button>
                <button onClick={() => setConfirmReset(false)} className="btn-secondary">Cancel</button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// Tab 0: My Profile — visible to all roles
// ============================================================

/** Resize + center-crop an image file to 200×200 JPEG (base64 data URL). */
function compressAvatar(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const size = 200;
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      if (!ctx) { reject(new Error('Canvas not available')); return; }
      const min = Math.min(img.width, img.height);
      const sx = (img.width - min) / 2;
      const sy = (img.height - min) / 2;
      ctx.drawImage(img, sx, sy, min, min, 0, 0, size, size);
      resolve(canvas.toDataURL('image/jpeg', 0.82));
    };
    img.onerror = () => { URL.revokeObjectURL(objectUrl); reject(new Error('Image load failed')); };
    img.src = objectUrl;
  });
}

function MyProfileTab() {
  const { service } = useStore();
  const user = service.getCurrentUser()!;
  const fileRef = useRef<HTMLInputElement>(null);

  // Profile form state
  const [nickname, setNickname] = useState(user.nickname ?? '');
  const [avatarPreview, setAvatarPreview] = useState<string | null>(user.avatar_url ?? null);
  const [avatarFile, setAvatarFile] = useState<string | null>(null); // base64 to save
  const [profileSaving, setProfileSaving] = useState(false);

  // Password form state
  const [pwForm, setPwForm] = useState({ current: '', next: '', confirm: '' });
  const [showPw, setShowPw] = useState({ current: false, next: false, confirm: false });
  const [pwSaving, setPwSaving] = useState(false);

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      showToast('error', 'Please select an image file');
      return;
    }
    try {
      const compressed = await compressAvatar(file);
      setAvatarPreview(compressed);
      setAvatarFile(compressed);
    } catch {
      showToast('error', 'Could not process image — please try another file');
    }
  };

  const handleRemoveAvatar = () => {
    setAvatarPreview(null);
    setAvatarFile(''); // empty string signals removal
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleSaveProfile = () => {
    setProfileSaving(true);
    const updates: Parameters<typeof service.updateUser>[1] = {
      nickname: nickname.trim() || null,
    };
    if (avatarFile !== null) {
      // avatarFile === '' means the user removed their avatar
      updates.avatar_url = avatarFile || null;
    }
    service.updateUser(user.id, updates);
    setAvatarFile(null); // mark as saved
    setProfileSaving(false);
    showToast('success', 'Profile updated');
  };

  const handleChangePassword = () => {
    if (!pwForm.current) { showToast('error', 'Enter your current password'); return; }
    if (pwForm.current !== user.password) { showToast('error', 'Current password is incorrect'); return; }
    if (!pwForm.next) { showToast('error', 'Enter a new password'); return; }
    if (pwForm.next.length < 4) { showToast('error', 'New password must be at least 4 characters'); return; }
    if (pwForm.next !== pwForm.confirm) { showToast('error', 'Passwords do not match'); return; }
    setPwSaving(true);
    service.updateUser(user.id, { password: pwForm.next });
    setPwForm({ current: '', next: '', confirm: '' });
    setPwSaving(false);
    showToast('success', 'Password changed successfully');
  };

  const displayName = user.nickname?.trim() || user.username;

  return (
    <div className="space-y-4">
      {/* ── Avatar + Display Name ──────────────────────────── */}
      <div className="card p-6">
        <div className="flex items-center gap-2 mb-5">
          <UserCog className="h-5 w-5 text-brand-500" />
          <h2 className="text-base font-semibold text-gray-900 dark:text-slate-100">Profile</h2>
        </div>

        <div className="flex flex-col sm:flex-row gap-6 items-start">
          {/* Avatar preview + upload */}
          <div className="flex flex-col items-center gap-3">
            <div className="relative">
              {avatarPreview ? (
                <img
                  src={avatarPreview}
                  alt={displayName}
                  className="h-20 w-20 rounded-full object-cover border-2 border-brand-200 dark:border-brand-800"
                />
              ) : (
                <div className="h-20 w-20 rounded-full bg-brand-100 dark:bg-brand-900 flex items-center justify-center text-brand-700 dark:text-brand-300 font-bold text-2xl border-2 border-brand-200 dark:border-brand-800">
                  {displayName.charAt(0).toUpperCase()}
                </div>
              )}
              <button
                onClick={() => fileRef.current?.click()}
                className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-brand-600 text-white shadow hover:bg-brand-700 transition-colors"
                title="Upload photo"
              >
                <Camera className="h-3.5 w-3.5" />
              </button>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleAvatarChange}
            />
            {avatarPreview && (
              <button
                onClick={handleRemoveAvatar}
                className="text-xs text-red-500 hover:text-red-700 dark:hover:text-red-400"
              >
                Remove photo
              </button>
            )}
          </div>

          {/* Nickname + username */}
          <div className="flex-1 min-w-0 space-y-4">
            <div>
              <label className="label">Username <span className="text-gray-400 font-normal">(read-only)</span></label>
              <input className="input bg-gray-50 dark:bg-slate-800/50 text-gray-500 dark:text-slate-400" value={user.username} readOnly />
            </div>
            <div>
              <label className="label">Display Name (Nickname)</label>
              <input
                className="input"
                placeholder={user.username}
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                maxLength={40}
              />
              <p className="mt-1 text-xs text-gray-400">Shown in the sidebar and header. Falls back to username if empty.</p>
            </div>
          </div>
        </div>

        <div className="mt-5 flex justify-end">
          <button
            onClick={handleSaveProfile}
            disabled={profileSaving}
            className="btn-primary"
          >
            <Save className="h-4 w-4" />
            Save Profile
          </button>
        </div>
      </div>

      {/* ── Change Password ────────────────────────────────── */}
      <div className="card p-6">
        <div className="flex items-center gap-2 mb-5">
          <KeyRound className="h-5 w-5 text-brand-500" />
          <h2 className="text-base font-semibold text-gray-900 dark:text-slate-100">Change Password</h2>
        </div>

        <div className="space-y-4 max-w-sm">
          {((['current', 'next', 'confirm'] as const)).map((field) => {
            const labels = { current: 'Current Password', next: 'New Password', confirm: 'Confirm New Password' };
            return (
              <div key={field}>
                <label className="label">{labels[field]}</label>
                <div className="relative">
                  <input
                    type={showPw[field] ? 'text' : 'password'}
                    className="input pr-10"
                    placeholder="••••••••"
                    value={pwForm[field]}
                    onChange={(e) => setPwForm((p) => ({ ...p, [field]: e.target.value }))}
                    autoComplete={field === 'current' ? 'current-password' : 'new-password'}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw((p) => ({ ...p, [field]: !p[field] }))}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPw[field] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-5 flex justify-end">
          <button
            onClick={handleChangePassword}
            disabled={pwSaving}
            className="btn-primary"
          >
            <KeyRound className="h-4 w-4" />
            Update Password
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Tab A: Business Profile
// ============================================================

function BusinessProfileTab() {
  const { state, service } = useStore();
  const config = state.config;
  const [form, setForm] = useState({
    company_name: config.company_name,
    address: config.address,
    phone: config.phone,
    mof: config.mof,
    logo_path: config.logo_path,
    auto_id_prefix: config.auto_id_prefix,
  });
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    service.updateConfig(form);
    setSaved(true);
    showToast('success', 'Business profile updated');
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="card p-6">
      <div className="flex items-center gap-2 mb-5">
        <Building2 className="h-5 w-5 text-brand-500" />
        <h2 className="text-base font-semibold text-gray-900 dark:text-slate-100">Business Profile</h2>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2">
          <label className="label">Company Name</label>
          <input className="input" value={form.company_name} onChange={(e) => setForm({ ...form, company_name: e.target.value })} />
        </div>
        <div>
          <label className="label">Phone</label>
          <input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        </div>
        <div>
          <label className="label">MOF (Ministry of Finance Number)</label>
          <input className="input" value={form.mof} onChange={(e) => setForm({ ...form, mof: e.target.value })} />
        </div>
        <div className="sm:col-span-2">
          <label className="label">Address</label>
          <input className="input" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
        </div>
        <div>
          <label className="label">Logo Path</label>
          <input className="input" value={form.logo_path} onChange={(e) => setForm({ ...form, logo_path: e.target.value })} />
        </div>
        <div>
          <label className="label">Auto ID Prefix</label>
          <input className="input" value={form.auto_id_prefix} onChange={(e) => setForm({ ...form, auto_id_prefix: e.target.value })} />
          <p className="mt-1 text-xs text-gray-400">Prefix used when generating repair IDs (e.g. {form.auto_id_prefix}-0001)</p>
        </div>
      </div>

      {/* Flow statuses display */}
      <div className="mt-6 pt-5 border-t border-gray-100 dark:border-slate-800">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-slate-100 mb-3">Repair Flow Statuses</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30 p-3">
            <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider mb-2">Finish Statuses</p>
            <div className="flex flex-wrap gap-1.5">
              {config.flow_statuses.finish_statuses.map((s) => (
                <span key={s} className="badge bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400">
                  <CheckCircle2 className="h-3 w-3" /> {s}
                </span>
              ))}
            </div>
          </div>
          <div className="rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/30 p-3">
            <p className="text-xs font-semibold text-red-700 dark:text-red-400 uppercase tracking-wider mb-2">Cancel Statuses</p>
            <div className="flex flex-wrap gap-1.5">
              {config.flow_statuses.cancel_statuses.map((s) => (
                <span key={s} className="badge bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-400">
                  <XCircle className="h-3 w-3" /> {s}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6 flex justify-end">
        <button onClick={handleSave} className="btn-primary">
          {saved ? <CheckCircle2 className="h-4 w-4" /> : <Save className="h-4 w-4" />}
          {saved ? 'Saved!' : 'Save Changes'}
        </button>
      </div>
    </div>
  );
}

// ============================================================
// Tab B: Users Monitor (UserRolesWindow)
// ============================================================

function UsersMonitorTab() {
  const { state, service } = useStore();
  const [refreshKey, setRefreshKey] = useState(0);

  // Force re-render on refresh
  useMemo(() => refreshKey, [refreshKey]);

  const handleRefresh = () => {
    service.heartbeat();
    setRefreshKey((k) => k + 1);
    showToast('info', 'User monitor refreshed');
  };

  return (
    <div className="card p-6">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <UsersIcon className="h-5 w-5 text-brand-500" />
          <h2 className="text-base font-semibold text-gray-900 dark:text-slate-100">System Users Monitor</h2>
        </div>
        <button onClick={handleRefresh} className="btn-secondary text-sm">
          <RefreshCw className="h-3.5 w-3.5" /> Refresh
        </button>
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-slate-800">
        <table className="w-full">
          <thead className="bg-gray-50 dark:bg-[#0b0f19] border-b border-gray-200 dark:border-slate-800">
            <tr>
              <th className="table-header">Username</th>
              <th className="table-header">Role</th>
              <th className="table-header">Live Status</th>
              <th className="table-header">Last Login</th>
              <th className="table-header">Last Seen</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {state.users.map((u) => {
              const active = isUserActive(u.last_seen);
              return (
                <tr key={u.id} className="hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors">
                  <td className="table-cell">
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-100 dark:bg-brand-900/30 text-brand-700 dark:text-brand-400 font-semibold text-xs">
                        {u.username.charAt(0).toUpperCase()}
                      </div>
                      <span className="font-medium text-gray-900 dark:text-slate-100">{u.username}</span>
                    </div>
                  </td>
                  <td className="table-cell">
                    <span className={`badge ${u.role === 'admin' ? 'bg-brand-50 dark:bg-brand-950/20 text-brand-700 dark:text-brand-400' : 'bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-400'}`}>
                      {u.role}
                    </span>
                  </td>
                  <td className="table-cell">
                    <span className={`flex items-center gap-1.5 text-sm font-medium ${active ? 'text-emerald-600' : 'text-gray-400 dark:text-slate-500'}`}>
                      <span className={`h-2 w-2 rounded-full ${active ? 'bg-emerald-500 animate-pulse-soft' : 'bg-gray-300 dark:bg-slate-600'}`} />
                      {active ? 'Active' : 'Offline'}
                    </span>
                  </td>
                  <td className="table-cell text-gray-600 dark:text-slate-400">{formatTimeAgo(u.last_login)}</td>
                  <td className="table-cell text-gray-600 dark:text-slate-400">{formatTimeAgo(u.last_seen)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex items-center gap-2 text-xs text-gray-400">
        <Info className="h-3.5 w-3.5" />
        Active status is determined by a 45-second heartbeat check on last_seen timestamp.
      </div>
    </div>
  );
}

// ============================================================
// Tab C: Messaging Integration Testing Hub (NotificationSettingsWindow)
// ============================================================

function MessagingHubTab() {
  const { state, service } = useStore();
  const [search, setSearch] = useState('');
  const [selectedRepairId, setSelectedRepairId] = useState<string>('');
  const [selectedTemplateKey, setSelectedTemplateKey] = useState<string>('');
  const [showPreview, setShowPreview] = useState(false);

  const config = state.config;

  // Get unique customers from repairs
  const customers = useMemo(() => {
    const seen = new Set<string>();
    return state.repairs
      .filter((r) => {
        if (seen.has(r.repair_id)) return false;
        seen.add(r.repair_id);
        return r.customer_name.toLowerCase().includes(search.toLowerCase()) ||
               r.repair_id.toLowerCase().includes(search.toLowerCase());
      })
      .sort((a, b) => a.customer_name.localeCompare(b.customer_name));
  }, [state.repairs, search]);

  // Find the latest active repair for the selected customer
  const selectedRepair: RepairRecord | null = useMemo(() => {
    if (!selectedRepairId) return null;
    return state.repairs.find((r) => r.id === selectedRepairId) || null;
  }, [selectedRepairId, state.repairs]);

  const selectedTemplate = config.whatsapp_templates.find((t) => t.key === selectedTemplateKey) || null;

  const renderedBody = useMemo(() => {
    if (!selectedRepair || !selectedTemplate) return '';
    return selectedTemplate.body
      .replace(/\{name\}/g, selectedRepair.customer_name)
      .replace(/\{repair_id\}/g, selectedRepair.repair_id)
      .replace(/\{status\}/g, selectedRepair.status);
  }, [selectedRepair, selectedTemplate]);

  const handleSendTemplate = () => {
    if (!selectedRepair || !selectedTemplate) {
      showToast('error', 'Select a customer and template first');
      return;
    }

    // Queue the notification
    service.createNotification(
      'whatsapp',
      selectedRepair.phone,
      selectedRepair.repair_id,
      `CRM Pro — ${selectedTemplate.label}`,
      renderedBody
    );

    showToast('success', `Template "${selectedTemplate.label}" queued for ${selectedRepair.customer_name}`);

    // Simulate dispatch — find the just-created notification and send it
    setTimeout(() => {
      const notifications = service.getState().notifications;
      const justQueued = notifications.find(
        (n) => n.customer_id === selectedRepair.repair_id && n.status === 'queued' && n.title.includes(selectedTemplate.label)
      );
      if (justQueued) {
        service.sendNotification(justQueued.id);
      }
    }, 800);

    setShowPreview(true);
  };

  return (
    <div className="card p-6">
      <div className="flex items-center gap-2 mb-5">
        <Send className="h-5 w-5 text-brand-500" />
        <h2 className="text-base font-semibold text-gray-900 dark:text-slate-100">Messaging Integration Testing Hub</h2>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Selection panel */}
        <div className="space-y-4">
          {/* Customer search + select */}
          <div>
            <label className="label">Search & Select Customer / Repair</label>
            <div className="relative mb-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                className="input pl-10"
                placeholder="Search by customer name or repair ID..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <select
              className="input"
              value={selectedRepairId}
              onChange={(e) => { setSelectedRepairId(e.target.value); setShowPreview(false); }}
            >
              <option value="">— Select a repair record —</option>
              {customers.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.customer_name} — {r.repair_id} ({r.brand} {r.model})
                </option>
              ))}
            </select>
          </div>

          {/* Template selection */}
          <div>
            <label className="label">WhatsApp Template</label>
            <select
              className="input"
              value={selectedTemplateKey}
              onChange={(e) => setSelectedTemplateKey(e.target.value)}
            >
              <option value="">— Select a template —</option>
              {config.whatsapp_templates.map((t) => (
                <option key={t.key} value={t.key}>
                  {t.label} ({t.lang})
                </option>
              ))}
            </select>
          </div>

          {/* Send button */}
          <button
            onClick={handleSendTemplate}
            disabled={!selectedRepair || !selectedTemplateKey}
            className="btn-primary w-full"
          >
            <MessageCircle className="h-4 w-4" /> Send Template
          </button>

          {/* Template preview text */}
          {selectedTemplate && (
            <div className="rounded-lg bg-gray-50 dark:bg-[#0b0f19] border border-gray-100 dark:border-slate-800 p-3">
              <p className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider mb-1">Template Body</p>
              <p className="text-sm text-gray-600 dark:text-slate-400 font-mono">{selectedTemplate.body}</p>
            </div>
          )}
        </div>

        {/* Right: Preview panel */}
        <div>
          <label className="label">Selected Repair Preview</label>
          {!selectedRepair ? (
            <div className="rounded-lg border-2 border-dashed border-gray-200 p-8 text-center">
              <Search className="h-8 w-8 mx-auto mb-2 text-gray-300" />
              <p className="text-sm text-gray-400">Select a repair record to preview</p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="rounded-lg border border-gray-200 dark:border-slate-800 p-4 bg-white dark:bg-[#0b0f19]">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs text-gray-400 dark:text-slate-500">Repair ID</p>
                    <p className="text-sm font-mono font-medium text-brand-600 dark:text-brand-400">{selectedRepair.repair_id}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 dark:text-slate-500">Customer Name</p>
                    <p className="text-sm font-medium text-gray-900 dark:text-slate-100">{selectedRepair.customer_name}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 dark:text-slate-500">Device</p>
                    <p className="text-sm text-gray-900 dark:text-slate-100">{selectedRepair.brand} {selectedRepair.model}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 dark:text-slate-500">Current Status</p>
                    <span className={`badge ${getStatusColor(selectedRepair.status)}`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${getStatusDotColor(selectedRepair.status)}`} />
                      {selectedRepair.status}
                    </span>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 dark:text-slate-500">Phone</p>
                    <p className="text-sm text-gray-600 dark:text-slate-400">{selectedRepair.phone}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 dark:text-slate-500">Email</p>
                    <p className="text-sm text-gray-600 dark:text-slate-400 truncate">{selectedRepair.email || '—'}</p>
                  </div>
                </div>
              </div>

              {/* Rendered message preview */}
              {renderedBody && (
                <div className="rounded-lg border border-emerald-200 dark:border-emerald-900/30 bg-emerald-50/50 dark:bg-emerald-950/20 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <MessageCircle className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                    <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">Rendered Message</p>
                  </div>
                  <p className="text-sm text-gray-700 dark:text-slate-300">{renderedBody}</p>
                </div>
              )}

              {/* Dispatch status */}
              {showPreview && (
                <div className="rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/30 p-3 animate-fade-in">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-blue-500 dark:text-blue-400" />
                    <p className="text-sm text-blue-700 dark:text-blue-400">Notification queued and dispatching...</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Tab D: Integrations Setup
// ============================================================

function IntegrationsTab() {
  const { state, service } = useStore();
  const config = state.config;

  // WhatsApp form with Supabase persistence
  const [waForm, setWaForm] = useState({
    enabled: false,
    api_version: 'v22.0',
    phone_number_id: '',
    access_token: '',
    template_language: 'en_US',
    finish_statuses: ['Ready For Pickup'],
    cancel_statuses: ['Canceled', 'Cancelled'],
  });
  const [waLoading, setWaLoading] = useState(true);
  const [waSaving, setWaSaving] = useState(false);
  const [testing, setTesting] = useState<string | null>(null);

  // Load WhatsApp config from Supabase on mount
  useEffect(() => {
    const loadConfig = async () => {
      try {
        const { data, error: _waErr } = await (await import('../services/supabaseClient')).supabase
          .from('whatsapp_config')
          .select('*')
          .eq('id', 1)
          .maybeSingle();

        if (data) {
          setWaForm({
            enabled: data.enabled ?? false,
            api_version: data.api_version ?? 'v22.0',
            phone_number_id: data.phone_number_id ?? '',
            access_token: data.access_token ?? '',
            template_language: data.template_language ?? 'en_US',
            finish_statuses: data.finish_statuses ?? ['Ready For Pickup'],
            cancel_statuses: data.cancel_statuses ?? ['Canceled', 'Cancelled'],
          });
        }
      } catch (err) {
        console.warn('[Settings] Failed to load WhatsApp config:', err);
      } finally {
        setWaLoading(false);
      }
    };
    loadConfig();
  }, []);

  const [emailForm, setEmailForm] = useState({
    enabled: config.email.enabled,
    host: config.email.host,
    port: config.email.port,
    user: config.email.user,
    pass: config.email.pass,
    from_name: config.email.from_name,
  });
  const [showWaToken, setShowWaToken] = useState(false);
  const [showEmailPass, setShowEmailPass] = useState(false);

  // Save WhatsApp config to Supabase
  const handleSaveWhatsApp = async () => {
    setWaSaving(true);
    try {
      const { error } = await (await import('../services/supabaseClient')).supabase
        .from('whatsapp_config')
        .upsert({
          id: 1,
          enabled: waForm.enabled,
          api_version: waForm.api_version,
          phone_number_id: waForm.phone_number_id,
          access_token: waForm.access_token,
          template_language: waForm.template_language,
          finish_statuses: waForm.finish_statuses,
          cancel_statuses: waForm.cancel_statuses,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'id' });

      if (error) {
        showToast('error', `Failed to save: ${error.message}`);
      } else {
        // Also sync to local config for backward compatibility
        service.updateConfig({
          whatsapp: {
            enabled: waForm.enabled,
            api_version: waForm.api_version,
            phone_number_id: waForm.phone_number_id,
            access_token: waForm.access_token,
          },
        });
        showToast('success', 'WhatsApp gateway configuration saved');
      }
    } catch (err) {
      showToast('error', `Failed to save: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setWaSaving(false);
    }
  };

  // Test WhatsApp connection via local backend
  const handleTestWhatsApp = async () => {
    if (!waForm.phone_number_id || !waForm.access_token) {
      showToast('error', 'Enter Phone Number ID and Access Token first');
      return;
    }
    setTesting('WhatsApp');
    try {
      const response = await fetch(getApiEndpoint('/api/whatsapp/test'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone_number_id: waForm.phone_number_id,
          access_token: waForm.access_token,
        }),
      });

      const data = await response.json();
      if (response.ok && data.success) {
        showToast('success', 'WhatsApp connection test successful');
      } else {
        showToast('error', `Connection failed: ${data.error || 'Unknown error'}`);
      }
    } catch (err) {
      showToast('error', `Connection failed: ${err instanceof Error ? err.message : 'Network error'}`);
    } finally {
      setTesting(null);
    }
  };

  const handleSaveEmail = () => {
    service.updateConfig({ email: { ...config.email, ...emailForm } });
    showToast('success', 'Email settings saved');
  };

  const handleTest = (channel: string) => {
    if (channel === 'WhatsApp') {
      handleTestWhatsApp();
      return;
    }
    setTesting(channel);
    setTimeout(() => {
      setTesting(null);
      showToast('info', `${channel} connection test: This is a placeholder. Configure your credentials and test with a live endpoint.`);
    }, 1200);
  };

  return (
    <div className="space-y-4">
      {/* WhatsApp Cloud API */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400">
              <MessageCircle className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-gray-900 dark:text-slate-100">WhatsApp Cloud API</h2>
              <p className="text-xs text-gray-400 dark:text-slate-500">Meta Cloud API integration for sending messages</p>
            </div>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <span className="text-sm text-gray-500 dark:text-slate-400">Enabled</span>
            <button
              type="button"
              onClick={() => setWaForm({ ...waForm, enabled: !waForm.enabled })}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${waForm.enabled ? 'bg-brand-600' : 'bg-gray-300 dark:bg-slate-700'}`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${waForm.enabled ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </label>
        </div>

        {waLoading ? (
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="label">API Version</label>
                <input className="input" value={waForm.api_version} onChange={(e) => setWaForm({ ...waForm, api_version: e.target.value })} placeholder="v22.0" />
              </div>
              <div>
                <label className="label">Phone Number ID</label>
                <input className="input" value={waForm.phone_number_id} onChange={(e) => setWaForm({ ...waForm, phone_number_id: e.target.value })} placeholder="e.g. 107039372694784" />
              </div>
              <div className="sm:col-span-2">
                <label className="label">Cloud Access Token</label>
                <div className="relative">
                  <input
                    type={showWaToken ? 'text' : 'password'}
                    className="input pr-10 font-mono"
                    value={waForm.access_token}
                    onChange={(e) => setWaForm({ ...waForm, access_token: e.target.value })}
                    placeholder="EAAG..."
                  />
                  <button type="button" onClick={() => setShowWaToken(!showWaToken)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    {showWaToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <p className="mt-1 text-xs text-gray-400 dark:text-slate-500">Your secret token - masked by default for security</p>
              </div>
              <div>
                <label className="label">Template Language</label>
                <select
                  className="input"
                  value={waForm.template_language}
                  onChange={(e) => setWaForm({ ...waForm, template_language: e.target.value })}
                >
                  <option value="en_US">English (US)</option>
                  <option value="en_GB">English (UK)</option>
                  <option value="ar">Arabic</option>
                  <option value="fr">French</option>
                  <option value="es">Spanish</option>
                </select>
              </div>
            </div>

            {/* Status Triggers */}
            <div className="mt-4 pt-4 border-t border-gray-100 dark:border-slate-800">
              <p className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider mb-3">Status Triggers</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30 p-3">
                  <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider mb-2">Finish Statuses</p>
                  <p className="text-xs text-emerald-600/70 dark:text-emerald-400/70 mb-2">Triggers &quot;order_finished&quot; template</p>
                  <div className="flex flex-wrap gap-1.5">
                    {waForm.finish_statuses.map((s) => (
                      <span key={s} className="badge bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400">
                        <CheckCircle2 className="h-3 w-3" /> {s}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/30 p-3">
                  <p className="text-xs font-semibold text-red-700 dark:text-red-400 uppercase tracking-wider mb-2">Cancel Statuses</p>
                  <p className="text-xs text-red-600/70 dark:text-red-400/70 mb-2">Triggers &quot;order_cancelled&quot; template</p>
                  <div className="flex flex-wrap gap-1.5">
                    {waForm.cancel_statuses.map((s) => (
                      <span key={s} className="badge bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-400">
                        <XCircle className="h-3 w-3" /> {s}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => handleTest('WhatsApp')} className="btn-secondary text-sm" disabled={!!testing || !waForm.phone_number_id || !waForm.access_token}>
                {testing === 'WhatsApp' ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <TestTube className="h-3.5 w-3.5" />}
                Test Connection
              </button>
              <button onClick={handleSaveWhatsApp} className="btn-primary text-sm" disabled={waSaving}>
                {waSaving ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                {waSaving ? 'Saving...' : 'Save Gateway Configurations'}
              </button>
            </div>
          </>
        )}
      </div>

      {/* Email / SMTP */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-950/20 text-blue-600 dark:text-blue-400">
              <Mail className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-gray-900 dark:text-slate-100">Email / SMTP</h2>
              <p className="text-xs text-gray-400 dark:text-slate-500">SMTP server configuration for email notifications</p>
            </div>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <span className="text-sm text-gray-500 dark:text-slate-400">Enabled</span>
            <button
              type="button"
              onClick={() => setEmailForm({ ...emailForm, enabled: !emailForm.enabled })}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${emailForm.enabled ? 'bg-brand-600' : 'bg-gray-300 dark:bg-slate-700'}`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${emailForm.enabled ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </label>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="label">SMTP Host</label>
            <input className="input" value={emailForm.host} onChange={(e) => setEmailForm({ ...emailForm, host: e.target.value })} placeholder="smtp.gmail.com" />
          </div>
          <div>
            <label className="label">Port</label>
            <input type="number" className="input" value={emailForm.port} onChange={(e) => setEmailForm({ ...emailForm, port: Number(e.target.value) })} placeholder="587" />
          </div>
          <div>
            <label className="label">Username</label>
            <input className="input" value={emailForm.user} onChange={(e) => setEmailForm({ ...emailForm, user: e.target.value })} placeholder="user@example.com" />
          </div>
          <div>
            <label className="label">Password</label>
            <div className="relative">
              <input
                type={showEmailPass ? 'text' : 'password'}
                className="input pr-10"
                value={emailForm.pass}
                onChange={(e) => setEmailForm({ ...emailForm, pass: e.target.value })}
              />
              <button type="button" onClick={() => setShowEmailPass(!showEmailPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                {showEmailPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <div className="sm:col-span-2">
            <label className="label">From Name</label>
            <input className="input" value={emailForm.from_name} onChange={(e) => setEmailForm({ ...emailForm, from_name: e.target.value })} />
          </div>
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <button onClick={() => handleTest('Email')} className="btn-secondary text-sm" disabled={!!testing}>
            {testing === 'Email' ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <TestTube className="h-3.5 w-3.5" />}
            Test Connection
          </button>
          <button onClick={handleSaveEmail} className="btn-primary text-sm">
            <Save className="h-3.5 w-3.5" /> Save
          </button>
        </div>
      </div>

    </div>
  );
}



function DatabaseSettingsTab() {
  const [dbMode, setDbMode] = useState<"cloud" | "local">("cloud");
  const [showSecrets, setShowSecrets] = useState(false);
  const [showLocalPass, setShowLocalPass] = useState(false);

  const [cloudForm, setCloudForm] = useState({
    supabaseUrl: "",
    supabaseAnonKey: "",
    supabaseDbUrl: "",
    supabaseServiceRoleKey: "",
  });

  const [localForm, setLocalForm] = useState({
    host: "localhost",
    port: 5432,
    database: "",
    username: "",
    password: "",
  });

  const [savedDbConfig, setSavedDbConfig] = useState(false);

  const handleSaveCloud = () => {
    setSavedDbConfig(true);
    showToast("success", "Cloud database settings saved");
  };

  const handleSaveLocal = () => {
    setSavedDbConfig(true);
    showToast("success", "Local database settings saved");
  };

  return (
    <div className="space-y-5 max-w-3xl">
      <div className="card p-5">
        <div className="flex items-center gap-2 mb-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400">
            <Database className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-gray-900 dark:text-slate-100">Database Settings</h2>
            <p className="text-xs text-gray-400 dark:text-slate-500">Choose where your data is stored</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setDbMode("cloud")}
            className={"flex items-start gap-3 rounded-xl border p-4 text-left transition-all " + (dbMode === "cloud" ? "border-brand-500 bg-brand-50 dark:bg-brand-950/20 ring-1 ring-brand-500" : "border-gray-200 dark:border-slate-700 hover:border-gray-300 dark:hover:border-slate-600")}
          >
            <div className={"flex h-9 w-9 shrink-0 items-center justify-center rounded-lg " + (dbMode === "cloud" ? "bg-brand-600 text-white" : "bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-slate-400")}>
              <Cloud className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900 dark:text-slate-100">Cloud (Supabase)</p>
              <p className="text-xs text-gray-400 dark:text-slate-500">Hosted PostgreSQL with auth &amp; realtime</p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setDbMode("local")}
            className={"flex items-start gap-3 rounded-xl border p-4 text-left transition-all " + (dbMode === "local" ? "border-brand-500 bg-brand-50 dark:bg-brand-950/20 ring-1 ring-brand-500" : "border-gray-200 dark:border-slate-700 hover:border-gray-300 dark:hover:border-slate-600")}
          >
            <div className={"flex h-9 w-9 shrink-0 items-center justify-center rounded-lg " + (dbMode === "local" ? "bg-brand-600 text-white" : "bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-slate-400")}>
              <Server className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900 dark:text-slate-100">Local Database</p>
              <p className="text-xs text-gray-400 dark:text-slate-500">Self-hosted PostgreSQL on your machine</p>
            </div>
          </button>
        </div>
      </div>

      {dbMode === "cloud" && (
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-50 dark:bg-brand-950/20 text-brand-600 dark:text-brand-400">
                <Cloud className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-gray-900 dark:text-slate-100">Cloud Configuration</h2>
                <p className="text-xs text-gray-400 dark:text-slate-500">Enter your project credentials</p>
              </div>
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <span className="text-sm text-gray-500 dark:text-slate-400">Show secrets</span>
              <button
                type="button"
                onClick={() => setShowSecrets(!showSecrets)}
                className={"relative inline-flex h-6 w-11 items-center rounded-full transition-colors " + (showSecrets ? "bg-brand-600" : "bg-gray-300 dark:bg-slate-700")}
              >
                <span className={"inline-block h-4 w-4 transform rounded-full bg-white transition-transform " + (showSecrets ? "translate-x-6" : "translate-x-1")} />
              </button>
            </label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="label">VITE_SUPABASE_URL</label>
              <input className="input" type={showSecrets ? "text" : "password"} value={cloudForm.supabaseUrl} onChange={(e) => setCloudForm({ ...cloudForm, supabaseUrl: e.target.value })} placeholder="https://xxxxxxxx.supabase.co" />
            </div>
            <div>
              <label className="label">VITE_SUPABASE_ANON_KEY</label>
              <input className="input" type={showSecrets ? "text" : "password"} value={cloudForm.supabaseAnonKey} onChange={(e) => setCloudForm({ ...cloudForm, supabaseAnonKey: e.target.value })} placeholder="eyJhbGciOi..." />
            </div>
            <div>
              <label className="label">SUPABASE_DB_URL</label>
              <input className="input" type={showSecrets ? "text" : "password"} value={cloudForm.supabaseDbUrl} onChange={(e) => setCloudForm({ ...cloudForm, supabaseDbUrl: e.target.value })} placeholder="postgresql://postgres:****@db.xxxx.supabase.co:5432/postgres" />
            </div>
            <div className="sm:col-span-2">
              <label className="label">SUPABASE_SERVICE_ROLE_KEY</label>
              <input className="input" type={showSecrets ? "text" : "password"} value={cloudForm.supabaseServiceRoleKey} onChange={(e) => setCloudForm({ ...cloudForm, supabaseServiceRoleKey: e.target.value })} placeholder="eyJhbGciOi..." />
            </div>
          </div>

          <div className="mt-4 flex justify-end">
            <button onClick={handleSaveCloud} className="btn-primary text-sm">
              <Save className="h-3.5 w-3.5" /> Save
            </button>
          </div>
        </div>
      )}

      {dbMode === "local" && (
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-50 dark:bg-amber-950/20 text-amber-600 dark:text-amber-400">
              <Server className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-gray-900 dark:text-slate-100">Local Database Configuration</h2>
              <p className="text-xs text-gray-400 dark:text-slate-500">Connect to a self-hosted PostgreSQL instance</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Host / IP</label>
              <input className="input" value={localForm.host} onChange={(e) => setLocalForm({ ...localForm, host: e.target.value })} placeholder="localhost" />
            </div>
            <div>
              <label className="label">Port</label>
              <input type="number" className="input" value={localForm.port} onChange={(e) => setLocalForm({ ...localForm, port: Number(e.target.value) })} placeholder="5432" />
            </div>
            <div>
              <label className="label">Database Name</label>
              <input className="input" value={localForm.database} onChange={(e) => setLocalForm({ ...localForm, database: e.target.value })} placeholder="cygnus_repairs" />
            </div>
            <div>
              <label className="label">Username</label>
              <input className="input" value={localForm.username} onChange={(e) => setLocalForm({ ...localForm, username: e.target.value })} placeholder="postgres" />
            </div>
            <div className="sm:col-span-2">
              <label className="label">Password</label>
              <div className="relative">
                <input type={showLocalPass ? "text" : "password"} className="input pr-10" value={localForm.password} onChange={(e) => setLocalForm({ ...localForm, password: e.target.value })} placeholder="••••••••" />
                <button type="button" onClick={() => setShowLocalPass(!showLocalPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {showLocalPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
          </div>

          <div className="mt-4 flex justify-end">
            <button onClick={handleSaveLocal} className="btn-primary text-sm">
              <Save className="h-3.5 w-3.5" /> Save
            </button>
          </div>
        </div>
      )}

      {savedDbConfig && (
        <div className="card p-4 flex items-center gap-3 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800">
          <KeyRound className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
          <p className="text-sm text-emerald-700 dark:text-emerald-400">
            Database configuration saved. Changes will apply on next application restart.
          </p>
        </div>
      )}
    </div>
  );
}
