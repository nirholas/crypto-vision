/**
 * TypingIndicator Component
 * 
 * Animated typing indicator shown while AI is generating a response
 */

'use client';

import { memo } from 'react';

interface TypingIndicatorProps {
  /** Optional label for screen readers */
  label?: string;
}

function TypingIndicatorComponent({ label = 'AI is thinking...' }: TypingIndicatorProps) {
  return (
    <div 
      className="flex items-start gap-4"
      role="status"
      aria-label={label}
    >
      {/* AI Avatar */}
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center">
        <svg 
          className="w-5 h-5 text-white" 
          fill="none" 
          viewBox="0 0 24 24" 
          stroke="currentColor"
          aria-hidden="true"
        >
          <path 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            strokeWidth={2} 
            d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" 
          />
        </svg>
      </div>

      {/* Typing bubble */}
      <div className="bg-gray-800/60 rounded-2xl rounded-bl-md px-4 py-3 shadow-lg">
        <div className="flex items-center gap-1.5">
          {/* Animated dots */}
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="w-2 h-2 bg-purple-400 rounded-full animate-bounce"
              style={{
                animationDelay: `${i * 150}ms`,
                animationDuration: '600ms',
              }}
            />
          ))}
        </div>
        
        {/* Accessible text (visually hidden) */}
        <span className="sr-only">{label}</span>
      </div>
    </div>
  );
}

export const TypingIndicator = memo(TypingIndicatorComponent);
