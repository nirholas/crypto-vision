/**
 * Crypto Vision — Whale Tracking Routes
 *
 * Large transaction monitoring via Blockchair, Blockchain.info, and Etherscan.
 *
 * === Whale Transaction Feed ===
 * GET /api/whales/transactions                — Recent whale transactions (>$100K)
 * GET /api/whales/transactions/:symbol        — Whale txs for specific token
 * GET /api/whales/alerts                      — Generated whale alerts
 *
 * === Smart Money ===
 * GET /api/whales/smart-money                 — Smart money movement tracker
 * GET /api/whales/smart-money/:token          — Smart money trades for token
 *
 * === Exchange Flows ===
 * GET /api/whales/exchange-flows              — Exchange deposit/withdrawal flows
 * GET /api/whales/exchange-flows/:symbol      — Token exchange flows
 *
 * === Wallets ===
 * GET /api/whales/wallets/top/:chain          — Top wallets by holdings
 * GET /api/whales/wallets/:address            — Wallet profile & activity
 * GET /api/whales/wallets/:address/track      — Track a wallet (add to watchlist)
 *
 * === Signals ===
 * GET /api/whales/accumulation/:symbol        — Accumulation/distribution signal
 * GET /api/whales/dormant                     — Recently active dormant wallets
 *
 * === Legacy (Blockchair/Etherscan direct) ===
 * GET /api/whales/btc/latest                  — Recent large BTC transactions
 * GET /api/whales/btc/mempool                 — BTC mempool data
 * GET /api/whales/stats/:chain                — Blockchair chain stats
 * GET /api/whales/address/:chain/:address     — Address balance lookup
 * GET /api/whales/eth/richlist                — Top ETH holders
 * GET /api/whales/eth/holders/:address        — Token top holders
 * GET /api/whales/eth/transfers/:address      — Recent large ETH transfers
 * GET /api/whales/charts/:name                — Blockchain.info chart data
 * GET /api/whales/overview                    — Aggregate whale overview
 *
 * @copyright 2024-2026 nirholas. All rights reserved.
 */

import { Hono } from "hono";
import * as whales from "../sources/whales.js";

export const whaleRoutes = new Hono();

// ─── Whale Transaction Feed ─────────────────────────────────

whaleRoutes.get("/transactions", async (c) => {
  const minUsd = Number(c.req.query("min_usd") || 100000);
  const chain = c.req.query("chain");
  const type = c.req.query("type");
  const limit = Math.min(Number(c.req.query("limit") || 25), 100);

  let txs = await whales.getRecentWhaleTransactions({ minUsd });

  if (chain) txs = txs.filter((tx) => tx.blockchain === chain);
  if (type) txs = txs.filter((tx) => tx.transactionType === type);

  const classification = whales.classifyWhaleActivity(txs);

  return c.json({
    data: {
      transactions: txs.slice(0, limit),
      classification: {
        overallSignal: classification.overallSignal,
        signalStrength: classification.signalStrength,
        exchangeDeposits: classification.exchangeDeposits,
        exchangeWithdrawals: classification.exchangeWithdrawals,
      },
      totalFiltered: txs.length,
    },
    timestamp: new Date().toISOString(),
  });
});

whaleRoutes.get("/transactions/:symbol", async (c) => {
  const symbol = c.req.param("symbol").toUpperCase();
  const minUsd = Number(c.req.query("min_usd") || 100000);
  const limit = Math.min(Number(c.req.query("limit") || 25), 100);

  const txs = await whales.getWhaleTransactionsForToken(symbol, minUsd);
  const classification = whales.classifyWhaleActivity(txs);

  return c.json({
    data: {
      symbol,
      transactions: txs.slice(0, limit),
      classification,
      total: txs.length,
    },
    timestamp: new Date().toISOString(),
  });
});

// ─── Whale Alerts ────────────────────────────────────────────

