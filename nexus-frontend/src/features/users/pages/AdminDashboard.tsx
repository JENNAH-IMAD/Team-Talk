import React, { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users, Layers, MessageSquare, Activity, Search, Shield, UserX,
  ChevronDown, X, Check, AlertTriangle,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area,
} from 'recharts';
import { Avatar } from '@/components/ui';
import apiClient from '@/services/apiClient';
import toast from 'react-hot-toast';
import type { User, UserRole } from '@/types';

// ── helpers ────────────────────────────────────────────────
const ROLES: { value: UserRole; label: string; color: string }[] = [
  { value: 'admin',    label: 'Admin',    color: '#f59e0b' },
  { value: 'manager',  label: 'Manager',  color: '#6247ea' },
  { value: 'employee', label: 'Employee', color: '#6b7280' },
];

const STATUS_COLOR: Record<string, string> = {
  online: '#10b981',
  away: '#f59e0b',
  donotdisturb: '#ef4444',
  offline: '#9ca3af',
};

const STATUS_LABEL: Record<string, string> = {
  online: 'Online',
  away: 'Away',
  donotdisturb: 'Do Not Disturb',
  offline: 'Offline',
};

interface AdminStats {
  messagesToday: number;
  teamCount: number;
  weeklyActivity: { day: string; messages: number }[];
  monthlyActivity: { month: string; messages: number }[];
}

// ── RoleDropdown ───────────────────────────────────────────
interface RoleDropdownProps {
  user: User;
  onUpdate: (userId: string, role: UserRole) => void;
}

