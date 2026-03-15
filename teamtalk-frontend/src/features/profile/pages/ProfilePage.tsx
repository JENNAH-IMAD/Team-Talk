import React, { useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Camera, User, Mail, Briefcase, FileText, Lock, Check, Eye, EyeOff, Shield } from 'lucide-react';
import { useAppDispatch, useAuth } from '@/hooks';
import { updateProfile, updateAvatar } from '@/store/slices/authSlice';
import { Avatar } from '@/components/ui';
import { Input } from '@/components/ui';
import { Button } from '@/components/ui';
import apiClient from '@/services/apiClient';
import toast from 'react-hot-toast';
import { cn, getUserRoles } from '@/utils';

const ROLE_COLORS: Record<string, string> = {
  admin:    'bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-500/20',
  manager:  'bg-brand-50 dark:bg-brand-500/10 text-brand-600 dark:text-brand-400 border-brand-200 dark:border-brand-500/20',
  employee: 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20',
};

const ProfilePage: React.FC = () => {
  const dispatch = useAppDispatch();
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Profile form state
  const [firstName, setFirstName] = useState(user?.firstName ?? user?.name?.split(' ')[0] ?? '');
  const [lastName, setLastName]   = useState(user?.lastName  ?? user?.name?.split(' ').slice(1).join(' ') ?? '');
  const [title, setTitle]         = useState(user?.title ?? '');
  const [bio, setBio]             = useState(user?.bio ?? '');
  const [saving, setSaving]       = useState(false);

  // Password form state
  const [currentPwd, setCurrentPwd]   = useState('');
  const [newPwd, setNewPwd]           = useState('');
  const [confirmPwd, setConfirmPwd]   = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew]         = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [pwdSaving, setPwdSaving]     = useState(false);
  const [pwdErrors, setPwdErrors]     = useState<Record<string, string>>({});

  // Avatar upload
  const [avatarUploading, setAvatarUploading] = useState(false);

  const handleSaveProfile = async () => {
    if (!firstName.trim() || !lastName.trim()) {
      toast.error('First and last name are required');
      return;
    }
    setSaving(true);
    try {
      await dispatch(updateProfile({ firstName: firstName.trim(), lastName: lastName.trim(), title: title.trim() || undefined, bio: bio.trim() || undefined })).unwrap();
      toast.success('Profile updated');
    } catch (err: any) {
      toast.error(err || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarUploading(true);
    try {
      await dispatch(updateAvatar(file)).unwrap();
      toast.success('Profile photo updated');
    } catch (err: any) {
      toast.error(err || 'Failed to upload photo');
    } finally {
      setAvatarUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleChangePassword = async () => {
    const errs: Record<string, string> = {};
    if (!currentPwd) errs.currentPwd = 'Required';
    if (!newPwd || newPwd.length < 6) errs.newPwd = 'Min 6 characters';
    if (newPwd !== confirmPwd) errs.confirmPwd = "Passwords don't match";
    if (Object.keys(errs).length > 0) { setPwdErrors(errs); return; }
    setPwdErrors({});
    setPwdSaving(true);
    try {
      await apiClient.put('/users/me/password', { currentPassword: currentPwd, newPassword: newPwd });
      toast.success('Password changed');
      setCurrentPwd(''); setNewPwd(''); setConfirmPwd('');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to change password');
    } finally {
      setPwdSaving(false);
    }
  };

  if (!user) return null;

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">

        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
          <h1 className="text-xl font-black text-gray-900 dark:text-gray-100 font-display">My Profile</h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage your personal information and account settings</p>
        </motion.div>

        {/* Avatar + Name card */}
        <motion.div
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.05 }}
          className="bg-white dark:bg-surface-900 border border-subtle rounded-2xl p-6"
        >
          <div className="flex items-center gap-5 mb-6">
            {/* Avatar upload */}
            <div className="relative group flex-shrink-0">
              <Avatar user={{ id: user.id, name: user.name, status: user.status as any, avatarUrl: user.avatarUrl }} size="xl" showStatus={false} />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={avatarUploading}
                className="absolute inset-0 rounded-lg bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
              >
                {avatarUploading
                  ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  : <Camera size={18} className="text-white" />}
              </button>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
            </div>
            <div>
              <div className="text-lg font-bold text-gray-900 dark:text-gray-100 font-display">{user.name}</div>
              <div className="text-sm text-gray-500">{user.email}</div>
              <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                {getUserRoles(user).map((r) => (
                  <span key={r} className={cn('text-[11px] font-bold px-2 py-0.5 rounded-md border capitalize', ROLE_COLORS[r])}>
                    <Shield size={10} className="inline mr-0.5 -mt-px" />{r}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Form */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="First name"
              placeholder="First name"
              icon={<User size={15} />}
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              autoComplete="off"
            />
            <Input
              label="Last name"
              placeholder="Last name"
              icon={<User size={15} />}
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              autoComplete="off"
            />
          </div>
          <Input
            label="Email"
            placeholder="you@company.com"
            icon={<Mail size={15} />}
            value={user.email}
            disabled
            className="opacity-60 cursor-not-allowed"
            autoComplete="off"
          />
          <Input
            label="Job title"
            placeholder="e.g. Software Engineer"
            icon={<Briefcase size={15} />}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            autoComplete="off"
          />
          <div className="mb-4">
            <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5 uppercase tracking-wide font-body">
              Bio
            </label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Tell your team a bit about yourself…"
              rows={3}
              className="w-full bg-surface-100 dark:bg-surface-850 border-[1.5px] border-transparent focus:border-brand-500 focus:ring-2 focus:ring-brand-500/10 rounded-xl px-3.5 py-2.5 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 outline-none resize-none transition-all font-body"
            />
          </div>
          <div className="flex justify-end">
            <Button onClick={handleSaveProfile} isLoading={saving} icon={saving ? undefined : <Check size={14} />}>
              Save Changes
            </Button>
          </div>
        </motion.div>

        {/* Change password card */}
        <motion.div
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.1 }}
          className="bg-white dark:bg-surface-900 border border-subtle rounded-2xl p-6"
        >
          <div className="flex items-center gap-2 mb-5">
            <Lock size={15} className="text-brand-500" />
            <h3 className="font-bold text-sm text-gray-900 dark:text-gray-100 font-display">Change Password</h3>
          </div>
          <Input
            label="Current password"
            type={showCurrent ? 'text' : 'password'}
            placeholder="••••••••"
            icon={<Lock size={15} />}
            rightIcon={
              <button type="button" onClick={() => setShowCurrent((v) => !v)}>
                {showCurrent ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            }
            value={currentPwd}
            onChange={(e) => { setCurrentPwd(e.target.value); setPwdErrors((p) => ({ ...p, currentPwd: '' })); }}
            error={pwdErrors.currentPwd}
            autoComplete="current-password"
          />
          <Input
            label="New password"
            type={showNew ? 'text' : 'password'}
            placeholder="••••••••"
            icon={<Lock size={15} />}
            rightIcon={
              <button type="button" onClick={() => setShowNew((v) => !v)}>
                {showNew ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            }
            value={newPwd}
            onChange={(e) => { setNewPwd(e.target.value); setPwdErrors((p) => ({ ...p, newPwd: '' })); }}
            error={pwdErrors.newPwd}
            autoComplete="new-password"
          />
          <Input
            label="Confirm new password"
            type={showConfirm ? 'text' : 'password'}
            placeholder="••••••••"
            icon={<Lock size={15} />}
            rightIcon={
              <button type="button" onClick={() => setShowConfirm((v) => !v)}>
                {showConfirm ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            }
            value={confirmPwd}
            onChange={(e) => { setConfirmPwd(e.target.value); setPwdErrors((p) => ({ ...p, confirmPwd: '' })); }}
            error={pwdErrors.confirmPwd}
            autoComplete="new-password"
          />
          <div className="flex justify-end">
            <Button onClick={handleChangePassword} isLoading={pwdSaving} variant="secondary">
              Update Password
            </Button>
          </div>
        </motion.div>

      </div>
    </div>
  );
};

export default ProfilePage;
