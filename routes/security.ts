/**
 * Crypto Vision — Security Routes
 *
 * Token & address security analysis via GoPlus (free, no key).
 *
 * GET /api/security/token/:chainId/:address — Token security audit
 * GET /api/security/address/:chainId/:addr  — Address risk check
 * GET /api/security/nft/:chainId/:address   — NFT contract security
 * GET /api/security/dapp                    — dApp phishing check
 * GET /api/security/chains                  — Supported chains
 */

import { Hono } from "hono";
import * as goplus from "../sources/goplus.js";

export const securityRoutes = new Hono();

// Chain ID helper
const CHAIN_IDS: Record<string, number> = {
  ethereum: 1, eth: 1,
  bsc: 56, bnb: 56,
  polygon: 137, matic: 137,
  arbitrum: 42161, arb: 42161,
  optimism: 10, op: 10,
  base: 8453,
  avalanche: 43114, avax: 43114,
  fantom: 250, ftm: 250,
};

function resolveChainId(param: string): number {
  return CHAIN_IDS[param.toLowerCase()] ?? Number(param);
}

// ─── GET /api/security/token/:chainId/:address ───────────────

securityRoutes.get("/token/:chainId/:address", async (c) => {
  const chainId = resolveChainId(c.req.param("chainId"));
  const address = c.req.param("address");

  if (!chainId || isNaN(chainId)) {
    return c.json({ error: "Invalid chain ID. Use number or name (ethereum, bsc, polygon, etc.)" }, 400);
  }

  const { result } = await goplus.getTokenSecurity(chainId, [address]);
  const token = result[address.toLowerCase()];

  if (!token) {
    return c.json({ error: "Token not found or not supported on this chain" }, 404);
  }

  return c.json({
    data: {
      isOpenSource: token.is_open_source === "1",
      isProxy: token.is_proxy === "1",
      isMintable: token.is_mintable === "1",
      isHoneypot: token.is_honeypot === "1",
      buyTax: token.buy_tax ? parseFloat(token.buy_tax) : null,
      sellTax: token.sell_tax ? parseFloat(token.sell_tax) : null,
      holderCount: token.holder_count ? parseInt(token.holder_count) : null,
      canTakeBackOwnership: token.can_take_back_ownership === "1",
      hiddenOwner: token.hidden_owner === "1",
      selfDestruct: token.selfdestruct === "1",
      externalCall: token.external_call === "1",
      isTrueToken: token.is_true_token === "1",
      isAirdropScam: token.is_airdrop_scam === "1",
      isFakeToken: token.fake_token === "1",
      trustList: token.trust_list === "1",
      honeypotWithSameCreator: token.honeypot_with_same_creator === "1",
      topHolders: (token.holders || []).slice(0, 10).map((h) => ({
        address: h.address,
        percent: parseFloat(h.percent),
        isLocked: h.is_locked === 1,
      })),
      lpHolders: (token.lp_holders || []).slice(0, 5).map((h) => ({
        address: h.address,
        percent: parseFloat(h.percent),
        isLocked: h.is_locked === 1,
      })),
      riskLevel:
        token.is_honeypot === "1"
          ? "critical"
          : parseFloat(token.sell_tax || "0") > 0.1 ||
              parseFloat(token.buy_tax || "0") > 0.1
            ? "high"
            : token.is_open_source !== "1"
              ? "medium"
              : "low",
    },
    chainId,
    address,
    timestamp: new Date().toISOString(),
  });
});

// ─── GET /api/security/address/:chainId/:address ─────────────

securityRoutes.get("/address/:chainId/:address", async (c) => {
  const chainId = resolveChainId(c.req.param("chainId"));
  const address = c.req.param("address");

  const { result } = await goplus.getAddressSecurity(chainId, address);

  const risks: string[] = [];
  if (result.cybercrime === "1") risks.push("cybercrime");
  if (result.money_laundering === "1") risks.push("money_laundering");
  if (result.financial_crime === "1") risks.push("financial_crime");
  if (result.phishing_activities === "1") risks.push("phishing");
  if (result.stealing_attack === "1") risks.push("stealing_attack");
  if (result.sanctioned === "1") risks.push("sanctioned");
  if (result.honeypot_related_address === "1") risks.push("honeypot_related");
  if (result.darkweb_transactions === "1") risks.push("darkweb");
  if (result.mixer === "1") risks.push("mixer");

  return c.json({
    data: {
      ...result,
      risks,
      riskCount: risks.length,
      riskLevel: risks.length === 0 ? "safe" : risks.length <= 2 ? "medium" : "high",
    },
    chainId,
    address,
    timestamp: new Date().toISOString(),
  });
});

// ─── GET /api/security/nft/:chainId/:address ─────────────────

securityRoutes.get("/nft/:chainId/:address", async (c) => {
  const chainId = resolveChainId(c.req.param("chainId"));
  const address = c.req.param("address");

  const { result } = await goplus.getNFTSecurity(chainId, address);

  return c.json({
    data: {
      isOpenSource: result.nft_open_source === "1",
      isProxy: result.nft_proxy === "1",
      restrictedApproval: result.restricted_approval === "1",
      transferWithoutApproval: result.transfer_without_approval === "1",
      privilegedMinting: result.privileged_minting === "1",
      selfDestruct: result.self_destruct === "1",
      oversupplyMinting: result.oversupply_minting === "1",
    },
    chainId,
    address,
    timestamp: new Date().toISOString(),
  });
});

// ─── GET /api/security/dapp ──────────────────────────────────

securityRoutes.get("/dapp", async (c) => {
  const url = c.req.query("url");
  if (!url) return c.json({ error: "url parameter required" }, 400);

  const { result } = await goplus.getDappSecurity(url);

  return c.json({
    data: {
      isAudited: result.is_audit === "1",
      trustListed: result.trust_list === "1",
      isOpenSource: result.is_open_source === "1",
      phishingSite: result.phishing_site === "1",
      darkwebActivity: result.darkweb_activity === "1",
      safe: result.phishing_site !== "1" && result.darkweb_activity !== "1",
    },
    url,
    timestamp: new Date().toISOString(),
  });
});

// ─── GET /api/security/chains ────────────────────────────────

securityRoutes.get("/chains", async (c) => {
  const { result } = await goplus.getSupportedChains();

  return c.json({
    data: result,
    aliases: CHAIN_IDS,
    timestamp: new Date().toISOString(),
  });
});