whaleRoutes.get("/alerts", async (c) => {
  const severity = c.req.query("severity");
  const type = c.req.query("type");
  const limit = Math.min(Number(c.req.query("limit") || 25), 100);

  let alerts = await whales.getWhaleAlerts();

  if (severity) alerts = alerts.filter((a) => a.severity === severity);
  if (type) alerts = alerts.filter((a) => a.type === type);

  return c.json({
    data: {
      alerts: alerts.slice(0, limit),
      total: alerts.length,
    },
    timestamp: new Date().toISOString(),
  });
});

// ─── Smart Money ─────────────────────────────────────────────

whaleRoutes.get("/smart-money", async (c) => {
  const limit = Math.min(Number(c.req.query("limit") || 20), 50);

  const trades = await whales.getSmartMoneyTrades(undefined, 200);
  const analysis = whales.analyzeSmartMoney(trades);

  return c.json({
    data: {
      consensusBuys: analysis.consensusBuys.slice(0, limit),
      consensusSells: analysis.consensusSells.slice(0, limit),
      newPositions: analysis.newPositions.slice(0, 10),
      exitingPositions: analysis.exitingPositions.slice(0, 10),
      topPerformingWallets: analysis.topPerformingWallets.slice(0, 10),
      defiTrends: analysis.defiTrends.slice(0, 10),
    },
    timestamp: new Date().toISOString(),
  });
});

whaleRoutes.get("/smart-money/:token", async (c) => {
  const token = c.req.param("token").toUpperCase();
  const limit = Math.min(Number(c.req.query("limit") || 25), 100);

  const trades = await whales.getSmartMoneyTrades(token, limit);

  return c.json({
    data: {
      token,
      trades: trades.slice(0, limit),
      total: trades.length,
      buyCount: trades.filter((t) => t.action === "buy").length,
      sellCount: trades.filter((t) => t.action === "sell").length,
      totalVolumeUsd: trades.reduce((sum, t) => sum + t.amountUsd, 0),
    },
    timestamp: new Date().toISOString(),
  });
});

// ─── Exchange Flows ──────────────────────────────────────────

whaleRoutes.get("/exchange-flows", async (c) => {
  const flows = await whales.getExchangeFlows();

  const totalDeposits = flows.reduce((sum, f) => sum + f.deposits24h, 0);
  const totalWithdrawals = flows.reduce((sum, f) => sum + f.withdrawals24h, 0);

  return c.json({
    data: {
      flows,
      summary: {
        totalDeposits24h: totalDeposits,
        totalWithdrawals24h: totalWithdrawals,
        netFlow: totalDeposits - totalWithdrawals,
        signal: totalDeposits > totalWithdrawals ? "bearish" : "bullish",
        exchangeCount: flows.length,
      },
    },
    timestamp: new Date().toISOString(),
  });
});

whaleRoutes.get("/exchange-flows/:symbol", async (c) => {
  const symbol = c.req.param("symbol").toUpperCase();
  const flows = await whales.getTokenExchangeFlows(symbol);

  return c.json({
    data: {
      symbol,
      flows,
      total: flows.length,
    },
    timestamp: new Date().toISOString(),
  });
});

// ─── Wallets ─────────────────────────────────────────────────

whaleRoutes.get("/wallets/top/:chain", async (c) => {
  const chain = c.req.param("chain").toLowerCase();
  const wallets = await whales.getTopWalletsByChain(chain);

  return c.json({
    data: {
      chain,
      wallets,
      count: wallets.length,
    },
    timestamp: new Date().toISOString(),
  });
});

whaleRoutes.get("/wallets/:address/track", async (c) => {
  const address = c.req.param("address");
  const result = whales.trackWallet(address);

  return c.json({
    data: result,
    timestamp: new Date().toISOString(),
  });
});

whaleRoutes.get("/wallets/:address", async (c) => {
  const address = c.req.param("address");
  const profile = await whales.getWalletProfile(address);

  return c.json({
    data: profile,
    timestamp: new Date().toISOString(),
  });
});

// ─── Accumulation / Distribution ─────────────────────────────

