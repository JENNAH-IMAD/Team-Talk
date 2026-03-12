import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { MessageSquare, Users, Hash, Bell, ChevronRight, Lock, TrendingUp } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { useAuth, useAppSelector, useAppDispatch, useGsapReveal } from '@/hooks';
import { setActiveChannel } from '@/store/slices/chatSlice';
import { getGreeting } from '@/utils';
import apiClient from '@/services/apiClient';

interface UserStats {
  messagesThisWeek: number;
  messagesThisMonth: number;
  weeklyActivity: { day: string; messages: number }[];
}

const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { user } = useAuth();
  const teams = useAppSelector((s) => s.teams.teams);
  const channels = useAppSelector((s) => s.teams.channels);
  const [stats, setStats] = useState<UserStats | null>(null);
  const pageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    apiClient.get<UserStats>('/stats/me').then(({ data }) => setStats(data)).catch(() => {});
  }, []);

  useGsapReveal(pageRef as React.RefObject<HTMLElement>);

  const quickActions = [
    { icon: MessageSquare, label: 'New Message', color: '#6247ea', onClick: () => navigate('/dashboard/messages') },
    { icon: Users, label: 'Create Team', color: '#10b981', onClick: () => navigate('/dashboard/teams', { state: { openCreateTeam: true } }) },
    { icon: Hash, label: 'Browse Channels', color: '#3b82f6', onClick: () => navigate('/dashboard/teams') },
    { icon: Bell, label: 'Notifications', color: '#ef4444', onClick: () => navigate('/dashboard/activity') },
  ];

  const handleChannelClick = (channelId: string) => {
    dispatch(setActiveChannel(channelId));
    navigate(`/dashboard/chat/${channelId}`);
  };

  return (
    <div ref={pageRef} className="flex-1 overflow-y-auto p-6 md:p-8">
      <div className="max-w-6xl mx-auto">
        {/* Greeting */}
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          data-reveal
        >
          <h1 className="text-2xl font-black text-gray-900 dark:text-gray-100 font-display tracking-tight mb-1">
            {getGreeting()}, {user?.name.split(' ')[0]}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-8">
            Here's what's happening in your workspace today.
          </p>
        </motion.div>

        {/* Quick actions */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
          {quickActions.map((action, i) => (
            <motion.button
              key={action.label}
              data-reveal
              onClick={action.onClick}
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.97 }}
              className="bg-white dark:bg-surface-900 border border-subtle rounded-xl p-4 text-center hover:shadow-sm transition-shadow group w-full"
            >
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center mx-auto mb-2.5 transition-transform group-hover:scale-110"
                style={{ backgroundColor: action.color + '12' }}
              >
                <action.icon size={18} style={{ color: action.color }} />
              </div>
              <div className="text-xs font-semibold text-gray-700 dark:text-gray-300">{action.label}</div>
            </motion.button>
          ))}
        </div>

        {/* Activity stats */}
        <div className="bg-white dark:bg-surface-900 border border-subtle rounded-2xl p-5 mb-8" data-reveal>
          <div className="flex items-center gap-2 mb-5">
            <TrendingUp size={15} className="text-brand-500" />
            <h3 className="font-bold text-sm text-gray-900 dark:text-gray-100 font-display">Your Activity</h3>
          </div>
          <div className="grid grid-cols-2 gap-3 mb-5">
            <div className="bg-surface-50 dark:bg-surface-800 rounded-xl p-4">
              <div className="text-2xl font-black text-gray-900 dark:text-gray-100 font-display">
                {stats ? stats.messagesThisWeek : <span className="text-gray-300 dark:text-gray-700">—</span>}
              </div>
              <div className="text-xs text-gray-500 mt-0.5">Messages this week</div>
            </div>
            <div className="bg-surface-50 dark:bg-surface-800 rounded-xl p-4">
              <div className="text-2xl font-black text-gray-900 dark:text-gray-100 font-display">
                {stats ? stats.messagesThisMonth : <span className="text-gray-300 dark:text-gray-700">—</span>}
              </div>
              <div className="text-xs text-gray-500 mt-0.5">Messages this month</div>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={120}>
            <BarChart data={stats?.weeklyActivity ?? []} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" className="dark:opacity-20" />
              <XAxis dataKey="day" tick={{ fill: '#9ca3af', fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 12 }}
                cursor={{ fill: 'rgba(98,71,234,0.06)' }}
              />
              <Bar dataKey="messages" fill="#6247ea" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Recent channels */}
        <h3 className="font-bold text-sm text-gray-900 dark:text-gray-100 font-display mb-3" data-reveal>Recent Channels</h3>
        <div className="space-y-1.5 mb-8">
          {channels.slice(0, 4).map((ch) => {
            const team = teams.find((t) => t.id === ch.teamId);
            return (
              <motion.button
                key={ch.id}
                data-reveal
                onClick={() => handleChannelClick(ch.id)}
                whileHover={{ x: 3 }}
                transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                className="w-full flex items-center gap-3 px-4 py-3 bg-white dark:bg-surface-900 border border-subtle rounded-xl hover:shadow-sm transition-shadow text-left"
              >
                <div className="w-9 h-9 rounded-lg bg-brand-50 dark:bg-brand-500/10 flex items-center justify-center flex-shrink-0">
                  {ch.isPrivate ? <Lock size={15} className="text-brand-500" /> : <Hash size={15} className="text-brand-500" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">{ch.name}</div>
                  <div className="text-xs text-gray-400 dark:text-gray-600 truncate">{team?.name} - {ch.description}</div>
                </div>
                <ChevronRight size={15} className="text-gray-300 dark:text-gray-700" />
              </motion.button>
            );
          })}
        </div>

        {/* Teams */}
        <h3 className="font-bold text-sm text-gray-900 dark:text-gray-100 font-display mb-3" data-reveal>Your Teams</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {teams.map((team) => (
            <motion.button
              key={team.id}
              data-reveal
              onClick={() => navigate('/dashboard/teams')}
              whileHover={{ scale: 1.03, y: -2 }}
              whileTap={{ scale: 0.97 }}
              transition={{ type: 'spring', stiffness: 350, damping: 22 }}
              className="bg-white dark:bg-surface-900 border border-subtle rounded-xl p-4 text-left hover:shadow-sm transition-shadow"
            >
              <div className="text-2xl mb-2">{team.icon}</div>
              <div className="text-sm font-bold text-gray-900 dark:text-gray-100 mb-0.5">{team.name}</div>
              <div className="text-xs text-gray-400">{team.members.length} members</div>
            </motion.button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default HomePage;
