/**
 * Integration tests for Gas Tracker routes.
 *
 * Mocks the EVM source adapter so no real HTTP calls are made.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";

// ─── Mock sources BEFORE importing routes ────────────────────

vi.mock("../../sources/evm.js", () => ({
  getMultiChainGas: vi.fn(),
  getGasOracle: vi.fn(),
  getEthGasOracle: vi.fn(),
  getEthSupply: vi.fn(),
  getEthPrice: vi.fn(),
  getERC20TopHolders: vi.fn(),
}));

import * as evm from "../../sources/evm.js";
import { gasRoutes } from "../gas.js";

const app = new Hono().route("/api/gas", gasRoutes);

beforeEach(() => {
  vi.clearAllMocks();
});

// ═══════════════════════════════════════════════════════════════
// GET /api/gas
// ═══════════════════════════════════════════════════════════════

describe("GET /api/gas", () => {
  it("returns multi-chain gas estimates", async () => {
    vi.mocked(evm.getMultiChainGas).mockResolvedValue([
      { chain: "ethereum", speeds: [{ acceptance: "fast", gasPrice: 30, estimatedFee: 0.003 }] },
      { chain: "polygon", speeds: [{ acceptance: "fast", gasPrice: 100, estimatedFee: 0.001 }] },
    ] as any);

    const res = await app.request("/api/gas");
    expect(res.status).toBe(200);

    const json = (await res.json()) as Record<string, any>;
    expect(json.data).toHaveLength(2);
    expect(json.chains).toEqual(["ethereum", "polygon"]);
    expect(json).toHaveProperty("timestamp");
  });

  it("propagates source errors as 500", async () => {
    vi.mocked(evm.getMultiChainGas).mockRejectedValue(new Error("API down"));

    const res = await app.request("/api/gas");
    expect(res.status).toBe(500);
  });
});

// ═══════════════════════════════════════════════════════════════
// GET /api/gas/:chain
// ═══════════════════════════════════════════════════════════════

describe("GET /api/gas/:chain", () => {
  it("returns gas oracle for a specific chain", async () => {
    vi.mocked(evm.getGasOracle).mockResolvedValue({
      speeds: [
        { acceptance: "slow", gasPrice: 10, estimatedFee: 0.001 },
        { acceptance: "standard", gasPrice: 20, estimatedFee: 0.002 },
        { acceptance: "fast", gasPrice: 30, estimatedFee: 0.003 },
      ],
    } as any);

    const res = await app.request("/api/gas/polygon");
    expect(res.status).toBe(200);

    const json = (await res.json()) as Record<string, any>;
    expect(json.data.chain).toBe("polygon");
    expect(json.data.speeds).toHaveLength(3);
    expect(json.data.unit).toBe("gwei");
    expect(evm.getGasOracle).toHaveBeenCalledWith("polygon");
  });

  it("returns etherscan oracle when source=etherscan for ethereum", async () => {
    vi.mocked(evm.getEthGasOracle).mockResolvedValue({
      result: {
        LastBlock: "19000000",
        SafeGasPrice: "15",
        ProposeGasPrice: "20",
        FastGasPrice: "30",
        suggestBaseFee: "14.5",
      },
    } as any);

    const res = await app.request("/api/gas/ethereum?source=etherscan");
    expect(res.status).toBe(200);

    const json = (await res.json()) as Record<string, any>;
    expect(json.data.chain).toBe("ethereum");
    expect(json.data.source).toBe("etherscan");
    expect(json.data.safeGasPrice).toBe(15);
    expect(json.data.proposeGasPrice).toBe(20);
    expect(json.data.fastGasPrice).toBe(30);
    expect(json.data.suggestBaseFee).toBe(14.5);
    expect(json.data.unit).toBe("gwei");
  });

  it("falls through to owlracle when etherscan fails", async () => {
    vi.mocked(evm.getEthGasOracle).mockRejectedValue(new Error("etherscan down"));
    vi.mocked(evm.getGasOracle).mockResolvedValue({
      speeds: [{ acceptance: "fast", gasPrice: 25, estimatedFee: 0.0025 }],
    } as any);

    const res = await app.request("/api/gas/ethereum?source=etherscan");
    expect(res.status).toBe(200);

    const json = (await res.json()) as Record<string, any>;
    expect(json.data.chain).toBe("ethereum");
    expect(json.data.speeds).toHaveLength(1);
    expect(evm.getGasOracle).toHaveBeenCalledWith("ethereum");
  });

  it("propagates source errors as 500", async () => {
    vi.mocked(evm.getGasOracle).mockRejectedValue(new Error("fail"));

    const res = await app.request("/api/gas/arbitrum");
    expect(res.status).toBe(500);
  });
});

// ═══════════════════════════════════════════════════════════════
// GET /api/gas/eth/supply
// ═══════════════════════════════════════════════════════════════

describe("GET /api/gas/eth/supply", () => {
  it("returns ETH supply data", async () => {
    vi.mocked(evm.getEthSupply).mockResolvedValue({
      result: "120000000000000000000000000",
    } as any);

    const res = await app.request("/api/gas/eth/supply");
    expect(res.status).toBe(200);

    const json = (await res.json()) as Record<string, any>;
    expect(json.data.supplyWei).toBe("120000000000000000000000000");
    expect(json.data.supplyEth).toBe(120000000);
    expect(json.source).toBe("etherscan");
  });

  it("propagates source errors as 500", async () => {
    vi.mocked(evm.getEthSupply).mockRejectedValue(new Error("etherscan down"));

    const res = await app.request("/api/gas/eth/supply");
    expect(res.status).toBe(500);
  });
});

// ═══════════════════════════════════════════════════════════════
// GET /api/gas/eth/price
// ═══════════════════════════════════════════════════════════════

describe("GET /api/gas/eth/price", () => {
  it("returns ETH price in USD and BTC", async () => {
    vi.mocked(evm.getEthPrice).mockResolvedValue({
      result: {
        ethusd: "3500.50",
        ethbtc: "0.058",
        ethusd_timestamp: "1709500800",
        ethbtc_timestamp: "1709500800",
      },
    } as any);

    const res = await app.request("/api/gas/eth/price");
    expect(res.status).toBe(200);

    const json = (await res.json()) as Record<string, any>;
    expect(json.data.ethUsd).toBe(3500.5);
    expect(json.data.ethBtc).toBe(0.058);
    expect(json.data.ethUsdTimestamp).toBeTruthy();
    expect(json.data.ethBtcTimestamp).toBeTruthy();
    expect(json.source).toBe("etherscan");
  });

  it("handles null timestamps", async () => {
    vi.mocked(evm.getEthPrice).mockResolvedValue({
      result: {
        ethusd: "3000",
        ethbtc: "0.05",
        ethusd_timestamp: null,
        ethbtc_timestamp: null,
      },
    } as any);

    const res = await app.request("/api/gas/eth/price");
    expect(res.status).toBe(200);

    const json = (await res.json()) as Record<string, any>;
    expect(json.data.ethUsdTimestamp).toBeNull();
    expect(json.data.ethBtcTimestamp).toBeNull();
  });

  it("propagates source errors as 500", async () => {
    vi.mocked(evm.getEthPrice).mockRejectedValue(new Error("error"));

    const res = await app.request("/api/gas/eth/price");
    expect(res.status).toBe(500);
  });
});

// ═══════════════════════════════════════════════════════════════
// GET /api/gas/eth/token/:address/holders
// ═══════════════════════════════════════════════════════════════

describe("GET /api/gas/eth/token/:address/holders", () => {
  it("returns top ERC-20 token holders", async () => {
    vi.mocked(evm.getERC20TopHolders).mockResolvedValue({
      result: [
        { TokenHolderAddress: "0xabc123", TokenHolderQuantity: "1000000", percentage: "10.5" },
        { TokenHolderAddress: "0xdef456", TokenHolderQuantity: "500000", percentage: "5.2" },
      ],
    } as any);

    const res = await app.request("/api/gas/eth/token/0xdac17f958d2ee523a2206206994597c13d831ec7/holders");
    expect(res.status).toBe(200);

    const json = (await res.json()) as Record<string, any>;
    expect(json.data).toHaveLength(2);
    expect(json.data[0].address).toBe("0xabc123");
    expect(json.data[0].quantity).toBe("1000000");
    expect(json.contractAddress).toBe("0xdac17f958d2ee523a2206206994597c13d831ec7");
    expect(json.source).toBe("etherscan");
  });

  it("handles empty results", async () => {
    vi.mocked(evm.getERC20TopHolders).mockResolvedValue({ result: [] } as any);

    const res = await app.request("/api/gas/eth/token/0x0000/holders");
    expect(res.status).toBe(200);

    const json = (await res.json()) as Record<string, any>;
    expect(json.data).toHaveLength(0);
  });

  it("propagates source errors as 500", async () => {
    vi.mocked(evm.getERC20TopHolders).mockRejectedValue(new Error("etherscan down"));

    const res = await app.request("/api/gas/eth/token/0x0000/holders");
    expect(res.status).toBe(500);
  });
});
