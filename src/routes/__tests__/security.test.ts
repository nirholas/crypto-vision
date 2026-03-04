/**
 * Integration tests for Security routes.
 *
 * Mocks the GoPlus source adapter so no real HTTP calls are made.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";

// ─── Mock sources BEFORE importing routes ────────────────────

vi.mock("../../sources/goplus.js", () => ({
  getTokenSecurity: vi.fn(),
  getAddressSecurity: vi.fn(),
  getNFTSecurity: vi.fn(),
  getDappSecurity: vi.fn(),
  getSupportedChains: vi.fn(),
  getApprovalSecurity: vi.fn(),
}));

vi.mock("../../lib/validation.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../lib/validation.js")>();
  return { ...actual };
});

vi.mock("../../lib/api-error.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../lib/api-error.js")>();
  return { ...actual };
});

import * as goplus from "../../sources/goplus.js";
import { securityRoutes } from "../security.js";

const app = new Hono().route("/api/security", securityRoutes);

beforeEach(() => {
  vi.clearAllMocks();
});

// ═══════════════════════════════════════════════════════════════
// GET /api/security/token/:chainId/:address
// ═══════════════════════════════════════════════════════════════

describe("GET /api/security/token/:chainId/:address", () => {
  it("returns token security analysis", async () => {
    vi.mocked(goplus.getTokenSecurity).mockResolvedValue({
      result: {
        "0xabcdef1234567890abcdef1234567890abcdef12": {
          is_open_source: "1",
          is_proxy: "0",
          is_mintable: "0",
          is_honeypot: "0",
          buy_tax: "0.01",
          sell_tax: "0.01",
          holder_count: "50000",
          can_take_back_ownership: "0",
          hidden_owner: "0",
          selfdestruct: "0",
          external_call: "0",
          is_true_token: "1",
          is_airdrop_scam: "0",
          fake_token: "0",
          trust_list: "1",
          honeypot_with_same_creator: "0",
          holders: [
            { address: "0xholder1", percent: "5.5", is_locked: 0 },
          ],
          lp_holders: [
            { address: "0xlp1", percent: "80.0", is_locked: 1 },
          ],
        },
      },
    } as any);

    const res = await app.request(
      "/api/security/token/ethereum/0xabcdef1234567890abcdef1234567890abcdef12",
    );
    expect(res.status).toBe(200);

    const json = (await res.json()) as Record<string, any>;
    expect(json.data.isOpenSource).toBe(true);
    expect(json.data.isHoneypot).toBe(false);
    expect(json.data.riskLevel).toBe("low");
    expect(json.data.topHolders).toHaveLength(1);
    expect(json.data.lpHolders).toHaveLength(1);
    expect(json.chainId).toBe(1);
  });

  it("returns 404 when token not found", async () => {
    vi.mocked(goplus.getTokenSecurity).mockResolvedValue({
      result: {},
    } as any);

    const res = await app.request(
      "/api/security/token/1/0xabcdef1234567890abcdef1234567890abcdef12",
    );
    expect(res.status).toBe(404);
  });

  it("returns 400 for invalid chain ID", async () => {
    const res = await app.request(
      "/api/security/token/invalidchain/0xabcdef1234567890abcdef1234567890abcdef12",
    );
    expect(res.status).toBe(400);
  });

  it("detects critical risk for honeypots", async () => {
    vi.mocked(goplus.getTokenSecurity).mockResolvedValue({
      result: {
        "0xabcdef1234567890abcdef1234567890abcdef12": {
          is_open_source: "0",
          is_proxy: "0",
          is_mintable: "1",
          is_honeypot: "1",
          buy_tax: "0.99",
          sell_tax: "0.99",
          holder_count: "10",
          can_take_back_ownership: "1",
          hidden_owner: "1",
          selfdestruct: "0",
          external_call: "0",
          is_true_token: "0",
          is_airdrop_scam: "1",
          fake_token: "1",
          trust_list: "0",
          honeypot_with_same_creator: "1",
          holders: [],
          lp_holders: [],
        },
      },
    } as any);

    const res = await app.request(
      "/api/security/token/1/0xabcdef1234567890abcdef1234567890abcdef12",
    );
    expect(res.status).toBe(200);

    const json = (await res.json()) as Record<string, any>;
    expect(json.data.isHoneypot).toBe(true);
    expect(json.data.riskLevel).toBe("critical");
  });
});

// ═══════════════════════════════════════════════════════════════
// GET /api/security/address/:chainId/:address
// ═══════════════════════════════════════════════════════════════

describe("GET /api/security/address/:chainId/:address", () => {
  it("returns address risk analysis with no risks", async () => {
    vi.mocked(goplus.getAddressSecurity).mockResolvedValue({
      result: {
        cybercrime: "0",
        money_laundering: "0",
        financial_crime: "0",
        phishing_activities: "0",
        stealing_attack: "0",
        sanctioned: "0",
        honeypot_related_address: "0",
        darkweb_transactions: "0",
        mixer: "0",
      },
    } as any);

    const res = await app.request(
      "/api/security/address/ethereum/0xabcdef1234567890abcdef1234567890abcdef12",
    );
    expect(res.status).toBe(200);

    const json = (await res.json()) as Record<string, any>;
    expect(json.data.risks).toHaveLength(0);
    expect(json.data.riskLevel).toBe("safe");
    expect(json.chainId).toBe(1);
  });

  it("detects high-risk addresses", async () => {
    vi.mocked(goplus.getAddressSecurity).mockResolvedValue({
      result: {
        cybercrime: "1",
        money_laundering: "1",
        financial_crime: "1",
        phishing_activities: "0",
        stealing_attack: "0",
        sanctioned: "0",
        honeypot_related_address: "0",
        darkweb_transactions: "0",
        mixer: "0",
      },
    } as any);

    const res = await app.request(
      "/api/security/address/1/0xabcdef1234567890abcdef1234567890abcdef12",
    );
    expect(res.status).toBe(200);

    const json = (await res.json()) as Record<string, any>;
    expect(json.data.risks).toContain("cybercrime");
    expect(json.data.risks).toContain("money_laundering");
    expect(json.data.risks).toContain("financial_crime");
    expect(json.data.riskCount).toBe(3);
    expect(json.data.riskLevel).toBe("high");
  });

  it("returns 400 for invalid chain ID", async () => {
    const res = await app.request(
      "/api/security/address/invalidchain/0xabcdef1234567890abcdef1234567890abcdef12",
    );
    expect(res.status).toBe(400);
  });
});

// ═══════════════════════════════════════════════════════════════
// GET /api/security/nft/:chainId/:address
// ═══════════════════════════════════════════════════════════════

describe("GET /api/security/nft/:chainId/:address", () => {
  it("returns NFT security analysis", async () => {
    vi.mocked(goplus.getNFTSecurity).mockResolvedValue({
      result: {
        nft_open_source: "1",
        nft_proxy: "0",
        restricted_approval: "0",
        transfer_without_approval: "0",
        privileged_minting: "0",
        self_destruct: "0",
        oversupply_minting: "0",
      },
    } as any);

    const res = await app.request(
      "/api/security/nft/ethereum/0xabcdef1234567890abcdef1234567890abcdef12",
    );
    expect(res.status).toBe(200);

    const json = (await res.json()) as Record<string, any>;
    expect(json.data.isOpenSource).toBe(true);
    expect(json.data.isProxy).toBe(false);
    expect(json.data.privilegedMinting).toBe(false);
    expect(json.chainId).toBe(1);
  });

  it("returns 400 for invalid chain ID", async () => {
    const res = await app.request(
      "/api/security/nft/invalidchain/0xabcdef1234567890abcdef1234567890abcdef12",
    );
    expect(res.status).toBe(400);
  });
});

// ═══════════════════════════════════════════════════════════════
// GET /api/security/dapp
// ═══════════════════════════════════════════════════════════════

describe("GET /api/security/dapp", () => {
  it("returns dApp security check", async () => {
    vi.mocked(goplus.getDappSecurity).mockResolvedValue({
      result: {
        is_audit: "1",
        trust_list: "1",
        is_open_source: "1",
        phishing_site: "0",
        darkweb_activity: "0",
      },
    } as any);

    const res = await app.request(
      "/api/security/dapp?url=https://app.uniswap.org",
    );
    expect(res.status).toBe(200);

    const json = (await res.json()) as Record<string, any>;
    expect(json.data.isAudited).toBe(true);
    expect(json.data.trustListed).toBe(true);
    expect(json.data.safe).toBe(true);
    expect(json.url).toBe("https://app.uniswap.org");
  });

  it("detects phishing sites", async () => {
    vi.mocked(goplus.getDappSecurity).mockResolvedValue({
      result: {
        is_audit: "0",
        trust_list: "0",
        is_open_source: "0",
        phishing_site: "1",
        darkweb_activity: "0",
      },
    } as any);

    const res = await app.request(
      "/api/security/dapp?url=https://fake-uniswap.com",
    );
    expect(res.status).toBe(200);

    const json = (await res.json()) as Record<string, any>;
    expect(json.data.phishingSite).toBe(true);
    expect(json.data.safe).toBe(false);
  });

  it("returns 400 when url is missing", async () => {
    const res = await app.request("/api/security/dapp");
    expect(res.status).toBe(400);
  });
});

// ═══════════════════════════════════════════════════════════════
// GET /api/security/chains
// ═══════════════════════════════════════════════════════════════

describe("GET /api/security/chains", () => {
  it("returns supported chains", async () => {
    vi.mocked(goplus.getSupportedChains).mockResolvedValue({
      result: [
        { id: "1", name: "Ethereum" },
        { id: "56", name: "BSC" },
      ],
    } as any);

    const res = await app.request("/api/security/chains");
    expect(res.status).toBe(200);

    const json = (await res.json()) as Record<string, any>;
    expect(json.data).toHaveLength(2);
    expect(json.aliases).toHaveProperty("ethereum", 1);
    expect(json).toHaveProperty("timestamp");
  });

  it("propagates source errors as 500", async () => {
    vi.mocked(goplus.getSupportedChains).mockRejectedValue(new Error("fail"));

    const res = await app.request("/api/security/chains");
    expect(res.status).toBe(500);
  });
});

// ═══════════════════════════════════════════════════════════════
// GET /api/security/approval/:chainId/:address
// ═══════════════════════════════════════════════════════════════

describe("GET /api/security/approval/:chainId/:address", () => {
  it("returns approval security data", async () => {
    vi.mocked(goplus.getApprovalSecurity).mockResolvedValue({
      result: {
        "0xspender1": {
          approved_amount: "unlimited",
          approved_contract: "0xcontract1",
          approved_spender: "0xspender1",
          is_open_source: "1",
          trust_list: "1",
          tag: "Uniswap V3",
          is_contract: "1",
        },
      },
    } as any);

    const res = await app.request(
      "/api/security/approval/ethereum/0xabcdef1234567890abcdef1234567890abcdef12",
    );
    expect(res.status).toBe(200);

    const json = (await res.json()) as Record<string, any>;
    expect(json.data).toHaveLength(1);
    expect(json.data[0]).toMatchObject({
      contract: "0xspender1",
      approvedAmount: "unlimited",
      tag: "Uniswap V3",
    });
    expect(json.chainId).toBe(1);
  });

  it("returns 400 for invalid chain ID", async () => {
    const res = await app.request(
      "/api/security/approval/invalidchain/0xabcdef1234567890abcdef1234567890abcdef12",
    );
    expect(res.status).toBe(400);
  });
});
