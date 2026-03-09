import React, { useState, useEffect } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  Hash, Lock, Bell, Search, Sun, Moon, LogOut, Home, MessageSquare,
  Activity, BarChart3, ChevronDown, ChevronRight, Layers, Users,
  Briefcase, ChevronLeft, Plus, Check, UserCircle,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppSelector, useAppDispatch, useAuth, useTheme, useNotifications, useSignalR } from '@/hooks';
import { logoutUser, updateUserStatus } from '@/store/slices/authSlice';
import { fetchTeams, fetchTeamChannels, createChannel } from '@/store/slices/teamSlice';
import { setActiveChannel } from '@/store/slices/chatSlice';
import { fetchNotifications, markAllAsReadApi } from '@/store/slices/notificationSlice';
import { Avatar, Badge, Button, Dropdown } from '@/components/ui';
import { SidebarItem } from '@/components/shared';
import { formatTime, cn } from '@/utils';
import toast from 'react-hot-toast';
import type { UserStatus } from '@/types';

// ── Status config ──────────────────────────────────────────
const STATUS_OPTIONS: { value: UserStatus; label: string; dot: string }[] = [
  { value: 'online',       label: 'Online',         dot: 'bg-emerald-500' },
  { value: 'away',         label: 'Away',           dot: 'bg-amber-500'   },
  { value: 'donotdisturb', label: 'Do Not Disturb', dot: 'bg-red-500'     },
  { value: 'offline',      label: 'Offline',        dot: 'bg-gray-400'    },
];

// ── Inline Create Channel ──────────────────────────────────
interface InlineCreateChannelProps {
  teamId: string;
  onDone: () => void;
}

const InlineCreateChannel: React.FC<InlineCreateChannelProps> = ({ teamId, onDone }) => {
  const dispatch = useAppDispatch();
  const [name, setName] = useState('');

  const handleSubmit = async () => {
    if (!name.trim()) { onDone(); return; }
    try {
      await dispatch(createChannel({ teamId, name: name.trim().toLowerCase().replace(/\s+/g, '-'), description: '', isPrivate: false })).unwrap();
      toast.success(`#${name.trim()} created`);
    } catch {
      toast.error('Failed to create channel');
    }
    onDone();
  };

  return (
    <div className="flex items-center gap-1 pl-8 pr-2 py-1">
      <Hash size={12} className="text-gray-400 flex-shrink-0" />
      <input
        value={name}
        onChange={(e) => setName(e.target.value.toLowerCase().replace(/\s+/g, '-'))}
        onKeyDown={(e) => {
          if (e.key === 'Enter') handleSubmit();
          if (e.key === 'Escape') onDone();
        }}
        onBlur={handleSubmit}
        placeholder="channel-name"
        autoFocus
        className="flex-1 bg-surface-100 dark:bg-surface-800 border-none outline-none text-xs text-gray-900 dark:text-gray-100 placeholder-gray-400 rounded px-1.5 py-0.5 font-body"
      />
    </div>
  );
};