whaleRoutes.get("/accumulation/:symbol", async (c) => {
  const symbol = c.req.param("symbol").toUpperCase();
  const signal = await whales.getAccumulationSignal(symbol);

  return c.json({
    data: signal,
    timestamp: new Date().toISOString(),
  });
});

// ─── Dormant Wallets ─────────────────────────────────────────

whaleRoutes.get("/dormant", async (c) => {
  const wallets = await whales.getDormantWallets();

  return c.json({
    data: {
      wallets,
      count: wallets.length,
    },
    timestamp: new Date().toISOString(),
  });
});

// ─── Legacy: Bitcoin Whale Tracking ──────────────────────────

whaleRoutes.get("/btc/latest", async (c) => {
  const limit = Math.min(Number(c.req.query("limit")) || 25, 100);
  const data = await whales.getLatestBTCTransactions(limit);
  return c.json(data);
});

whaleRoutes.get("/btc/mempool", async (c) => {
  const data = await whales.getBTCMempool();
  return c.json(data);
});

// ─── Legacy: Multi-Chain Stats ───────────────────────────────

whaleRoutes.get("/stats/bitcoin", async (c) => {
  const data = await whales.getChainStats("bitcoin");
  return c.json(data);
});

whaleRoutes.get("/stats/ethereum", async (c) => {
  const data = await whales.getChainStats("ethereum");
  return c.json(data);
});

whaleRoutes.get("/stats/:chain", async (c) => {
  const chain = c.req.param("chain");
  const data = await whales.getChainStats(chain);
  return c.json(data);
});

// ─── Legacy: Address Lookup ──────────────────────────────────

whaleRoutes.get("/address/:chain/:address", async (c) => {
  const chain = c.req.param("chain");
  const address = c.req.param("address");
  const data = await whales.getAddressInfo(chain, address);
  return c.json(data);
});

// ─── Legacy: Ethereum Whale Data ─────────────────────────────

whaleRoutes.get("/eth/richlist", async (c) => {
  const data = await whales.getETHRichList();
  return c.json(data);
});

whaleRoutes.get("/eth/holders/:address", async (c) => {
  const address = c.req.param("address");
  const page = Number(c.req.query("page")) || 1;
  const offset = Math.min(Number(c.req.query("offset")) || 25, 100);
  const data = await whales.getTokenTopHolders(address, page, offset);
  return c.json(data);
});

whaleRoutes.get("/eth/transfers/:address", async (c) => {
  const address = c.req.param("address");
  const startblock = Number(c.req.query("startblock")) || 0;
  const data = await whales.getRecentLargeETHTransfers(address, startblock);
  return c.json(data);
});

// ─── Legacy: Charts (Blockchain.info) ────────────────────────

whaleRoutes.get("/charts/price", async (c) => {
  const timespan = c.req.query("timespan") || "1year";
  const data = await whales.getBTCChart("market-price", timespan);
  return c.json(data);
});

whaleRoutes.get("/charts/hashrate", async (c) => {
  const timespan = c.req.query("timespan") || "1year";
  const data = await whales.getBTCChart("hash-rate", timespan);
  return c.json(data);
});

whaleRoutes.get("/charts/difficulty", async (c) => {
  const timespan = c.req.query("timespan") || "1year";
  const data = await whales.getBTCChart("difficulty", timespan);
  return c.json(data);
});

whaleRoutes.get("/charts/transactions", async (c) => {
  const timespan = c.req.query("timespan") || "1year";
  const data = await whales.getBTCChart("n-transactions", timespan);
  return c.json(data);
});

whaleRoutes.get("/charts/:name", async (c) => {
  const name = c.req.param("name");
  const timespan = c.req.query("timespan") || "1year";
  const rollingAverage = c.req.query("rollingAverage") || undefined;
  const data = await whales.getBTCChart(name, timespan, rollingAverage);
  return c.json(data);
});

// ─── Legacy: Aggregate ───────────────────────────────────────

whaleRoutes.get("/overview", async (c) => {
  const data = await whales.getWhaleOverview();
  return c.json(data);
});
