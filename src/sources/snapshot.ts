/**
 * Crypto Vision — Snapshot Governance Data Source
 *
 * 100% free GraphQL, no API key.
 * https://hub.snapshot.org/graphql
 *
 * Provides: governance proposals, voting spaces, votes,
 *           major protocol governance tracking.
 */

import { fetchJSON } from "../lib/fetcher.js";
import { cache } from "../lib/cache.js";

const BASE = "https://hub.snapshot.org/graphql";

async function gql<T>(query: string, variables: Record<string, unknown> = {}): Promise<T> {
  const res = await fetchJSON<{ data: T }>(BASE, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: { query, variables },
  });
  return res.data;
}

// ─── Proposals ───────────────────────────────────────────────

export interface Proposal {
  id: string;
  title: string;
  body: string;
  state: string;
  author: string;
  created: number;
  start: number;
  end: number;
  choices: string[];
  scores: number[];
  scores_total: number;
  votes: number;
  quorum: number;
  space: { id: string; name: string };
  type: string;
  link: string;
}

export function getProposals(
  space: string,
  state = "all",
  limit = 20,
): Promise<Proposal[]> {
  const stateFilter = state !== "all" ? `state: "${state}",` : "";
  return cache.wrap(`snap:proposals:${space}:${state}:${limit}`, 120, async () => {
    const res = await gql<{ proposals: Proposal[] }>(`
      query {
        proposals(
          first: ${limit},
          skip: 0,
          where: { space: "${space}", ${stateFilter} },
          orderBy: "created",
          orderDirection: desc
        ) {
          id title body state author created start end
          choices scores scores_total votes quorum type link
          space { id name }
        }
      }
    `);
    return res.proposals;
  });
}

// ─── Active Proposals (multi-space) ──────────────────────────

const MAJOR_SPACES = [
  "aave.eth",
  "uniswapgovernance.eth",
  "ens.eth",
  "gitcoindao.eth",
  "lido-snapshot.eth",
  "arbitrumfoundation.eth",
  "opcollective.eth",
  "safe.eth",
  "balancer.eth",
  "sushigov.eth",
  "curve.eth",
  "compound-governance.eth",
];

export async function getActiveProposals(): Promise<Record<string, Proposal[]>> {
  return cache.wrap("snap:active", 120, async () => {
    const results: Record<string, Proposal[]> = {};
    const promises = MAJOR_SPACES.map(async (space) => {
      try {
        results[space] = await getProposals(space, "active", 5);
      } catch {
        results[space] = [];
      }
    });
    await Promise.all(promises);
    return results;
  });
}

// ─── Spaces ──────────────────────────────────────────────────

export interface Space {
  id: string;
  name: string;
  about: string;
  network: string;
  symbol: string;
  members: number;
  proposalsCount: number;
  categories: string[];
  avatar: string;
  website: string;
  twitter: string;
  github: string;
}

export function getTopSpaces(limit = 50): Promise<Space[]> {
  return cache.wrap(`snap:spaces:${limit}`, 300, async () => {
    const res = await gql<{ spaces: Space[] }>(`
      query {
        spaces(
          first: ${limit},
          skip: 0,
          orderBy: "proposalsCount",
          orderDirection: desc
        ) {
          id name about network symbol members proposalsCount
          categories avatar website twitter github
        }
      }
    `);
    return res.spaces;
  });
}

export function getSpace(id: string): Promise<Space | null> {
  return cache.wrap(`snap:space:${id}`, 300, async () => {
    const res = await gql<{ space: Space | null }>(`
      query {
        space(id: "${id}") {
          id name about network symbol members proposalsCount
          categories avatar website twitter github
        }
      }
    `);
    return res.space;
  });
}

// ─── Votes ───────────────────────────────────────────────────

export interface Vote {
  id: string;
  voter: string;
  vp: number;
  choice: number | number[] | Record<string, number>;
  created: number;
  reason: string;
}

export function getVotes(proposalId: string, limit = 100): Promise<Vote[]> {
  return cache.wrap(`snap:votes:${proposalId}:${limit}`, 120, async () => {
    const res = await gql<{ votes: Vote[] }>(`
      query {
        votes(
          first: ${limit},
          where: { proposal: "${proposalId}" },
          orderBy: "vp",
          orderDirection: desc
        ) {
          id voter vp choice created reason
        }
      }
    `);
    return res.votes;
  });
}

// ─── Search Spaces ───────────────────────────────────────────

export function searchSpaces(query: string, limit = 20): Promise<Space[]> {
  // Snapshot doesn't have a text search API, so we fetch top spaces and filter
  return cache.wrap(`snap:search:${query}:${limit}`, 120, async () => {
    const all = await getTopSpaces(200);
    const q = query.toLowerCase();
    return all.filter((s) =>
      s.name.toLowerCase().includes(q) ||
      s.id.toLowerCase().includes(q) ||
      s.about?.toLowerCase().includes(q)
    ).slice(0, limit);
  });
}
