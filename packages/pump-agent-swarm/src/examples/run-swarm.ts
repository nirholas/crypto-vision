/**
 * Example: Run a Pump.fun Agent Swarm
 *
 * Usage:
 *   npm run swarm           # Interactive CLI mode (default)
 *   npm run swarm demo      # Demo mode with simulated interactions
 *   npm run swarm present   # AI-narrated presentation mode for hackathons
 *
 * This example shows the complete flow:
 * 1. Creator agent mints a token with a 0.5 SOL dev buy
 * 2. Three trader agents trade it back and forth using the "organic" strategy
 * 3. x402 analytics API is called (paid with USDC) every 60s for intelligence
 * 4. Swarm stops when budget is exhausted or max duration is reached
 *
 * Prerequisites:
 * - Fund the creator wallet with enough SOL (dev buy + trader funding)
 * - Upload metadata JSON to Arweave/IPFS
 * - Set environment variables (see below)
 *
 * Environment variables:
 *   SOLANA_RPC_URL     — Solana RPC endpoint (mainnet or devnet)
 *   CREATOR_SECRET_KEY — Base58-encoded secret key for the creator wallet
 *   X402_PRIVATE_KEY   — (Optional) EVM private key for paying x402 analytics
 *   ANALYTICS_API_URL  — (Optional) Base URL of the x402 analytics API
 *   OPENROUTER_API_KEY — (Required for presentation mode) OpenRouter API key
 */

import { SwarmCoordinator, STRATEGY_ORGANIC } from '../index.js';
import { LAMPORTS_PER_SOL } from '@solana/web3.js';
import BN from 'bn.js';
import { PresentationMode } from '../demo/presentation.js';

async function main() {
  const mode = process.argv[2] || 'cli';

  // Handle presentation mode
  if (mode === 'present') {
    const openRouterApiKey = process.env.OPENROUTER_API_KEY;
    if (!openRouterApiKey) {
      console.error('Error: OPENROUTER_API_KEY environment variable is required for presentation mode');
      process.exit(1);
    }

    const presenter = new PresentationMode({
      openRouterApiKey,
      rpcUrl: process.env.SOLANA_RPC_URL,
      presenterName: process.env.PRESENTER_NAME || 'Demo',
      hackathonName: process.env.HACKATHON_NAME || 'Solana Hackathon 2026',
      audience: (process.env.AUDIENCE as 'technical' | 'investor' | 'general') || 'technical',
    });

    await presenter.runPresentation();
    console.log('\n\n✅ Presentation complete!');
    return;
  }

  // Handle demo mode
  if (mode === 'demo') {
    console.log('Demo mode not yet implemented. Use "present" mode for AI-narrated demos.');
    process.exit(1);
  }

  // Default: CLI mode
  const rpcUrl = process.env.SOLANA_RPC_URL ?? 'https://api.devnet.solana.com';

  // ─── Configure the Swarm ──────────────────────────────────

  const swarm = new SwarmCoordinator({
    rpcUrl,
    traderCount: 3,

    // Token metadata
    token: {
      name: 'AI Agent Coin',
      symbol: 'AIAC',
      metadataUri: 'https://arweave.net/your-metadata-uri-here',
    },

    // Creator does a 0.5 SOL dev buy at launch
    bundle: {
      devBuyLamports: new BN(0.5 * LAMPORTS_PER_SOL),
      bundleWallets: [], // No additional bundle buys for this example
      slippageBps: 500,  // 5% slippage tolerance
    },

    // Organic strategy: slow accumulation, looks natural
    strategy: STRATEGY_ORGANIC,

    // x402 analytics (optional — remove to run without paid intelligence)
    analyticsApiUrl: process.env.ANALYTICS_API_URL,
    solanaPrivateKey: process.env.X402_SOLANA_PRIVATE_KEY,

    // Set to true to skip real payments (API must also be in dev mode)
    devMode: !process.env.X402_SOLANA_PRIVATE_KEY,
  });

  // ─── Event Listeners ──────────────────────────────────────

  swarm.on('phase:change', (phase) => {
    console.log(`\n>>> Phase: ${phase.toUpperCase()}\n`);
  });

  swarm.on('token:created', (result) => {
    console.log(`✔ Token created: ${result.mint}`);
    console.log(`  Bonding curve: ${result.bondingCurve}`);
    console.log(`  Signature: ${result.signature}`);
    if (result.devBuyTokens) {
      console.log(`  Dev buy tokens: ${result.devBuyTokens.toString()}`);
    }
  });

  swarm.on('trade:executed', (result) => {
    const dir = result.order.direction === 'buy' ? 'BUY' : 'SELL';
    const amount = result.order.direction === 'buy'
      ? `${(result.order.amount.toNumber() / LAMPORTS_PER_SOL).toFixed(4)} SOL`
      : `${result.order.amount.toString()} tokens`;
    const status = result.success ? 'OK' : 'FAIL';
    console.log(`  [${result.order.traderId}] ${dir} ${amount} — ${status} (${result.signature.slice(0, 8)}...)`);
  });

  swarm.on('analytics:x402-payment', (amount, endpoint) => {
    console.log(`  💰 x402 payment: ${amount} USDC → ${endpoint}`);
  });

  swarm.on('analytics:fetched', (analytics) => {
    console.log(`  📊 Analytics: price=${analytics.bondingCurve.currentPriceSol.toFixed(8)} SOL, ` +
      `mcap=${analytics.bondingCurve.marketCapSol.toFixed(2)} SOL, ` +
      `holders=${analytics.holderCount}, rug=${analytics.rugScore}/100`);
  });

  swarm.on('curve:graduated', (mint) => {
    console.log(`\n🎓 TOKEN GRADUATED! Mint: ${mint}\n`);
  });

  swarm.on('error', (error) => {
    console.error('Swarm error:', error.message);
  });

  // ─── Handle Ctrl+C Gracefully ─────────────────────────────

  process.on('SIGINT', async () => {
    console.log('\n\nStopping swarm (Ctrl+C)...');
    await swarm.stop();
    process.exit(0);
  });

  // ─── Run ──────────────────────────────────────────────────

  console.log('Starting Pump.fun Agent Swarm...\n');
  const finalStatus = await swarm.run();

  console.log('\nSwarm finished.');
  console.log(`Total trades: ${finalStatus.totalTrades} (${finalStatus.successfulTrades} ok, ${finalStatus.failedTrades} failed)`);
  console.log(`Net P&L: ${(finalStatus.netPnlSol.toNumber() / LAMPORTS_PER_SOL).toFixed(4)} SOL`);

  if (finalStatus.x402PaymentsMade > 0) {
    console.log(`x402 analytics: ${finalStatus.x402PaymentsMade} calls, $${finalStatus.x402TotalSpentUsdc.toFixed(4)} USDC`);
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
