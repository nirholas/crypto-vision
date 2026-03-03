/**
 * Crypto Vision — L2Beat Data Source
 *
 * 100% free, no API key required.
 *
 * Provides: Layer 2 project TVL, risk assessments,
 *           transaction activity, L2 sector overview.
 */

import { fetchJSON } from "../lib/fetcher.js";
import { cache } from "../lib/cache.js";

const API = "https://l2beat.com/api";

// ─── TVL Overview (scaling summary) ──────────────────────────

export interface L2Project {
  id: string;
  name: string;
  slug: string;
  tvl: number;
  tvlChange7d: number;
  category: string;
  stage: string;
  purposes: string[];
  provider?: string;
}

export function getScalingSummary(): Promise<{
  projects: Record<string, {
    id: string;
    name: string;
    slug: string;
    category: string;
    provider?: string;
    purposes: string[];
    stage?: { stage: string };
    tvl?: { displayValue: string; value: number; change: number };
  }>;
}> {
  return cache.wrap("l2beat:summary", 600, () =>
    fetchJSON(`${API}/scaling/summary`),
  );
}

// ─── TVL Breakdown ───────────────────────────────────────────

export function getScalingTvl(): Promise<{
  projects: Record<string, {
    charts: {
      daily: {
        data: [number, number, number, number][]; // [ts, canonical, external, native]
      };
    };
  }>;
}> {
  return cache.wrap("l2beat:tvl", 600, () =>
    fetchJSON(`${API}/scaling/tvl`),
  );
}

// ─── Activity (TPS) ──────────────────────────────────────────

export function getScalingActivity(): Promise<{
  projects: Record<string, {
    daily: {
      data: [number, number, number][]; // [ts, txCount, uopsCount]
    };
  }>;
}> {
  return cache.wrap("l2beat:activity", 600, () =>
    fetchJSON(`${API}/scaling/activity`),
  );
}
