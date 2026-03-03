/**
 * AskAIButton Component
 * 
 * Floating action button to trigger the RAG chat modal
 */

'use client';

import { useRAGChatModal } from './RAGChatProvider';

interface AskAIButtonProps {
  position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
  size?: 'sm' | 'md' | 'lg';
  showKeyboardHint?: boolean;
  className?: string;
}

export function AskAIButton({
  position = 'bottom-right',
  size = 'md',
  showKeyboardHint = true,
  className = '',
}: AskAIButtonProps) {
  const { open, isOpen } = useRAGChatModal();

  const positionClasses = {
    'bottom-right': 'bottom-6 right-6',
    'bottom-left': 'bottom-6 left-6',
    'top-right': 'top-6 right-6',
    'top-left': 'top-6 left-6',
  };

  const sizeClasses = {
    sm: 'w-12 h-12',
    md: 'w-14 h-14',
    lg: 'w-16 h-16',
  };

  const iconSizes = {
    sm: 'w-5 h-5',
    md: 'w-6 h-6',
    lg: 'w-7 h-7',
  };

  if (isOpen) return null;

  return (
    <button
      onClick={open}
      className={`
        fixed ${positionClasses[position]} ${sizeClasses[size]}
        bg-gradient-to-br from-blue-500 to-purple-600 
        hover:from-blue-600 hover:to-purple-700
        text-white rounded-full shadow-lg shadow-blue-500/25
        hover:shadow-xl hover:shadow-blue-500/30
        transition-all duration-200 hover:scale-105 active:scale-95
        flex items-center justify-center
        z-50 group
        ${className}
      `}
      title="Ask AI (⌘K)"
    >
      <svg 
        className={`${iconSizes[size]} transition-transform group-hover:scale-110`} 
        fill="none" 
        stroke="currentColor" 
        viewBox="0 0 24 24"
      >
        <path 
          strokeLinecap="round" 
          strokeLinejoin="round" 
          strokeWidth={1.5}
          d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z" 
        />
      </svg>

      {/* Keyboard hint tooltip */}
      {showKeyboardHint && (
        <span className="absolute -top-10 left-1/2 -translate-x-1/2 px-2 py-1 
                         bg-gray-900 text-xs text-gray-300 rounded 
                         opacity-0 group-hover:opacity-100 transition-opacity
                         whitespace-nowrap pointer-events-none">
          <kbd className="font-mono">⌘K</kbd>
        </span>
      )}

      {/* Pulse animation */}
      <span className="absolute inset-0 rounded-full bg-blue-500 animate-ping opacity-25" />
    </button>
  );
}

export default AskAIButton;