// ═══════════════════════════════════════════════════════════
// SIDEBAR
// ═══════════════════════════════════════════════════════════
const Sidebar: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useAppDispatch();
  const { user } = useAuth();
  const teams = useAppSelector((s) => s.teams.teams);
  const channels = useAppSelector((s) => s.teams.channels);
  const activeChannel = useAppSelector((s) => s.chat.activeChannel);
  const [expandedTeams, setExpandedTeams] = useState<Record<string, boolean>>({});
  const [addingChannelTeam, setAddingChannelTeam] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showStatusPicker, setShowStatusPicker] = useState(false);
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem('sidebar-collapsed') === 'true'; } catch { return false; }
  });

  // Start global SignalR connection here so it's active on ALL dashboard pages
  useSignalR();

  const toggleCollapsed = () => {
    setCollapsed((c) => {
      const next = !c;
      localStorage.setItem('sidebar-collapsed', String(next));
      return next;
    });
  };

  useEffect(() => { dispatch(fetchTeams()); dispatch(fetchNotifications()); }, [dispatch]);

  useEffect(() => {
    teams.forEach((team) => {
      dispatch(fetchTeamChannels(team.id));
      if (teams.length > 0) setExpandedTeams((p) => ({ ...p, [teams[0].id]: true }));
    });
  }, [teams, dispatch]);

  const filteredChannels = channels.filter((c) =>
    c.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const baseNav = [
    { icon: <Home size={16} />,           label: 'Home',            path: '/dashboard' },
    { icon: <MessageSquare size={16} />,  label: 'Direct Messages', path: '/dashboard/messages' },
    { icon: <Activity size={16} />,       label: 'Activity',        path: '/dashboard/activity' },
    { icon: <Briefcase size={16} />,      label: 'Teams',           path: '/dashboard/teams' },
  ];

  const isAdmin   = user?.role === 'admin'   || user?.secondaryRole === 'admin';
  const isManager = user?.role === 'manager' || user?.secondaryRole === 'manager';

  const adminNav = isAdmin
    ? [
        { icon: <BarChart3 size={16} />, label: 'Dashboard',    path: '/dashboard/admin' },
        { icon: <Users size={16} />,     label: 'Users',         path: '/dashboard/admin/users' },
      ]
    : isManager
    ? [{ icon: <Users size={16} />, label: 'Team Members', path: '/dashboard/admin/users' }]
    : [];

  const handleChannelClick = (channelId: string) => {
    dispatch(setActiveChannel(channelId));
    navigate(`/dashboard/chat/${channelId}`);
  };

  const handleLogout = () => { dispatch(logoutUser()); navigate('/login'); };

  const handleStatusChange = async (status: UserStatus) => {
    setShowStatusPicker(false);
    try {
      await dispatch(updateUserStatus(status)).unwrap();
    } catch {
      toast.error('Failed to update status');
    }
  };

  const currentStatus = STATUS_OPTIONS.find(s => s.value === (user?.status as UserStatus)) ?? STATUS_OPTIONS[0];

  return (
    <motion.aside
      animate={{ width: collapsed ? 60 : 260 }}
      transition={{ duration: 0.22, ease: 'easeInOut' }}
      className="bg-white dark:bg-surface-900 border-r border-subtle flex flex-col h-screen flex-shrink-0 relative overflow-hidden"
    >
      {/* Logo */}
      <div className={cn(
        'border-b border-subtle flex items-center flex-shrink-0 h-[57px]',
        collapsed ? 'justify-center' : 'px-4 gap-3'
      )}>
        <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: 'linear-gradient(135deg, #6247ea, #8b5cf6)' }}>
          <Layers size={18} className="text-white" />
        </div>
        {!collapsed && (
          <div className="min-w-0 flex-1">
            <div className="font-bold text-sm text-gray-900 dark:text-gray-100 font-display">Nexus</div>
            <div className="text-[11px] text-gray-400">Enterprise workspace</div>
          </div>
        )}
      </div>

      {/* Search */}
      {!collapsed && (
        <div className="px-3 py-2.5 flex-shrink-0">
          <div className="flex items-center gap-2 bg-surface-100 dark:bg-surface-850 rounded-lg px-3 py-1.5">
            <Search size={13} className="text-gray-400 flex-shrink-0" />
            <input
              placeholder="Search channels..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-transparent border-none outline-none text-xs text-gray-900 dark:text-gray-100 w-full placeholder:text-gray-400 font-body"
            />
          </div>
        </div>
      )}

      {/* Main nav */}
      <div className={cn('flex-shrink-0 space-y-0.5', collapsed ? 'px-1.5 py-1' : 'px-2')}>
        {baseNav.map((item) => (
          <SidebarItem key={item.path} icon={item.icon} label={item.label}
            isActive={location.pathname === item.path} collapsed={collapsed}
            onClick={() => navigate(item.path)} />
        ))}
      </div>

      {/* Admin / Manager section */}
      {adminNav.length > 0 && (
        <div className={cn('flex-shrink-0', collapsed ? 'px-1.5 pt-2 pb-1' : 'px-2 pt-3 pb-1')}>
          {!collapsed && (
            <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-0.5">
              {isAdmin ? 'Admin' : 'Management'}
            </div>
          )}
          {collapsed && <div className="border-t border-subtle/50 mb-1.5 mx-1" />}
          <div className="space-y-0.5">
            {adminNav.map((item) => (
              <SidebarItem key={item.path} icon={item.icon} label={item.label}
                isActive={location.pathname === item.path} collapsed={collapsed}
                onClick={() => navigate(item.path)} />
            ))}
          </div>
        </div>
      )}

      {/* Team channels */}
      {!collapsed && (
        <div className="flex-1 overflow-y-auto scrollbar-thin px-2 py-3 space-y-1">
          {teams.map((team) => {
            const teamChannels = filteredChannels.filter((c) => c.teamId === team.id);
            if (searchTerm && teamChannels.length === 0) return null;
            return (
              <div key={team.id}>
                <div className="flex items-center group/teamrow">
                  <button onClick={() => setExpandedTeams((p) => ({ ...p, [team.id]: !p[team.id] }))}
                    className="flex-1 flex items-center gap-1.5 px-2 py-1.5 text-[11px] font-bold uppercase tracking-wide text-gray-400 hover:text-gray-600 dark:hover:text-gray-400 transition-colors">
                    {expandedTeams[team.id] ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
                    <span>{team.icon}</span><span>{team.name}</span>
                  </button>
                  <button
                    onClick={() => { setExpandedTeams((p) => ({ ...p, [team.id]: true })); setAddingChannelTeam(team.id); }}
                    title="Add channel"
                    className="opacity-0 group-hover/teamrow:opacity-100 p-1 rounded hover:bg-surface-100 dark:hover:bg-surface-800 text-gray-400 hover:text-brand-500 transition-all"
                  >
                    <Plus size={12} />
                  </button>
                </div>
                {expandedTeams[team.id] && (
                  <>
                    {teamChannels.map((ch) => {
                      const isActive = activeChannel === ch.id && location.pathname.startsWith('/dashboard/chat');
                      return (
                        <button key={ch.id} onClick={() => handleChannelClick(ch.id)}
                          className={cn(
                            'w-full flex items-center gap-2 pl-8 pr-3 py-1.5 rounded-r-lg mr-2 text-[13px] transition-all duration-100',
                            isActive ? 'bg-brand-500/10 text-brand-500 dark:text-brand-300 font-semibold'
                              : 'text-gray-500 dark:text-gray-400 hover:bg-surface-100 dark:hover:bg-surface-800/60'
                          )}>
                          {ch.isPrivate ? <Lock size={13} /> : <Hash size={13} />}
                          <span className="truncate">{ch.name}</span>
                        </button>
                      );
                    })}
                    {addingChannelTeam === team.id && (
                      <InlineCreateChannel
                        teamId={team.id}
                        onDone={() => setAddingChannelTeam(null)}
                      />
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}

      {collapsed && <div className="flex-1" />}

      {/* User footer */}
      <div className={cn(
        'border-t border-subtle flex-shrink-0 relative',
        collapsed ? 'py-3 flex flex-col items-center gap-2' : 'px-3 py-3 flex items-center gap-2.5'
      )}>
        {user && (
          <button
            onClick={() => collapsed ? navigate('/dashboard/profile') : setShowStatusPicker((p) => !p)}
            className="relative flex-shrink-0"
            title={collapsed ? 'My Profile' : undefined}
          >
            <Avatar user={{ id: user.id, name: user.name, status: user.status as any, avatarUrl: user.avatarUrl }} size="sm" />
            <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white dark:border-surface-900 ${currentStatus.dot}`} />
          </button>
        )}
        {!collapsed && (
          <button
            onClick={() => setShowStatusPicker((p) => !p)}
            className="flex-1 min-w-0 text-left"
          >
            <div className="text-[13px] font-semibold text-gray-900 dark:text-gray-100 truncate">{user?.name}</div>
            <div className="text-[11px] text-gray-400 capitalize flex items-center gap-1">
              <span>{currentStatus.label}</span>
              {user?.secondaryRole && (
                <span className="text-[9px] font-semibold px-1 py-0.5 rounded bg-brand-500/10 text-brand-500 capitalize">
                  +{user.secondaryRole}
                </span>
              )}
            </div>
          </button>
        )}
        <button onClick={handleLogout} title="Logout"
          className="p-1.5 rounded-lg hover:bg-surface-100 dark:hover:bg-surface-800 text-gray-400 transition-colors">
          <LogOut size={15} />
        </button>

        {/* Status picker popup */}
        <AnimatePresence>
          {showStatusPicker && !collapsed && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowStatusPicker(false)} />
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 4 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 4 }}
                transition={{ duration: 0.12 }}
                className="absolute bottom-full left-3 mb-2 w-52 bg-white dark:bg-surface-900 border border-subtle rounded-xl shadow-xl overflow-hidden z-20"
              >
                <button
                  onClick={() => { setShowStatusPicker(false); navigate('/dashboard/profile'); }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-surface-50 dark:hover:bg-surface-800 transition-colors border-b border-subtle"
                >
                  <UserCircle size={14} className="text-brand-500 flex-shrink-0" />
                  <span className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex-1 text-left">My Profile</span>
                </button>
                <div className="px-3 py-2 border-b border-subtle">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-gray-400">Set status</p>
                </div>
                {STATUS_OPTIONS.map((s) => (
                  <button
                    key={s.value}
                    onClick={() => handleStatusChange(s.value)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-surface-50 dark:hover:bg-surface-800 transition-colors"
                  >
                    <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${s.dot}`} />
                    <span className="text-sm text-gray-700 dark:text-gray-300 flex-1 text-left">{s.label}</span>
                    {user?.status === s.value && <Check size={13} className="text-brand-500" />}
                  </button>
                ))}
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>

      {/* Collapse toggle */}
      <button
        onClick={toggleCollapsed}
        className="absolute bottom-[56px] -right-3 w-6 h-6 rounded-full bg-white dark:bg-surface-800 border border-subtle shadow-sm flex items-center justify-center text-gray-400 hover:text-brand-500 transition-colors z-20"
      >
        {collapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
      </button>
    </motion.aside>
  );
};

// ═══════════════════════════════════════════════════════════
// NAVBAR
// ═══════════════════════════════════════════════════════════
const Navbar: React.FC = () => {
  const { isDark, toggle: toggleTheme } = useTheme();
  const { notifications, unreadCount } = useNotifications();
  const dispatch = useAppDispatch();
  const activeChannel = useAppSelector((s) => s.chat.activeChannel);
  const channels = useAppSelector((s) => s.teams.channels);
  const channel = channels.find((c) => c.id === activeChannel);
  const location = useLocation();
  const [showNotifs, setShowNotifs] = useState(false);

  const getTitle = () => {
    if (location.pathname.startsWith('/dashboard/chat') && channel) return null;
    if (location.pathname === '/dashboard/admin') return 'Admin Dashboard';
    if (location.pathname === '/dashboard/admin/users') return 'User Management';
    if (location.pathname === '/dashboard/activity') return 'Activity';
    if (location.pathname === '/dashboard/teams') return 'Teams';
    if (location.pathname === '/dashboard/messages') return 'Direct Messages';
    if (location.pathname === '/dashboard/profile') return 'My Profile';
    return 'Home';
  };
  const title = getTitle();

  return (
    <header className="h-14 bg-white dark:bg-surface-900 border-b border-subtle flex items-center px-5 gap-3 flex-shrink-0">
      <div className="flex-1 flex items-center gap-2.5">
        {title ? (
          <h1 className="font-bold text-[15px] text-gray-900 dark:text-gray-100 font-display">{title}</h1>
        ) : channel ? (
          <>
            <div className="flex items-center gap-1.5 font-bold text-[15px] text-gray-900 dark:text-gray-100 font-display">
              {channel.isPrivate ? <Lock size={15} /> : <Hash size={15} />}
              {channel.name}
            </div>
            <span className="text-xs text-gray-400 hidden md:inline">{channel.description}</span>
          </>
        ) : null}
      </div>
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="sm" onClick={toggleTheme}>
          {isDark ? <Sun size={16} /> : <Moon size={16} />}
        </Button>
        <div className="relative">
          <button onClick={() => setShowNotifs(!showNotifs)}
            className="relative p-2 rounded-lg hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors">
            <Bell size={16} className="text-gray-500 dark:text-gray-400" />
            {unreadCount > 0 && <Badge count={unreadCount} className="absolute -top-0.5 -right-0.5" />}
          </button>
          <Dropdown isOpen={showNotifs} onClose={() => setShowNotifs(false)} className="w-[340px]">
            <div className="px-4 py-3 border-b border-subtle flex justify-between items-center">
              <span className="font-bold text-sm text-gray-900 dark:text-gray-100 font-display">Notifications</span>
              {unreadCount > 0 && (
                <button onClick={() => dispatch(markAllAsReadApi())} className="text-xs text-brand-500 font-semibold hover:underline">
                  Mark all read
                </button>
              )}
            </div>
            <div className="max-h-72 overflow-y-auto scrollbar-thin">
              {notifications.map((n) => (
                <div key={n.id}
                  className={cn('px-4 py-3 border-b border-subtle/50 cursor-pointer transition-colors',
                    'hover:bg-surface-50 dark:hover:bg-surface-800/40',
                    !n.read && 'bg-brand-50/50 dark:bg-brand-500/5')}>
                  <p className="text-[13px] text-gray-800 dark:text-gray-200">{n.content}</p>
                  <p className="text-[11px] text-gray-400 mt-1">{formatTime(n.timestamp)}</p>
                </div>
              ))}
              {notifications.length === 0 && (
                <p className="px-4 py-8 text-center text-sm text-gray-400">No notifications</p>
              )}
            </div>
          </Dropdown>
        </div>
      </div>
    </header>
  );
};

// ═══════════════════════════════════════════════════════════
// DASHBOARD LAYOUT
// ═══════════════════════════════════════════════════════════
export const DashboardLayout: React.FC = () => (
  <div className="flex h-screen overflow-hidden bg-surface-50 dark:bg-surface-950">
    <Sidebar />
    <div className="flex-1 flex flex-col overflow-hidden min-w-0">
      <Navbar />
      <main className="flex-1 overflow-hidden">
        <Outlet />
      </main>
    </div>
  </div>
);
