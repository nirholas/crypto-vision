/**
 * Integration tests for /api/unlocks/* routes
 *
 * All source calls are mocked — no live API traffic.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

// ─── Mock the source module BEFORE importing the routes ──────

vi.mock("@/sources/unlocks.js", () => ({
    getUpcomingUnlocks: vi.fn(),
    getTokenUnlocks: vi.fn(),
    getUnlockCalendar: vi.fn(),
    getLargeUnlocks: vi.fn(),
    getUnlockImpact: vi.fn(),
    getCliffUnlocks: vi.fn(),
    getVestingSchedule: vi.fn(),
    getEmissionsProtocols: vi.fn(),
    getProtocolEmissions: vi.fn(),
    getProtocolSupply: vi.fn(),
    getTrackedEmissions: vi.fn(),
}));

import { unlocksRoutes } from "@/routes/unlocks.js";
import * as unlocks from "@/sources/unlocks.js";
import { Hono } from "hono";

const app = new Hono();
app.route("/", unlocksRoutes);

// ─── Fixtures ────────────────────────────────────────────────

const MOCK_UNLOCK: import("@/sources/unlocks.js").TokenUnlock = {
    protocol: "Arbitrum",
    token: "ARB",
    amount: 100_000_000,
    amountUSD: 150_000_000,
    unlockDate: "2026-03-16T00:00:00.000Z",
    category: "team",
    percentOfSupply: 2.5,
    cliff: true,
    linear: false,
};

const MOCK_VESTING_EVENT: import("@/sources/unlocks.js").VestingEvent = {
    date: "2026-03-16T00:00:00.000Z",
    timestamp: 1773936000,
    amount: 100_000_000,
    amountUSD: 150_000_000,
    category: "team",
    description: "Team token unlock",
    cliff: true,
    linear: false,
    percentOfSupply: 2.5,
};

const MOCK_IMPACT: import("@/sources/unlocks.js").UnlockImpact = {
    symbol: "ARB",
    nextUnlock: {
        date: "2026-03-16T00:00:00.000Z",
        amount: 100_000_000,
        valueUsd: 150_000_000,
        percentOfCirculating: 2.5,
    },
    impactAssessment: {
        sellingPressure: "high",
        historicalAvgImpact: -5.2,
        riskRating: 5,
        recommendation: "Exercise caution. Significant selling pressure likely around unlock date.",
    },
    upcomingUnlocks: [MOCK_VESTING_EVENT],
    totalLocked: 500_000_000,
    totalLockedUsd: 750_000_000,
    percentVested: 60,
};

const MOCK_VESTING_SCHEDULE: import("@/sources/unlocks.js").VestingSchedule = {
    protocol: "Arbitrum",
    token: "ARB",
    totalSupply: 10_000_000_000,
    circulatingSupply: 6_000_000_000,
    lockedAmount: 4_000_000_000,
    lockedValueUSD: 6_000_000_000,
    percentVested: 60,
    schedule: [MOCK_VESTING_EVENT],
};

// ─── Helpers ─────────────────────────────────────────────────

function req(path: string) {
    return app.request(path, { method: "GET" });
}

beforeEach(() => vi.clearAllMocks());

// ─── Tests ───────────────────────────────────────────────────

describe("GET /upcoming", () => {
    it("returns upcoming unlocks with default 30 days", async () => {
        vi.mocked(unlocks.getUpcomingUnlocks).mockResolvedValue({
            upcoming: [MOCK_UNLOCK],
            totalValueUSD: 150_000_000,
            count: 1,
        });

        const res = await req("/upcoming");
        expect(res.status).toBe(200);

        const body = (await res.json()) as Record<string, any>;
        expect(body.upcoming).toHaveLength(1);
        expect(body.totalValueUSD).toBe(150_000_000);
        expect(body.days).toBe(30);
        expect(body.timestamp).toBeDefined();
    });

    it("accepts custom days parameter", async () => {
        vi.mocked(unlocks.getUpcomingUnlocks).mockResolvedValue({
            upcoming: [],
            totalValueUSD: 0,
            count: 0,
        });

        const res = await req("/upcoming?days=7");
        expect(res.status).toBe(200);

        const body = (await res.json()) as Record<string, any>;
        expect(body.days).toBe(7);
        expect(unlocks.getUpcomingUnlocks).toHaveBeenCalledWith(7);
    });

    it("clamps days to max 365", async () => {
        vi.mocked(unlocks.getUpcomingUnlocks).mockResolvedValue({
            upcoming: [],
            totalValueUSD: 0,
            count: 0,
        });

        const res = await req("/upcoming?days=999");
        expect(res.status).toBe(200);

        const body = (await res.json()) as Record<string, any>;
        expect(body.days).toBe(365);
    });
});

describe("GET /token/:symbol", () => {
    it("returns unlock schedule for a specific token", async () => {
        vi.mocked(unlocks.getTokenUnlocks).mockResolvedValue({
            protocol: "Arbitrum",
            token: "ARB",
            events: [MOCK_VESTING_EVENT],
            totalLocked: 500_000_000,
            totalLockedUSD: 750_000_000,
            percentVested: 60,
        });

        const res = await req("/token/arb");
        expect(res.status).toBe(200);

        const body = (await res.json()) as Record<string, any>;
        expect(body.data.protocol).toBe("Arbitrum");
        expect(body.data.events).toHaveLength(1);
        expect(body.data.totalLocked).toBe(500_000_000);
    });

    it("returns 404 for unknown token", async () => {
        vi.mocked(unlocks.getTokenUnlocks).mockResolvedValue(null);

        const res = await req("/token/unknowntoken");
        expect(res.status).toBe(404);
    });
});

describe("GET /calendar", () => {
    it("returns calendar view grouped by date", async () => {
        vi.mocked(unlocks.getUnlockCalendar).mockResolvedValue({
            calendar: {
                "2026-03-16": [MOCK_UNLOCK],
            },
            totalEvents: 1,
            totalValueUSD: 150_000_000,
        });

        const res = await req("/calendar");
        expect(res.status).toBe(200);

        const body = (await res.json()) as Record<string, any>;
        expect(body.calendar).toBeDefined();
        expect(body.calendar["2026-03-16"]).toHaveLength(1);
        expect(body.totalEvents).toBe(1);
        expect(body.days).toBe(90);
    });

    it("accepts custom days parameter", async () => {
        vi.mocked(unlocks.getUnlockCalendar).mockResolvedValue({
            calendar: {},
            totalEvents: 0,
            totalValueUSD: 0,
        });

        const res = await req("/calendar?days=30");
        expect(res.status).toBe(200);

        const body = (await res.json()) as Record<string, any>;
        expect(body.days).toBe(30);
    });
});

describe("GET /large", () => {
    it("returns large unlocks with default $10M threshold", async () => {
        vi.mocked(unlocks.getLargeUnlocks).mockResolvedValue({
            largeUnlocks: [MOCK_UNLOCK],
            totalValueUSD: 150_000_000,
            count: 1,
        });

        const res = await req("/large");
        expect(res.status).toBe(200);

        const body = (await res.json()) as Record<string, any>;
        expect(body.largeUnlocks).toHaveLength(1);
        expect(body.thresholdUsd).toBe(10_000_000);
        expect(body.count).toBe(1);
    });

    it("accepts custom threshold parameter", async () => {
        vi.mocked(unlocks.getLargeUnlocks).mockResolvedValue({
            largeUnlocks: [],
            totalValueUSD: 0,
            count: 0,
        });

        const res = await req("/large?threshold=50000000");
        expect(res.status).toBe(200);

        const body = (await res.json()) as Record<string, any>;
        expect(body.thresholdUsd).toBe(50_000_000);
        expect(unlocks.getLargeUnlocks).toHaveBeenCalledWith(50_000_000, 90);
    });

    it("enforces minimum threshold of $100K", async () => {
        vi.mocked(unlocks.getLargeUnlocks).mockResolvedValue({
            largeUnlocks: [],
            totalValueUSD: 0,
            count: 0,
        });

        const res = await req("/large?threshold=50");
        expect(res.status).toBe(200);

        const body = (await res.json()) as Record<string, any>;
        expect(body.thresholdUsd).toBe(100_000);
    });
});

describe("GET /impact/:symbol", () => {
    it("returns unlock impact analysis", async () => {
        vi.mocked(unlocks.getUnlockImpact).mockResolvedValue(MOCK_IMPACT);

        const res = await req("/impact/arb");
        expect(res.status).toBe(200);

        const body = (await res.json()) as Record<string, any>;
        expect(body.data.symbol).toBe("ARB");
        expect(body.data.nextUnlock).toBeDefined();
        expect(body.data.nextUnlock.percentOfCirculating).toBe(2.5);
        expect(body.data.impactAssessment.sellingPressure).toBe("high");
        expect(body.data.impactAssessment.riskRating).toBe(5);
        expect(body.data.impactAssessment.recommendation).toContain("caution");
        expect(body.data.upcomingUnlocks).toHaveLength(1);
        expect(body.data.totalLocked).toBe(500_000_000);
        expect(body.data.percentVested).toBe(60);
    });

    it("returns impact with no upcoming unlocks", async () => {
        vi.mocked(unlocks.getUnlockImpact).mockResolvedValue({
            symbol: "BTC",
            nextUnlock: null,
            impactAssessment: {
                sellingPressure: "none",
                historicalAvgImpact: 0,
                riskRating: 1,
                recommendation: "No upcoming unlocks detected.",
            },
            upcomingUnlocks: [],
            totalLocked: 0,
            totalLockedUsd: 0,
            percentVested: 100,
        });

        const res = await req("/impact/btc");
        expect(res.status).toBe(200);

        const body = (await res.json()) as Record<string, any>;
        expect(body.data.nextUnlock).toBeNull();
        expect(body.data.impactAssessment.sellingPressure).toBe("none");
    });
});

describe("GET /cliff", () => {
    it("returns cliff unlocks", async () => {
        vi.mocked(unlocks.getCliffUnlocks).mockResolvedValue({
            cliffUnlocks: [MOCK_UNLOCK],
            totalValueUSD: 150_000_000,
            count: 1,
        });

        const res = await req("/cliff");
        expect(res.status).toBe(200);

        const body = (await res.json()) as Record<string, any>;
        expect(body.cliffUnlocks).toHaveLength(1);
        expect(body.cliffUnlocks[0].cliff).toBe(true);
        expect(body.days).toBe(90);
    });
});

describe("GET /vesting/:symbol", () => {
    it("returns full vesting schedule", async () => {
        vi.mocked(unlocks.getVestingSchedule).mockResolvedValue(MOCK_VESTING_SCHEDULE);

        const res = await req("/vesting/arb");
        expect(res.status).toBe(200);

        const body = (await res.json()) as Record<string, any>;
        expect(body.data.protocol).toBe("Arbitrum");
        expect(body.data.totalSupply).toBe(10_000_000_000);
        expect(body.data.circulatingSupply).toBe(6_000_000_000);
        expect(body.data.lockedAmount).toBe(4_000_000_000);
        expect(body.data.percentVested).toBe(60);
        expect(body.data.schedule).toHaveLength(1);
    });

    it("returns 404 for unknown symbol", async () => {
        vi.mocked(unlocks.getVestingSchedule).mockResolvedValue(null);

        const res = await req("/vesting/unknowntoken");
        expect(res.status).toBe(404);
    });
});

// ─── Legacy Protocol Endpoints ───────────────────────────────

describe("GET /protocols", () => {
    it("returns protocols with emission data", async () => {
        vi.mocked(unlocks.getEmissionsProtocols).mockResolvedValue([
            { name: "Arbitrum", slug: "arbitrum", symbol: "ARB" },
            { name: "Optimism", slug: "optimism", symbol: "OP" },
        ]);

        const res = await req("/protocols");
        expect(res.status).toBe(200);

        const body = (await res.json()) as Record<string, any>;
        expect(body.count).toBe(2);
        expect(body.data).toHaveLength(2);
    });
});

describe("GET /protocol/:name", () => {
    it("returns emission schedule for a protocol", async () => {
        vi.mocked(unlocks.getProtocolEmissions).mockResolvedValue({
            name: "Arbitrum",
            events: [],
        });

        const res = await req("/protocol/arbitrum");
        expect(res.status).toBe(200);
    });
});

describe("GET /tracked", () => {
    it("returns tracked protocol emissions", async () => {
        vi.mocked(unlocks.getTrackedEmissions).mockResolvedValue([
            { protocol: "arbitrum", data: { events: [] } },
        ]);

        const res = await req("/tracked");
        expect(res.status).toBe(200);

        const body = (await res.json()) as Record<string, any>;
        expect(body.count).toBe(1);
        expect(body.timestamp).toBeDefined();
    });
});
