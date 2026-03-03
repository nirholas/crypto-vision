/**
 * Crypto Vision — Governance Route
 *
 * On-chain governance data from Snapshot and related sources.
 *
 * GET /api/governance/proposals/:space      — Proposals for a DAO space
 * GET /api/governance/active                — Active proposals across major DAOs
 * GET /api/governance/spaces                — Popular DAO spaces
 * GET /api/governance/space/:id             — Space detail
 * GET /api/governance/votes/:proposalId     — Votes on a proposal
 * GET /api/governance/search                — Search spaces
 */

import { Hono } from "hono";
import * as snapshot from "../sources/snapshot.js";

export const governanceRoutes = new Hono();

governanceRoutes.get("/proposals/:space", async (c) => {
  const space = c.req.param("space");
  const first = Number(c.req.query("limit") || "20");
  const skip = Number(c.req.query("offset") || "0");
  const state = c.req.query("state") || undefined;
  const data = await snapshot.getProposals(space, state, first);
  return c.json({ space, count: data.length, data });
});

governanceRoutes.get("/active", async (c) => {
  const data = await snapshot.getActiveProposals();
  return c.json({ count: data.length, data, timestamp: new Date().toISOString() });
});

governanceRoutes.get("/spaces", async (c) => {
  const first = Number(c.req.query("limit") || "20");
  const skip = Number(c.req.query("offset") || "0");
  const data = await snapshot.getTopSpaces(first);
  return c.json({ count: data.length, data });
});

governanceRoutes.get("/space/:id", async (c) => {
  const id = c.req.param("id");
  const data = await snapshot.getSpace(id);
  return c.json(data);
});

governanceRoutes.get("/votes/:proposalId", async (c) => {
  const proposalId = c.req.param("proposalId");
  const first = Number(c.req.query("limit") || "100");
  const data = await snapshot.getVotes(proposalId, first);
  return c.json({ proposalId, count: data.length, data });
});

governanceRoutes.get("/search", async (c) => {
  const q = c.req.query("q") || "";
  if (!q) return c.json({ error: "Missing ?q= parameter" }, 400);
  const data = await snapshot.searchSpaces(q);
  return c.json({ query: q, count: data.length, data });
});

// ─── GET /api/governance/top-spaces ──────────────────────────

governanceRoutes.get("/top-spaces", async (c) => {
  const first = Number(c.req.query("limit") || "20");
  const data = await snapshot.getTopSpaces(first);
  return c.json({ count: data.length, data });
});
