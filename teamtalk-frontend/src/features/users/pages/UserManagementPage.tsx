import React, { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, X, UserX, Shield, ChevronDown, Check, AlertTriangle,
  UserPlus, RefreshCw, Filter, Users,
} from 'lucide-react';
import { Avatar, Button, Input } from '@/components/ui';
import { useAuth, useAppDispatch } from '@/hooks';
import apiClient from '@/services/apiClient';
import { storage, getUserRoles, getPrimaryRole, normalizeRoles, hasRole } from '@/utils';
import { setUser } from '@/store/slices/authSlice';
import toast from 'react-hot-toast';
import type { User, UserRole, UserStatus } from '@/types';

// ── Job Titles ────────────────────────────────────────────
const JOB_TITLES: { category: string; titles: string[] }[] = [
  {
    category: 'LEADERSHIP & EXECUTIVE',
    titles: [
      'Chief Executive Officer', 'Chief Technology Officer', 'Chief Operating Officer',
      'Chief Financial Officer', 'Chief Marketing Officer', 'Chief People Officer',
      'Chief Product Officer', 'Chief Information Officer', 'Vice President of Engineering',
      'Vice President of Sales', 'Vice President of Marketing', 'General Manager',
      'Director of Operations',
    ],
  },
  {
    category: 'INFORMATION TECHNOLOGY',
    titles: [
      'Software Engineer', 'Senior Software Engineer', 'Lead Software Engineer',
      'Principal Engineer', 'Staff Engineer', 'Frontend Developer', 'Backend Developer',
      'Full Stack Developer', 'Mobile Developer', 'DevOps Engineer', 'Site Reliability Engineer',
      'Cloud Architect', 'Solutions Architect', 'Enterprise Architect', 'Data Engineer',
      'Data Scientist', 'Machine Learning Engineer', 'AI Engineer', 'QA Engineer',
      'Security Engineer', 'Cybersecurity Analyst', 'Network Engineer', 'Systems Administrator',
      'IT Support Specialist', 'Database Administrator', 'Technical Lead',
      'Engineering Manager', 'Head of Engineering',
    ],
  },
  {
    category: 'PRODUCT',
    titles: [
      'Product Manager', 'Senior Product Manager', 'Principal Product Manager',
      'Director of Product', 'Head of Product', 'Product Owner', 'Business Analyst',
      'Product Analyst', 'UX Designer', 'UI Designer', 'Product Designer', 'UX Researcher',
      'Design Lead', 'Head of Design',
    ],
  },
  {
    category: 'MARKETING',
    titles: [
      'Marketing Manager', 'Senior Marketing Manager', 'Director of Marketing',
      'Head of Marketing', 'Content Strategist', 'Content Writer', 'Copywriter',
      'SEO Specialist', 'SEM Specialist', 'Social Media Manager', 'Community Manager',
      'Brand Manager', 'Growth Hacker', 'Performance Marketing Manager',
      'Email Marketing Specialist', 'Marketing Analyst', 'Campaign Manager',
      'Events Manager', 'PR Manager', 'Communications Manager',
    ],
  },
  {
    category: 'SALES',
    titles: [
      'Sales Representative', 'Account Executive', 'Senior Account Executive',
      'Sales Manager', 'Director of Sales', 'Head of Sales', 'Business Development Manager',
      'Business Development Representative', 'Sales Engineer', 'Pre-Sales Consultant',
      'Account Manager', 'Customer Success Manager', 'Customer Success Lead',
      'Partnership Manager', 'Channel Sales Manager',
    ],
  },
  {
    category: 'HUMAN RESOURCES',
    titles: [
      'HR Manager', 'Senior HR Manager', 'Director of HR', 'Head of HR',
      'HR Business Partner', 'Recruiter', 'Senior Recruiter', 'Talent Acquisition Manager',
      'Talent Acquisition Specialist', 'People Operations Manager',
      'Compensation & Benefits Manager', 'Learning & Development Manager',
      'HR Generalist', 'HR Coordinator', 'Onboarding Specialist',
      'Employee Relations Manager', 'Workforce Planning Analyst',
    ],
  },
  {
    category: 'FINANCE & ACCOUNTING',
    titles: [
      'Finance Manager', 'Senior Finance Manager', 'Director of Finance', 'Head of Finance',
      'CFO', 'Financial Analyst', 'Senior Financial Analyst', 'FP&A Manager', 'Controller',
      'Accounting Manager', 'Senior Accountant', 'Accountant', 'Accounts Payable Specialist',
      'Accounts Receivable Specialist', 'Payroll Manager', 'Payroll Specialist',
      'Tax Manager', 'Audit Manager', 'Treasury Manager', 'Risk Manager',
    ],
  },
  {
    category: 'LEGAL & COMPLIANCE',
    titles: [
      'General Counsel', 'Legal Counsel', 'Corporate Attorney', 'Compliance Manager',
      'Compliance Officer', 'Data Privacy Officer', 'Risk & Compliance Analyst',
      'Paralegal', 'Legal Operations Manager', 'Contract Manager',
    ],
  },
  {
    category: 'OPERATIONS',
    titles: [
      'Operations Manager', 'Senior Operations Manager', 'Director of Operations',
      'Head of Operations', 'Project Manager', 'Senior Project Manager', 'Program Manager',
      'Scrum Master', 'Agile Coach', 'Business Operations Analyst',
      'Process Improvement Manager', 'Supply Chain Manager', 'Logistics Manager',
      'Facilities Manager', 'Office Manager', 'Executive Assistant', 'Administrative Assistant',
    ],
  },
  {
    category: 'CUSTOMER SUPPORT',
    titles: [
      'Customer Support Manager', 'Head of Customer Support', 'Customer Support Lead',
      'Customer Support Specialist', 'Technical Support Engineer', 'Help Desk Analyst',
      'Customer Experience Manager', 'Customer Onboarding Specialist',
    ],
  },
  {
    category: 'DATA & ANALYTICS',
    titles: [
      'Data Analyst', 'Senior Data Analyst', 'Analytics Manager', 'Director of Analytics',
      'Head of Data', 'Business Intelligence Analyst', 'BI Developer', 'Data Architect',
      'Analytics Engineer', 'Reporting Analyst', 'Insights Manager',
    ],
  },
];

