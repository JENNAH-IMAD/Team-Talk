import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Plus, Edit2, Trash2, UserPlus, UserMinus, Users, X, Hash, Check, Lock, Volume2, Shield } from 'lucide-react';
import { useAppDispatch, useAppSelector, useAuth } from '@/hooks';
import { createTeam, updateTeam, deleteTeam, createChannel, fetchTeams } from '@/store/slices/teamSlice';
import { Avatar, Button, Input, Modal } from '@/components/ui';
import { hasRole } from '@/utils';
import apiClient from '@/services/apiClient';
import toast from 'react-hot-toast';
import type { User, UserRole, Team } from '@/types';

const TEAM_ICONS = ['⚡', '🎨', '💻', '🚀', '🧩', '📦', '🎯', '🛠️', '🧠', '🔒', '🌐', '📊', '📱', '🧪', '🧑‍💻', '🧭', '🛰️', '🧵', '🎥', '🏆'];
const TEAM_COLORS = ['#6247ea','#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6','#06b6d4','#f97316','#ec4899','#14b8a6'];

const ROLE_COLORS: Record<UserRole, string> = {
  director: '#8b5cf6',
  admin:    '#f59e0b',
  manager:  '#6247ea',
  employee: '#10b981',
};

const STATUS_DOT: Record<string, string> = {
  online: 'bg-emerald-500',
  away: 'bg-amber-500',
  donotdisturb: 'bg-red-500',
  offline: 'bg-gray-300 dark:bg-gray-600',
};

// -- Filter tabs --------------------------------------------
const FILTER_TABS = [
  { key: 'all',      label: 'All' },
  { key: 'director', label: 'Director' },
  { key: 'admin',    label: 'Admin' },
  { key: 'manager',  label: 'Manager' },
  { key: 'employee', label: 'Employee' },
];

// -- Add Member Modal ---------------------------------------
interface AddMemberModalProps {
  teamId: string;
  teamName: string;
  currentMemberIds: string[];
  onMembersChanged?: () => void;
  onClose: () => void;
}

