/**
 * Standardized Form Components
 * Provides consistent form inputs, selects, and buttons across the application.
 */

import React, { forwardRef, useState, useId } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ExclamationCircleIcon,
  CheckCircleIcon,
  EyeIcon,
  EyeSlashIcon,
  ChevronDownIcon,
  MagnifyingGlassIcon,
} from '@heroicons/react/24/outline';

// =============================================================================
// SHARED STYLES
// =============================================================================

const baseInputStyles = `
  w-full px-4 py-2.5 text-sm
  bg-white dark:bg-slate-800
  border border-gray-300 dark:border-slate-600
  rounded-lg
  text-gray-900 dark:text-white
  placeholder-gray-400 dark:placeholder-gray-500
  transition-all duration-200
  focus:ring-2 focus:ring-primary-500 focus:border-primary-500
  disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-gray-100 dark:disabled:bg-slate-700
`;

const errorInputStyles = `
  border-red-500 dark:border-red-400
  focus:ring-red-500 focus:border-red-500
`;

const labelStyles = `
  block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5
`;

const helperTextStyles = `
  mt-1.5 text-xs text-gray-500 dark:text-gray-400
`;

const errorTextStyles = `
  mt-1.5 text-xs text-red-600 dark:text-red-400 flex items-center gap-1
`;

// =============================================================================
// INPUT COMPONENT
// =============================================================================

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  showPasswordToggle?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      error,
      helperText,
      leftIcon,
      rightIcon,
      showPasswordToggle,
      type = 'text',
      className = '',
      id,
      ...props
    },
    ref
  ) => {
    const generatedId = useId();
    const inputId = id || generatedId;
    const [showPassword, setShowPassword] = useState(false);

    const inputType = showPasswordToggle
      ? showPassword
        ? 'text'
        : 'password'
      : type;

    return (
      <div className={className}>
        {label && (
          <label htmlFor={inputId} className={labelStyles}>
            {label}
            {props.required && <span className="text-red-500 ml-0.5">*</span>}
          </label>
        )}
        <div className="relative">
          {leftIcon && (
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
              {leftIcon}
            </div>
          )}
          <input
            ref={ref}
            id={inputId}
            type={inputType}
            className={`
              ${baseInputStyles}
              ${error ? errorInputStyles : ''}
              ${leftIcon ? 'pl-10' : ''}
              ${rightIcon || showPasswordToggle ? 'pr-10' : ''}
            `}
            aria-invalid={!!error}
            aria-describedby={error ? `${inputId}-error` : undefined}
            {...props}
          />
          {showPasswordToggle && (
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              {showPassword ? (
                <EyeSlashIcon className="h-5 w-5" />
              ) : (
                <EyeIcon className="h-5 w-5" />
              )}
            </button>
          )}
          {rightIcon && !showPasswordToggle && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
              {rightIcon}
            </div>
          )}
        </div>
        {error && (
          <motion.p
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            id={`${inputId}-error`}
            className={errorTextStyles}
          >
            <ExclamationCircleIcon className="h-3.5 w-3.5" />
            {error}
          </motion.p>
        )}
        {helperText && !error && (
          <p className={helperTextStyles}>{helperText}</p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';

// =============================================================================
// SEARCH INPUT COMPONENT
// =============================================================================

export interface SearchInputProps extends Omit<InputProps, 'leftIcon'> {
  onClear?: () => void;
}

export const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(
  ({ onClear, value, ...props }, ref) => {
    return (
      <Input
        ref={ref}
        type="search"
        leftIcon={<MagnifyingGlassIcon className="h-5 w-5" />}
        value={value}
        {...props}
      />
    );
  }
);

SearchInput.displayName = 'SearchInput';

// =============================================================================
// TEXTAREA COMPONENT
// =============================================================================

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, helperText, className = '', id, ...props }, ref) => {
    const generatedId = useId();
    const textareaId = id || generatedId;

    return (
      <div className={className}>
        {label && (
          <label htmlFor={textareaId} className={labelStyles}>
            {label}
            {props.required && <span className="text-red-500 ml-0.5">*</span>}
          </label>
        )}
        <textarea
          ref={ref}
          id={textareaId}
          className={`
            ${baseInputStyles}
            ${error ? errorInputStyles : ''}
            min-h-[100px] resize-y
          `}
          aria-invalid={!!error}
          aria-describedby={error ? `${textareaId}-error` : undefined}
          {...props}
        />
        {error && (
          <motion.p
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            id={`${textareaId}-error`}
            className={errorTextStyles}
          >
            <ExclamationCircleIcon className="h-3.5 w-3.5" />
            {error}
          </motion.p>
        )}
        {helperText && !error && (
          <p className={helperTextStyles}>{helperText}</p>
        )}
      </div>
    );
  }
);

Textarea.displayName = 'Textarea';