// ── JobTitleDropdown ──────────────────────────────────────
const JobTitleDropdown: React.FC<{ value: string; onChange: (v: string) => void }> = ({ value, onChange }) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [highlighted, setHighlighted] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  useEffect(() => {
    if (open) {
      setSearch('');
      setHighlighted(null);
      setTimeout(() => searchRef.current?.focus(), 0);
    }
  }, [open]);

  useEffect(() => {
    if (!highlighted || !listRef.current) return;
    const el = listRef.current.querySelector(`[data-title="${CSS.escape(highlighted)}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [highlighted]);

  const q = search.toLowerCase().trim();
  const filtered = JOB_TITLES
    .map(cat => ({ category: cat.category, titles: q ? cat.titles.filter(t => t.toLowerCase().includes(q)) : cat.titles }))
    .filter(cat => cat.titles.length > 0);
  const flatTitles = filtered.flatMap(cat => cat.titles);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') { setOpen(true); e.preventDefault(); }
      return;
    }
    if (e.key === 'Escape') { setOpen(false); e.preventDefault(); return; }
    if (e.key === 'Enter' && highlighted) { onChange(highlighted); setOpen(false); e.preventDefault(); return; }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const idx = highlighted ? flatTitles.indexOf(highlighted) : -1;
      setHighlighted(flatTitles[Math.min(idx + 1, flatTitles.length - 1)] ?? null);
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      const idx = highlighted ? flatTitles.indexOf(highlighted) : flatTitles.length;
      setHighlighted(flatTitles[Math.max(idx - 1, 0)] ?? null);
    }
  };

  return (
    <div className="mb-0 relative" ref={containerRef} onKeyDown={handleKeyDown} tabIndex={-1}>
      <label className="block text-[11px] font-bold uppercase tracking-wide text-gray-400 dark:text-gray-500 mb-1">
        Job title <span className="normal-case font-normal">(optional)</span>
      </label>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={`w-full flex items-center justify-between px-3 py-2 rounded-xl border text-sm transition-colors text-left focus:outline-none ${
          open
            ? 'border-brand-500 ring-2 ring-brand-500/20'
            : 'border-gray-200 dark:border-surface-700 hover:border-gray-300 dark:hover:border-surface-600'
        } bg-white dark:bg-surface-800`}
        style={{ minHeight: 38 }}
      >
        <span className={value ? 'text-gray-900 dark:text-gray-100' : 'text-gray-400 dark:text-gray-500'}>
          {value || 'e.g. Software Engineer'}
        </span>
        <div className="flex items-center gap-0.5 flex-shrink-0 ml-2">
          {value && (
            <span
              role="button"
              tabIndex={-1}
              onClick={e => { e.stopPropagation(); onChange(''); }}
              className="p-0.5 rounded hover:bg-gray-100 dark:hover:bg-surface-700 text-gray-400 cursor-pointer"
            >
              <X size={12} />
            </span>
          )}
          <ChevronDown size={14} className={`text-gray-400 transition-transform duration-150 ${open ? 'rotate-180' : ''}`} />
        </div>
      </button>

      {open && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white dark:bg-surface-800 border border-gray-200 dark:border-surface-700 rounded-xl shadow-2xl overflow-hidden">
          {/* Search bar */}
          <div className="p-2 border-b border-gray-100 dark:border-surface-700">
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              <input
                ref={searchRef}
                value={search}
                onChange={e => { setSearch(e.target.value); setHighlighted(null); }}
                placeholder="Search job titles..."
                className="w-full pl-7 pr-3 py-1.5 text-sm bg-gray-50 dark:bg-surface-700 border border-gray-200 dark:border-surface-600 rounded-lg outline-none focus:border-brand-500 text-gray-900 dark:text-gray-100 placeholder-gray-400"
                onKeyDown={e => {
                  // Let arrow/enter/escape bubble to container handler
                  if (['ArrowDown', 'ArrowUp', 'Enter', 'Escape'].includes(e.key)) {
                    e.preventDefault();
                    containerRef.current?.dispatchEvent(new KeyboardEvent('keydown', { key: e.key, bubbles: true }));
                  }
                }}
              />
            </div>
          </div>

          {/* Scrollable list */}
          <div ref={listRef} className="overflow-y-auto" style={{ maxHeight: 280 }}>
            {filtered.length === 0 && (
              <div className="px-4 py-6 text-center text-sm text-gray-400">No matches found</div>
            )}
            {filtered.map((cat, ci) => (
              <div key={cat.category}>
                <div className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500 bg-gray-50 dark:bg-surface-900/60 select-none ${ci > 0 ? 'border-t border-gray-100 dark:border-surface-700' : ''}`}>
                  {cat.category}
                </div>
                {cat.titles.map(title => (
                  <button
                    key={title}
                    data-title={title}
                    type="button"
                    onMouseEnter={() => setHighlighted(title)}
                    onClick={() => { onChange(title); setOpen(false); }}
                    className={`w-full flex flex-col items-start px-3 py-2 text-left transition-colors ${
                      highlighted === title
                        ? 'bg-brand-50 dark:bg-brand-500/10'
                        : value === title
                        ? 'bg-brand-50/60 dark:bg-brand-500/5'
                        : 'hover:bg-gray-50 dark:hover:bg-surface-700/60'
                    }`}
                  >
                    <span className="text-[13px] font-medium text-gray-900 dark:text-gray-100 leading-snug">{title}</span>
                    <span className="text-[11px] text-gray-400 dark:text-gray-500 leading-tight">{cat.category}</span>
                  </button>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// ── Constants ─────────────────────────────────────────────
const ROLES: { value: UserRole; label: string; color: string; desc: string }[] = [
  { value: 'director', label: 'Director', color: '#8b5cf6', desc: 'Org-wide control — teams, users & access' },
  { value: 'admin',    label: 'Admin',    color: '#f59e0b', desc: 'Full access — users, teams & settings' },
  { value: 'manager',  label: 'Manager',  color: '#6247ea', desc: 'Manage owned teams, members & channels' },
  { value: 'employee', label: 'Employee', color: '#6b7280', desc: 'Standard member access' },
];

const STATUSES: { value: UserStatus; label: string; dot: string }[] = [
  { value: 'online',       label: 'Online',          dot: 'bg-emerald-500' },
  { value: 'away',         label: 'Away',            dot: 'bg-amber-500'   },
  { value: 'donotdisturb', label: 'Do Not Disturb',  dot: 'bg-red-500'     },
  { value: 'offline',      label: 'Offline',         dot: 'bg-gray-400'    },
];

function toServerRole(role: UserRole): string {
  return role.charAt(0).toUpperCase() + role.slice(1);
}

function toServerRoles(roles: UserRole[]): string[] {
  return roles.map(toServerRole);
}

function formatLastActive(value?: string): string {
  if (!value) return '—';
  const ts = new Date(value).getTime();
  if (Number.isNaN(ts)) return '—';
  const diff = Date.now() - ts;
  if (diff < 60_000) return 'Just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) {
    return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  return new Date(ts).toLocaleDateString([], { month: 'short', day: 'numeric' });
}

// ── RoleSelect ────────────────────────────────────────────
const RoleSelect: React.FC<{
  roles: UserRole[];
  onChange: (roles: UserRole[]) => void;
  disabled?: boolean;
}> = ({ roles, onChange, disabled }) => {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Set<UserRole>>(
    () => new Set(normalizeRoles(roles))
  );

  useEffect(() => {
    setSelected(new Set(normalizeRoles(roles)));
  }, [roles]);

  const toggle = (r: UserRole) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(r)) {
        if (next.size > 1) next.delete(r);
      } else {
        next.add(r);
      }
      return next;
    });
  };

  const handleApply = () => {
    const normalized = normalizeRoles([...selected]);
    onChange(normalized);
    setOpen(false);
  };

  const normalized = normalizeRoles([...selected]);
  const primary = getPrimaryRole(normalized);
  const current = ROLES.find((r) => r.value === primary)!;
  const extraCount = Math.max(0, normalized.length - 1);

  return (
    <div className="relative">
      <button
        onClick={() => !disabled && setOpen((o) => !o)}
        disabled={disabled}
        className={`flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-md transition-opacity ${
          disabled ? 'opacity-50 cursor-not-allowed' : 'hover:opacity-80'
        }`}
        style={{ backgroundColor: current.color + '18', color: current.color }}
      >
        {current.label}
        {extraCount > 0 && <span className="text-[10px] opacity-70">+{extraCount}</span>}
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
              className="absolute z-20 left-0 top-full mt-1 w-60 bg-white dark:bg-surface-900 border border-subtle rounded-xl shadow-xl overflow-hidden"
            >
              <div className="px-3 py-2 border-b border-subtle">
                <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400">Select roles</p>
                <p className="text-[10px] text-gray-400 mt-0.5">Choose one or more roles</p>
              </div>
              {ROLES.map((r) => (
                <button
                  key={r.value}
                  onClick={() => toggle(r.value)}
                  className="w-full flex items-start gap-2.5 px-3 py-2.5 hover:bg-surface-50 dark:hover:bg-surface-800 transition-colors"
                >
                  <div
                    className="w-4 h-4 rounded flex items-center justify-center flex-shrink-0 mt-0.5 border transition-colors"
                    style={
                      selected.has(r.value)
                        ? { backgroundColor: r.color, borderColor: r.color }
                        : { borderColor: '#d1d5db' }
                    }
                  >
                    {selected.has(r.value) && <Check size={10} className="text-white" />}
                  </div>
                  <div className="text-left">
                    <p className="text-xs font-semibold" style={{ color: r.color }}>{r.label}</p>
                    <p className="text-[10px] text-gray-400 leading-tight">{r.desc}</p>
                  </div>
                </button>
              ))}
              <div className="px-3 py-2 border-t border-subtle">
                <button
                  onClick={handleApply}
                  className="w-full py-1.5 text-xs font-semibold bg-brand-500 text-white rounded-lg hover:bg-brand-600 transition-colors"
                >
                  Apply
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

// ── StatusDot ─────────────────────────────────────────────
const StatusDot: React.FC<{ status: UserStatus }> = ({ status }) => {
  const s = STATUSES.find((x) => x.value === status);
  return (
    <div className="flex items-center gap-1.5">
      <div className={`w-1.5 h-1.5 rounded-full ${s?.dot ?? 'bg-gray-400'}`} />
      <span className="text-xs text-gray-500">{s?.label ?? status}</span>
    </div>
  );
};

// ── InviteModal ───────────────────────────────────────────
interface InviteModalProps {
  onClose: () => void;
  onInvited: () => void;
}

const InviteModal: React.FC<InviteModalProps> = ({ onClose, onInvited }) => {
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', title: '', password: '' });
  const [selectedRoles, setSelectedRoles] = useState<Set<UserRole>>(new Set(['employee']));
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.firstName.trim()) e.firstName = 'Required';
    if (!form.lastName.trim()) e.lastName = 'Required';
    if (!form.email.trim()) e.email = 'Required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'Invalid email';
    if (!form.password.trim()) e.password = 'Required';
    else if (form.password.length < 6) e.password = 'Min 6 characters';
    return e;
  };

  const handleSubmit = async () => {
    const e = validate();
    if (Object.keys(e).length > 0) { setErrors(e); return; }
    const roles = normalizeRoles([...selectedRoles]);
    const role = getPrimaryRole(roles);
    const secondaryRole = roles.find((r) => r !== role) ?? null;
    setLoading(true);
    try {
      await apiClient.post('/auth/register', {
        ...form,
        roles: toServerRoles(roles),
        role: toServerRole(role),
        secondaryRole: secondaryRole ? toServerRole(secondaryRole) : null,
      });
      toast.success(`${form.firstName} ${form.lastName} added successfully`);
      onInvited();
      onClose();
    } catch (err: any) {
      toast.error(err.response?.data?.message ?? 'Failed to create user');
    } finally {
      setLoading(false);
    }
  };

  const toggleRole = (r: UserRole) => {
    setSelectedRoles((prev) => {
      const next = new Set(prev);
      if (next.has(r)) { if (next.size > 1) next.delete(r); }
      else next.add(r);
      return next;
    });
  };

  const field = (
    key: keyof typeof form,
    label: string,
    placeholder: string,
    type = 'text',
    autoComplete = 'off'
  ) => (
    <div className="mb-0">
      <Input
        label={label}
        type={type}
        placeholder={placeholder}
        value={form[key]}
        autoComplete={autoComplete}
        onChange={(e) => { setForm((p) => ({ ...p, [key]: e.target.value })); setErrors((p) => ({ ...p, [key]: '' })); }}
        error={errors[key]}
      />
    </div>
  );

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 24 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 24 }}
        transition={{ duration: 0.22 }}
        className="bg-white dark:bg-surface-900 rounded-2xl p-6 w-full max-w-lg shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="font-black text-gray-900 dark:text-gray-100 font-display text-base">
              Add new user
            </h3>
            <p className="text-xs text-gray-400 mt-0.5">Fill in the details to create a new account</p>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-surface-100 dark:hover:bg-surface-800 text-gray-400 transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Name row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-3">
          {field('firstName', 'First name', 'Your first name', 'text', 'off')}
          {field('lastName', 'Last name', 'Your last name', 'text', 'off')}
        </div>
        {field('email', 'Email', 'you@company.com', 'email', 'off')}
        <JobTitleDropdown value={form.title} onChange={v => { setForm(p => ({ ...p, title: v })); }} />
        {field('password', 'Temporary password', '••••••••', 'password', 'new-password')}

        {/* Role multi-select */}
        <div className="mt-1 mb-4">
          <label className="block text-[11px] font-bold uppercase tracking-wide text-gray-400 mb-2">
            Roles
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {ROLES.map((r) => {
              const active = selectedRoles.has(r.value);
              return (
                <button
                  key={r.value}
                  type="button"
                  onClick={() => toggleRole(r.value)}
                  className="relative flex flex-col items-start gap-1 px-3 py-2.5 rounded-xl text-left border transition-all"
                  style={
                    active
                      ? { backgroundColor: r.color + '12', borderColor: r.color + '60' }
                      : { backgroundColor: 'transparent', borderColor: '#e5e7eb' }
                  }
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="text-xs font-semibold" style={{ color: active ? r.color : '#6b7280' }}>
                      {r.label}
                    </span>
                    <div
                      className="w-3.5 h-3.5 rounded flex items-center justify-center border transition-colors"
                      style={active ? { backgroundColor: r.color, borderColor: r.color } : { borderColor: '#d1d5db' }}
                    >
                      {active && <Check size={9} className="text-white" />}
                    </div>
                  </div>
                  <span className="text-[10px] text-gray-400 leading-tight">{r.desc}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 text-sm font-semibold rounded-xl border border-subtle text-gray-500 hover:bg-surface-50 dark:hover:bg-surface-800 transition-colors"
          >
            Cancel
          </button>
          <Button onClick={handleSubmit} isLoading={loading} className="flex-[2] justify-center py-2.5 text-sm">
            Add user
          </Button>
        </div>
      </motion.div>
    </motion.div>
  );
};

// ── DeactivateModal ────────────────────────────────────────
const DeactivateModal: React.FC<{
  user: User | null;
  onConfirm: () => void;
  onCancel: () => void;
}> = ({ user, onConfirm, onCancel }) => (
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
            lose access to Team Talk immediately.
          </p>
          <div className="flex gap-2">
            <button onClick={onCancel} className="flex-1 py-2.5 text-sm font-semibold rounded-xl border border-subtle text-gray-500 hover:bg-surface-50 dark:hover:bg-surface-800 transition-colors">
              Cancel
            </button>
            <button onClick={onConfirm} className="flex-1 py-2.5 text-sm font-semibold rounded-xl bg-red-500 text-white hover:bg-red-600 transition-colors">
              Deactivate
            </button>
          </div>
        </motion.div>
      </motion.div>
    )}
  </AnimatePresence>
);

