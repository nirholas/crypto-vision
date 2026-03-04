'use client';

/**
 * Theme Provider - SINGLE DARK THEME ONLY
 * Black background, white text - no switching
 */

import { createContext, useContext, type ReactNode } from 'react';

type ResolvedTheme = 'dark';

interface ThemeContextType {
  theme: 'dark';
  resolvedTheme: ResolvedTheme;
  setTheme: (theme: string) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: 'dark',
  resolvedTheme: 'dark',
  setTheme: () => {},
  toggleTheme: () => {},
});

interface ThemeProviderProps {
  children: ReactNode;
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  // Always dark - no state, no storage, no switching
  return (
    <ThemeContext.Provider
      value={{
        theme: 'dark',
        resolvedTheme: 'dark',
        setTheme: () => {},
        toggleTheme: () => {},
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}

/**
 * Theme Script - No-op since we're always dark
 */
export function ThemeScript() {
  return null;
}
