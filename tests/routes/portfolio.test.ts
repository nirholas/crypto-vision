/**
 * Integration tests for /api/portfolio/* routes
 *
 * All source calls are mocked — no live API traffic.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

// ─── Mock the source modules BEFORE importing the routes ─────

vi.mock("@/sources/coingecko.js", () => ({
    getCoins: vi.fn(),
    getCoinDetail: vi.fn(),
    getPrice: vi.fn(),
    getTrending: vi.fn(),
    getGlobal: vi.fn(),
    searchCoins: vi.fn(),
    getMarketChart: vi.fn(),
    getOHLC: vi.fn(),
    getExchanges: vi.fn(),
    getCategories: vi.fn(),
}));

vi.mock("@/sources/evm.js", () => ({
    getGasOracle: vi.fn(),
    getEthPrice: vi.fn(),
}));

vi.mock("@/sources/portfolio.js", () => ({
    valuePortfolio: vi.fn(),
    correlationMatrix: vi.fn(),
    volatilityMetrics: vi.fn(),
    diversificationScore: vi.fn(),
}));

vi.mock("@/lib/cache.js", () => ({
    cache: {
        wrap: vi.fn((_key: string, _ttl: number, fn: () => Promise<unknown>) => fn()),
    },
}));

import { portfolioRoutes } from "@/routes/portfolio.js";
import * as cg from "@/sources/coingecko.js";
import * as evm from "@/sources/evm.js";
import * as portfolio from "@/sources/portfolio.js";
import { Hono } from "hono";

const app = new Hono();
app.route("/", portfolioRoutes);

// ─── Fixtures ────────────────────────────────────────────────

function makePriceHistory(days: number, startPrice: number, dailyChange = 0.01): {
    prices: [number, number][];
    market_caps: [number, number][];
    total_volumes: [number, number][];
} {
    const now = Date.now();
    const prices: [number, number][] = [];
    const market_caps: [number, number][] = [];
    const total_volumes: [number, number][] = [];
    let price = startPrice;
    for (let i = 0; i < days; i++) {
        const ts = now - (days - i) * 86_400_000;
        price *= 1 + dailyChange * (Math.sin(i * 0.3) + 0.2); // oscillating growth
        prices.push([ts, price]);
        market_caps.push([ts, price * 19_500_000]);
        total_volumes.push([ts, price * 500_000]);
    }
    return { prices, market_caps, total_volumes };
}

const BTC_CHART_90 = makePriceHistory(90, 50000, 0.005);
const ETH_CHART_90 = makePriceHistory(90, 3000, 0.007);
const SOL_CHART_90 = makePriceHistory(90, 100, 0.012);

const MOCK_PRICE_DATA: Record<string, Record<string, unknown>> = {
    bitcoin: { usd: 65000, usd_24h_change: 2.5, usd_market_cap: 1_200_000_000_000 },
    ethereum: { usd: 3500, usd_24h_change: -1.2, usd_market_cap: 400_000_000_000 },
    solana: { usd: 150, usd_24h_change: 5.3, usd_market_cap: 60_000_000_000 },
};

// ─── Helpers ─────────────────────────────────────────────────

function postJSON(path: string, body: unknown) {
    return app.request(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });
}

function req(path: string) {
    return app.request(path, { method: "GET" });
}

// ─── beforeEach ──────────────────────────────────────────────

beforeEach(() => {
    vi.mocked(cg.getPrice).mockReset();
    vi.mocked(cg.getCoins).mockReset();
    vi.mocked(cg.getMarketChart).mockReset();
    vi.mocked(cg.getGlobal).mockReset();
    vi.mocked(evm.getGasOracle).mockReset();
    vi.mocked(evm.getEthPrice).mockReset();
    vi.mocked(portfolio.valuePortfolio).mockReset();
    vi.mocked(portfolio.volatilityMetrics).mockReset();
    vi.mocked(portfolio.diversificationScore).mockReset();
});

// ═══════════════════════════════════════════════════════════════
// POST /calculate — Full PnL Portfolio Calculation
// ═══════════════════════════════════════════════════════════════

describe("POST /calculate", () => {
    it("returns portfolio valuation with PnL and allocations", async () => {
        vi.mocked(cg.getPrice).mockResolvedValue(MOCK_PRICE_DATA);

        const res = await postJSON("/calculate", {
            holdings: [
                { coinId: "bitcoin", amount: 1.5, costBasis: 40000 },
                { coinId: "ethereum", amount: 10, costBasis: 2000 },
                { coinId: "solana", amount: 100, costBasis: 50 },
            ],
        });

        expect(res.status).toBe(200);
        const body = await res.json();
        const data = body.data;

        // 3 positions returned
        expect(data.positions).toHaveLength(3);

        // Total value = 1.5*65000 + 10*3500 + 100*150 = 97500 + 35000 + 15000 = 147500
        expect(data.totalValue).toBeCloseTo(147500, 0);

        // Total costBasis = 1.5*40000 + 10*2000 + 100*50 = 60000 + 20000 + 5000 = 85000
        expect(data.totalCostBasis).toBeCloseTo(85000, 0);

        // Total PnL = 147500 - 85000 = 62500
        expect(data.totalPnl).toBeCloseTo(62500, 0);

        // PnL % = 62500/85000 * 100 ≈ 73.53%
        expect(data.totalPnlPercent).toBeCloseTo(73.53, 0);

        // Each position has allocation summing to 100%
        const totalAllocation = data.positions.reduce(
            (s: number, p: { allocation: number }) => s + p.allocation,
            0,
        );
        expect(totalAllocation).toBeCloseTo(100, 1);

        // Diversification score exists
        expect(typeof data.diversification).toBe("number");
        expect(body).toHaveProperty("timestamp");
    });

    it("works without costBasis (PnL fields are null)", async () => {
        vi.mocked(cg.getPrice).mockResolvedValue({
            bitcoin: { usd: 65000, usd_24h_change: 2.5 },
        });

        const res = await postJSON("/calculate", {
            holdings: [{ coinId: "bitcoin", amount: 2 }],
        });

        expect(res.status).toBe(200);
        const body = await res.json();
        const pos = body.data.positions[0];

        expect(pos.costBasis).toBeNull();
        expect(pos.pnl).toBeNull();
        expect(pos.pnlPercent).toBeNull();
        expect(body.data.totalCostBasis).toBeNull();
        expect(body.data.totalPnl).toBeNull();
    });

    it("returns 400 for empty holdings array", async () => {
        const res = await postJSON("/calculate", { holdings: [] });
        expect(res.status).toBe(400);
    });

    it("returns 400 for invalid coinId format", async () => {
        const res = await postJSON("/calculate", {
            holdings: [{ coinId: "../hacked", amount: 1 }],
        });
        expect(res.status).toBe(400);
    });

    it("returns 400 for negative amount", async () => {
        const res = await postJSON("/calculate", {
            holdings: [{ coinId: "bitcoin", amount: -5 }],
        });
        expect(res.status).toBe(400);
    });

    it("filters out coins not found in price data", async () => {
        vi.mocked(cg.getPrice).mockResolvedValue({
            bitcoin: { usd: 65000, usd_24h_change: 2.5 },
            // ethereum missing
        });

        const res = await postJSON("/calculate", {
            holdings: [
                { coinId: "bitcoin", amount: 1 },
                { coinId: "ethereum", amount: 5 },
            ],
        });

        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.data.positions).toHaveLength(1);
        expect(body.data.positions[0].coinId).toBe("bitcoin");
    });
});

// ═══════════════════════════════════════════════════════════════
// POST /analyze — Deep Portfolio Analysis
// ═══════════════════════════════════════════════════════════════

describe("POST /analyze", () => {
    it("returns deep analysis with volatility and correlation data", async () => {
        vi.mocked(cg.getPrice).mockResolvedValue(MOCK_PRICE_DATA);
        vi.mocked(cg.getMarketChart)
            .mockResolvedValueOnce(BTC_CHART_90)
            .mockResolvedValueOnce(ETH_CHART_90);

        const res = await postJSON("/analyze", {
            holdings: [
                { coinId: "bitcoin", amount: 1, costBasis: 40000 },
                { coinId: "ethereum", amount: 10, costBasis: 2000 },
            ],
        });

        expect(res.status).toBe(200);
        const body = await res.json();
        const { summary, positions, topCorrelations, recommendations } = body.data;

        expect(summary).toHaveProperty("totalValue");
        expect(summary).toHaveProperty("portfolioVolatility");
        expect(summary).toHaveProperty("portfolioMaxDrawdown");
        expect(summary).toHaveProperty("diversificationScore");
        expect(summary).toHaveProperty("herfindahlIndex");
        expect(summary).toHaveProperty("concentrationRisk");
        expect(typeof summary.portfolioVolatility).toBe("number");

        expect(positions).toHaveLength(2);
        expect(positions[0]).toHaveProperty("volatility30d");
        expect(positions[0]).toHaveProperty("maxDrawdown30d");

        expect(Array.isArray(topCorrelations)).toBe(true);
        expect(Array.isArray(recommendations)).toBe(true);
    });

    it("returns 400 for empty holdings", async () => {
        const res = await postJSON("/analyze", { holdings: [] });
        expect(res.status).toBe(400);
    });
});

// ═══════════════════════════════════════════════════════════════
// POST /optimize — Portfolio Optimization Suggestions
// ═══════════════════════════════════════════════════════════════

describe("POST /optimize", () => {
    it("returns optimization suggestions with risk-parity weighting", async () => {
        vi.mocked(cg.getMarketChart)
            .mockResolvedValueOnce(BTC_CHART_90)
            .mockResolvedValueOnce(ETH_CHART_90)
            .mockResolvedValueOnce(SOL_CHART_90);

        const res = await postJSON("/optimize", {
            holdings: [
                { coinId: "bitcoin", allocation: 50 },
                { coinId: "ethereum", allocation: 30 },
                { coinId: "solana", allocation: 20 },
            ],
            riskTolerance: "moderate",
        });

        expect(res.status).toBe(200);
        const body = await res.json();
        const { suggestions, assetMetrics, riskTolerance } = body.data;

        expect(riskTolerance).toBe("moderate");
        expect(suggestions).toHaveLength(3);
        expect(assetMetrics).toHaveLength(3);

        // Suggested allocations should sum to 100%
        const totalSuggested = suggestions.reduce(
            (s: number, item: { suggestedAllocation: number }) => s + item.suggestedAllocation,
            0,
        );
        expect(totalSuggested).toBeCloseTo(100, 0);

        // Each suggestion has required fields
        for (const s of suggestions) {
            expect(s).toHaveProperty("coinId");
            expect(s).toHaveProperty("currentAllocation");
            expect(s).toHaveProperty("suggestedAllocation");
            expect(s).toHaveProperty("reason");
        }

        expect(body.data).toHaveProperty("methodology");
    });

    it("returns 400 with only 1 holding (minimum 2)", async () => {
        const res = await postJSON("/optimize", {
            holdings: [{ coinId: "bitcoin", allocation: 100 }],
        });
        expect(res.status).toBe(400);
    });

    it("accepts different risk tolerances", async () => {
        vi.mocked(cg.getMarketChart)
            .mockResolvedValueOnce(BTC_CHART_90)
            .mockResolvedValueOnce(ETH_CHART_90);

        const res = await postJSON("/optimize", {
            holdings: [
                { coinId: "bitcoin", allocation: 60 },
                { coinId: "ethereum", allocation: 40 },
            ],
            riskTolerance: "conservative",
        });

        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.data.riskTolerance).toBe("conservative");
    });
});

// ═══════════════════════════════════════════════════════════════
// POST /risk — Portfolio Risk Assessment
// ═══════════════════════════════════════════════════════════════

describe("POST /risk", () => {
    it("returns comprehensive risk metrics", async () => {
        vi.mocked(cg.getMarketChart)
            .mockResolvedValueOnce(BTC_CHART_90)
            .mockResolvedValueOnce(ETH_CHART_90);

        const res = await postJSON("/risk", {
            holdings: [
                { coinId: "bitcoin", allocation: 60 },
                { coinId: "ethereum", allocation: 40 },
            ],
        });

        expect(res.status).toBe(200);
        const body = await res.json();
        const data = body.data;

        expect(data).toHaveProperty("volatility");
        expect(data).toHaveProperty("maxDrawdown");
        expect(data).toHaveProperty("valueAtRisk95");
        expect(data).toHaveProperty("sharpeRatio");
        expect(data).toHaveProperty("sortinoRatio");
        expect(data).toHaveProperty("annualizedReturn");
        expect(data).toHaveProperty("concentrationRisk");
        expect(data).toHaveProperty("herfindahlIndex");
        expect(data).toHaveProperty("riskLevel");
        expect(data).toHaveProperty("assetRiskContribution");
        expect(data).toHaveProperty("recommendations");

        expect(typeof data.volatility).toBe("number");
        expect(typeof data.sharpeRatio).toBe("number");
        expect(typeof data.sortinoRatio).toBe("number");
        expect(["low", "medium", "high", "very_high"]).toContain(data.riskLevel);
        expect(["low", "medium", "high"]).toContain(data.concentrationRisk);
        expect(Array.isArray(data.assetRiskContribution)).toBe(true);
        expect(Array.isArray(data.recommendations)).toBe(true);
        expect(data.recommendations.length).toBeGreaterThan(0);
    });

    it("returns 400 for empty holdings", async () => {
        const res = await postJSON("/risk", { holdings: [] });
        expect(res.status).toBe(400);
    });
});

// ═══════════════════════════════════════════════════════════════
// POST /correlation — Asset Correlation Matrix
// ═══════════════════════════════════════════════════════════════

describe("POST /correlation", () => {
    it("builds an N×N correlation matrix", async () => {
        vi.mocked(cg.getMarketChart)
            .mockResolvedValueOnce(BTC_CHART_90)
            .mockResolvedValueOnce(ETH_CHART_90)
            .mockResolvedValueOnce(SOL_CHART_90);

        const res = await postJSON("/correlation", {
            coinIds: ["bitcoin", "ethereum", "solana"],
            days: 90,
        });

        expect(res.status).toBe(200);
        const body = await res.json();
        const { assets, matrix, strongestPairs, days } = body.data;

        expect(days).toBe(90);
        expect(assets).toHaveLength(3);
        expect(assets).toContain("bitcoin");
        expect(assets).toContain("ethereum");
        expect(assets).toContain("solana");

        // Diagonal should be 1
        expect(matrix.bitcoin.bitcoin).toBe(1);
        expect(matrix.ethereum.ethereum).toBe(1);
        expect(matrix.solana.solana).toBe(1);

        // Off-diagonal should be symmetric and between -1 and 1
        expect(matrix.bitcoin.ethereum).toBeCloseTo(matrix.ethereum.bitcoin, 4);
        expect(Math.abs(matrix.bitcoin.ethereum)).toBeLessThanOrEqual(1);

        expect(Array.isArray(strongestPairs)).toBe(true);
    });

    it("returns 400 with only 1 coin (minimum 2)", async () => {
        const res = await postJSON("/correlation", { coinIds: ["bitcoin"] });
        expect(res.status).toBe(400);
    });
});

// ═══════════════════════════════════════════════════════════════
// POST /backtest — Historical Portfolio Backtest
// ═══════════════════════════════════════════════════════════════

describe("POST /backtest", () => {
    it("returns backtested portfolio performance", async () => {
        vi.mocked(cg.getMarketChart)
            .mockResolvedValueOnce(BTC_CHART_90)
            .mockResolvedValueOnce(ETH_CHART_90);

        const res = await postJSON("/backtest", {
            holdings: [
                { coinId: "bitcoin", allocation: 60 },
                { coinId: "ethereum", allocation: 40 },
            ],
            days: 90,
            initialInvestment: 10000,
            rebalanceFrequency: "none",
        });

        expect(res.status).toBe(200);
        const body = await res.json();
        const data = body.data;

        expect(data.initialInvestment).toBe(10000);
        expect(typeof data.finalValue).toBe("number");
        expect(typeof data.totalReturn).toBe("number");
        expect(typeof data.annualizedReturn).toBe("number");
        expect(typeof data.volatility).toBe("number");
        expect(typeof data.maxDrawdown).toBe("number");
        expect(typeof data.sharpeRatio).toBe("number");
        expect(data.rebalanceFrequency).toBe("none");
        expect(data.days).toBe(90);
        expect(data.dataPoints).toBeGreaterThan(1);
        expect(Array.isArray(data.timeline)).toBe(true);
        expect(data.timeline.length).toBeGreaterThan(0);
        expect(data.timeline[0]).toHaveProperty("day");
        expect(data.timeline[0]).toHaveProperty("value");
    });

    it("supports rebalancing", async () => {
        vi.mocked(cg.getMarketChart)
            .mockResolvedValueOnce(BTC_CHART_90)
            .mockResolvedValueOnce(ETH_CHART_90);

        const res = await postJSON("/backtest", {
            holdings: [
                { coinId: "bitcoin", allocation: 50 },
                { coinId: "ethereum", allocation: 50 },
            ],
            days: 90,
            initialInvestment: 50000,
            rebalanceFrequency: "weekly",
        });

        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.data.rebalanceFrequency).toBe("weekly");
        expect(body.data.initialInvestment).toBe(50000);
    });

    it("returns 400 for empty holdings", async () => {
        const res = await postJSON("/backtest", { holdings: [] });
        expect(res.status).toBe(400);
    });
});

// ═══════════════════════════════════════════════════════════════
// GET /wallet/:address — Auto-detect Portfolio from Wallet
// ═══════════════════════════════════════════════════════════════

describe("GET /wallet/:address", () => {
    it("returns wallet info for a valid Ethereum address", async () => {
        vi.mocked(evm.getGasOracle).mockResolvedValue({
            result: { SafeGasPrice: "10", ProposeGasPrice: "15", FastGasPrice: "20", suggestBaseFee: "12", gasUsedRatio: "0.5" },
        } as never);
        vi.mocked(evm.getEthPrice).mockResolvedValue({
            result: { ethusd: "3500", ethusd_timestamp: "1700000000" },
        } as never);

        const res = await req("/wallet/0x1234567890abcdef1234567890abcdef12345678");
        expect(res.status).toBe(200);

        const body = await res.json();
        expect(body.data.address).toBe("0x1234567890abcdef1234567890abcdef12345678");
        expect(body.data.chain).toBe("ethereum");
        expect(typeof body.data.ethPriceUsd).toBe("number");
    });

    it("returns 400 for invalid Ethereum address", async () => {
        const res = await req("/wallet/not-an-address");
        expect(res.status).toBe(400);
    });

    it("returns 400 for short hex address", async () => {
        const res = await req("/wallet/0x1234");
        expect(res.status).toBe(400);
    });
});

// ═══════════════════════════════════════════════════════════════
// POST /value — Portfolio Valuation (original endpoint)
// ═══════════════════════════════════════════════════════════════

describe("POST /value", () => {
    it("delegates to portfolio.valuePortfolio", async () => {
        vi.mocked(portfolio.valuePortfolio).mockResolvedValue({
            totalValue: 100000,
            holdings: [{ coinId: "bitcoin", amount: 1, price: 65000, value: 65000 }],
        } as never);

        const res = await postJSON("/value", {
            holdings: [{ coinId: "bitcoin", amount: 1 }],
        });

        expect(res.status).toBe(200);
        expect(portfolio.valuePortfolio).toHaveBeenCalled();
    });
});

// ═══════════════════════════════════════════════════════════════
// GET /volatility/:id — Single Asset Volatility
// ═══════════════════════════════════════════════════════════════

describe("GET /volatility/:id", () => {
    it("delegates to portfolio.volatilityMetrics", async () => {
        vi.mocked(portfolio.volatilityMetrics).mockResolvedValue({
            coinId: "bitcoin",
            volatility: 55.3,
            maxDrawdown: 12.5,
        } as never);

        const res = await req("/volatility/bitcoin?days=30");
        expect(res.status).toBe(200);
        expect(portfolio.volatilityMetrics).toHaveBeenCalledWith("bitcoin", 30, "usd");
    });
});

// ═══════════════════════════════════════════════════════════════
// POST /diversification — Diversification Score
// ═══════════════════════════════════════════════════════════════

describe("POST /diversification", () => {
    it("delegates to portfolio.diversificationScore", async () => {
        vi.mocked(portfolio.diversificationScore).mockResolvedValue({
            score: 75,
            rating: "good",
        } as never);

        const res = await postJSON("/diversification", {
            holdings: [
                { coinId: "bitcoin", amount: 1 },
                { coinId: "ethereum", amount: 10 },
            ],
        });

        expect(res.status).toBe(200);
        expect(portfolio.diversificationScore).toHaveBeenCalled();
    });
});
