import React, { forwardRef, useState } from 'react';
import { cn } from '@/utils';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  icon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, icon, rightIcon, className, ...props }, ref) => {
    const [focused, setFocused] = useState(false);

    return (
      <div className="mb-4">
        {label && (
          <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5 uppercase tracking-wide font-body">
            {label}
          </label>
        )}
        <div
          className={cn(
            'flex items-center gap-2 rounded-xl px-3.5',
            'border-[1.5px] transition-all duration-150',
            error
              ? focused
                ? 'bg-red-50 dark:bg-red-500/10 border-red-500 ring-2 ring-red-500/15'
                : 'bg-red-50 dark:bg-red-500/8 border-red-400'
              : focused
              ? 'bg-surface-100 dark:bg-surface-850 border-brand-500 ring-2 ring-brand-500/10'
              : 'bg-surface-100 dark:bg-surface-850 border-transparent',
            className
          )}
        >
          {icon && (
            <span className={cn('flex-shrink-0 transition-colors duration-150', error ? 'text-red-400' : 'text-gray-400 dark:text-gray-500')}>
              {icon}
            </span>
          )}
          <input
            ref={ref}
            onFocus={(e) => {
              setFocused(true);
              props.onFocus?.(e);
            }}
            onBlur={(e) => {
              setFocused(false);
              props.onBlur?.(e);
            }}
            className={cn(
              'w-full py-2.5 bg-transparent outline-none text-sm font-body',
              'text-gray-900 dark:text-gray-100',
              'placeholder:text-gray-400 dark:placeholder:text-gray-600'
            )}
            {...props}
          />
          {rightIcon && (
            <span className="text-gray-400 dark:text-gray-500 flex-shrink-0 cursor-pointer">
              {rightIcon}
            </span>
          )}
        </div>
        {error && (
          <p className="mt-1.5 text-xs text-red-500 font-medium flex items-center gap-1">
            <span className="inline-block w-1 h-1 rounded-full bg-red-500 flex-shrink-0" />
            {error}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';