// =============================================================================
// SELECT COMPONENT
// =============================================================================

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps
  extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'children'> {
  label?: string;
  error?: string;
  helperText?: string;
  options: SelectOption[];
  placeholder?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  (
    { label, error, helperText, options, placeholder, className = '', id, ...props },
    ref
  ) => {
    const generatedId = useId();
    const selectId = id || generatedId;

    return (
      <div className={className}>
        {label && (
          <label htmlFor={selectId} className={labelStyles}>
            {label}
            {props.required && <span className="text-red-500 ml-0.5">*</span>}
          </label>
        )}
        <div className="relative">
          <select
            ref={ref}
            id={selectId}
            className={`
              ${baseInputStyles}
              ${error ? errorInputStyles : ''}
              appearance-none pr-10 cursor-pointer
            `}
            aria-invalid={!!error}
            aria-describedby={error ? `${selectId}-error` : undefined}
            {...props}
          >
            {placeholder && (
              <option value="" disabled>
                {placeholder}
              </option>
            )}
            {options.map((option) => (
              <option
                key={option.value}
                value={option.value}
                disabled={option.disabled}
              >
                {option.label}
              </option>
            ))}
          </select>
          <ChevronDownIcon className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 pointer-events-none" />
        </div>
        {error && (
          <motion.p
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            id={`${selectId}-error`}
            className={errorTextStyles}
          >
            <ExclamationCircleIcon className="h-3.5 w-3.5" />
            {error}
          </motion.p>
        )}
        {helperText && !error && (
          <p className={helperTextStyles}>{helperText}</p>
        )}
      </div>
    );
  }
);

Select.displayName = 'Select';

// =============================================================================
// CHECKBOX COMPONENT
// =============================================================================

export interface CheckboxProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: string;
  description?: string;
  error?: string;
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  ({ label, description, error, className = '', id, ...props }, ref) => {
    const generatedId = useId();
    const checkboxId = id || generatedId;

    return (
      <div className={className}>
        <div className="flex items-start gap-3">
          <div className="flex items-center h-5">
            <input
              ref={ref}
              id={checkboxId}
              type="checkbox"
              className={`
                h-4 w-4 rounded
                border-gray-300 dark:border-slate-600
                text-primary-600
                focus:ring-primary-500 focus:ring-offset-0
                dark:bg-slate-800
                disabled:opacity-50 disabled:cursor-not-allowed
                ${error ? 'border-red-500' : ''}
              `}
              aria-invalid={!!error}
              {...props}
            />
          </div>
          <div className="flex-1">
            <label
              htmlFor={checkboxId}
              className="text-sm font-medium text-gray-700 dark:text-gray-300 cursor-pointer"
            >
              {label}
            </label>
            {description && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                {description}
              </p>
            )}
          </div>
        </div>
        {error && (
          <motion.p
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            className={`${errorTextStyles} ml-7`}
          >
            <ExclamationCircleIcon className="h-3.5 w-3.5" />
            {error}
          </motion.p>
        )}
      </div>
    );
  }
);

Checkbox.displayName = 'Checkbox';

// =============================================================================
// SWITCH/TOGGLE COMPONENT
// =============================================================================

export interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  description?: string;
  disabled?: boolean;
  size?: 'sm' | 'md';
}

export function Switch({
  checked,
  onChange,
  label,
  description,
  disabled = false,
  size = 'md',
}: SwitchProps) {
  const id = useId();
  const sizes = {
    sm: { track: 'w-8 h-4', thumb: 'h-3 w-3', translate: 'translate-x-4' },
    md: { track: 'w-11 h-6', thumb: 'h-5 w-5', translate: 'translate-x-5' },
  };

  const s = sizes[size];

  return (
    <div className="flex items-center justify-between gap-3">
      {(label || description) && (
        <div className="flex-1">
          {label && (
            <label
              htmlFor={id}
              className="text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              {label}
            </label>
          )}
          {description && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              {description}
            </p>
          )}
        </div>
      )}
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`
          ${s.track}
          relative inline-flex shrink-0 cursor-pointer rounded-full
          border-2 border-transparent
          transition-colors duration-200 ease-in-out
          focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2
          disabled:opacity-50 disabled:cursor-not-allowed
          ${checked ? 'bg-primary-600' : 'bg-gray-200 dark:bg-slate-600'}
        `}
      >
        <span
          className={`
            ${s.thumb}
            pointer-events-none inline-block rounded-full
            bg-white shadow-lg ring-0
            transition duration-200 ease-in-out
            ${checked ? s.translate : 'translate-x-0'}
          `}
        />
      </button>
    </div>
  );
}

// =============================================================================
// BUTTON COMPONENT
// =============================================================================

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'outline';
export type ButtonSize = 'xs' | 'sm' | 'md' | 'lg';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  fullWidth?: boolean;
}

