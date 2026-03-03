/**
 * Crypto Vision — Solana Routes
 *
 * Comprehensive Solana ecosystem data: Jupiter DEX, token metrics,
 * validator stats, program analytics, NFT collections, memecoins.
 *
 * GET /api/solana/overview                      — Solana ecosystem overview
 * GET /api/solana/tokens                        — Top Solana tokens by market cap
 * GET /api/solana/token/:mint                   — Token detail by mint address
 * GET /api/solana/quote                         — Jupiter swap quote
 * GET /api/solana/routes/:inputMint/:outputMint — Best swap routes
 * GET /api/solana/price/:mint                   — Token price via Jupiter
 * GET /api/solana/prices                        — Batch token prices
 * GET /api/solana/dex/pools                     — Top Solana DEX pools
 * GET /api/solana/dex/volume                    — Solana DEX volume stats
 * GET /api/solana/validators                    — Validator rankings
 * GET /api/solana/tps                           — Current TPS
 * GET /api/solana/supply                        — SOL supply breakdown
 * GET /api/solana/staking                       — Staking statistics
 * GET /api/solana/programs/top                  — Top Solana programs by usage
 * GET /api/solana/nft/collections               — Top Solana NFT collections
 * GET /api/solana/new-tokens                    — Recently created SPL tokens
 * GET /api/solana/memecoins                     — Trending memecoins on Solana
 *
 * @copyright 2024-2026 nirholas. All rights reserved.
 */

import { Hono } from "hono";
import * as jupiter from "../sources/jupiter.js";
import * as cg from "../sources/coingecko.js";
import { ApiError } from "../lib/api-error.js";

export const solanaRoutes = new Hono();

// ─── GET /overview — Solana Ecosystem Overview ───────────────

solanaRoutes.get("/overview", async (c) => {
  const [solPrice, jupTokens, tpsData, validators, supply, epochInfo] =
    await Promise.allSettled([
      cg.getCoinDetail("solana"),
      jupiter.getTokenList(),
      jupiter.getRecentTps(),
      jupiter.getValidators(),
      jupiter.getSolSupply(),
      jupiter.getEpochInfo(),
    ]);

  return c.json({
    data: {
      price:
        solPrice.status === "fulfilled"
          ? {
              usd: solPrice.value.market_data.current_price.usd,
              change24h:
                solPrice.value.market_data.price_change_percentage_24h,
              change7d:
                solPrice.value.market_data.price_change_percentage_7d,
              change30d:
                solPrice.value.market_data.price_change_percentage_30d,
              marketCap: solPrice.value.market_data.market_cap.usd,
              volume24h: solPrice.value.market_data.total_volume.usd,
              circulatingSupply:
                solPrice.value.market_data.circulating_supply,
            }
          : null,
      network: {
        tps: tpsData.status === "fulfilled" ? tpsData.value.tps : null,
        nonVoteTps:
          tpsData.status === "fulfilled" ? tpsData.value.nonVoteTps : null,
        validatorCount:
          validators.status === "fulfilled" ? validators.value.length : null,
        activeValidators:
          validators.status === "fulfilled"
            ? validators.value.filter((v) => !v.delinquent).length
            : null,
        totalStakedSol:
          validators.status === "fulfilled"
            ? Math.round(
                validators.value.reduce(
                  (sum, v) => sum + v.activatedStake,
                  0,
                ) / 1e9,
              )
            : null,
        epoch:
          epochInfo.status === "fulfilled" ? epochInfo.value.epoch : null,
        blockHeight:
          epochInfo.status === "fulfilled"
            ? epochInfo.value.blockHeight
            : null,
      },
      supply:
        supply.status === "fulfilled"
          ? {
              totalSol: Math.round(supply.value.totalSol),
              circulatingSol: Math.round(supply.value.circulatingSol),
              nonCirculatingSol: Math.round(
                supply.value.nonCirculatingSol,
              ),
            }
          : null,
      ecosystem: {
        registeredTokens:
          jupTokens.status === "fulfilled" ? jupTokens.value.length : null,
      },
    },
    timestamp: new Date().toISOString(),
  });
});

// ─── GET /tokens — Top Solana Tokens by Market Cap ───────────

