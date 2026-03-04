/**
 * Crypto Vision — Governance Ingestion Worker
 *
 * Fetches governance data from Snapshot: active proposals across
 * major DAO spaces, vote counts, and proposal metadata.
 *
 * Schedule: every 30 minutes
 * Pub/Sub topic: crypto-vision-hourly
 * BigQuery table: governance_proposals
 */

import { Tables } from "../lib/bigquery.js";
import { ingestGovernanceProposals } from "../lib/bq-ingest.js";
import { log } from "../lib/logger.js";
import { Topics } from "../lib/pubsub.js";
import { IngestionWorker, runWorkerCLI, type WorkerConfig } from "./worker-base.js";

class GovernanceIngestionWorker extends IngestionWorker {
    constructor() {
        const config: WorkerConfig = {
            name: "ingest-governance",
            intervalMs: 30 * 60 * 1_000, // 30 minutes
            bqTable: Tables.GOVERNANCE_PROPOSALS,
            pubsubTopic: Topics.HOURLY,
        };
        super(config);
    }

    async fetch(): Promise<Record<string, unknown>[]> {
        const allRows: Record<string, unknown>[] = [];

        const { getActiveProposals, getTopSpaces } = await import("../sources/snapshot.js");

        // Fetch top spaces and active proposals in parallel
        const [activeProposals, topSpaces] = await Promise.allSettled([
            getActiveProposals(),
            getTopSpaces(50),
        ]);

        // 1. Active proposals across major DAOs
        if (activeProposals.status === "fulfilled" && activeProposals.value) {
            const spaceProposals = activeProposals.value as unknown as Record<string, Array<Record<string, unknown>>>;
            const allProposals: Array<Record<string, unknown>> = [];

            for (const [spaceId, proposals] of Object.entries(spaceProposals)) {
                if (!Array.isArray(proposals)) continue;
                for (const p of proposals) {
                    allProposals.push({
                        ...p,
                        _space_id: spaceId,
                    });
                }
            }

            if (allProposals.length) {
                ingestGovernanceProposals(allProposals);

                const rows = allProposals.map((p) => ({
                    type: "governance_proposal",
                    proposal_id: p.id,
                    space_id: p._space_id ?? (typeof p.space === "object" ? (p.space as Record<string, unknown>)?.id : p.space),
                    title: p.title,
                    state: p.state,
                    author: p.author,
                    start_ts: p.start,
                    end_ts: p.end,
                    scores_total: p.scores_total,
                    votes: p.votes,
                    source: "snapshot",
                }));
                allRows.push(...rows);
                log.debug({ count: allProposals.length }, "Fetched active governance proposals");
            }
        } else if (activeProposals.status === "rejected") {
            log.warn({ err: activeProposals.reason?.message }, "Failed to fetch active proposals");
        }

        // 2. Top governance spaces (metadata)
        if (topSpaces.status === "fulfilled" && topSpaces.value?.length) {
            const spaces = topSpaces.value as unknown as Array<Record<string, unknown>>;
            const rows = spaces.map((s) => ({
                type: "governance_space",
                space_id: s.id,
                name: s.name,
                members: s.members ?? s.followersCount,
                network: s.network,
                proposals_count: s.proposalsCount,
                source: "snapshot",
            }));
            allRows.push(...rows);
            log.debug({ count: spaces.length }, "Fetched top governance spaces");
        } else if (topSpaces.status === "rejected") {
            log.warn({ err: topSpaces.reason?.message }, "Failed to fetch top spaces");
        }

        return allRows;
    }
}

// ── CLI Entry Point ──────────────────────────────────────

const worker = new GovernanceIngestionWorker();
runWorkerCLI(worker);

export { GovernanceIngestionWorker };
