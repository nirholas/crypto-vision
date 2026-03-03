/**
 * Crypto Vision — DePINScan Data Source
 *
 * 100% free, no API key.
 * https://api.depinscan.io
 *
 * Provides: DePIN project listings, categories, metrics.
 * DePIN = Decentralized Physical Infrastructure Networks.
 */

import { fetchJSON } from "../lib/fetcher.js";
import { cache } from "../lib/cache.js";

const BASE = "https://api.depinscan.io/api";

// ─── Projects ────────────────────────────────────────────────

export interface DePINProject {
  id: string;
  name: string;
  symbol: string;
  slug: string;
  category: string;
  description: string;
  website: string;
  marketCap: number;
  fdv: number;
  price: number;
  priceChange24h: number;
  activeDevices: number;
  deviceGrowth30d: number;
  monthlyRevenue: number;
  totalRevenue: number;
  chains: string[];
  logo: string;
}

export function getProjects(limit = 100): Promise<DePINProject[]> {
  return cache.wrap(`depin:projects:${limit}`, 300, () =>
    fetchJSON(`${BASE}/projects?limit=${limit}`)
  );
}

export function getProject(slug: string): Promise<DePINProject | null> {
  return cache.wrap(`depin:project:${slug}`, 300, async () => {
    try {
      return await fetchJSON<DePINProject>(`${BASE}/projects/${slug}`);
    } catch {
      return null;
    }
  });
}

// ─── Categories ──────────────────────────────────────────────

export async function getCategories(): Promise<string[]> {
  return cache.wrap("depin:categories", 3600, async () => {
    const projects = await getProjects(200);
    const cats = new Set(projects.map((p) => p.category).filter(Boolean));
    return [...cats].sort();
  });
}

export async function getProjectsByCategory(category: string): Promise<DePINProject[]> {
  const projects = await getProjects(200);
  return projects.filter(
    (p) => p.category.toLowerCase() === category.toLowerCase(),
  );
}

// ─── Metrics ─────────────────────────────────────────────────

export interface DePINMetrics {
  totalProjects: number;
  totalMarketCap: number;
  totalActiveDevices: number;
  totalMonthlyRevenue: number;
  categories: Record<string, number>;
  topByMarketCap: DePINProject[];
  topByDevices: DePINProject[];
  topByRevenue: DePINProject[];
}

export async function getMetrics(): Promise<DePINMetrics> {
  return cache.wrap("depin:metrics", 300, async () => {
    const projects = await getProjects(200);

    const categories: Record<string, number> = {};
    for (const p of projects) {
      if (p.category) {
        categories[p.category] = (categories[p.category] || 0) + 1;
      }
    }

    return {
      totalProjects: projects.length,
      totalMarketCap: projects.reduce((s, p) => s + (p.marketCap || 0), 0),
      totalActiveDevices: projects.reduce((s, p) => s + (p.activeDevices || 0), 0),
      totalMonthlyRevenue: projects.reduce((s, p) => s + (p.monthlyRevenue || 0), 0),
      categories,
      topByMarketCap: [...projects].sort((a, b) => (b.marketCap || 0) - (a.marketCap || 0)).slice(0, 10),
      topByDevices: [...projects].sort((a, b) => (b.activeDevices || 0) - (a.activeDevices || 0)).slice(0, 10),
      topByRevenue: [...projects].sort((a, b) => (b.monthlyRevenue || 0) - (a.monthlyRevenue || 0)).slice(0, 10),
    };
  });
}
