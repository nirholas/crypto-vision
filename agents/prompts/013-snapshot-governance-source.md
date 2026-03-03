# Prompt 013 — Snapshot Source Adapter (Governance Voting)

## Preamble — Read Every Time

You are an expert TypeScript engineer building **cryptocurrency.cv**. Stack: **Hono + TypeScript + Node.js**, Google Cloud Run, Redis caching, Zod validation.

### Absolute Rules

1. **Never mock, stub, or fake anything.** Real implementations only.
2. **TypeScript strict mode** — no `any`, no `@ts-ignore`.
3. **Always kill terminals**, **commit and push as `nirholas`**.
4. **If close to hallucinating** — stop and tell the prompter.
5. **Run `npx tsc --noEmit` and `npx vitest run`** after changes.

---

## Task

Build `src/sources/snapshot.ts` — adapter for Snapshot.org, the dominant off-chain governance voting platform. Snapshot uses **GraphQL**, not REST.

### API Endpoint

```
https://hub.snapshot.org/graphql     # GraphQL
# No auth needed for public queries
```

### Requirements

#### 1. GraphQL Client

```typescript
async function snapshotQuery<T>(query: string, variables?: Record<string, unknown>, ttl?: number): Promise<T>
// POST to https://hub.snapshot.org/graphql
// Body: { query, variables }
// Use fetchJSON with proper Content-Type
```

#### 2. Zod Schemas

- `SnapshotSpace` — id, name, about, network, symbol, strategies[], members[], admins[], moderators[], proposalsCount, followersCount, avatar, domain, twitter, github, terms, voting (delay, period, quorum, hideAbstain), categories[], treasuries[]
- `SnapshotProposal` — id, title, body, choices[], start, end, state (active, closed, pending), author, space { id, name }, scores[], scores_total, votes, quorum, type (single-choice, weighted, approval, quadratic, ranked-choice), discussion, ipfs, created, updated, plugins
- `SnapshotVote` — id, voter, choice (number or object for weighted), vp (voting power), vp_by_strategy[], created, reason, space { id }, proposal { id }
- `SnapshotStrategy` — name, network, params
- `SnapshotFollow` — id, follower, space, created

#### 3. Exported Functions

**Spaces (DAOs):**

| Function | Query | Cache TTL |
|----------|-------|-----------|
| `getSpaces(first?, skip?, orderBy?)` | `spaces` query | 120s |
| `getSpace(id)` | `space(id: $id)` | 120s |
| `searchSpaces(query)` | `spaces(where: {name_contains: $q})` | 60s |
| `getTopSpacesByFollowers(limit?)` | `spaces(orderBy: "followers")` | 300s |
| `getTopSpacesByProposals(limit?)` | `spaces(orderBy: "proposals_count")` | 300s |

**Proposals:**

| Function | Query | Cache TTL |
|----------|-------|-----------|
| `getProposals(space?, state?, first?, skip?)` | `proposals` query | 60s |
| `getProposal(id)` | `proposal(id: $id)` | 60s |
| `getActiveProposals(space?)` | `proposals(where: {state: "active"})` | 60s |
| `getRecentProposals(first?)` | `proposals(orderBy: "created")` | 60s |
| `getProposalsByAuthor(author)` | `proposals(where: {author: $author})` | 120s |

**Votes:**

| Function | Query | Cache TTL |
|----------|-------|-----------|
| `getVotes(proposal, first?, skip?, orderBy?)` | `votes` query | 60s |
| `getVotesByVoter(voter, first?)` | `votes(where: {voter: $voter})` | 120s |
| `getTopVotersByVP(proposal)` | Sort votes by vp | 60s |
| `getVoterProfile(address)` | Aggregate votes for address | 300s |

**Analytics:**

```typescript
export function analyzeProposalOutcome(proposal: SnapshotProposal): {
  winner: string;
  winnerIndex: number;
  margin: number;
  participation: number;
  quorumReached: boolean;
}
export function calculateVoterParticipation(space: SnapshotSpace, proposals: SnapshotProposal[]): number
export function identifyWhaleVoters(votes: SnapshotVote[], threshold: number): { voter: string; totalVP: number; voteCount: number }[]
export function analyzeGovernanceHealth(space: SnapshotSpace, proposals: SnapshotProposal[], votes: SnapshotVote[]): {
  healthScore: number;
  participation: number;
  proposalFrequency: number;
  voterDiversity: number;
  whaleConcentration: number;
  avgQuorumAchievement: number;
}
export function detectGovernanceAttacks(votes: SnapshotVote[], proposals: SnapshotProposal[]): {
  riskLevel: 'low' | 'medium' | 'high';
  signals: string[];
}
```

### Acceptance Criteria

- [ ] File compiles with zero errors
- [ ] GraphQL queries properly structured and typed
- [ ] All space, proposal, and vote functions work
- [ ] Analytics correctly calculate outcomes and health
- [ ] `src/routes/governance.ts` imports work
- [ ] All tests pass, committed and pushed as `nirholas`, terminals killed

### Hallucination Warning

Snapshot uses GraphQL — do NOT use REST endpoints. The `choice` field in votes can be a number (single-choice) OR an object (weighted voting). Voting power (`vp`) is calculated server-side by strategies. Proposals have specific types that affect how choices work. If unsure about query structure, tell the prompter.