const buttonVariants: Record<ButtonVariant, string> = {
  primary: `
    bg-gradient-to-r from-primary-500 to-primary-600
    hover:from-primary-600 hover:to-primary-700
    text-white shadow-lg shadow-primary-500/25
    hover:shadow-xl hover:shadow-primary-500/30
  `,
  secondary: `
    bg-gray-100 dark:bg-slate-700
    hover:bg-gray-200 dark:hover:bg-slate-600
    text-gray-700 dark:text-gray-200
  `,
  danger: `
    bg-gradient-to-r from-red-500 to-red-600
    hover:from-red-600 hover:to-red-700
    text-white shadow-lg shadow-red-500/25
    hover:shadow-xl hover:shadow-red-500/30
  `,
  ghost: `
    bg-transparent hover:bg-gray-100 dark:hover:bg-slate-800
    text-gray-600 dark:text-gray-400
  `,
  outline: `
    bg-transparent border border-gray-300 dark:border-slate-600
    hover:bg-gray-50 dark:hover:bg-slate-800
    text-gray-700 dark:text-gray-300
  `,
};

const buttonSizes: Record<ButtonSize, string> = {
  xs: 'px-2 py-1 text-xs gap-1',
  sm: 'px-3 py-1.5 text-sm gap-1.5',
  md: 'px-4 py-2.5 text-sm gap-2',
  lg: 'px-6 py-3 text-base gap-2',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      loading = false,
      leftIcon,
      rightIcon,
      fullWidth = false,
      disabled,
      className = '',
      children,
      ...props
    },
    ref
  ) => {
    const isDisabled = disabled || loading;

    return (
      <motion.button
        ref={ref}
        whileHover={!isDisabled ? { scale: 1.02 } : undefined}
        whileTap={!isDisabled ? { scale: 0.98 } : undefined}
        disabled={isDisabled}
        className={`
          inline-flex items-center justify-center
          font-medium rounded-lg
          transition-all duration-200
          focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2
          disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none
          ${buttonVariants[variant]}
          ${buttonSizes[size]}
          ${fullWidth ? 'w-full' : ''}
          ${className}
        `}
        {...props}
      >
        {loading ? (
          <>
            <svg
              className="animate-spin h-4 w-4"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
            <span>Loading...</span>
          </>
        ) : (
          <>
            {leftIcon}
            {children}
            {rightIcon}
          </>
        )}
      </motion.button>
    );
  }
);

Button.displayName = 'Button';

// =============================================================================
// ICON BUTTON COMPONENT
// =============================================================================

export interface IconButtonProps extends Omit<ButtonProps, 'leftIcon' | 'rightIcon' | 'children'> {
  icon: React.ReactNode;
  'aria-label': string;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ icon, size = 'md', className = '', ...props }, ref) => {
    const iconSizes: Record<ButtonSize, string> = {
      xs: 'p-1',
      sm: 'p-1.5',
      md: 'p-2',
      lg: 'p-3',
    };

    return (
      <Button
        ref={ref}
        size={size}
        className={`${iconSizes[size]} ${className}`}
        {...props}
      >
        {icon}
      </Button>
    );
  }
);

IconButton.displayName = 'IconButton';

// =============================================================================
// FORM GROUP COMPONENT (for layouts)
// =============================================================================

export interface FormGroupProps {
  children: React.ReactNode;
  className?: string;
}

export function FormGroup({ children, className = '' }: FormGroupProps) {
  return <div className={`space-y-4 ${className}`}>{children}</div>;
}

// =============================================================================
// FORM ROW COMPONENT (for inline fields)
// =============================================================================

export interface FormRowProps {
  children: React.ReactNode;
  className?: string;
}

export function FormRow({ children, className = '' }: FormRowProps) {
  return (
    <div className={`grid grid-cols-1 md:grid-cols-2 gap-4 ${className}`}>
      {children}
    </div>
  );
}

// =============================================================================
// FORM SECTION COMPONENT (for grouped fields with title)
// =============================================================================

export interface FormSectionProps {
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}

export function FormSection({
  title,
  description,
  children,
  className = '',
}: FormSectionProps) {
  return (
    <div className={`space-y-4 ${className}`}>
      <div>
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
          {title}
        </h3>
        {description && (
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            {description}
          </p>
        )}
      </div>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

// =============================================================================
// VALIDATION INDICATOR COMPONENT
// =============================================================================

export interface ValidationIndicatorProps {
  valid: boolean;
  message: string;
}

export function ValidationIndicator({ valid, message }: ValidationIndicatorProps) {
  return (
    <div className={`flex items-center gap-1.5 text-xs ${valid ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-400 dark:text-gray-500'}`}>
      {valid ? (
        <CheckCircleIcon className="h-3.5 w-3.5" />
      ) : (
        <div className="h-3.5 w-3.5 rounded-full border-2 border-current" />
      )}
      {message}
    </div>
  );
}