const RoleDropdown: React.FC<RoleDropdownProps> = ({ user, onUpdate }) => {
  const [open, setOpen] = useState(false);
  const current = ROLES.find((r) => r.value === user.role) ?? ROLES[2];

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-md transition-colors hover:opacity-80"
        style={{ backgroundColor: current.color + '18', color: current.color }}
      >
        {current.label}
        <ChevronDown size={11} />
      </button>
      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -4 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -4 }}
              transition={{ duration: 0.12 }}
              className="absolute z-20 left-0 top-full mt-1 w-36 bg-white dark:bg-surface-900 border border-subtle rounded-xl shadow-lg overflow-hidden"
            >
              {ROLES.map((r) => (
                <button
                  key={r.value}
                  onClick={() => { onUpdate(user.id, r.value); setOpen(false); }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold hover:bg-surface-50 dark:hover:bg-surface-800 transition-colors"
                  style={{ color: r.color }}
                >
                  {r.value === user.role && <Check size={11} />}
                  <span className={r.value !== user.role ? 'ml-[15px]' : ''}>{r.label}</span>
                </button>
              ))}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

// ── DeactivateModal ────────────────────────────────────────
interface DeactivateModalProps {
  user: User | null;
  onConfirm: () => void;
  onCancel: () => void;
}

const DeactivateModal: React.FC<DeactivateModalProps> = ({ user, onConfirm, onCancel }) => (
  <AnimatePresence>
    {user && (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
        onClick={onCancel}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          transition={{ duration: 0.2 }}
          className="bg-white dark:bg-surface-900 rounded-2xl p-6 w-full max-w-sm shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="w-12 h-12 rounded-2xl bg-red-50 dark:bg-red-500/10 flex items-center justify-center mx-auto mb-4">
            <AlertTriangle size={22} className="text-red-500" />
          </div>
          <h3 className="text-base font-black text-gray-900 dark:text-gray-100 font-display text-center mb-2">
            Deactivate account?
          </h3>
          <p className="text-sm text-gray-500 text-center mb-6">
            <span className="font-semibold text-gray-700 dark:text-gray-300">{user.name}</span> will
            lose access to Nexus.
          </p>
          <div className="flex gap-2">
            <button
              onClick={onCancel}
              className="flex-1 py-2.5 text-sm font-semibold rounded-xl border border-subtle text-gray-500 hover:bg-surface-50 dark:hover:bg-surface-800 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              className="flex-1 py-2.5 text-sm font-semibold rounded-xl bg-red-500 text-white hover:bg-red-600 transition-colors"
            >
              Deactivate
            </button>
          </div>
        </motion.div>
      </motion.div>
    )}
  </AnimatePresence>
);

// ═══════════════════════════════════════════════════════════
// ADMIN DASHBOARD
// ═══════════════════════════════════════════════════════════
const AdminDashboard: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [deactivateTarget, setDeactivateTarget] = useState<User | null>(null);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const chartTextColor = '#888';

  const loadUsers = useCallback(async () => {
    try {
      setIsLoading(true);
      const [usersRes, statsRes] = await Promise.all([
        apiClient.get<User[]>('/users'),
        apiClient.get<AdminStats>('/admin/stats'),
      ]);
      setUsers(usersRes.data);
      setStats(statsRes.data);
    } catch {
      toast.error('Failed to load dashboard data');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { loadUsers(); }, [loadUsers]);

  const handleRoleUpdate = async (userId: string, role: UserRole) => {
    try {
      await apiClient.put(`/users/${userId}/role`, { role });
      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, role } : u)));
      toast.success('Role updated');
    } catch {
      toast.error('Failed to update role');
    }
  };

  const handleDeactivate = async () => {
    if (!deactivateTarget) return;
    try {
      await apiClient.delete(`/users/${deactivateTarget.id}`);
      setUsers((prev) => prev.filter((u) => u.id !== deactivateTarget.id));
      toast.success(`${deactivateTarget.name} deactivated`);
    } catch {
      toast.error('Failed to deactivate user');
    } finally {
      setDeactivateTarget(null);
    }
  };

  const filtered = users.filter(
    (u) =>
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase()) ||
      (u.title ?? '').toLowerCase().includes(search.toLowerCase())
  );

  // Stats derived from real data
  const online = users.filter((u) => u.status === 'online').length;
  const roleData = [
    { name: 'Admin',    value: users.filter((u) => u.role === 'admin').length,    color: '#f59e0b' },
    { name: 'Manager',  value: users.filter((u) => u.role === 'manager').length,  color: '#6247ea' },
    { name: 'Employee', value: users.filter((u) => u.role === 'employee').length, color: '#10b981' },
  ];

  const statCards = [
    { label: 'Total Users',    value: users.length.toString(), icon: Users,         color: '#6247ea' },
    { label: 'Online Now',     value: online.toString(),        icon: Activity,      color: '#10b981' },
    { label: 'Messages Today', value: stats ? stats.messagesToday.toLocaleString() : '—', icon: MessageSquare, color: '#3b82f6' },
    { label: 'Active Teams',   value: stats ? stats.teamCount.toString() : '—',          icon: Layers,        color: '#f59e0b' },
  ];

  return (
    <>
      <DeactivateModal
        user={deactivateTarget}
        onConfirm={handleDeactivate}
        onCancel={() => setDeactivateTarget(null)}
      />

      <div className="flex-1 overflow-y-auto p-8 font-body">
        <div className="max-w-5xl">
          <motion.h2
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-xl font-black text-gray-900 dark:text-gray-100 font-display mb-6"
          >
            Admin Dashboard
          </motion.h2>

          {/* Stats */}
          <div className="grid grid-cols-4 gap-3.5 mb-7">
            {statCards.map((s, i) => (
              <motion.div
                key={s.label}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.07 }}
                className="bg-white dark:bg-surface-900 border border-subtle rounded-2xl p-5"
              >
                <div className="flex justify-between items-start mb-3">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center"
                    style={{ backgroundColor: s.color + '18' }}
                  >
                    <s.icon size={18} style={{ color: s.color }} />
                  </div>
                </div>
                <div className="text-2xl font-black text-gray-900 dark:text-gray-100 font-display tracking-tight">
                  {isLoading ? (
                    <div className="h-7 w-12 bg-surface-100 dark:bg-surface-800 rounded-lg animate-pulse" />
                  ) : (
                    s.value
                  )}
                </div>
                <div className="text-xs text-gray-500 mt-0.5">{s.label}</div>
              </motion.div>
            ))}
          </div>

          {/* Charts row */}
          <div className="grid grid-cols-[2fr_1fr] gap-3.5 mb-7">
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="bg-white dark:bg-surface-900 border border-subtle rounded-2xl p-5"
            >
              <h3 className="font-bold text-sm text-gray-900 dark:text-gray-100 font-display mb-5">
                Weekly Activity
              </h3>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={stats?.weeklyActivity ?? []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" className="dark:opacity-20" />
                  <XAxis dataKey="day" tick={{ fill: chartTextColor, fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: chartTextColor, fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 12 }} />
                  <Bar dataKey="messages" fill="#6247ea" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35 }}
              className="bg-white dark:bg-surface-900 border border-subtle rounded-2xl p-5"
            >
              <h3 className="font-bold text-sm text-gray-900 dark:text-gray-100 font-display mb-5">
                Users by Role
              </h3>
              <ResponsiveContainer width="100%" height={150}>
                <PieChart>
                  <Pie data={roleData} cx="50%" cy="50%" innerRadius={38} outerRadius={58} dataKey="value" paddingAngle={4}>
                    {roleData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-col gap-1.5 mt-2">
                {roleData.map((r) => (
                  <div key={r.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: r.color }} />
                      <span className="text-[11px] text-gray-500">{r.name}</span>
                    </div>
                    <span className="text-[11px] font-bold text-gray-700 dark:text-gray-300">{r.value}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>

          {/* Monthly trend */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="bg-white dark:bg-surface-900 border border-subtle rounded-2xl p-5 mb-7"
          >
            <h3 className="font-bold text-sm text-gray-900 dark:text-gray-100 font-display mb-5">
              Monthly Trends
            </h3>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={stats?.monthlyActivity ?? []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" className="dark:opacity-20" />
                <XAxis dataKey="month" tick={{ fill: chartTextColor, fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: chartTextColor, fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 12 }} />
                <Area type="monotone" dataKey="messages" stroke="#6247ea" fill="rgba(98,71,234,0.08)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </motion.div>

          {/* User management */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.45 }}
            className="bg-white dark:bg-surface-900 border border-subtle rounded-2xl p-5"
          >
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-bold text-sm text-gray-900 dark:text-gray-100 font-display">
                User Management
              </h3>
              <div className="relative">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search users…"
                  className="pl-8 pr-8 py-2 text-xs rounded-lg border border-subtle bg-surface-50 dark:bg-surface-800 text-gray-700 dark:text-gray-300 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-brand-500/40 w-52"
                />
                {search && (
                  <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2">
                    <X size={12} className="text-gray-400 hover:text-gray-600" />
                  </button>
                )}
              </div>
            </div>

            {isLoading ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="h-12 bg-surface-50 dark:bg-surface-800 rounded-xl animate-pulse" style={{ opacity: 1 - i * 0.15 }} />
                ))}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr>
                      {['User', 'Role', 'Status', 'Title', 'Actions'].map((h) => (
                        <th
                          key={h}
                          className="text-left px-4 py-2.5 text-[11px] font-bold uppercase tracking-wide text-gray-400 border-b border-subtle"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <AnimatePresence>
                      {filtered.map((u, i) => (
                        <motion.tr
                          key={u.id}
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, x: -20 }}
                          transition={{ delay: i * 0.04 }}
                          className="hover:bg-surface-50 dark:hover:bg-surface-800/30 transition-colors"
                        >
                          <td className="px-4 py-3 border-b border-subtle/50">
                            <div className="flex items-center gap-2.5">
                              <Avatar user={u} size="sm" />
                              <div>
                                <div className="text-[13px] font-semibold text-gray-900 dark:text-gray-100">{u.name}</div>
                                <div className="text-[11px] text-gray-400">{u.email}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 border-b border-subtle/50">
                            <RoleDropdown user={u} onUpdate={handleRoleUpdate} />
                          </td>
                          <td className="px-4 py-3 border-b border-subtle/50">
                            <div className="flex items-center gap-1.5">
                              <div
                                className="w-1.5 h-1.5 rounded-full"
                                style={{ backgroundColor: STATUS_COLOR[u.status] ?? '#9ca3af' }}
                              />
                              <span className="text-xs text-gray-500">
                                {STATUS_LABEL[u.status] ?? u.status}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3 border-b border-subtle/50 text-[13px] text-gray-500">
                            {u.title ?? '—'}
                          </td>
                          <td className="px-4 py-3 border-b border-subtle/50">
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => setDeactivateTarget(u)}
                                title="Deactivate user"
                                className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                              >
                                <UserX size={14} />
                              </button>
                              <button
                                title="Manage permissions"
                                className="p-1.5 rounded-lg text-gray-400 hover:text-brand-500 hover:bg-brand-50 dark:hover:bg-brand-500/10 transition-colors"
                              >
                                <Shield size={14} />
                              </button>
                            </div>
                          </td>
                        </motion.tr>
                      ))}
                    </AnimatePresence>
                    {filtered.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-4 py-12 text-center text-sm text-gray-400">
                          No users found
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </motion.div>
        </div>
      </div>
    </>
  );
};

export default AdminDashboard;
