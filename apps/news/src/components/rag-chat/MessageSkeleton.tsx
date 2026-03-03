/**
 * MessageSkeleton Component
 * 
 * Loading skeleton for chat messages
 */

'use client';

import { memo } from 'react';

interface MessageSkeletonProps {
  type?: 'user' | 'assistant';
  lines?: number;
}

function MessageSkeletonComponent({ type = 'assistant', lines = 3 }: MessageSkeletonProps) {
  const isUser = type === 'user';
  
  return (
    <div 
      className={`flex gap-4 animate-pulse ${isUser ? 'flex-row-reverse' : ''}`}
      role="status"
      aria-label="Loading message"
    >
      {/* Avatar skeleton */}
      <div className={`flex-shrink-0 w-8 h-8 rounded-full ${
        isUser ? 'bg-blue-600/30' : 'bg-purple-600/30'
      }`} />

      {/* Content skeleton */}
      <div className={`flex-1 max-w-[85%] ${isUser ? 'flex flex-col items-end' : ''}`}>
        <div className={`p-4 rounded-2xl ${
          isUser
            ? 'bg-blue-600/20 rounded-br-md'
            : 'bg-gray-800/40 rounded-bl-md'
        }`} style={{ minWidth: isUser ? '120px' : '300px' }}>
          <div className="space-y-2">
            {Array.from({ length: lines }).map((_, i) => (
              <div 
                key={i}
                className="h-3.5 bg-gray-700/50 rounded"
                style={{ 
                  width: i === lines - 1 ? '60%' : '100%',
                  maxWidth: isUser ? '200px' : '400px',
                }}
              />
            ))}
          </div>
        </div>
        
        {/* Metadata skeleton */}
        {!isUser && (
          <div className="flex items-center gap-3 mt-2">
            <div className="h-3 w-12 bg-gray-700/30 rounded" />
            <div className="h-3 w-16 bg-gray-700/30 rounded" />
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Multiple message skeletons for initial loading state
 */
export function MessageSkeletonGroup() {
  return (
    <div className="space-y-6" role="status" aria-label="Loading conversation">
      <MessageSkeletonComponent type="user" lines={1} />
      <MessageSkeletonComponent type="assistant" lines={4} />
      <MessageSkeletonComponent type="user" lines={2} />
      <MessageSkeletonComponent type="assistant" lines={3} />
    </div>
  );
}

/**
 * Welcome screen skeleton
 */
export function WelcomeSkeleton() {
  return (
    <div className="h-full flex flex-col items-center justify-center max-w-2xl mx-auto text-center px-4 animate-pulse">
      {/* Icon skeleton */}
      <div className="w-16 h-16 rounded-2xl bg-gray-800/50 mb-6" />
      
      {/* Title skeleton */}
      <div className="h-7 w-64 bg-gray-800/50 rounded mb-2" />
      
      {/* Description skeleton */}
      <div className="space-y-2 mb-8 w-full max-w-md">
        <div className="h-4 w-full bg-gray-800/30 rounded" />
        <div className="h-4 w-3/4 bg-gray-800/30 rounded mx-auto" />
      </div>
      
      {/* Suggestions skeleton */}
      <div className="grid gap-2 sm:grid-cols-2 w-full">
        {Array.from({ length: 6 }).map((_, i) => (
          <div 
            key={i}
            className="h-16 bg-gray-800/30 rounded-xl border border-gray-700/30"
          />
        ))}
      </div>
    </div>
  );
}

export const MessageSkeleton = memo(MessageSkeletonComponent);
export default MessageSkeleton;