solanaRoutes.get("/tokens", async (c) => {
  const limit = Math.min(Number(c.req.query("limit") || 50), 200);
  const tokens = await jupiter.getTopTokensByMarketCap(limit);

  return c.json({
    data: tokens.map((t) => ({
      mint: t.address,
      name: t.name,
      symbol: t.symbol,
      decimals: t.decimals,
      logo: t.logoURI,
      tags: t.tags,
    })),
    count: tokens.length,
    timestamp: new Date().toISOString(),
  });
});

// ─── GET /token/:mint — Token Detail by Mint Address ─────────

solanaRoutes.get("/token/:mint", async (c) => {
  const mint = c.req.param("mint");
  const token = await jupiter.getTokenByMint(mint);

  if (!token) {
    return ApiError.notFound(c, `Token not found for mint: ${mint}`);
  }

  // Also fetch price
  const priceRes = await jupiter.getPrice(mint).catch(() => null);
  const price = priceRes?.data?.[mint] ?? null;

  return c.json({
    data: {
      mint: token.address,
      name: token.name,
      symbol: token.symbol,
      decimals: token.decimals,
      logo: token.logoURI,
      tags: token.tags,
      extensions: token.extensions ?? {},
      price: price
        ? {
            usd: price.price,
            vsToken: price.vsToken,
            vsTokenSymbol: price.vsTokenSymbol,
          }
        : null,
    },
    timestamp: new Date().toISOString(),
  });
});

// ─── GET /quote — Jupiter Swap Quote ─────────────────────────

solanaRoutes.get("/quote", async (c) => {
  const inputMint = c.req.query("input_mint") ?? c.req.query("inputMint");
  const outputMint = c.req.query("output_mint") ?? c.req.query("outputMint");
  const amount = c.req.query("amount");
  const slippage = Number(c.req.query("slippage") ?? c.req.query("slippageBps") ?? 50);
  const dexes = c.req.query("dexes");

  if (!inputMint) return ApiError.missingParam(c, "input_mint");
  if (!outputMint) return ApiError.missingParam(c, "output_mint");
  if (!amount) return ApiError.missingParam(c, "amount");

  const dexList = dexes ? dexes.split(",").map((d) => d.trim()) : undefined;

  const quote = await jupiter.getQuote(
    inputMint,
    outputMint,
    amount,
    slippage,
    dexList,
  );

  return c.json({
    data: {
      inputMint: quote.inputMint,
      outputMint: quote.outputMint,
      inputAmount: quote.inAmount,
      outputAmount: quote.outAmount,
      otherAmountThreshold: quote.otherAmountThreshold,
      priceImpactPct: quote.priceImpactPct,
      swapMode: quote.swapMode,
      slippageBps: quote.slippageBps,
      routePlan: quote.routePlan.map((step) => ({
        ammKey: step.swapInfo.ammKey,
        label: step.swapInfo.label,
        inputMint: step.swapInfo.inputMint,
        outputMint: step.swapInfo.outputMint,
        inAmount: step.swapInfo.inAmount,
        outAmount: step.swapInfo.outAmount,
        feeAmount: step.swapInfo.feeAmount,
        feeMint: step.swapInfo.feeMint,
        percent: step.percent,
      })),
    },
    timestamp: new Date().toISOString(),
  });
});

// ─── GET /routes/:inputMint/:outputMint — Best Swap Routes ──

solanaRoutes.get("/routes/:inputMint/:outputMint", async (c) => {
  const inputMint = c.req.param("inputMint");
  const outputMint = c.req.param("outputMint");
  const amount = c.req.query("amount") ?? "1000000000"; // default 1 SOL in lamports

  const quote = await jupiter.getQuote(inputMint, outputMint, amount, 50);

  return c.json({
    data: {
      inputMint: quote.inputMint,
      outputMint: quote.outputMint,
      inputAmount: quote.inAmount,
      outputAmount: quote.outAmount,
      priceImpactPct: quote.priceImpactPct,
      routes: quote.routePlan.map((step) => ({
        ammKey: step.swapInfo.ammKey,
        label: step.swapInfo.label,
        inputMint: step.swapInfo.inputMint,
        outputMint: step.swapInfo.outputMint,
        inAmount: step.swapInfo.inAmount,
        outAmount: step.swapInfo.outAmount,
        feeAmount: step.swapInfo.feeAmount,
        feeMint: step.swapInfo.feeMint,
        percent: step.percent,
      })),
    },
    timestamp: new Date().toISOString(),
  });
});

// ─── GET /price/:mint — Token Price via Jupiter ──────────────

