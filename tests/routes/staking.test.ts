/**
 * Integration tests for /api/staking/* routes
 *
 * All source calls are mocked — no live API traffic.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mock the source module BEFORE importing the routes ──────

vi.mock("@/sources/staking.js", () => ({
  getStakingOverview: vi.fn(),
  getStakingYields: vi.fn(),
  getStakingYield: vi.fn(),
  getChainValidators: vi.fn(),
  getLiquidStaking: vi.fn(),
  getLiquidStakingByChain: vi.fn(),
  getRestakingProtocols: vi.fn(),
  getStakingHistory: vi.fn(),
  getValidatorQueue: vi.fn(),
  getLatestEpoch: vi.fn(),
  getETHNetworkStats: vi.fn(),
  getValidator: vi.fn(),
  getValidatorAttestations: vi.fn(),
  getRatedOverview: vi.fn(),
  getTopOperators: vi.fn(),
  getNetworkMetrics: vi.fn(),
  getLiquidStakingProtocols: vi.fn(),
}));

import { Hono } from "hono";
import { stakingRoutes } from "@/routes/staking.js";
import * as staking from "@/sources/staking.js";

const app = new Hono();
app.route("/", stakingRoutes);

// ─── Fixtures ────────────────────────────────────────────────

const MOCK_YIELD: import("@/sources/staking.js").StakingYieldInfo = {
  pool: "pool-eth-lido",
  chain: "Ethereum",
  project: "lido",
  symbol: "STETH",
  apy: 3.8,
  apyBase: 3.5,
  apyReward: 0.3,
  tvlUsd: 15_000_000_000,
  rewardTokens: ["LDO"],
};

const MOCK_STAKING_INFO: import("@/sources/staking.js").StakingInfo = {
  apy: 3.8,
  apr: 3.73,
  tvlUsd: 15_000_000_000,
  chain: "Ethereum",
  project: "lido",
  symbol: "STETH",
  unbondingDays: 1,
  minimumStake: 32,
  avgValidatorCommission: 10,
};

const MOCK_LST: import("@/sources/staking.js").LiquidStakingProtocol = {
  name: "Lido",
  slug: "lido",
  symbol: "LDO",
  tvl: 15_000_000_000,
  change1d: 1.2,
  change7d: 3.5,
  chains: ["Ethereum"],
  category: "Liquid Staking",
  url: "https://lido.fi",
  logo: "https://defillama.com/lido.png",
  marketShare: 72.5,
};

const MOCK_RESTAKING: import("@/sources/staking.js").RestakingProtocol = {
  name: "EigenLayer",
  slug: "eigenlayer",
  symbol: "EIGEN",
  tvl: 8_000_000_000,
  change1d: 0.5,
  change7d: 2.1,
  chains: ["Ethereum"],
  category: "Restaking",
  url: "https://eigenlayer.xyz",
  logo: "https://defillama.com/eigenlayer.png",
};

const MOCK_HISTORY: import("@/sources/staking.js").StakingHistoryPoint[] = [
  { date: "2025-01-01T00:00:00.000Z", apy: 4.0, tvlUsd: 14_000_000_000 },
  { date: "2025-02-01T00:00:00.000Z", apy: 3.9, tvlUsd: 14_500_000_000 },
  { date: "2025-03-01T00:00:00.000Z", apy: 3.8, tvlUsd: 15_000_000_000 },
];

// ─── Helpers ─────────────────────────────────────────────────

function req(path: string) {
  return app.request(path, { method: "GET" });
}

beforeEach(() => vi.clearAllMocks());

// ─── Tests ───────────────────────────────────────────────────

describe("GET /overview", () => {
  it("returns comprehensive staking dashboard", async () => {
    vi.mocked(staking.getStakingOverview).mockResolvedValue({
      ethNetwork: null,
      liquidStaking: [MOCK_LST],
      topYields: [MOCK_YIELD],
      restaking: [MOCK_RESTAKING],
      totalLSTTvl: 15_000_000_000,
      totalRestakingTvl: 8_000_000_000,
    });

    const res = await req("/overview");
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.data).toBeDefined();
    expect(body.data.liquidStaking).toHaveLength(1);
    expect(body.data.topYields).toHaveLength(1);
    expect(body.data.restaking).toHaveLength(1);
    expect(body.data.totalLSTTvl).toBe(15_000_000_000);
    expect(body.timestamp).toBeDefined();
  });
});

describe("GET /yields", () => {
  it("returns staking yields", async () => {
    vi.mocked(staking.getStakingYields).mockResolvedValue([MOCK_YIELD]);

    const res = await req("/yields");
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.data).toHaveLength(1);
    expect(body.data[0].project).toBe("lido");
    expect(body.count).toBe(1);
  });

  it("filters by chain", async () => {
    const solanaYield = { ...MOCK_YIELD, chain: "Solana", project: "marinade" };
    vi.mocked(staking.getStakingYields).mockResolvedValue([MOCK_YIELD, solanaYield]);

    const res = await req("/yields?chain=solana");
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.data).toHaveLength(1);
    expect(body.data[0].chain).toBe("Solana");
  });

  it("respects limit parameter", async () => {
    const yields = Array.from({ length: 5 }, (_, i) => ({
      ...MOCK_YIELD,
      pool: `pool-${i}`,
      tvlUsd: 1_000_000 * (5 - i),
    }));
    vi.mocked(staking.getStakingYields).mockResolvedValue(yields);

    const res = await req("/yields?limit=2");
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.data).toHaveLength(2);
    expect(body.count).toBe(2);
  });
});

describe("GET /yield/:token", () => {
  it("returns yield for a specific token", async () => {
    vi.mocked(staking.getStakingYield).mockResolvedValue(MOCK_STAKING_INFO);

    const res = await req("/yield/eth");
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.data.apy).toBe(3.8);
    expect(body.data.apr).toBe(3.73);
    expect(body.data.unbondingDays).toBe(1);
  });

  it("returns 404 for unknown token", async () => {
    vi.mocked(staking.getStakingYield).mockResolvedValue({
      apy: 0,
      apr: 0,
      tvlUsd: 0,
      chain: "unknown",
      project: "unknown",
      symbol: "FAKE",
      unbondingDays: 7,
      minimumStake: 1,
      avgValidatorCommission: 5,
    });

    const res = await req("/yield/faketoken123");
    expect(res.status).toBe(404);
  });
});

describe("GET /validators/:chain", () => {
  it("returns validator data for a chain", async () => {
    vi.mocked(staking.getChainValidators).mockResolvedValue({
      chain: "ethereum",
      operators: [],
      networkMetrics: null,
      fetchedAt: new Date().toISOString(),
    });

    const res = await req("/validators/ethereum");
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.data.chain).toBe("ethereum");
  });
});

describe("GET /calculator", () => {
  it("computes staking rewards correctly", async () => {
    vi.mocked(staking.getStakingYield).mockResolvedValue(MOCK_STAKING_INFO);

    const res = await req("/calculator?token=eth&amount=32&period=365");
    expect(res.status).toBe(200);

    const body = await res.json();
    const calc = body.data;
    expect(calc.token).toBe("eth");
    expect(calc.amountStaked).toBe(32);
    expect(calc.periodDays).toBe(365);
    expect(calc.apy).toBe(3.8);
    expect(calc.simpleRewards).toBeGreaterThan(0);
    expect(calc.compoundedRewards).toBeGreaterThan(0);
    expect(calc.compoundedRewards).toBeGreaterThanOrEqual(calc.simpleRewards);
    expect(calc.dailyReward).toBeGreaterThan(0);
    expect(calc.monthlyReward).toBeGreaterThan(0);
    expect(calc.unstakingPeriod).toBe(1);
    expect(calc.minimumStake).toBe(32);
  });

  it("simple rewards = amount * APY% * period/365", async () => {
    vi.mocked(staking.getStakingYield).mockResolvedValue(MOCK_STAKING_INFO);

    const res = await req("/calculator?token=eth&amount=100&period=365");
    expect(res.status).toBe(200);

    const body = await res.json();
    // Simple rewards for 100 ETH at 3.8% for 1 year = 3.8
    expect(body.data.simpleRewards).toBeCloseTo(3.8, 1);
  });

  it("rejects missing token parameter", async () => {
    const res = await req("/calculator?amount=32");
    expect(res.status).toBe(400);
  });

  it("rejects negative amount", async () => {
    const res = await req("/calculator?token=eth&amount=-10");
    expect(res.status).toBe(400);
  });

  it("returns 404 when token has no yield data", async () => {
    vi.mocked(staking.getStakingYield).mockResolvedValue({
      ...MOCK_STAKING_INFO,
      apy: 0,
    });

    const res = await req("/calculator?token=unknown&amount=100");
    expect(res.status).toBe(404);
  });

  it("defaults period to 365 days", async () => {
    vi.mocked(staking.getStakingYield).mockResolvedValue(MOCK_STAKING_INFO);

    const res = await req("/calculator?token=eth&amount=32");
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.data.periodDays).toBe(365);
  });
});

describe("GET /liquid-staking", () => {
  it("returns liquid staking protocols", async () => {
    vi.mocked(staking.getLiquidStaking).mockResolvedValue([MOCK_LST]);

    const res = await req("/liquid-staking");
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.data).toHaveLength(1);
    expect(body.data[0].name).toBe("Lido");
    expect(body.data[0].marketShare).toBeDefined();
    expect(body.chain).toBe("all");
  });

  it("filters by chain when specified", async () => {
    vi.mocked(staking.getLiquidStakingByChain).mockResolvedValue([MOCK_LST]);

    const res = await req("/liquid-staking?chain=ethereum");
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.chain).toBe("ethereum");
    expect(staking.getLiquidStakingByChain).toHaveBeenCalledWith("ethereum");
  });
});

describe("GET /restaking", () => {
  it("returns restaking protocol metrics", async () => {
    vi.mocked(staking.getRestakingProtocols).mockResolvedValue([MOCK_RESTAKING]);

    const res = await req("/restaking");
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.data).toHaveLength(1);
    expect(body.data[0].name).toBe("EigenLayer");
    expect(body.data[0].marketShare).toBeDefined();
    expect(body.totalTvl).toBe(8_000_000_000);
  });
});

describe("GET /history/:token", () => {
  it("returns historical staking rates", async () => {
    vi.mocked(staking.getStakingHistory).mockResolvedValue(MOCK_HISTORY);

    const res = await req("/history/eth");
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.data).toHaveLength(3);
    expect(body.token).toBe("eth");
    expect(body.count).toBe(3);
    expect(body.data[0].apy).toBe(4.0);
  });

  it("returns empty array for unknown token", async () => {
    vi.mocked(staking.getStakingHistory).mockResolvedValue([]);

    const res = await req("/history/unknown");
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.data).toHaveLength(0);
    expect(body.count).toBe(0);
  });
});

// ─── Legacy Ethereum Endpoints ───────────────────────────────

describe("GET /eth/validators", () => {
  it("returns validator queue data", async () => {
    vi.mocked(staking.getValidatorQueue).mockResolvedValue({ data: { beaconchain_entering: 10 } });

    const res = await req("/eth/validators");
    expect(res.status).toBe(200);
  });
});

describe("GET /eth/epoch", () => {
  it("returns latest epoch", async () => {
    vi.mocked(staking.getLatestEpoch).mockResolvedValue({ data: { epoch: 250000 } });

    const res = await req("/eth/epoch");
    expect(res.status).toBe(200);
  });
});

describe("GET /liquid", () => {
  it("returns filtered liquid staking list", async () => {
    vi.mocked(staking.getLiquidStaking).mockResolvedValue([MOCK_LST]);

    const res = await req("/liquid");
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.count).toBe(1);
    expect(body.data).toHaveLength(1);
  });
});