const AddMemberModal: React.FC<AddMemberModalProps> = ({ teamId, teamName, currentMemberIds, onMembersChanged, onClose }) => {
  const [users, setUsers] = useState<User[]>([]);
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState('all');
  const [adding, setAdding] = useState<string | null>(null);
  const [added, setAdded] = useState<Set<string>>(new Set());

  useEffect(() => {
    apiClient.get<User[]>('/users').then(({ data }) => setUsers(data));
  }, []);

  const nonMembers = users.filter((u) => !currentMemberIds.includes(u.id));

  const filtered = nonMembers.filter((u) => {
    const q = search.toLowerCase();
    const matchQ = u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q) || (u.title ?? '').toLowerCase().includes(q);
    const matchTab = tab === 'all' || u.role === tab;
    return matchQ && matchTab;
  });

  const handleAdd = async (user: User) => {
    setAdding(user.id);
    try {
      await apiClient.post(`/teams/${teamId}/members`, { userId: user.id });
      setAdded((s) => new Set([...s, user.id]));
      onMembersChanged?.();
      toast.success(`${user.name} added to ${teamName}`);
    } catch {
      toast.error('Failed to add member');
    } finally {
      setAdding(null);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.92, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.92, y: 20 }}
        transition={{ duration: 0.2 }}
        className="bg-white dark:bg-surface-900 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-subtle flex items-center justify-between">
          <div>
            <h3 className="font-black text-gray-900 dark:text-gray-100 font-display text-base">Add members</h3>
            <p className="text-[12px] text-gray-400 mt-0.5">to {teamName}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-surface-100 dark:hover:bg-surface-800 text-gray-400">
            <X size={15} />
          </button>
        </div>

        <div className="px-4 pt-3 pb-2">
          <div className="flex items-center gap-2 bg-surface-100 dark:bg-surface-800 rounded-lg px-3 py-2 mb-3">
            <Search size={13} className="text-gray-400 flex-shrink-0" />
            <input value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, email or title…"
              className="bg-transparent border-none outline-none text-xs text-gray-900 dark:text-gray-100 w-full placeholder-gray-400 font-body"
              autoFocus />
            {search && <button onClick={() => setSearch('')}><X size={11} className="text-gray-400" /></button>}
          </div>
          <div className="flex gap-1">
            {FILTER_TABS.map((t) => (
              <button key={t.key} onClick={() => setTab(t.key)}
                className={`text-[11px] font-bold px-2.5 py-1 rounded-md transition-colors ${
                  tab === t.key ? 'bg-brand-500 text-white' : 'bg-surface-100 dark:bg-surface-800 text-gray-500 hover:bg-surface-200'
                }`}>
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-y-auto max-h-72 px-4 pb-4 space-y-1">
          {filtered.length === 0 ? (
            <div className="py-8 text-center text-sm text-gray-400">
              {search ? 'No users match your search' : 'All users are already members'}
            </div>
          ) : filtered.map((u) => {
            const isAdded = added.has(u.id);
            return (
              <div key={u.id} className="flex items-center gap-3 py-2 px-2 rounded-xl hover:bg-surface-50 dark:hover:bg-surface-800/50 transition-colors">
                <div className="relative flex-shrink-0">
                  <Avatar user={u} size="sm" showStatus={false} />
                  <div className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white dark:border-surface-900 ${STATUS_DOT[u.status] ?? 'bg-gray-300'}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-semibold text-gray-900 dark:text-gray-100 truncate">{u.name}</div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-[10px] font-bold capitalize px-1.5 py-0.5 rounded-md"
                      style={{ backgroundColor: ROLE_COLORS[u.role] + '18', color: ROLE_COLORS[u.role] }}>
                      {u.role}
                    </span>
                    {u.title && <span className="text-[11px] text-gray-400 truncate">{u.title}</span>}
                  </div>
                </div>
                <button
                  onClick={() => !isAdded && handleAdd(u)}
                  disabled={isAdded || adding === u.id}
                  className={`flex-shrink-0 flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-lg transition-all ${
                    isAdded ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 cursor-default'
                    : adding === u.id ? 'opacity-50 cursor-wait bg-brand-50 text-brand-400'
                    : 'bg-brand-500 text-white hover:bg-brand-600'
                  }`}
                >
                  {isAdded ? <><Check size={11} /> Added</> : adding === u.id ? '…' : <><UserPlus size={11} /> Add</>}
                </button>
              </div>
            );
          })}
        </div>
      </motion.div>
    </motion.div>
  );
};

// -- Manage Members Modal -----------------------------------
interface ManageMembersModalProps {
  team: Team;
  users: User[];
  onClose: () => void;
  onMembersChanged: () => void;
}

const ManageMembersModal: React.FC<ManageMembersModalProps> = ({ team, users, onClose, onMembersChanged }) => {
  const [tab, setTab] = useState<'members' | 'add'>('members');
  const [search, setSearch] = useState('');
  const [adding, setAdding] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);
  const [added, setAdded] = useState<Set<string>>(new Set());

  const matchesQuery = (u: User) => {
    const q = search.toLowerCase();
    return (
      u.name.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      (u.title ?? '').toLowerCase().includes(q)
    );
  };

  const members = users.filter((u) => team.members.includes(u.id)).filter(matchesQuery);
  const nonMembers = users.filter((u) => !team.members.includes(u.id)).filter(matchesQuery);

  const handleAdd = async (user: User) => {
    setAdding(user.id);
    try {
      await apiClient.post(`/teams/${team.id}/members`, { userId: user.id });
      setAdded((s) => new Set([...s, user.id]));
      onMembersChanged();
      toast.success(`${user.name} added to ${team.name}`);
    } catch {
      toast.error('Failed to add member');
    } finally {
      setAdding(null);
    }
  };

  const handleRemove = async (user: User) => {
    setRemoving(user.id);
    try {
      await apiClient.delete(`/teams/${team.id}/members/${user.id}`);
      onMembersChanged();
      toast.success(`${user.name} removed from ${team.name}`);
    } catch {
      toast.error('Failed to remove member');
    } finally {
      setRemoving(null);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.92, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.92, y: 20 }}
        transition={{ duration: 0.2 }}
        className="bg-white dark:bg-surface-900 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-subtle flex items-center justify-between">
          <div>
            <h3 className="font-black text-gray-900 dark:text-gray-100 font-display text-base">Manage members</h3>
            <p className="text-[12px] text-gray-400 mt-0.5">{team.name}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-surface-100 dark:hover:bg-surface-800 text-gray-400">
            <X size={15} />
          </button>
        </div>

        <div className="px-4 pt-3 pb-2 space-y-2">
          <div className="flex gap-1">
            <button
              onClick={() => setTab('members')}
              className={`text-[11px] font-bold px-2.5 py-1 rounded-md transition-colors ${
                tab === 'members' ? 'bg-brand-500 text-white' : 'bg-surface-100 dark:bg-surface-800 text-gray-500 hover:bg-surface-200'
              }`}
            >
              Members ({team.members.length})
            </button>
            <button
              onClick={() => setTab('add')}
              className={`text-[11px] font-bold px-2.5 py-1 rounded-md transition-colors ${
                tab === 'add' ? 'bg-brand-500 text-white' : 'bg-surface-100 dark:bg-surface-800 text-gray-500 hover:bg-surface-200'
              }`}
            >
              Add
            </button>
          </div>
          <div className="flex items-center gap-2 bg-surface-100 dark:bg-surface-800 rounded-lg px-3 py-2">
            <Search size={13} className="text-gray-400 flex-shrink-0" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={tab === 'add' ? 'Search users to add…' : 'Search team members…'}
              className="bg-transparent border-none outline-none text-xs text-gray-900 dark:text-gray-100 w-full placeholder-gray-400 font-body"
              autoFocus
            />
            {search && <button onClick={() => setSearch('')}><X size={11} className="text-gray-400" /></button>}
          </div>
        </div>

        <div className="overflow-y-auto max-h-80 px-4 pb-4 space-y-1">
          {tab === 'members' && (
            members.length === 0 ? (
              <div className="py-8 text-center text-sm text-gray-400">
                {search ? 'No members match your search' : 'No members in this team'}
              </div>
            ) : members.map((u) => {
              const isOwner = u.id === team.ownerId;
              return (
                <div key={u.id} className="flex items-center gap-3 py-2 px-2 rounded-xl hover:bg-surface-50 dark:hover:bg-surface-800/50 transition-colors">
                  <div className="relative flex-shrink-0">
                    <Avatar user={u} size="sm" showStatus={false} />
                    <div className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white dark:border-surface-900 ${STATUS_DOT[u.status] ?? 'bg-gray-300'}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-semibold text-gray-900 dark:text-gray-100 truncate">{u.name}</div>
                    <div className="text-[11px] text-gray-400 truncate">{u.email}</div>
                    <div className="flex items-center gap-1.5 mt-1">
                      <span className="text-[10px] font-bold capitalize px-1.5 py-0.5 rounded-md"
                        style={{ backgroundColor: ROLE_COLORS[u.role] + '18', color: ROLE_COLORS[u.role] }}>
                        {u.role}
                      </span>
                      {isOwner && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-emerald-500/10 text-emerald-500">
                          Owner
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => !isOwner && handleRemove(u)}
                    disabled={isOwner || removing === u.id}
                    className={`flex-shrink-0 flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-lg transition-all ${
                      isOwner ? 'bg-surface-100 dark:bg-surface-800 text-gray-400 cursor-not-allowed'
                      : removing === u.id ? 'opacity-50 cursor-wait bg-red-50 text-red-400'
                      : 'bg-red-500/10 text-red-500 hover:bg-red-500/20'
                    }`}
                  >
                    {isOwner ? 'Owner' : removing === u.id ? '…' : <><UserMinus size={11} /> Remove</>}
                  </button>
                </div>
              );
            })
          )}

          {tab === 'add' && (
            nonMembers.length === 0 ? (
              <div className="py-8 text-center text-sm text-gray-400">
                {search ? 'No users match your search' : 'All users are already members'}
              </div>
            ) : nonMembers.map((u) => {
              const isAdded = added.has(u.id);
              return (
                <div key={u.id} className="flex items-center gap-3 py-2 px-2 rounded-xl hover:bg-surface-50 dark:hover:bg-surface-800/50 transition-colors">
                  <div className="relative flex-shrink-0">
                    <Avatar user={u} size="sm" showStatus={false} />
                    <div className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white dark:border-surface-900 ${STATUS_DOT[u.status] ?? 'bg-gray-300'}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-semibold text-gray-900 dark:text-gray-100 truncate">{u.name}</div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-[10px] font-bold capitalize px-1.5 py-0.5 rounded-md"
                        style={{ backgroundColor: ROLE_COLORS[u.role] + '18', color: ROLE_COLORS[u.role] }}>
                        {u.role}
                      </span>
                      {u.title && <span className="text-[11px] text-gray-400 truncate">{u.title}</span>}
                    </div>
                  </div>
                  <button
                    onClick={() => !isAdded && handleAdd(u)}
                    disabled={isAdded || adding === u.id}
                    className={`flex-shrink-0 flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-lg transition-all ${
                      isAdded ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 cursor-default'
                      : adding === u.id ? 'opacity-50 cursor-wait bg-brand-50 text-brand-400'
                      : 'bg-brand-500 text-white hover:bg-brand-600'
                    }`}
                  >
                    {isAdded ? <><Check size={11} /> Added</> : adding === u.id ? '…' : <><UserPlus size={11} /> Add</>}
                  </button>
                </div>
              );
            })
          )}
        </div>
      </motion.div>
    </motion.div>
  );
};