solanaRoutes.get("/price/:mint", async (c) => {
  const mint = c.req.param("mint");
  const vs = c.req.query("vs");

  const data = vs
    ? await jupiter.getPriceVs(mint, vs)
    : await jupiter.getPrice(mint);

  const price = data.data[mint] ?? null;
  if (!price) {
    return ApiError.notFound(c, `Price not found for mint: ${mint}`);
  }

  return c.json({
    data: {
      mint: price.id,
      symbol: price.mintSymbol,
      price: price.price,
      vsToken: price.vsToken,
      vsTokenSymbol: price.vsTokenSymbol,
    },
    timestamp: new Date().toISOString(),
  });
});

// ─── GET /prices — Batch Token Prices ────────────────────────

solanaRoutes.get("/prices", async (c) => {
  const ids = c.req.query("ids");
  if (!ids) {
    return ApiError.missingParam(c, "ids");
  }

  const vs = c.req.query("vs");
  const data = vs
    ? await jupiter.getPriceVs(ids, vs)
    : await jupiter.getPrice(ids);

  const prices = Object.entries(data.data).map(([mint, p]) => ({
    mint: p.id,
    symbol: p.mintSymbol,
    price: p.price,
    vsToken: p.vsToken,
    vsTokenSymbol: p.vsTokenSymbol,
  }));

  return c.json({
    data: prices,
    count: prices.length,
    timestamp: new Date().toISOString(),
  });
});

// ─── GET /dex/pools — Top Solana DEX Pools ───────────────────

solanaRoutes.get("/dex/pools", async (c) => {
  const page = Math.max(1, Number(c.req.query("page") || 1));
  const pools = await jupiter.getSolanaDexPools(page);

  return c.json({
    data: pools,
    count: pools.length,
    page,
    timestamp: new Date().toISOString(),
  });
});

// ─── GET /dex/volume — Solana DEX Volume Stats ──────────────

solanaRoutes.get("/dex/volume", async (c) => {
  const volume = await jupiter.getSolanaDexVolume();

  return c.json({
    data: {
      totalVolumeH24: volume.totalVolumeH24,
      poolCount: volume.poolCount,
      topPools: volume.topPools.map((p) => ({
        name: p.name,
        address: p.address,
        volumeH24: p.volumeH24,
        priceChangeH24: p.priceChangeH24,
        reserveUsd: p.reserveUsd,
      })),
    },
    timestamp: new Date().toISOString(),
  });
});

// ─── GET /validators — Validator Rankings ────────────────────

solanaRoutes.get("/validators", async (c) => {
  const limit = Math.min(Number(c.req.query("limit") || 50), 500);
  const includeDelinquent = c.req.query("include_delinquent") === "true";

  const validators = await jupiter.getValidators();
  const filtered = includeDelinquent
    ? validators.slice(0, limit)
    : validators.filter((v) => !v.delinquent).slice(0, limit);

  return c.json({
    data: filtered.map((v, idx) => ({
      rank: idx + 1,
      votePubkey: v.votePubkey,
      nodePubkey: v.nodePubkey,
      activatedStakeSol: Math.round(v.activatedStakeSol * 100) / 100,
      commission: v.commission,
      lastVote: v.lastVote,
      delinquent: v.delinquent,
      epochCredits: v.epochCredits,
    })),
    count: filtered.length,
    totalValidators: validators.length,
    timestamp: new Date().toISOString(),
  });
});

// ─── GET /tps — Current TPS ─────────────────────────────────

solanaRoutes.get("/tps", async (c) => {
  const tps = await jupiter.getRecentTps();

  return c.json({
    data: {
      tps: tps.tps,
      nonVoteTps: tps.nonVoteTps,
      sampleCount: tps.sampleCount,
      avgSlotTime: Math.round(tps.avgSlotTime * 1000) / 1000,
    },
    timestamp: new Date().toISOString(),
  });
});

// ─── GET /supply — SOL Supply Breakdown ──────────────────────

solanaRoutes.get("/supply", async (c) => {
  const supply = await jupiter.getSolSupply();

  return c.json({
    data: {
      totalSol: Math.round(supply.totalSol * 100) / 100,
      circulatingSol: Math.round(supply.circulatingSol * 100) / 100,
      nonCirculatingSol:
        Math.round(supply.nonCirculatingSol * 100) / 100,
      circulatingPct:
        Math.round((supply.circulatingSol / supply.totalSol) * 10000) /
        100,
    },
    timestamp: new Date().toISOString(),
  });
});

// ─── GET /staking — Staking Statistics ───────────────────────

