/**
 * @fileoverview Premium Input Components
 * 
 * Form inputs with modern styling, validation states,
 * and enhanced user experience.
 * 
 * @module components/ui/Input
 */
'use client';

import { forwardRef, InputHTMLAttributes, TextareaHTMLAttributes, ReactNode } from 'react';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  leftElement?: ReactNode;
  rightElement?: ReactNode;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      error,
      hint,
      leftIcon,
      rightIcon,
      leftElement,
      rightElement,
      className = '',
      id,
      ...props
    },
    ref
  ) => {
    const inputId = id || `input-${Math.random().toString(36).substr(2, 9)}`;
    
    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-sm font-medium text-text-secondary mb-1.5"
          >
            {label}
          </label>
        )}
        <div className="relative">
          {leftElement && (
            <div className="absolute inset-y-0 left-0 flex items-center">
              {leftElement}
            </div>
          )}
          {leftIcon && !leftElement && (
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-text-muted">
              {leftIcon}
            </div>
          )}
          <input
            ref={ref}
            id={inputId}
            className={`
              input-premium w-full
              ${leftIcon || leftElement ? 'pl-10' : ''}
              ${rightIcon || rightElement ? 'pr-10' : ''}
              ${error ? 'border-loss focus:border-loss focus:ring-loss/20' : ''}
              ${className}
            `}
            {...props}
          />
          {rightElement && (
            <div className="absolute inset-y-0 right-0 flex items-center">
              {rightElement}
            </div>
          )}
          {rightIcon && !rightElement && (
            <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-text-muted">
              {rightIcon}
            </div>
          )}
        </div>
        {error && (
          <p className="mt-1.5 text-sm text-loss flex items-center gap-1">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            {error}
          </p>
        )}
        {hint && !error && (
          <p className="mt-1.5 text-sm text-text-muted">{hint}</p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';

export default Input;

// Search Input
export interface SearchInputProps extends Omit<InputProps, 'leftIcon'> {
  onClear?: () => void;
  showClear?: boolean;
}

export const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(
  ({ onClear, showClear = true, value, className = '', ...props }, ref) => {
    return (
      <Input
        ref={ref}
        type="search"
        value={value}
        leftIcon={
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        }
        rightElement={
          showClear && value ? (
            <button
              type="button"
              onClick={onClear}
              className="px-3 h-full text-text-muted hover:text-text-primary transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          ) : undefined
        }
        className={`search-premium ${className}`}
        {...props}
      />
    );
  }
);

SearchInput.displayName = 'SearchInput';

// Number Input with increment/decrement
export interface NumberInputProps extends Omit<InputProps, 'type'> {
  min?: number;
  max?: number;
  step?: number;
  onIncrement?: () => void;
  onDecrement?: () => void;
}

export const NumberInput = forwardRef<HTMLInputElement, NumberInputProps>(
  ({ min, max, step = 1, onIncrement, onDecrement, className = '', ...props }, ref) => {
    return (
      <Input
        ref={ref}
        type="number"
        min={min}
        max={max}
        step={step}
        rightElement={
          <div className="flex flex-col border-l border-surface-border h-full">
            <button
              type="button"
              onClick={onIncrement}
              className="flex-1 px-2 hover:bg-surface-hover transition-colors text-text-muted hover:text-text-primary"
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
              </svg>
            </button>
            <button
              type="button"
              onClick={onDecrement}
              className="flex-1 px-2 border-t border-surface-border hover:bg-surface-hover transition-colors text-text-muted hover:text-text-primary"
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </div>
        }
        className={`number-mono ${className}`}
        {...props}
      />
    );
  }
);

NumberInput.displayName = 'NumberInput';

// Textarea
export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, hint, className = '', id, ...props }, ref) => {
    const textareaId = id || `textarea-${Math.random().toString(36).substr(2, 9)}`;
    
    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={textareaId}
            className="block text-sm font-medium text-text-secondary mb-1.5"
          >
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          id={textareaId}
          className={`
            input-premium w-full min-h-[100px] resize-y
            ${error ? 'border-loss focus:border-loss focus:ring-loss/20' : ''}
            ${className}
          `}
          {...props}
        />
        {error && (
          <p className="mt-1.5 text-sm text-loss flex items-center gap-1">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            {error}
          </p>
        )}
        {hint && !error && (
          <p className="mt-1.5 text-sm text-text-muted">{hint}</p>
        )}
      </div>
    );
  }
);

Textarea.displayName = 'Textarea';
