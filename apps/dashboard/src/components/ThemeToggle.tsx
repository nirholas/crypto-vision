/**
 * @fileoverview Theme Toggle - DISABLED
 * Single dark theme only - this component is a no-op
 */
'use client';

interface ThemeToggleProps {
  className?: string;
}

export default function ThemeToggle({ className = '' }: ThemeToggleProps) {
  // No toggle needed - always dark mode
  return null;
}
