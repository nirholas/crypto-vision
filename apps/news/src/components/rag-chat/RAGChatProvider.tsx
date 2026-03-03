/**
 * RAGChatProvider
 * 
 * Provides global RAG chat functionality via context
 * and renders the modal when triggered
 */

'use client';

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import { RAGChatModal } from './RAGChatModal';

interface RAGChatContextValue {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
}

const RAGChatContext = createContext<RAGChatContextValue | null>(null);

interface RAGChatProviderProps {
  children: ReactNode;
}

export function RAGChatProvider({ children }: RAGChatProviderProps) {
  const [isOpen, setIsOpen] = useState(false);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);
  const toggle = useCallback(() => setIsOpen(prev => !prev), []);

  const value: RAGChatContextValue = {
    isOpen,
    open,
    close,
    toggle,
  };

  return (
    <RAGChatContext.Provider value={value}>
      {children}
      <RAGChatModal defaultOpen={isOpen} onOpenChange={setIsOpen} />
    </RAGChatContext.Provider>
  );
}

export function useRAGChatModal() {
  const context = useContext(RAGChatContext);
  if (!context) {
    throw new Error('useRAGChatModal must be used within a RAGChatProvider');
  }
  return context;
}

export default RAGChatProvider;