// -- Create Channel Modal -----------------------------------
interface CreateChannelModalProps {
  team: Team;
  onClose: () => void;
}

const CreateChannelModal: React.FC<CreateChannelModalProps> = ({ team, onClose }) => {
  const dispatch = useAppDispatch();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [isVoice, setIsVoice] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    if (!name.trim()) return;
    setLoading(true);
    try {
      await dispatch(createChannel({ teamId: team.id, name: name.trim(), description, isPrivate, isVoice })).unwrap();
      toast.success(`#${name.trim()} created`);
      onClose();
    } catch {
      toast.error('Failed to create channel');
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.92, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.92, y: 20 }}
        transition={{ duration: 0.2 }}
        className="bg-white dark:bg-surface-900 rounded-2xl w-full max-w-sm shadow-2xl p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="font-black text-gray-900 dark:text-gray-100 font-display text-base">Create Channel</h3>
            <p className="text-[12px] text-gray-400 mt-0.5">in {team.name}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-surface-100 dark:hover:bg-surface-800 text-gray-400">
            <X size={15} />
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wide text-gray-400 mb-1.5">Channel name</label>
            <div className="flex items-center gap-2 bg-surface-100 dark:bg-surface-800 rounded-lg px-3 py-2">
              <Hash size={14} className="text-gray-400 flex-shrink-0" />
              <input
                value={name}
                onChange={(e) => setName(e.target.value.toLowerCase().replace(/\s+/g, '-'))}
                onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                placeholder="e.g. design-feedback"
                autoFocus
                className="bg-transparent border-none outline-none text-sm text-gray-900 dark:text-gray-100 w-full placeholder-gray-400 font-body"
              />
            </div>
          </div>

          <Input
            label="Description (optional)"
            placeholder="What's this channel about?"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />

          <button
            onClick={() => setIsPrivate(!isPrivate)}
            className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all ${
              isPrivate
                ? 'border-brand-500/40 bg-brand-50 dark:bg-brand-500/10'
                : 'border-subtle bg-surface-50 dark:bg-surface-800/50'
            }`}
          >
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
              isPrivate ? 'bg-brand-100 dark:bg-brand-500/20' : 'bg-surface-100 dark:bg-surface-800'
            }`}>
              <Lock size={14} className={isPrivate ? 'text-brand-500' : 'text-gray-400'} />
            </div>
            <div className="text-left flex-1">
              <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">Private channel</div>
              <div className="text-[11px] text-gray-400">Only invited members can view</div>
            </div>
            <div className={`w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${
              isPrivate ? 'border-brand-500 bg-brand-500' : 'border-gray-300 dark:border-gray-600'
            }`}>
              {isPrivate && <Check size={10} className="text-white" />}
            </div>
          </button>

          <button
            onClick={() => setIsVoice(!isVoice)}
            className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all ${
              isVoice
                ? 'border-emerald-500/40 bg-emerald-50 dark:bg-emerald-500/10'
                : 'border-subtle bg-surface-50 dark:bg-surface-800/50'
            }`}
          >
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
              isVoice ? 'bg-emerald-100 dark:bg-emerald-500/20' : 'bg-surface-100 dark:bg-surface-800'
            }`}>
              <Volume2 size={14} className={isVoice ? 'text-emerald-500' : 'text-gray-400'} />
            </div>
            <div className="text-left flex-1">
              <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">Voice channel</div>
              <div className="text-[11px] text-gray-400">Members can join and talk with audio</div>
            </div>
            <div className={`w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${
              isVoice ? 'border-emerald-500 bg-emerald-500' : 'border-gray-300 dark:border-gray-600'
            }`}>
              {isVoice && <Check size={10} className="text-white" />}
            </div>
          </button>
        </div>

        <div className="flex gap-2 mt-5">
          <button onClick={onClose} className="flex-1 py-2.5 text-sm font-semibold rounded-xl border border-subtle text-gray-500 hover:bg-surface-50 dark:hover:bg-surface-800 transition-colors">
            Cancel
          </button>
          <Button onClick={handleCreate} isLoading={loading} className="flex-[2] justify-center">
            Create Channel
          </Button>
        </div>
      </motion.div>
    </motion.div>
  );
};

