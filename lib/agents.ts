/**
 * Crypto Vision — Agent Registry
 *
 * Loads and indexes the 43 DeFi agent JSON configs from agents/src/.
 * Provides typed access for the routes layer and AI execution.
 *
 * @copyright 2024-2026 nirholas. All rights reserved.
 */

import { readFileSync, readdirSync } from "node:fs";
import { join, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { log } from "./logger.js";

// ─── Types ───────────────────────────────────────────────────

export interface AgentMeta {
  title: string;
  description: string;
  avatar: string;
  tags: string[];
  category: string;
}

export interface AgentConfig {
  systemRole: string;
  openingMessage: string;
  openingQuestions: string[];
}

export interface AgentExample {
  role: "user" | "assistant";
  content: string;
}

export interface AgentDefinition {
  author: string;
  config: AgentConfig;
  createdAt: string;
  examples: AgentExample[];
  homepage: string;
  identifier: string;
  knowledgeCount: number;
  meta: AgentMeta;
  pluginCount: number;
  schemaVersion: number;
  summary: string;
  tokenUsage: number;
}

/** Lightweight listing entry (no full systemRole / examples) */
export interface AgentSummary {
  id: string;
  title: string;
  description: string;
  avatar: string;
  tags: string[];
  category: string;
  author: string;
  createdAt: string;
  tokenUsage: number;
}

// ─── Registry ────────────────────────────────────────────────

const agentMap = new Map<string, AgentDefinition>();

function loadAgents(): void {
  // Resolve agents/src relative to project root
  const thisFile = fileURLToPath(import.meta.url);
  const projectRoot = join(thisFile, "..", "..");
  const agentsDir = join(projectRoot, "agents", "src");

  let files: string[];
  try {
    files = readdirSync(agentsDir).filter((f) => f.endsWith(".json"));
  } catch (err) {
    log.warn({ err, agentsDir }, "Could not read agents directory");
    return;
  }

  for (const file of files) {
    try {
      const raw = readFileSync(join(agentsDir, file), "utf-8");
      const def = JSON.parse(raw) as AgentDefinition;
      const id = def.identifier || basename(file, ".json");
      agentMap.set(id, def);
    } catch (err) {
      log.warn({ err, file }, "Failed to load agent config");
    }
  }

  log.info(`Loaded ${agentMap.size} agent configs`);
}

// Load on import
loadAgents();

// ─── Public API ──────────────────────────────────────────────

/** Return all agents as lightweight summaries */
export function listAgents(): AgentSummary[] {
  return Array.from(agentMap.values()).map((a) => ({
    id: a.identifier,
    title: a.meta.title,
    description: a.meta.description,
    avatar: a.meta.avatar,
    tags: a.meta.tags,
    category: a.meta.category,
    author: a.author,
    createdAt: a.createdAt,
    tokenUsage: a.tokenUsage,
  }));
}

/** Return the full agent definition (or undefined if not found) */
export function getAgent(id: string): AgentDefinition | undefined {
  return agentMap.get(id);
}

/** Check if an agent exists */
export function hasAgent(id: string): boolean {
  return agentMap.has(id);
}

/** Number of loaded agents */
export function agentCount(): number {
  return agentMap.size;
}
