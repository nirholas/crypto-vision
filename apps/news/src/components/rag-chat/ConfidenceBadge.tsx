/**
 * ConfidenceBadge Component
 * 
 * Displays confidence level with color coding and optional details
 */

'use client';

import { memo, useState } from 'react';
import type { ConfidenceScore } from './types';
import { CONFIDENCE_COLORS } from './types';

interface ConfidenceBadgeProps {
  confidence: ConfidenceScore;
  size?: 'sm' | 'md' | 'lg';
  showDetails?: boolean;
  className?: string;
}

function ConfidenceBadgeComponent({
  confidence,
  size = 'md',
  showDetails = false,
  className = '',
}: ConfidenceBadgeProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  
  const colors = CONFIDENCE_COLORS[confidence.level];
  
  const sizeClasses = {
    sm: 'px-1.5 py-0.5 text-[10px]',
    md: 'px-2 py-1 text-xs',
    lg: 'px-3 py-1.5 text-sm',
  };

  const iconSizes = {
    sm: 'w-3 h-3',
    md: 'w-3.5 h-3.5',
    lg: 'w-4 h-4',
  };

  const getIcon = () => {
    switch (confidence.level) {
      case 'high':
        return (
          <svg className={iconSizes[size]} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      case 'medium':
        return (
          <svg className={iconSizes[size]} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      case 'low':
        return (
          <svg className={iconSizes[size]} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        );
      case 'uncertain':
        return (
          <svg className={iconSizes[size]} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
    }
  };

  const getLabel = () => {
    switch (confidence.level) {
      case 'high': return 'High confidence';
      case 'medium': return 'Medium confidence';
      case 'low': return 'Low confidence';
      case 'uncertain': return 'Uncertain';
    }
  };

  return (
    <div className={`relative inline-flex ${className}`}>
      <button
        onClick={() => showDetails && setIsExpanded(!isExpanded)}
        className={`
          inline-flex items-center gap-1 rounded-full font-medium
          ${sizeClasses[size]} ${colors.bg} ${colors.text} ${colors.border}
          border transition-all
          ${showDetails ? 'cursor-pointer hover:opacity-80' : 'cursor-default'}
        `}
        title={getLabel()}
        aria-label={`Confidence: ${confidence.level}, ${Math.round(confidence.overall * 100)}%`}
      >
        {getIcon()}
        <span>{Math.round(confidence.overall * 100)}%</span>
        {showDetails && (
          <svg 
            className={`${iconSizes[size]} transition-transform ${isExpanded ? 'rotate-180' : ''}`} 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        )}
      </button>

      {/* Expanded details */}
      {showDetails && isExpanded && (
        <div className="absolute top-full left-0 mt-2 z-50 w-64 p-3 bg-gray-900 border border-gray-700 rounded-lg shadow-xl">
          <div className="space-y-3">
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-gray-400">Overall</span>
                <span className={`text-xs font-medium ${colors.text}`}>
                  {Math.round(confidence.overall * 100)}%
                </span>
              </div>
              <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
                <div 
                  className={`h-full ${colors.bg.replace('/30', '')} transition-all`}
                  style={{ width: `${confidence.overall * 100}%` }}
                />
              </div>
            </div>

            {confidence.dimensions && (
              <div className="space-y-2 pt-2 border-t border-gray-700">
                {Object.entries(confidence.dimensions).map(([key, value]) => (
                  <div key={key} className="flex items-center justify-between text-xs">
                    <span className="text-gray-400 capitalize">{key}</span>
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-1 bg-gray-700 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-blue-500 transition-all"
                          style={{ width: `${value * 100}%` }}
                        />
                      </div>
                      <span className="text-gray-300 w-8 text-right">{Math.round(value * 100)}%</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {confidence.factors && !confidence.dimensions && (
              <div className="space-y-2 pt-2 border-t border-gray-700">
                {Object.entries(confidence.factors).map(([key, value]) => (
                  <div key={key} className="flex items-center justify-between text-xs">
                    <span className="text-gray-400 capitalize">
                      {key === 'sourceQuality' ? 'Source Quality' : 
                       key === 'recency' ? 'Recency' :
                       key === 'relevance' ? 'Relevance' :
                       key === 'consistency' ? 'Response Quality' : key}
                    </span>
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-1 bg-gray-700 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-blue-500 transition-all"
                          style={{ width: `${value * 100}%` }}
                        />
                      </div>
                      <span className="text-gray-300 w-8 text-right">{Math.round(value * 100)}%</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {confidence.explanation && (
              <p className="text-xs text-gray-400 pt-2 border-t border-gray-700">
                {confidence.explanation}
              </p>
            )}

            {confidence.warnings && confidence.warnings.length > 0 && (
              <div className="pt-2 border-t border-gray-700">
                {confidence.warnings.map((warning, i) => (
                  <div key={i} className="flex items-start gap-1.5 text-xs text-yellow-400">
                    <svg className="w-3 h-3 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01" />
                    </svg>
                    <span>{warning}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export const ConfidenceBadge = memo(ConfidenceBadgeComponent);
export default ConfidenceBadge;
