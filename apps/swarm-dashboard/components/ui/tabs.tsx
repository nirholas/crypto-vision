'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

interface TabsContextValue {
  value: string;
  onValueChange: (value: string) => void;
}

const TabsContext = React.createContext<TabsContextValue>({ value: '', onValueChange: () => {} });

interface TabsProps extends React.HTMLAttributes<HTMLDivElement> {
  value: string;
  onValueChange: (value: string) => void;
}

function Tabs({ value, onValueChange, children, className, ...props }: TabsProps) {
  return (
    <TabsContext.Provider value={{ value, onValueChange }}>
      <div className={cn('w-full', className)} {...props}>
        {children}
      </div>
    </TabsContext.Provider>
  );
}

function TabsList({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'inline-flex h-10 items-center justify-center rounded-lg bg-bg-secondary p-1 text-text-secondary',
        className,
      )}
      {...props}
    />
  );
}

interface TabsTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  value: string;
}

function TabsTrigger({ value, className, ...props }: TabsTriggerProps) {
  const ctx = React.useContext(TabsContext);
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-all focus-visible:outline-none',
        ctx.value === value
          ? 'bg-bg-card text-text-primary shadow-sm'
          : 'text-text-muted hover:text-text-secondary',
        className,
      )}
      onClick={() => ctx.onValueChange(value)}
      {...props}
    />
  );
}

interface TabsContentProps extends React.HTMLAttributes<HTMLDivElement> {
  value: string;
}

function TabsContent({ value, className, ...props }: TabsContentProps) {
  const ctx = React.useContext(TabsContext);
  if (ctx.value !== value) return null;
  return <div className={cn('mt-2 animate-in', className)} {...props} />;
}

export { Tabs, TabsList, TabsTrigger, TabsContent };
