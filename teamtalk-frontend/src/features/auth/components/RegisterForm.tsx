import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, Lock, Eye, EyeOff, User, Briefcase, ArrowRight, CheckCircle2 } from 'lucide-react';
import { useAppDispatch, useAuth } from '@/hooks';
import { registerUser, clearError } from '@/store/slices/authSlice';
import { Input, Button } from '@/components/ui';

const schema = z
  .object({
    firstName: z.string().min(1, 'First name is required'),
    lastName: z.string().min(1, 'Last name is required'),
    email: z.string().min(1, 'Email is required').email('Invalid email'),
    title: z.string().optional(),
    password: z.string().min(6, 'Minimum 6 characters'),
    confirmPassword: z.string().min(1, 'Please confirm your password'),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword'],
  });

type FormData = z.infer<typeof schema>;

const steps = ['Personal info', 'Account details'];

export const RegisterForm: React.FC = () => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { isLoading, error, isAuthenticated } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [step, setStep] = useState(0);

  const {
    register,
    handleSubmit,
    trigger,
    formState: { errors },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  useEffect(() => {
    if (isAuthenticated) navigate('/dashboard', { replace: true });
  }, [isAuthenticated, navigate]);

  const goNext = async () => {
    const valid = await trigger(['firstName', 'lastName', 'email', 'title']);
    if (valid) setStep(1);
  };

  const onSubmit = (data: FormData) => {
    dispatch(clearError());
    dispatch(
      registerUser({
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        password: data.password,
        title: data.title || undefined,
      })
    );
  };

  return (
    <div>
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <h2 className="text-2xl font-black text-gray-900 dark:text-gray-100 font-display tracking-tight mb-1">
          Create your account
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
          Join your team on Team Talk
        </p>
      </motion.div>

      {/* Step indicator */}
      <div className="flex items-center gap-2 mb-7">
        {steps.map((label, i) => (
          <React.Fragment key={label}>
            <motion.div
              className="flex items-center gap-1.5"
              animate={{ opacity: i <= step ? 1 : 0.4 }}
              transition={{ duration: 0.3 }}
            >
              <motion.div
                className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold"
                animate={{
                  backgroundColor: i < step ? '#6247ea' : i === step ? '#6247ea' : '#e5e7eb',
                  color: i <= step ? '#fff' : '#9ca3af',
                }}
                transition={{ duration: 0.3 }}
              >
                {i < step ? <CheckCircle2 size={12} /> : i + 1}
              </motion.div>
              <span className="text-[11px] font-semibold text-gray-500">{label}</span>
            </motion.div>
            {i < steps.length - 1 && (
              <motion.div
                className="flex-1 h-px"
                animate={{ backgroundColor: step > 0 ? '#6247ea' : '#e5e7eb' }}
                transition={{ duration: 0.4 }}
              />
            )}
          </React.Fragment>
        ))}
      </div>

      {/* Error */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-4 p-3 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-red-600 dark:text-red-400 text-sm"
          >
            {error}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Steps */}
      <AnimatePresence mode="wait">
        {step === 0 ? (
          <motion.div
            key="step0"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.25 }}
          >
            <div className="grid grid-cols-2 gap-3 mb-0">
              <Input
                label="First name"
                placeholder="First name"
                icon={<User size={15} />}
                error={errors.firstName?.message}
                autoComplete="off"
                {...register('firstName')}
              />
              <Input
                label="Last name"
                placeholder="Last name"
                icon={<User size={15} />}
                error={errors.lastName?.message}
                autoComplete="off"
                {...register('lastName')}
              />
            </div>
            <Input
              label="Email"
              placeholder="you@company.com"
              icon={<Mail size={15} />}
              error={errors.email?.message}
              autoComplete="off"
              {...register('email')}
            />
            <Input
              label="Job title (optional)"
              placeholder="Software Engineer"
              icon={<Briefcase size={15} />}
              error={errors.title?.message}
              autoComplete="off"
              {...register('title')}
            />
            <Button
              onClick={goNext}
              className="w-full justify-center py-2.5 text-sm mt-1"
            >
              Continue
              <ArrowRight size={15} className="ml-1" />
            </Button>
          </motion.div>
        ) : (
          <motion.div
            key="step1"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ duration: 0.25 }}
          >
            <Input
              label="Password"
              type={showPassword ? 'text' : 'password'}
              placeholder="••••••••"
              icon={<Lock size={15} />}
              rightIcon={
                <button type="button" onClick={() => setShowPassword(!showPassword)}>
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              }
              error={errors.password?.message}
              autoComplete="new-password"
              {...register('password')}
            />
            <Input
              label="Confirm password"
              type={showConfirm ? 'text' : 'password'}
              placeholder="••••••••"
              icon={<Lock size={15} />}
              rightIcon={
                <button type="button" onClick={() => setShowConfirm(!showConfirm)}>
                  {showConfirm ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              }
              error={errors.confirmPassword?.message}
              autoComplete="new-password"
              {...register('confirmPassword')}
            />
            <div className="flex gap-2 mt-1">
              <button
                type="button"
                onClick={() => setStep(0)}
                className="flex-1 py-2.5 text-sm font-semibold rounded-xl border border-subtle text-gray-500 hover:bg-surface-50 dark:hover:bg-surface-800 transition-colors"
              >
                Back
              </button>
              <Button
                onClick={handleSubmit(onSubmit)}
                isLoading={isLoading}
                className="flex-[2] justify-center py-2.5 text-sm"
              >
                Create account
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <p className="text-center text-[11px] text-gray-400 mt-5">
        Already have an account?{' '}
        <Link to="/login" className="text-brand-500 font-semibold hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
};
