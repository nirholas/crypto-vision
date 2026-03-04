'use client';

import React, { useState, useMemo } from 'react';
import type { TimelineEvent, EventCategory, EventSeverity } from '@/types/swarm';
import { formatRelativeTime } from '@/types/swarm';

// ─── Props ────────────────────────────────────────────────────

interface EventTimelinePanelProps {
  events: TimelineEvent[];
  loading?: boolean;
}

// ─── Constants ────────────────────────────────────────────────

const CATEGORY_COLORS: Record<EventCategory, string> = {
  lifecycle: 'bg-blue-500',
  trading: 'bg-emerald-500',
  analytics: 'bg-purple-500',
  bundle: 'bg-amber-500',
  intelligence: 'bg-cyan-500',
  coordination: 'bg-indigo-500',
  system: 'bg-gray-500',
  wallet: 'bg-orange-500',
  error: 'bg-red-500',
  metrics: 'bg-teal-500',
};

const SEVERITY_COLORS: Record<EventSeverity, string> = {
  debug: 'text-gray-500',
  info: 'text-gray-300',
  warn: 'text-amber-400',
  error: 'text-red-400',
  critical: 'text-red-500 font-bold',
};

const ALL_CATEGORIES: EventCategory[] = [
  'lifecycle', 'trading', 'analytics', 'bundle', 'intelligence',
  'coordination', 'system', 'wallet', 'error', 'metrics',
];

const ALL_SEVERITIES: EventSeverity[] = ['debug', 'info', 'warn', 'error', 'critical'];

// ─── Component ────────────────────────────────────────────────

export function EventTimelinePanel({ events, loading }: EventTimelinePanelProps) {
  const [filterCategories, setFilterCategories] = useState<Set<EventCategory>>(new Set());
  const [filterSeverity, setFilterSeverity] = useState<EventSeverity | ''>('');

  const filteredEvents = useMemo(() => {
    return events.filter((e) => {
      if (filterCategories.size > 0 && !filterCategories.has(e.category)) return false;
      if (filterSeverity) {
        const severityIndex = ALL_SEVERITIES.indexOf(e.severity);
        const filterIndex = ALL_SEVERITIES.indexOf(filterSeverity);
        if (severityIndex < filterIndex) return false;
      }
      return true;
    });
  }, [events, filterCategories, filterSeverity]);

  const toggleCategory = (cat: EventCategory) => {
    setFilterCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) {
        next.delete(cat);
      } else {
        next.add(cat);
      }
      return next;
    });
  };

  if (loading) {
    return <EventTimelineSkeleton />;
  }

  return (
    <div className="bg-gray-800/50 rounded-lg border border-gray-700 overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-700 space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">Event Timeline</h3>
          <span className="text-xs text-gray-500 tabular-nums">{filteredEvents.length} events</span>
        </div>

        {/* Category filters */}
        <div className="flex flex-wrap gap-1">
          {ALL_CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => toggleCategory(cat)}
              className={`px-2 py-0.5 text-[10px] rounded-full border transition-colors ${
                filterCategories.size === 0 || filterCategories.has(cat)
                  ? 'border-gray-600 text-gray-300 bg-gray-700/50'
                  : 'border-gray-800 text-gray-600'
              }`}
            >
              <span className={`inline-block w-1.5 h-1.5 rounded-full mr-1 ${CATEGORY_COLORS[cat]}`} />
              {cat}
            </button>
          ))}
          <select
            value={filterSeverity}
            onChange={(e) => setFilterSeverity(e.target.value as EventSeverity | '')}
            className="text-[10px] bg-gray-800 border border-gray-700 rounded px-1 py-0.5 text-gray-400 focus:outline-none"
          >
            <option value="">All levels</option>
            {ALL_SEVERITIES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Event list */}
      <div className="max-h-96 overflow-y-auto scrollbar-thin scrollbar-track-gray-900 scrollbar-thumb-gray-700">
        {filteredEvents.length === 0 ? (
          <div className="p-8 text-center text-gray-500 text-sm">No events</div>
        ) : (
          <div className="divide-y divide-gray-800/50">
            {filteredEvents.map((event) => (
              <div key={event.id} className="px-4 py-2 hover:bg-gray-800/30 transition-colors">
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full shrink-0 ${CATEGORY_COLORS[event.category]}`} />
                  <span className="text-xs text-gray-500 tabular-nums shrink-0 w-16">
                    {formatRelativeTime(event.timestamp)}
                  </span>
                  <span className={`text-xs ${SEVERITY_COLORS[event.severity]} truncate flex-1`}>
                    {event.message}
                  </span>
                  <span className="text-[10px] text-gray-600 shrink-0">{event.source}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────

function EventTimelineSkeleton() {
  return (
    <div className="bg-gray-800/50 rounded-lg border border-gray-700 animate-pulse">
      <div className="px-4 py-3 border-b border-gray-700 space-y-2">
        <div className="h-4 w-28 bg-gray-700 rounded" />
        <div className="flex gap-1">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-4 w-14 bg-gray-700 rounded-full" />
          ))}
        </div>
      </div>
      <div className="p-3 space-y-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-6 bg-gray-800 rounded" />
        ))}
      </div>
    </div>
  );
}