solanaRoutes.get("/staking", async (c) => {
  const stats = await jupiter.getStakingStats();

  return c.json({
    data: {
      totalValidators: stats.totalValidators,
      activeValidators: stats.activeValidators,
      delinquentValidators: stats.delinquentValidators,
      totalStakedSol: Math.round(stats.totalStakedSol * 100) / 100,
      averageCommission: stats.averageCommission,
      medianCommission: stats.medianCommission,
      estimatedApy:
        Math.round(stats.stakingApy * 10000) / 100, // convert to percentage
    },
    timestamp: new Date().toISOString(),
  });
});

// ─── GET /programs/top — Top Solana Programs by Usage ────────

solanaRoutes.get("/programs/top", async (c) => {
  const limit = Math.min(Number(c.req.query("limit") || 20), 50);
  const programs = await jupiter.getTopPrograms(limit);

  return c.json({
    data: programs.map((p, idx) => ({
      rank: idx + 1,
      pubkey: p.pubkey,
      balanceSol: Math.round(p.lamportsSol * 100) / 100,
      balanceLamports: p.lamports,
    })),
    count: programs.length,
    timestamp: new Date().toISOString(),
  });
});

// ─── GET /nft/collections — Top Solana NFT Collections ──────

solanaRoutes.get("/nft/collections", async (c) => {
  const limit = Math.min(Number(c.req.query("limit") || 20), 50);
  const collections = await jupiter.getSolanaNftCollections(limit);

  return c.json({
    data: collections,
    count: collections.length,
    timestamp: new Date().toISOString(),
  });
});

// ─── GET /new-tokens — Recently Created SPL Tokens ──────────

solanaRoutes.get("/new-tokens", async (c) => {
  const limit = Math.min(Number(c.req.query("limit") || 50), 100);
  const tokens = await jupiter.getNewTokens(limit);

  return c.json({
    data: tokens.map((t) => ({
      mint: t.address,
      name: t.name,
      symbol: t.symbol,
      decimals: t.decimals,
      logo: t.logoURI,
      tags: t.tags,
    })),
    count: tokens.length,
    timestamp: new Date().toISOString(),
  });
});

// ─── GET /memecoins — Trending Memecoins on Solana ──────────

solanaRoutes.get("/memecoins", async (c) => {
  const limit = Math.min(Number(c.req.query("limit") || 20), 50);

  // Get tokens tagged as memecoins from Jupiter's list
  const memecoins = await jupiter.getMemecoins();

  // Get prices for all memecoins (batched, max 100 per call)
  const mints = memecoins.map((t) => t.address);
  const prices = await jupiter.getTokenPrices(mints.slice(0, 100));

  const withPrices = memecoins
    .map((token) => ({
      name: token.name,
      symbol: token.symbol,
      mint: token.address,
      decimals: token.decimals,
      logo: token.logoURI,
      price: prices[token.address]?.price ?? null,
      volume24h: prices[token.address]?.volume24h ?? null,
      tags: token.tags,
    }))
    .filter((t) => t.price !== null)
    .sort((a, b) => (b.price ?? 0) - (a.price ?? 0))
    .slice(0, limit);

  return c.json({
    data: withPrices,
    count: withPrices.length,
    timestamp: new Date().toISOString(),
  });
});

// ─── Legacy routes (backwards compatibility) ─────────────────

solanaRoutes.get("/price-vs/:token", async (c) => {
  const token = c.req.param("token");
  const vs =
    c.req.query("vs") || "So11111111111111111111111111111111111111112";
  const data = await jupiter.getPriceVs(token, vs);
  return c.json(data);
});

solanaRoutes.get("/tokens/strict", async (c) => {
  const data = await jupiter.getStrictTokenList();
  return c.json({ count: data.length, data });
});

solanaRoutes.get("/tokens/popular", async (c) => {
  const data = await jupiter.getPopularPrices();
  return c.json(data);
});

solanaRoutes.get("/popular/prices", async (c) => {
  const data = await jupiter.getPopularPrices();
  return c.json(data);
});

solanaRoutes.get("/top-tokens", async (c) => {
  const data = await jupiter.getTopTokensByMarketCap();
  return c.json(data);
});

solanaRoutes.get("/search", async (c) => {
  const q = c.req.query("q");
  if (!q) {
    return ApiError.missingParam(c, "q");
  }
  const data = await jupiter.searchTokens(q);
  return c.json({ query: q, data });
});
