/**
 * ProcessingIndicator Component
 * 
 * Shows the current processing step with animated icons
 * and real-time progress updates
 */

'use client';

import { memo, useEffect, useState, type ReactElement } from 'react';

interface ProcessingIndicatorProps {
  step: string | null;
  processingInfo?: {
    intent?: string;
    complexity?: string;
    documentsFound?: number;
  } | null;
}

const STEP_ICONS: Record<string, ReactElement> = {
  'Starting...': (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M13 10V3L4 14h7v7l9-11h-7z" />
    </svg>
  ),
  'Processing query...': (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
    </svg>
  ),
  'Searching documents...': (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
  ),
  'Reranking results...': (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M3 4h13M3 8h9m-9 4h9m5-4v12m0 0l-4-4m4 4l4-4" />
    </svg>
  ),
  'Generating response...': (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
    </svg>
  ),
};

const STEP_ORDER = [
  'Starting...',
  'Processing query...',
  'Searching documents...',
  'Reranking results...',
  'Generating response...',
];

function ProcessingIndicatorComponent({ step, processingInfo }: ProcessingIndicatorProps) {
  const [dots, setDots] = useState('');

  useEffect(() => {
    if (!step) return;
    const interval = setInterval(() => {
      setDots(prev => prev.length >= 3 ? '' : prev + '.');
    }, 400);
    return () => clearInterval(interval);
  }, [step]);

  if (!step) return null;

  const currentStepIndex = STEP_ORDER.findIndex(s => step.includes(s.replace('...', '')));
  const icon = Object.entries(STEP_ICONS).find(([key]) => step.includes(key.replace('...', '')))?.[1];

  return (
    <div className="flex items-center gap-4 p-4 bg-gray-800/40 border border-gray-700/30 rounded-xl">
      {/* Animated spinner */}
      <div className="relative flex-shrink-0">
        <div className="w-10 h-10 rounded-full border-2 border-gray-700 border-t-blue-500 animate-spin" />
        <div className="absolute inset-0 flex items-center justify-center text-blue-400">
          {icon}
        </div>
      </div>

      {/* Progress info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-white">
            {step.replace('...', '')}{dots}
          </span>
        </div>
        
        {/* Step progress */}
        <div className="flex items-center gap-1 mt-2">
          {STEP_ORDER.map((s, i) => (
            <div
              key={s}
              className={`h-1 flex-1 rounded-full transition-colors duration-300 ${
                i <= currentStepIndex
                  ? 'bg-blue-500'
                  : 'bg-gray-700'
              }`}
            />
          ))}
        </div>
        
        {/* Additional info */}
        {processingInfo && (
          <div className="flex flex-wrap gap-3 mt-2 text-xs text-gray-500">
            {processingInfo.intent && (
              <span className="flex items-center gap-1">
                <span className="text-gray-600">Intent:</span>
                <span className="text-gray-400 capitalize">{processingInfo.intent}</span>
              </span>
            )}
            {processingInfo.documentsFound !== undefined && (
              <span className="flex items-center gap-1">
                <span className="text-gray-600">Found:</span>
                <span className="text-gray-400">{processingInfo.documentsFound} documents</span>
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export const ProcessingIndicator = memo(ProcessingIndicatorComponent);
export default ProcessingIndicator;