// -----------------------------------------------------------
// TEAMS PAGE
// -----------------------------------------------------------
const TeamsPage: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { user: me } = useAuth();
  const teams = useAppSelector((s) => s.teams.teams);
  const channels = useAppSelector((s) => s.teams.channels);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formName, setFormName] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formIcon, setFormIcon] = useState(TEAM_ICONS[0]);
  const [formColor, setFormColor] = useState('#6247ea');
  const [formOwnerId, setFormOwnerId] = useState('');
  const [showIconPicker, setShowIconPicker] = useState(false);
  const [search, setSearch] = useState('');
  const [addMemberTeam, setAddMemberTeam] = useState<typeof teams[0] | null>(null);
  const [manageMembersTeamId, setManageMembersTeamId] = useState<string | null>(null);
  const [createChannelTeam, setCreateChannelTeam] = useState<typeof teams[0] | null>(null);
  const iconPickerRef = useRef<HTMLDivElement>(null);

  const isDirector = hasRole(me, 'director');
  const isAdmin = hasRole(me, 'admin');
  const isManager = hasRole(me, 'manager');

  const usersById = useMemo(() => {
    const map = new Map<string, User>();
    allUsers.forEach(u => map.set(u.id, u));
    return map;
  }, [allUsers]);

  const canManageTeam = (team: Team) => {
    if (isDirector) return true;
    // Manager and Admin can only manage teams they own
    if (isManager || isAdmin) return team.ownerId === (me?.id ?? '');
    return false;
  };

  const canCreateTeam = isDirector || isManager;
  const refreshTeams = () => { dispatch(fetchTeams()); };

  const manageMembersTeam = manageMembersTeamId
    ? teams.find((t) => t.id === manageMembersTeamId)
    : null;

  useEffect(() => {
    const openCreateTeam = (location.state as { openCreateTeam?: boolean } | null)?.openCreateTeam;
    if (!openCreateTeam) return;

    // Open modal, then clear the navigation state to avoid re-opening on back/forward.
    setEditingId(null);
    setFormName('');
    setFormDesc('');
    setFormIcon(TEAM_ICONS[0]);
    setFormColor('#6247ea');
    setFormOwnerId(me?.id ?? '');
    setShowModal(true);
    navigate(location.pathname, { replace: true, state: null });
  }, [location.pathname, location.state, navigate]);

  useEffect(() => {
    apiClient.get<User[]>('/users').then(({ data }) => setAllUsers(data)).catch(() => {});
  }, []);

  useEffect(() => {
    if (manageMembersTeamId && !manageMembersTeam) setManageMembersTeamId(null);
  }, [manageMembersTeamId, manageMembersTeam]);

  const openCreate = () => { setEditingId(null); setFormName(''); setFormDesc(''); setFormIcon(TEAM_ICONS[0]); setFormColor('#6247ea'); setFormOwnerId(me?.id ?? ''); setShowModal(true); };
  const openEdit = (team: typeof teams[0]) => { setEditingId(team.id); setFormName(team.name); setFormDesc(team.description); setFormIcon(team.icon || TEAM_ICONS[0]); setFormColor(team.color || '#6247ea'); setFormOwnerId(team.ownerId); setShowModal(true); };

  const handleSave = () => {
    if (!formName.trim()) return;
    if (editingId) {
      const editingTeam = teams.find(t => t.id === editingId);
      const ownerChanged = isAdmin && formOwnerId && formOwnerId !== editingTeam?.ownerId;
      dispatch(updateTeam({ id: editingId, name: formName, description: formDesc, icon: formIcon, color: formColor, ...(ownerChanged ? { ownerId: formOwnerId } : {}) }));
    } else {
      dispatch(createTeam({ name: formName, description: formDesc, icon: formIcon, color: formColor }));
    }
    setShowModal(false);
  };

  const filtered = teams.filter((t) => t.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-8 font-body">
      <div className="max-w-4xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-black text-gray-900 dark:text-gray-100 font-display">Teams</h2>
            <p className="text-sm text-gray-500 mt-0.5">{teams.length} teams in workspace</p>
          </div>
          <Button onClick={openCreate} icon={<Plus size={14} />} disabled={!canCreateTeam}>
            New Team
          </Button>
        </div>

        <div className="flex flex-wrap gap-2 mb-4">
          <div className="flex items-center gap-2 bg-white dark:bg-surface-900 border border-subtle rounded-xl px-3 py-2">
            <div className="w-2 h-2 rounded-full bg-brand-500" />
            <span className="text-xs text-gray-500">Total</span>
            <span className="text-xs font-black text-gray-900 dark:text-gray-100">{teams.length}</span>
          </div>
          <div className="flex items-center gap-2 bg-white dark:bg-surface-900 border border-subtle rounded-xl px-3 py-2">
            <div className="w-2 h-2 rounded-full bg-emerald-500" />
            <span className="text-xs text-gray-500">Owned by you</span>
            <span className="text-xs font-black text-gray-900 dark:text-gray-100">
              {teams.filter(t => t.ownerId === me?.id).length}
            </span>
          </div>
          {isDirector && (
            <div className="flex items-center gap-2 bg-white dark:bg-surface-900 border border-subtle rounded-xl px-3 py-2">
              <Shield size={12} className="text-gray-400" />
              <span className="text-xs text-gray-500">Global access</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 bg-surface-100 dark:bg-surface-850 rounded-xl px-3.5 py-2 mb-5 border border-subtle">
          <Search size={15} className="text-gray-400" />
          <input placeholder="Search teams..." value={search} onChange={(e) => setSearch(e.target.value)}
            className="bg-transparent border-none outline-none text-sm text-gray-900 dark:text-gray-100 w-full placeholder:text-gray-400 font-body" />
        </div>

        <div className="space-y-3">
          {filtered.map((team, i) => {
            const teamChannels = channels.filter((c) => c.teamId === team.id);
            const owner = usersById.get(team.ownerId);
            const isOwner = team.ownerId === me?.id;
            const canManage = canManageTeam(team);
            const memberUsers = team.members
              .map((id) => usersById.get(id))
              .filter(Boolean) as User[];
            return (
              <motion.div key={team.id}
                initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
                className="bg-white dark:bg-surface-900 border border-subtle rounded-2xl p-5 hover:shadow-sm transition-all">
                <div className="flex items-center gap-3.5 mb-3">
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
                    style={{ backgroundColor: team.color + '18' }}>
                    {team.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-[15px] text-gray-900 dark:text-gray-100 font-display">{team.name}</div>
                    <div className="text-[13px] text-gray-500">{team.description}</div>
                    <div className="flex items-center gap-2 mt-1 text-[11px] text-gray-400">
                      <span>Owner: {isOwner ? 'You' : owner?.name ?? '—'}</span>
                      {isOwner && <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 font-semibold">Owner</span>}
                      {!canManage && <span className="px-2 py-0.5 rounded-full bg-surface-100 dark:bg-surface-800 text-gray-500">View only</span>}
                    </div>
                  </div>
                  <div className="flex gap-1.5 flex-shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openEdit(team)}
                      icon={<Edit2 size={14} />}
                      disabled={!canManage}
                      title={canManage ? 'Edit team' : 'Only director or team manager can edit'}
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => dispatch(deleteTeam(team.id))}
                      icon={<Trash2 size={14} />}
                      disabled={!canManage}
                      title={canManage ? 'Delete team' : 'Only director or team manager can delete'}
                    />
                  </div>
                </div>

                {/* Channels */}
                {teamChannels.length > 0 && (
                  <div className="flex gap-1.5 flex-wrap mb-3">
                    {teamChannels.map((ch) => (
                      <span key={ch.id} className="flex items-center gap-1 text-[11px] text-gray-500 bg-surface-50 dark:bg-surface-800 px-2 py-0.5 rounded-md">
                        <Hash size={10} />{ch.name}
                      </span>
                    ))}
                  </div>
                )}

                {/* Members */}
                {memberUsers.length > 0 && (
                  <div className="flex items-center gap-2 mb-3">
                    <div className="flex -space-x-2">
                      {memberUsers.slice(0, 4).map((u) => (
                        <Avatar key={u.id} user={u} size="xs" showStatus={false} className="ring-2 ring-white dark:ring-surface-900" />
                      ))}
                    </div>
                    {memberUsers.length > 4 && (
                      <span className="text-[11px] text-gray-400">+{memberUsers.length - 4} more</span>
                    )}
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-3">
                  <span className="text-xs text-gray-500">{team.members.length} member{team.members.length !== 1 ? 's' : ''}</span>
                  <span className="text-xs text-gray-500">{teamChannels.length} channel{teamChannels.length !== 1 ? 's' : ''}</span>
                  <div className="flex-1" />
                  <Button
                    variant="secondary"
                    size="sm"
                    icon={<Hash size={13} />}
                    onClick={() => setCreateChannelTeam(team)}
                    disabled={!canManage}
                    title={canManage ? 'Add channel' : 'Only director or team manager can add channels'}
                  >
                    Add Channel
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    icon={<UserPlus size={13} />}
                    onClick={() => setAddMemberTeam(team)}
                    disabled={!canManage}
                    title={canManage ? 'Add member' : 'Only director or team manager can add members'}
                  >
                    Add Member
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    icon={<Users size={13} />}
                    onClick={() => setManageMembersTeamId(team.id)}
                    disabled={!canManage}
                    title={canManage ? 'Manage members' : 'Only director or team manager can manage members'}
                  >
                    Manage Members
                  </Button>
                </div>
              </motion.div>
            );
          })}
          {filtered.length === 0 && (
            <div className="text-center py-12 text-sm text-gray-400">No teams found</div>
          )}
        </div>
      </div>

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editingId ? 'Edit Team' : 'Create Team'}>
        {/* Icon + Color row */}
        <div className="flex items-center gap-3 mb-4">
          {/* Icon picker button */}
          <div className="relative" ref={iconPickerRef}>
            <button
              type="button"
              onClick={() => setShowIconPicker((v) => !v)}
              className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl border-2 border-dashed transition-all hover:scale-105"
              style={{ borderColor: formColor + '80', backgroundColor: formColor + '18' }}
              title="Choose icon"
            >
              {formIcon}
            </button>
            <AnimatePresence>
              {showIconPicker && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9, y: 8 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9, y: 8 }}
                  transition={{ duration: 0.15 }}
                  className="absolute top-full left-0 mt-2 z-50 bg-white dark:bg-surface-900 border border-subtle rounded-2xl shadow-xl p-3 w-64"
                >
                  <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400 mb-2">Pick an icon</p>
                  <div className="grid grid-cols-6 gap-2">
                    {TEAM_ICONS.map((ico) => (
                      <button
                        key={ico}
                        type="button"
                        onClick={() => { setFormIcon(ico); setShowIconPicker(false); }}
                        className={`w-10 h-10 rounded-xl text-2xl flex items-center justify-center transition-all hover:scale-110 ${
                          formIcon === ico ? 'ring-2 ring-offset-1' : 'hover:bg-surface-100 dark:hover:bg-surface-800'
                        }`}
                        style={formIcon === ico ? { '--tw-ring-color': formColor } as React.CSSProperties : undefined}
                      >
                        {ico}
                      </button>
                    ))}
                  </div>
                  <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400 mt-3 mb-2">Color</p>
                  <div className="flex gap-1.5 flex-wrap">
                    {TEAM_COLORS.map((col) => (
                      <button
                        key={col}
                        type="button"
                        onClick={() => setFormColor(col)}
                        className="w-6 h-6 rounded-full border-2 transition-transform hover:scale-110"
                        style={{
                          backgroundColor: col,
                          borderColor: formColor === col ? 'white' : col,
                          outline: formColor === col ? `2px solid ${col}` : 'none',
                        }}
                      />
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <div className="flex-1">
            <Input label="Team Name" placeholder="e.g. Engineering" value={formName} onChange={(e) => setFormName(e.target.value)} />
          </div>
        </div>
        <Input label="Description" placeholder="What is this team about?" value={formDesc} onChange={(e) => setFormDesc(e.target.value)} />

        {/* Owner field — admin only, edit mode only */}
        {isAdmin && editingId && (
          <div className="mt-3">
            <label className="block text-[11px] font-bold uppercase tracking-wide text-gray-400 mb-1.5">
              Owner
            </label>
            <div className="relative">
              <select
                value={formOwnerId}
                onChange={(e) => setFormOwnerId(e.target.value)}
                className="w-full bg-surface-100 dark:bg-surface-800 border border-subtle rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-gray-100 outline-none focus:border-brand-500 appearance-none cursor-pointer"
              >
                {allUsers.filter(u => u.role === 'manager' || u.role === 'director').map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} — {u.role}
                  </option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center">
                <svg className="w-3.5 h-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
            {formOwnerId && (
              <div className="flex items-center gap-2 mt-2 p-2 bg-surface-50 dark:bg-surface-800/50 rounded-lg border border-subtle">
                <Avatar user={allUsers.find(u => u.id === formOwnerId)!} size="xs" showStatus={false} />
                <div className="min-w-0">
                  <p className="text-[12px] font-semibold text-gray-900 dark:text-gray-100 truncate">
                    {allUsers.find(u => u.id === formOwnerId)?.name}
                  </p>
                  <p className="text-[10px] text-gray-400 capitalize">
                    {allUsers.find(u => u.id === formOwnerId)?.role}
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="flex justify-end gap-2 mt-4">
          <Button variant="secondary" onClick={() => setShowModal(false)}>Cancel</Button>
          <Button onClick={handleSave}>{editingId ? 'Save Changes' : 'Create Team'}</Button>
        </div>
      </Modal>

      <AnimatePresence>
        {addMemberTeam && (
          <AddMemberModal
            teamId={addMemberTeam.id}
            teamName={addMemberTeam.name}
            currentMemberIds={addMemberTeam.members}
            onMembersChanged={refreshTeams}
            onClose={() => setAddMemberTeam(null)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {manageMembersTeam && (
          <ManageMembersModal
            team={manageMembersTeam}
            users={allUsers}
            onMembersChanged={refreshTeams}
            onClose={() => setManageMembersTeamId(null)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {createChannelTeam && (
          <CreateChannelModal
            team={createChannelTeam}
            onClose={() => setCreateChannelTeam(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default TeamsPage;




