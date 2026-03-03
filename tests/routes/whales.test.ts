/**
 * Integration tests for /api/whales/* routes
 *
 * All whale/Blockchair/Etherscan source calls are mocked — no live API traffic.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

// ─── Mock the source module BEFORE importing the routes ──────

vi.mock("@/sources/whales.js", () => ({
    getRecentWhaleTransactions: vi.fn(),
    getWhaleTransactionsForToken: vi.fn(),
    classifyWhaleActivity: vi.fn(),
    getWhaleAlerts: vi.fn(),
    getSmartMoneyTrades: vi.fn(),
    analyzeSmartMoney: vi.fn(),
    getExchangeFlows: vi.fn(),
    getTokenExchangeFlows: vi.fn(),
    getTopWalletsByChain: vi.fn(),
    getWalletProfile: vi.fn(),
    trackWallet: vi.fn(),
    getAccumulationSignal: vi.fn(),
    getDormantWallets: vi.fn(),
    getLatestBTCTransactions: vi.fn(),
    getBTCMempool: vi.fn(),
    getChainStats: vi.fn(),
    getAddressInfo: vi.fn(),
    getETHRichList: vi.fn(),
    getTokenTopHolders: vi.fn(),
    getRecentLargeETHTransfers: vi.fn(),
    getBTCChart: vi.fn(),
    getWhaleOverview: vi.fn(),
}));

import { whaleRoutes } from "@/routes/whales.js";
import type {
    AccumulationSignal,
    DormantWallet,
    ExchangeFlowData,
    SmartMoneyAnalysis,
    SmartMoneyTrade,
    WalletProfile,
    WhaleAlert,
    WhaleClassification,
    WhaleTransaction,
} from "@/sources/whales.js";
import * as whales from "@/sources/whales.js";
import { Hono } from "hono";

const app = new Hono();
app.route("/", whaleRoutes);

// ─── Fixtures ────────────────────────────────────────────────

const MOCK_TX: WhaleTransaction = {
    hash: "0xabc123",
    blockchain: "ethereum",
    from: "0x1111111111111111111111111111111111111111",
    to: "0x2222222222222222222222222222222222222222",
    amount: 500,
    amountUsd: 1_500_000,
    symbol: "ETH",
    timestamp: "2026-03-01T10:00:00.000Z",
    transactionType: "exchange_withdrawal",
    blockHeight: 19500000,
    fromLabel: "Binance",
    toLabel: undefined,
};

const MOCK_BTC_TX: WhaleTransaction = {
    hash: "btchash456",
    blockchain: "bitcoin",
    from: "unknown",
    to: "unknown",
    amount: 25,
    amountUsd: 2_000_000,
    symbol: "BTC",
    timestamp: "2026-03-01T09:00:00.000Z",
    transactionType: "whale_transfer",
    blockHeight: 880000,
};

const MOCK_CLASSIFICATION: WhaleClassification = {
    overallSignal: "bullish",
    signalStrength: 72,
    exchangeDeposits: 3,
    exchangeWithdrawals: 8,
    whaleTransfers: 5,
    netExchangeFlow: -5_000_000,
};

const MOCK_ALERT: WhaleAlert = {
    id: "alert-1",
    type: "exchange_withdrawal",
    severity: "high",
    title: "$1.5M ETH exchange withdrawal",
    description: "$1.5M in ETH exchange withdrawal on ethereum from Binance",
    blockchain: "ethereum",
    amountUsd: 1_500_000,
    timestamp: "2026-03-01T10:00:00.000Z",
    hash: "0xabc123",
    addresses: { from: "0x1111", to: "0x2222" },
};

const MOCK_SMART_MONEY_TRADE: SmartMoneyTrade = {
    wallet: "0xBE0eB53F46cd790Cd13851d5EFf43D12404d33E8",
    walletLabel: "Binance",
    token: "ETH",
    action: "buy",
    amount: 100,
    amountUsd: 300_000,
    timestamp: "2026-03-01T08:00:00.000Z",
    hash: "0xdef456",
};

const MOCK_SMART_MONEY_ANALYSIS: SmartMoneyAnalysis = {
    consensusBuys: [{ token: "ETH", count: 5, totalUsd: 10_000_000 }],
    consensusSells: [{ token: "BTC", count: 3, totalUsd: 5_000_000 }],
    newPositions: [{ token: "SOL", wallet: "0xaaa", amountUsd: 500_000 }],
    exitingPositions: [{ token: "DOGE", wallet: "0xbbb", amountUsd: 200_000 }],
    topPerformingWallets: [{ wallet: "0xccc", label: "Smart Fund A", trades: 15, estimatedPnl: 2_000_000 }],
    defiTrends: [{ protocol: "ETH", action: "accumulation", count: 5 }],
};

const MOCK_EXCHANGE_FLOW: ExchangeFlowData = {
    exchange: "Binance",
    address: "0xBE0eB53F46cd790Cd13851d5EFf43D12404d33E8",
    chain: "ethereum",
    balance: 500_000,
    deposits24h: 2_000_000,
    withdrawals24h: 3_500_000,
    netFlow: -1_500_000,
    depositCount: 15,
    withdrawalCount: 22,
};

const MOCK_ACCUMULATION: AccumulationSignal = {
    symbol: "ETH",
    signal: "accumulation",
    strength: 65,
    exchangeNetFlow: -5_000_000,
    whaleBalanceChange: 10_000_000,
    period: "24h",
    interpretation: "Whales are withdrawing from exchanges — net outflow of $5,000,000. This suggests accumulation.",
};

const MOCK_DORMANT: DormantWallet = {
    address: "0x00000000219ab540356cBB839Cbe05303d7705Fa",
    chain: "ethereum",
    lastActiveDate: "2025-01-01T00:00:00.000Z",
    dormantDays: 365,
    reactivatedAt: "2026-01-01T00:00:00.000Z",
    balanceUsd: 50_000_000,
    transactionHash: "0xdormant789",
};

const MOCK_WALLET_PROFILE: WalletProfile = {
    address: "0xBE0eB53F46cd790Cd13851d5EFf43D12404d33E8",
    chain: "ethereum",
    balance: 500_000,
    balanceUsd: 1_500_000_000,
    totalReceived: 2_000_000,
    totalSent: 1_500_000,
    transactionCount: 50,
    firstSeen: "2019-01-15T00:00:00.000Z",
    lastSeen: "2026-03-01T10:00:00.000Z",
    label: "Binance",
    isExchange: true,
    isTracked: false,
};

// ─── Helpers ─────────────────────────────────────────────────

function req(path: string) {
    return app.request(path, { method: "GET" });
}

async function json(res: Response): Promise<Record<string, unknown>> {
    return res.json() as Promise<Record<string, unknown>>;
}

// ─── Reset ───────────────────────────────────────────────────

beforeEach(() => {
    vi.resetAllMocks();
});

// ─── Whale Transaction Feed ──────────────────────────────────

describe("GET /transactions", () => {
    it("returns whale transactions with classification", async () => {
        vi.mocked(whales.getRecentWhaleTransactions).mockResolvedValue([MOCK_TX, MOCK_BTC_TX]);
        vi.mocked(whales.classifyWhaleActivity).mockReturnValue(MOCK_CLASSIFICATION);

        const res = await req("/transactions");
        expect(res.status).toBe(200);

        const body = await json(res);
        const data = body.data as Record<string, unknown>;
        expect(data.transactions).toHaveLength(2);
        expect(data.classification).toBeDefined();
        expect((data.classification as Record<string, unknown>).overallSignal).toBe("bullish");
        expect(body.timestamp).toBeDefined();
    });

    it("filters by chain parameter", async () => {
        vi.mocked(whales.getRecentWhaleTransactions).mockResolvedValue([MOCK_TX, MOCK_BTC_TX]);
        vi.mocked(whales.classifyWhaleActivity).mockReturnValue(MOCK_CLASSIFICATION);

        const res = await req("/transactions?chain=ethereum");
        expect(res.status).toBe(200);

        const body = await json(res);
        const data = body.data as Record<string, unknown>;
        const txs = data.transactions as WhaleTransaction[];
        expect(txs.every((tx) => tx.blockchain === "ethereum")).toBe(true);
    });

    it("filters by transaction type", async () => {
        vi.mocked(whales.getRecentWhaleTransactions).mockResolvedValue([MOCK_TX, MOCK_BTC_TX]);
        vi.mocked(whales.classifyWhaleActivity).mockReturnValue(MOCK_CLASSIFICATION);

        const res = await req("/transactions?type=exchange_withdrawal");
        expect(res.status).toBe(200);

        const body = await json(res);
        const data = body.data as Record<string, unknown>;
        const txs = data.transactions as WhaleTransaction[];
        expect(txs.every((tx) => tx.transactionType === "exchange_withdrawal")).toBe(true);
    });

    it("respects min_usd parameter", async () => {
        vi.mocked(whales.getRecentWhaleTransactions).mockResolvedValue([MOCK_TX]);
        vi.mocked(whales.classifyWhaleActivity).mockReturnValue(MOCK_CLASSIFICATION);

        const res = await req("/transactions?min_usd=500000");
        expect(res.status).toBe(200);
        expect(whales.getRecentWhaleTransactions).toHaveBeenCalledWith({ minUsd: 500000 });
    });

    it("caps limit at 100", async () => {
        vi.mocked(whales.getRecentWhaleTransactions).mockResolvedValue(Array(150).fill(MOCK_TX));
        vi.mocked(whales.classifyWhaleActivity).mockReturnValue(MOCK_CLASSIFICATION);

        const res = await req("/transactions?limit=200");
        expect(res.status).toBe(200);

        const body = await json(res);
        const data = body.data as Record<string, unknown>;
        expect((data.transactions as unknown[]).length).toBeLessThanOrEqual(100);
    });
});

describe("GET /transactions/:symbol", () => {
    it("returns whale transactions for a given token", async () => {
        vi.mocked(whales.getWhaleTransactionsForToken).mockResolvedValue([MOCK_TX]);
        vi.mocked(whales.classifyWhaleActivity).mockReturnValue(MOCK_CLASSIFICATION);

        const res = await req("/transactions/ETH");
        expect(res.status).toBe(200);

        const body = await json(res);
        const data = body.data as Record<string, unknown>;
        expect(data.symbol).toBe("ETH");
        expect((data.transactions as unknown[]).length).toBe(1);
        expect(data.classification).toBeDefined();
    });

    it("normalizes symbol to uppercase", async () => {
        vi.mocked(whales.getWhaleTransactionsForToken).mockResolvedValue([]);
        vi.mocked(whales.classifyWhaleActivity).mockReturnValue({ ...MOCK_CLASSIFICATION, overallSignal: "neutral" });

        const res = await req("/transactions/eth");
        expect(res.status).toBe(200);
        expect(whales.getWhaleTransactionsForToken).toHaveBeenCalledWith("ETH", 100000);
    });
});

// ─── Whale Alerts ────────────────────────────────────────────

describe("GET /alerts", () => {
    it("returns whale alerts", async () => {
        vi.mocked(whales.getWhaleAlerts).mockResolvedValue([MOCK_ALERT]);

        const res = await req("/alerts");
        expect(res.status).toBe(200);

        const body = await json(res);
        const data = body.data as Record<string, unknown>;
        expect((data.alerts as unknown[]).length).toBe(1);
        expect(data.total).toBe(1);
    });

    it("filters alerts by severity", async () => {
        const lowAlert: WhaleAlert = { ...MOCK_ALERT, id: "alert-2", severity: "low" };
        vi.mocked(whales.getWhaleAlerts).mockResolvedValue([MOCK_ALERT, lowAlert]);

        const res = await req("/alerts?severity=high");
        expect(res.status).toBe(200);

        const body = await json(res);
        const data = body.data as Record<string, unknown>;
        const alerts = data.alerts as WhaleAlert[];
        expect(alerts.every((a) => a.severity === "high")).toBe(true);
    });

    it("filters alerts by type", async () => {
        vi.mocked(whales.getWhaleAlerts).mockResolvedValue([MOCK_ALERT]);

        const res = await req("/alerts?type=exchange_withdrawal");
        expect(res.status).toBe(200);

        const body = await json(res);
        const data = body.data as Record<string, unknown>;
        const alerts = data.alerts as WhaleAlert[];
        expect(alerts.every((a) => a.type === "exchange_withdrawal")).toBe(true);
    });
});

// ─── Smart Money ─────────────────────────────────────────────

describe("GET /smart-money", () => {
    it("returns smart money analysis", async () => {
        vi.mocked(whales.getSmartMoneyTrades).mockResolvedValue([MOCK_SMART_MONEY_TRADE]);
        vi.mocked(whales.analyzeSmartMoney).mockReturnValue(MOCK_SMART_MONEY_ANALYSIS);

        const res = await req("/smart-money");
        expect(res.status).toBe(200);

        const body = await json(res);
        const data = body.data as Record<string, unknown>;
        expect(data.consensusBuys).toHaveLength(1);
        expect(data.consensusSells).toHaveLength(1);
        expect(data.newPositions).toHaveLength(1);
        expect(data.exitingPositions).toHaveLength(1);
        expect(data.topPerformingWallets).toHaveLength(1);
        expect(data.defiTrends).toHaveLength(1);
    });

    it("passes limit through to getSmartMoneyTrades", async () => {
        vi.mocked(whales.getSmartMoneyTrades).mockResolvedValue([]);
        vi.mocked(whales.analyzeSmartMoney).mockReturnValue({
            consensusBuys: [],
            consensusSells: [],
            newPositions: [],
            exitingPositions: [],
            topPerformingWallets: [],
            defiTrends: [],
        });

        await req("/smart-money?limit=10");
        expect(whales.getSmartMoneyTrades).toHaveBeenCalledWith(undefined, 200);
    });
});

describe("GET /smart-money/:token", () => {
    it("returns smart money trades for a specific token", async () => {
        vi.mocked(whales.getSmartMoneyTrades).mockResolvedValue([MOCK_SMART_MONEY_TRADE]);

        const res = await req("/smart-money/ETH");
        expect(res.status).toBe(200);

        const body = await json(res);
        const data = body.data as Record<string, unknown>;
        expect(data.token).toBe("ETH");
        expect(data.buyCount).toBe(1);
        expect(data.sellCount).toBe(0);
        expect(data.totalVolumeUsd).toBe(300_000);
    });
});

// ─── Exchange Flows ──────────────────────────────────────────

describe("GET /exchange-flows", () => {
    it("returns exchange flows with summary", async () => {
        vi.mocked(whales.getExchangeFlows).mockResolvedValue([MOCK_EXCHANGE_FLOW]);

        const res = await req("/exchange-flows");
        expect(res.status).toBe(200);

        const body = await json(res);
        const data = body.data as Record<string, unknown>;
        expect(data.flows).toHaveLength(1);
        const summary = data.summary as Record<string, unknown>;
        expect(summary.totalDeposits24h).toBe(2_000_000);
        expect(summary.totalWithdrawals24h).toBe(3_500_000);
        expect(summary.signal).toBe("bullish"); // withdrawals > deposits
        expect(summary.exchangeCount).toBe(1);
    });

    it("signals bearish when deposits exceed withdrawals", async () => {
        const bearishFlow: ExchangeFlowData = {
            ...MOCK_EXCHANGE_FLOW,
            deposits24h: 5_000_000,
            withdrawals24h: 1_000_000,
        };
        vi.mocked(whales.getExchangeFlows).mockResolvedValue([bearishFlow]);

        const res = await req("/exchange-flows");
        expect(res.status).toBe(200);

        const body = await json(res);
        const data = body.data as Record<string, unknown>;
        const summary = data.summary as Record<string, unknown>;
        expect(summary.signal).toBe("bearish");
    });
});

describe("GET /exchange-flows/:symbol", () => {
    it("returns exchange flows for a specific token", async () => {
        vi.mocked(whales.getTokenExchangeFlows).mockResolvedValue([MOCK_EXCHANGE_FLOW]);

        const res = await req("/exchange-flows/ETH");
        expect(res.status).toBe(200);

        const body = await json(res);
        const data = body.data as Record<string, unknown>;
        expect(data.symbol).toBe("ETH");
        expect(data.flows).toHaveLength(1);
    });
});

// ─── Wallets ─────────────────────────────────────────────────

describe("GET /wallets/top/:chain", () => {
    it("returns top wallets for a chain", async () => {
        const topWallet = { address: "0xBE0eB53F46cd790Cd13851d5EFf43D12404d33E8", balance: 500_000, label: "Binance", rank: 1 };
        vi.mocked(whales.getTopWalletsByChain).mockResolvedValue([topWallet]);

        const res = await req("/wallets/top/ethereum");
        expect(res.status).toBe(200);

        const body = await json(res);
        const data = body.data as Record<string, unknown>;
        expect(data.chain).toBe("ethereum");
        expect(data.wallets).toHaveLength(1);
        expect(data.count).toBe(1);
    });
});

describe("GET /wallets/:address", () => {
    it("returns wallet profile", async () => {
        vi.mocked(whales.getWalletProfile).mockResolvedValue(MOCK_WALLET_PROFILE);

        const res = await req("/wallets/0xBE0eB53F46cd790Cd13851d5EFf43D12404d33E8");
        expect(res.status).toBe(200);

        const body = await json(res);
        const data = body.data as WalletProfile;
        expect(data.address).toBe("0xBE0eB53F46cd790Cd13851d5EFf43D12404d33E8");
        expect(data.chain).toBe("ethereum");
        expect(data.isExchange).toBe(true);
        expect(data.label).toBe("Binance");
    });
});

describe("GET /wallets/:address/track", () => {
    it("tracks a wallet", async () => {
        vi.mocked(whales.trackWallet).mockReturnValue({
            tracked: true,
            address: "0xbe0eb53f46cd790cd13851d5eff43d12404d33e8",
            watchlistSize: 1,
        });

        const res = await req("/wallets/0xBE0eB53F46cd790Cd13851d5EFf43D12404d33E8/track");
        expect(res.status).toBe(200);

        const body = await json(res);
        const data = body.data as Record<string, unknown>;
        expect(data.tracked).toBe(true);
        expect(data.watchlistSize).toBe(1);
    });
});

// ─── Accumulation / Distribution ─────────────────────────────

describe("GET /accumulation/:symbol", () => {
    it("returns accumulation signal for a token", async () => {
        vi.mocked(whales.getAccumulationSignal).mockResolvedValue(MOCK_ACCUMULATION);

        const res = await req("/accumulation/ETH");
        expect(res.status).toBe(200);

        const body = await json(res);
        const data = body.data as AccumulationSignal;
        expect(data.symbol).toBe("ETH");
        expect(data.signal).toBe("accumulation");
        expect(data.strength).toBe(65);
        expect(data.exchangeNetFlow).toBe(-5_000_000);
    });
});

// ─── Dormant Wallets ─────────────────────────────────────────

describe("GET /dormant", () => {
    it("returns dormant wallets", async () => {
        vi.mocked(whales.getDormantWallets).mockResolvedValue([MOCK_DORMANT]);

        const res = await req("/dormant");
        expect(res.status).toBe(200);

        const body = await json(res);
        const data = body.data as Record<string, unknown>;
        expect(data.wallets).toHaveLength(1);
        expect(data.count).toBe(1);

        const wallets = data.wallets as DormantWallet[];
        expect(wallets[0].dormantDays).toBe(365);
        expect(wallets[0].chain).toBe("ethereum");
    });
});

// ─── Legacy BTC Endpoints ────────────────────────────────────

describe("GET /btc/latest", () => {
    it("returns latest BTC transactions", async () => {
        vi.mocked(whales.getLatestBTCTransactions).mockResolvedValue({ data: [] });

        const res = await req("/btc/latest");
        expect(res.status).toBe(200);
        expect(whales.getLatestBTCTransactions).toHaveBeenCalledWith(25);
    });

    it("respects limit parameter", async () => {
        vi.mocked(whales.getLatestBTCTransactions).mockResolvedValue({ data: [] });

        const res = await req("/btc/latest?limit=50");
        expect(res.status).toBe(200);
        expect(whales.getLatestBTCTransactions).toHaveBeenCalledWith(50);
    });
});

describe("GET /btc/mempool", () => {
    it("returns BTC mempool data", async () => {
        vi.mocked(whales.getBTCMempool).mockResolvedValue({ data: {} });

        const res = await req("/btc/mempool");
        expect(res.status).toBe(200);
    });
});

// ─── Legacy Chain Stats ──────────────────────────────────────

describe("GET /stats/:chain", () => {
    it("returns stats for bitcoin", async () => {
        vi.mocked(whales.getChainStats).mockResolvedValue({ data: {}, context: { code: 200, source: "", results: 1, state: 0, cache: { live: false, duration: 0 } } });

        const res = await req("/stats/bitcoin");
        expect(res.status).toBe(200);
        expect(whales.getChainStats).toHaveBeenCalledWith("bitcoin");
    });

    it("returns stats for ethereum", async () => {
        vi.mocked(whales.getChainStats).mockResolvedValue({ data: {}, context: { code: 200, source: "", results: 1, state: 0, cache: { live: false, duration: 0 } } });

        const res = await req("/stats/ethereum");
        expect(res.status).toBe(200);
        expect(whales.getChainStats).toHaveBeenCalledWith("ethereum");
    });

    it("returns stats for arbitrary chain", async () => {
        vi.mocked(whales.getChainStats).mockResolvedValue({ data: {}, context: { code: 200, source: "", results: 1, state: 0, cache: { live: false, duration: 0 } } });

        const res = await req("/stats/dogecoin");
        expect(res.status).toBe(200);
        expect(whales.getChainStats).toHaveBeenCalledWith("dogecoin");
    });
});

// ─── Legacy Address Lookup ───────────────────────────────────

describe("GET /address/:chain/:address", () => {
    it("returns address info", async () => {
        vi.mocked(whales.getAddressInfo).mockResolvedValue({ data: {} });

        const res = await req("/address/bitcoin/bc1qm34lsc65zpw79lxes69zkqmk6ee3ewf0j77s3h");
        expect(res.status).toBe(200);
        expect(whales.getAddressInfo).toHaveBeenCalledWith("bitcoin", "bc1qm34lsc65zpw79lxes69zkqmk6ee3ewf0j77s3h");
    });
});

// ─── Legacy ETH Endpoints ────────────────────────────────────

describe("GET /eth/richlist", () => {
    it("returns ETH rich list", async () => {
        vi.mocked(whales.getETHRichList).mockResolvedValue({ result: [] });

        const res = await req("/eth/richlist");
        expect(res.status).toBe(200);
    });
});

describe("GET /eth/holders/:address", () => {
    it("returns token holders", async () => {
        vi.mocked(whales.getTokenTopHolders).mockResolvedValue({ result: [] });

        const res = await req("/eth/holders/0xdac17f958d2ee523a2206206994597c13d831ec7");
        expect(res.status).toBe(200);
        expect(whales.getTokenTopHolders).toHaveBeenCalledWith("0xdac17f958d2ee523a2206206994597c13d831ec7", 1, 25);
    });
});

describe("GET /eth/transfers/:address", () => {
    it("returns ETH transfers", async () => {
        vi.mocked(whales.getRecentLargeETHTransfers).mockResolvedValue({ result: [] });

        const res = await req("/eth/transfers/0xBE0eB53F46cd790Cd13851d5EFf43D12404d33E8");
        expect(res.status).toBe(200);
        expect(whales.getRecentLargeETHTransfers).toHaveBeenCalledWith("0xBE0eB53F46cd790Cd13851d5EFf43D12404d33E8", 0);
    });
});

// ─── Legacy Charts ───────────────────────────────────────────

describe("GET /charts/:name", () => {
    it("returns BTC chart data", async () => {
        vi.mocked(whales.getBTCChart).mockResolvedValue({
            status: "ok",
            name: "market-price",
            unit: "USD",
            period: "day",
            description: "BTC price",
            values: [{ x: 1709251200, y: 65000 }],
        });

        const res = await req("/charts/market-price");
        expect(res.status).toBe(200);
    });

    it("passes timespan parameter", async () => {
        vi.mocked(whales.getBTCChart).mockResolvedValue({
            status: "ok",
            name: "hash-rate",
            unit: "TH/s",
            period: "day",
            description: "Hash rate",
            values: [],
        });

        await req("/charts/hash-rate?timespan=30days");
        expect(whales.getBTCChart).toHaveBeenCalledWith("hash-rate", "30days", undefined);
    });
});

// ─── Legacy Overview ─────────────────────────────────────────

describe("GET /overview", () => {
    it("returns aggregate whale overview", async () => {
        vi.mocked(whales.getWhaleOverview).mockResolvedValue({
            btcStats: {},
            ethStats: {},
            btcMempool: {},
        });

        const res = await req("/overview");
        expect(res.status).toBe(200);
    });
});