// ═══════════════════════════════════════════════════════════
// FILTER BAR
// ═══════════════════════════════════════════════════════════
const ROLE_FILTERS = [
  { value: '', label: 'All roles' },
  { value: 'director', label: 'Director' },
  { value: 'admin', label: 'Admin' },
  { value: 'manager', label: 'Manager' },
  { value: 'employee', label: 'Employee' },
];

// ═══════════════════════════════════════════════════════════
// USER MANAGEMENT PAGE
// ═══════════════════════════════════════════════════════════
const UserManagementPage: React.FC = () => {
  const dispatch = useAppDispatch();
  const { user: currentUser } = useAuth();
  const [users, setUsers]             = useState<User[]>([]);
  const [isLoading, setIsLoading]     = useState(true);
  const [search, setSearch]           = useState('');
  const [roleFilter, setRoleFilter]   = useState('');
  const [showInvite, setShowInvite]   = useState(false);
  const [deactivateTarget, setDeactivateTarget] = useState<User | null>(null);
  const canEditRoles = hasRole(currentUser, 'admin') || hasRole(currentUser, 'director');

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data } = await apiClient.get<User[]>('/users');
      setUsers(data);
    } catch {
      toast.error('Failed to load users');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleRoleUpdate = async (userId: string, roles: UserRole[]) => {
    const normalized = normalizeRoles(roles);
    const role = getPrimaryRole(normalized);
    const secondaryRole = normalized.find((r) => r !== role) ?? null;
    const payload = {
      roles: toServerRoles(normalized),
      role: toServerRole(role),
      secondaryRole: secondaryRole ? toServerRole(secondaryRole) : null,
    };
    try {
      await apiClient.put(`/users/${userId}/role`, payload);
      setUsers((p) => p.map((u) => (u.id === userId ? {
        ...u,
        roles: normalized,
        role,
        secondaryRole: secondaryRole ?? undefined,
      } : u)));

      // If updating current user, refresh token to update role claims
      if (currentUser?.id === userId) {
        const refreshToken = storage.getRefreshToken();
        if (refreshToken) {
          const { data } = await apiClient.post('/auth/refresh', { refreshToken });
          storage.setToken(data.token);
          storage.setRefreshToken(data.refreshToken);
          if (data.user) dispatch(setUser(data.user));
        }
      }
      toast.success('Role updated');
    } catch (err: any) {
      const message = err?.response?.data?.message;
      toast.error(message ?? 'Failed to update role');
    }
  };

  const handleDeactivate = async () => {
    if (!deactivateTarget) return;
    try {
      await apiClient.delete(`/users/${deactivateTarget.id}`);
      setUsers((p) => p.filter((u) => u.id !== deactivateTarget.id));
      toast.success(`${deactivateTarget.name} deactivated`);
    } catch {
      toast.error('Failed to deactivate user');
    } finally {
      setDeactivateTarget(null);
    }
  };

  const filtered = users.filter((u) => {
    const matchSearch =
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase()) ||
      (u.title ?? '').toLowerCase().includes(search.toLowerCase());
    const matchRole = !roleFilter || getUserRoles(u).includes(roleFilter as UserRole);
    return matchSearch && matchRole;
  });

  const stats = [
    { label: 'Total',    value: users.length,                                                                            color: '#6247ea' },
    { label: 'Online',   value: users.filter((u) => u.status === 'online').length,                                      color: '#10b981' },
    { label: 'Directors', value: users.filter((u) => getUserRoles(u).includes('director')).length,                       color: '#8b5cf6' },
    { label: 'Admins',   value: users.filter((u) => getUserRoles(u).includes('admin')).length,                          color: '#f59e0b' },
    { label: 'Managers', value: users.filter((u) => getUserRoles(u).includes('manager')).length,                        color: '#3b82f6' },
  ];

  return (
    <>
      <AnimatePresence>
        {showInvite && (
          <InviteModal onClose={() => setShowInvite(false)} onInvited={load} />
        )}
      </AnimatePresence>

      <DeactivateModal
        user={deactivateTarget}
        onConfirm={handleDeactivate}
        onCancel={() => setDeactivateTarget(null)}
      />

      <div className="flex-1 overflow-y-auto p-4 md:p-8 font-body">
        <div className="max-w-5xl">

          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center justify-between mb-6"
          >
            <div>
              <h2 className="text-xl font-black text-gray-900 dark:text-gray-100 font-display">
                User Management
              </h2>
              <p className="text-sm text-gray-500 mt-0.5">
                Manage roles, permissions and access
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={load}
                className="p-2 rounded-xl border border-subtle hover:bg-surface-50 dark:hover:bg-surface-800 text-gray-500 transition-colors"
                title="Refresh"
              >
                <RefreshCw size={15} className={isLoading ? 'animate-spin' : ''} />
              </button>
              <Button
                onClick={() => setShowInvite(true)}
                icon={<UserPlus size={15} />}
                className="text-sm"
              >
                Add user
              </Button>
            </div>
          </motion.div>

          {/* Stat pills */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="flex flex-wrap gap-3 mb-6"
          >
            {stats.map((s) => (
              <div
                key={s.label}
                className="flex items-center gap-2.5 bg-white dark:bg-surface-900 border border-subtle rounded-xl px-4 py-2.5"
              >
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color }} />
                <span className="text-xs text-gray-500">{s.label}</span>
                <span className="text-sm font-black text-gray-900 dark:text-gray-100 font-display">
                  {isLoading ? '—' : s.value}
                </span>
              </div>
            ))}
          </motion.div>

          {/* Search + filter */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="flex items-center gap-3 mb-4"
          >
            <div className="relative flex-1 max-w-sm">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name, email or title…"
                className="w-full pl-8 pr-8 py-2 text-xs rounded-xl border border-subtle bg-white dark:bg-surface-900 text-gray-700 dark:text-gray-300 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-brand-500/40"
              />
              {search && (
                <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2">
                  <X size={12} className="text-gray-400 hover:text-gray-600" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-1.5 bg-white dark:bg-surface-900 border border-subtle rounded-xl px-3 py-1.5">
              <Filter size={12} className="text-gray-400" />
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="text-xs text-gray-700 dark:text-gray-300 bg-transparent border-none outline-none cursor-pointer"
              >
                {ROLE_FILTERS.map((f) => (
                  <option key={f.value} value={f.value}>{f.label}</option>
                ))}
              </select>
            </div>

            {(search || roleFilter) && (
              <button
                onClick={() => { setSearch(''); setRoleFilter(''); }}
                className="text-xs text-brand-500 font-semibold hover:underline"
              >
                Clear filters
              </button>
            )}
          </motion.div>

          {/* Table */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="bg-white dark:bg-surface-900 border border-subtle rounded-2xl overflow-hidden"
          >
            {isLoading ? (
              <div className="p-6 space-y-3">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="h-14 bg-surface-50 dark:bg-surface-800 rounded-xl animate-pulse" style={{ opacity: 1 - i * 0.12 }} />
                ))}
              </div>
            ) : (
              <div className="overflow-x-auto overflow-y-auto max-h-[520px]">
                <table className="w-full table-fixed min-w-[600px]">
                  <colgroup>
                    <col style={{ width: '230px' }} />
                    <col style={{ width: '200px' }} />
                    <col style={{ width: '140px' }} />
                    <col style={{ width: '140px' }} />
                    <col />
                    <col style={{ width: '100px' }} />
                  </colgroup>
                  <thead>
                    <tr className="border-b border-subtle">
                      {['User', 'Roles', 'Status', 'Last Active', 'Job Title', 'Actions'].map((h) => (
                        <th
                          key={h}
                          className="sticky top-0 z-10 text-left px-5 py-3 text-[11px] font-bold uppercase tracking-wide text-gray-400 whitespace-nowrap bg-surface-50/90 dark:bg-surface-800/80 backdrop-blur"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <AnimatePresence initial={false}>
                      {filtered.map((u, i) => (
                        <motion.tr
                          key={u.id}
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, x: -16 }}
                          transition={{ delay: i * 0.03, duration: 0.2 }}
                          className="border-b border-subtle/50 hover:bg-surface-50/60 dark:hover:bg-surface-800/30 transition-colors group"
                        >
                          <td className="px-5 py-3.5 w-[230px]">
                            <div className="flex items-center gap-3">
                              <Avatar user={u} size="sm" />
                              <div>
                                <div className="text-[13px] font-semibold text-gray-900 dark:text-gray-100 leading-tight">{u.name}</div>
                                <div className="text-[11px] text-gray-400">{u.email}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-5 py-3.5 w-[200px]">
                            <RoleSelect
                              roles={getUserRoles(u)}
                              onChange={(roles) => handleRoleUpdate(u.id, roles)}
                              disabled={!canEditRoles}
                            />
                          </td>
                          <td className="px-5 py-3.5 w-[140px]">
                            <StatusDot status={u.status} />
                          </td>
                          <td className="px-5 py-3.5 w-[140px] text-[12px] text-gray-500">
                            {formatLastActive(u.lastActiveAt)}
                          </td>
                          <td className="px-5 py-3.5 text-[13px] text-gray-500">
                            {u.title ? (
                              <span>{u.title}</span>
                            ) : (
                              <span className="text-gray-300 dark:text-gray-600 italic text-[12px]">—</span>
                            )}
                          </td>
                          <td className="px-5 py-3.5 w-[100px]">
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={() => setDeactivateTarget(u)}
                                title="Deactivate user"
                                className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                              >
                                <UserX size={14} />
                              </button>
                              <button
                                title="Permissions"
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
                        <td colSpan={6} className="px-5 py-16 text-center">
                          <Users size={28} className="text-gray-300 dark:text-gray-600 mx-auto mb-2" />
                          <p className="text-sm text-gray-400">No users found</p>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* Footer */}
            {!isLoading && filtered.length > 0 && (
              <div className="px-5 py-3 border-t border-subtle bg-surface-50/40 dark:bg-surface-800/20 flex items-center justify-between">
                <span className="text-xs text-gray-400">
                  Showing <span className="font-semibold text-gray-600 dark:text-gray-300">{filtered.length}</span> of{' '}
                  <span className="font-semibold text-gray-600 dark:text-gray-300">{users.length}</span> users
                </span>
              </div>
            )}
          </motion.div>
        </div>
      </div>
    </>
  );
};

export default UserManagementPage;
