#!/usr/bin/env tsx
/**
 * x402 Gas Station Agent — "Give Your Agent Access to Money"
 *
 * This is the star of the show. Run this while screen recording for your X post.
 *
 * THE FLOW:
 * 1. Agent wakes up with a funded wallet
 * 2. You give it a mission: "Find me the best opportunity right now"
 * 3. Agent maps out which gas station pumps it needs
 * 4. Agent drives to each pump, pays with USDC via x402, fills up with data
 * 5. Agent synthesizes everything and delivers a full report
 *
 * The console output is designed to look cinematic — clear visual hierarchy,
 * progress indicators, and a final "receipt" showing what the agent bought.
 *
 * Usage:
 *   # Terminal 1: Start the gas station server
 *   npx tsx scripts/demo/x402-gas-station-server.ts
 *
 *   # Terminal 2: Run the agent
 *   npx tsx scripts/demo/x402-gas-station-agent.ts
 *
 * For the video, record Terminal 2 (the agent). Terminal 1 shows the server
 * logs for a split-screen effect if you want.
 */

import * as crypto from 'node:crypto';

// ─── Configuration ────────────────────────────────────────────

const GAS_STATION_URL = process.env.GAS_STATION_URL ?? 'http://localhost:4020';
const AGENT_NAME = 'SperaxOS Agent \u03B1'; // α display name
const AGENT_USER_AGENT = 'SperaxOS-Agent-Alpha/1.0'; // ASCII-safe for HTTP headers
const AGENT_WALLET = '0x' + crypto.randomBytes(20).toString('hex');
const INITIAL_BALANCE_USDC = 5.0;
const NETWORK = 'eip155:84532'; // Base Sepolia

// Simulated EVM private key for signing (demo only — never use real keys in scripts)
const DEMO_PRIVATE_KEY = '0x' + crypto.randomBytes(32).toString('hex');

// ─── Visual Helpers ───────────────────────────────────────────

const COLORS = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  bgBlue: '\x1b[44m',
  bgGreen: '\x1b[42m',
  bgYellow: '\x1b[43m',
  bgMagenta: '\x1b[45m',
  red: '\x1b[31m',
};

function c(color: keyof typeof COLORS, text: string): string {
  return `${COLORS[color]}${text}${COLORS.reset}`;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function formatUsd(amount: number): string {
  return `$${amount.toFixed(3)}`;
}

function printLine() {
  console.log(c('dim', '  ─────────────────────────────────────────────────────────────'));
}

function printDoubleLine() {
  console.log(c('dim', '  ═════════════════════════════════════════════════════════════'));
}

// Typing effect for agent messages
async function typeMessage(prefix: string, message: string, delayPerChar = 12) {
  process.stdout.write(prefix);
  for (const char of message) {
    process.stdout.write(char);
    await sleep(delayPerChar);
  }
  console.log('');
}

// ─── x402 Payment Flow ───────────────────────────────────────

interface PaymentRequirements {
  x402Version: number;
  accepts: Array<{
    scheme: string;
    network: string;
    maxAmountRequired: string;
    resource: string;
    description: string;
    payTo: string;
    asset: string;
  }>;
}

interface RefuelResult {
  endpoint: string;
  pumpName: string;
  priceUsd: number;
  data: unknown;
  txHash: string;
  latencyMs: number;
}

/**
 * Sign a demo x402 payment.
 * In production, this uses ethers.js + EIP-3009 transferWithAuthorization.
 * For the demo, we create a well-formed payload with a dummy signature.
 */
function signPayment(requirements: PaymentRequirements): string {
  const accepted = requirements.accepts[0];
  if (!accepted) throw new Error('No accepted payment schemes');

  const payload = {
    x402Version: 2,
    scheme: 'exact',
    network: accepted.network,
    payload: {
      signature: '0x' + crypto.randomBytes(65).toString('hex'), // Demo signature
      authorization: {
        from: AGENT_WALLET,
        to: accepted.payTo,
        value: accepted.maxAmountRequired,
        validAfter: Math.floor(Date.now() / 1000) - 60,
        validBefore: Math.floor(Date.now() / 1000) + 300,
        nonce: '0x' + crypto.randomBytes(32).toString('hex'),
      },
    },
  };

  return Buffer.from(JSON.stringify(payload)).toString('base64');
}

/**
 * Refuel at a gas station pump — the core x402 payment loop.
 *
 * 1. Hit the endpoint (no payment) → get 402 + requirements
 * 2. Sign the payment
 * 3. Retry with X-PAYMENT header → get data
 */
async function refuelAtPump(endpoint: string): Promise<RefuelResult> {
  const url = `${GAS_STATION_URL}${endpoint}`;
  const startTime = Date.now();

  // Step 1: Initial request → expect 402
  const initialResponse = await fetch(url, {
    headers: { 'Accept': 'application/json', 'User-Agent': AGENT_USER_AGENT },
  });

  if (initialResponse.status !== 402) {
    // Endpoint didn't require payment (shouldn't happen in demo)
    return {
      endpoint,
      pumpName: 'Free Pump',
      priceUsd: 0,
      data: await initialResponse.json(),
      txHash: 'N/A',
      latencyMs: Date.now() - startTime,
    };
  }

  // Step 2: Parse payment requirements
  const paymentHeader = initialResponse.headers.get('X-PAYMENT-REQUIRED') ?? initialResponse.headers.get('x-payment-required');
  if (!paymentHeader) throw new Error(`402 but no X-PAYMENT-REQUIRED header from ${endpoint}`);

  const requirements: PaymentRequirements = JSON.parse(
    Buffer.from(paymentHeader, 'base64').toString('utf-8'),
  );

  const priceUsd = parseFloat(requirements.accepts[0]?.maxAmountRequired ?? '0') / 1e6;
  const body = await initialResponse.json() as { pump?: string };
  const pumpName = (body as Record<string, unknown>).pump as string ?? endpoint;

  // Step 3: Sign payment
  const paymentProof = signPayment(requirements);

  // Step 4: Retry with payment
  const paidResponse = await fetch(url, {
    headers: {
      'Accept': 'application/json',
      'User-Agent': AGENT_USER_AGENT,
      'X-PAYMENT': paymentProof,
    },
  });

  if (!paidResponse.ok) {
    throw new Error(`Paid request failed: ${paidResponse.status}`);
  }

  // Extract settlement tx from response header
  const paymentResponseHeader = paidResponse.headers.get('X-Payment-Response') ?? paidResponse.headers.get('x-payment-response');
  let txHash = 'pending';
  if (paymentResponseHeader) {
    try {
      const parsed = JSON.parse(Buffer.from(paymentResponseHeader, 'base64').toString('utf-8'));
      txHash = parsed.transactionHash ?? 'pending';
    } catch {
      // ignore
    }
  }

  const data = await paidResponse.json();

  return {
    endpoint,
    pumpName,
    priceUsd,
    data,
    txHash,
    latencyMs: Date.now() - startTime,
  };
}

// ─── The Demo Flow ────────────────────────────────────────────

async function runGasStationDemo() {
  const receipts: RefuelResult[] = [];
  let totalSpent = 0;

  console.clear();
  console.log('');
  console.log(c('bold', '  ╔═══════════════════════════════════════════════════════════╗'));
  console.log(c('bold', '  ║                                                           ║'));
  console.log(c('bold', `  ║   ${c('cyan', '🤖 ' + AGENT_NAME)}                                    ║`));
  console.log(c('bold', '  ║   Autonomous Crypto Intelligence Agent                    ║'));
  console.log(c('bold', '  ║                                                           ║'));
  console.log(c('bold', '  ╚═══════════════════════════════════════════════════════════╝'));
  console.log('');

  await sleep(800);

  // ─── Phase 1: Wallet Check ──────────────────────────────────

  console.log(c('dim', '  [WALLET]'));
  await typeMessage('  ', `💳 Wallet: ${c('cyan', AGENT_WALLET)}`);
  await typeMessage('  ', `💰 Balance: ${c('green', formatUsd(INITIAL_BALANCE_USDC) + ' USDC')}`);
  await typeMessage('  ', `🔗 Network: ${c('blue', 'Base Sepolia')} (${NETWORK})`);
  console.log('');

  await sleep(1000);

  // ─── Phase 2: Mission Received ──────────────────────────────

  printLine();
  console.log('');
  console.log(c('yellow', '  📨 MISSION RECEIVED'));
  console.log('');
  await typeMessage('  ', `${c('bold', 'User:')} "Find me the best crypto opportunity right now."`);
  console.log('');

  await sleep(1200);

  // ─── Phase 3: Planning ──────────────────────────────────────

  await typeMessage('  ', `${c('cyan', AGENT_NAME + ':')} "On it. Let me plan my route..."`, 15);
  console.log('');
  await sleep(600);

  const missionPlan = [
    { endpoint: '/api/premium/market/coins', reason: 'Get current market prices & trends' },
    { endpoint: '/api/premium/whales/transactions', reason: 'Check what smart money is doing' },
    { endpoint: '/api/premium/defi/protocols', reason: 'Scan DeFi yields & TVL flows' },
    { endpoint: '/api/premium/ai/sentiment', reason: 'Read the social sentiment pulse' },
    { endpoint: '/api/premium/ai/analyze', reason: 'Run AI analysis on all data' },
  ];

  console.log(c('dim', '  [ROUTE PLANNED]'));
  for (let i = 0; i < missionPlan.length; i++) {
    const step = missionPlan[i]!;
    await sleep(200);
    console.log(`  ${c('dim', `${i + 1}.`)} ${step.reason} ${c('dim', `→ ${step.endpoint}`)}`);
  }
  console.log('');

  await sleep(800);

  // ─── Phase 4: Gas Station ───────────────────────────────────

  printDoubleLine();
  console.log('');
  console.log(c('bold', '  ⛽  ENTERING GAS STATION'));
  console.log(c('dim', `     ${GAS_STATION_URL}`));
  console.log('');
  printLine();

  for (let i = 0; i < missionPlan.length; i++) {
    const step = missionPlan[i]!;
    const pumpNumber = i + 1;

    console.log('');
    console.log(`  ${c('yellow', `⛽ PUMP ${pumpNumber}/${missionPlan.length}`)} ${c('dim', '→')} ${step.endpoint}`);
    console.log(`  ${c('dim', step.reason)}`);

    // Show connecting animation
    process.stdout.write(c('dim', '  Connecting'));
    for (let dot = 0; dot < 3; dot++) {
      await sleep(150);
      process.stdout.write(c('dim', '.'));
    }
    console.log('');

    try {
      // Hit the pump
      const result = await refuelAtPump(step.endpoint);
      receipts.push(result);
      totalSpent += result.priceUsd;

      // Show x402 flow
      console.log(`  ${c('dim', '↳')} ${c('dim', '402 → sign EIP-3009 → pay')} ${c('green', formatUsd(result.priceUsd))} ${c('dim', 'USDC')}`);
      console.log(`  ${c('green', '✓')} Payment: ${c('green', formatUsd(result.priceUsd))} USDC`);
      console.log(`  ${c('green', '✓')} Data received (${result.latencyMs}ms)`);
      console.log(`  ${c('dim', '  tx: ' + result.txHash.slice(0, 22) + '...')}`);

      // Show remaining balance
      const remaining = INITIAL_BALANCE_USDC - totalSpent;
      console.log(`  ${c('dim', `  balance: ${formatUsd(remaining)} USDC remaining`)}`);

    } catch (error) {
      console.log(`  ${c('red', '✗')} Failed: ${(error as Error).message}`);
    }

    if (i < missionPlan.length - 1) {
      await sleep(600);
    }
  }

  console.log('');
  printDoubleLine();
  console.log('');

  await sleep(800);

  // ─── Phase 5: Analysis ──────────────────────────────────────

  console.log(c('bold', '  🧠  ANALYZING DATA'));
  console.log('');

  const analysisSteps = [
    'Cross-referencing market data with whale movements...',
    'Scoring DeFi protocols by risk-adjusted yield...',
    'Overlaying sentiment data for confirmation bias check...',
    'Running AI opportunity detection model...',
    'Generating final report...',
  ];

  for (const step of analysisSteps) {
    await typeMessage(`  ${c('dim', '→')} `, step, 18);
    await sleep(400);
  }

  console.log('');
  await sleep(600);

  // ─── Phase 6: Report ────────────────────────────────────────

  printDoubleLine();
  console.log('');
  console.log(c('bold', '  📊  INTELLIGENCE REPORT'));
  console.log('');
  printLine();
  console.log('');

  // Extract data from receipts for the report
  const marketData = receipts.find(r => r.endpoint.includes('market'))?.data as Record<string, unknown> | undefined;
  const aiData = receipts.find(r => r.endpoint.includes('ai/analyze'))?.data as Record<string, unknown> | undefined;
  const whaleData = receipts.find(r => r.endpoint.includes('whales'))?.data as Record<string, unknown> | undefined;
  const sentimentData = receipts.find(r => r.endpoint.includes('sentiment'))?.data as Record<string, unknown> | undefined;
  const defiData = receipts.find(r => r.endpoint.includes('defi'))?.data as Record<string, unknown> | undefined;

  // Market Overview
  console.log(c('cyan', '  MARKET OVERVIEW'));
  const coins = ((marketData as Record<string, unknown>)?.data as Array<Record<string, unknown>>) ?? [];
  for (const coin of coins.slice(0, 5)) {
    const change = coin.price_change_percentage_24h as number;
    const changeColor = change >= 0 ? 'green' : 'red';
    const arrow = change >= 0 ? '▲' : '▼';
    console.log(`  ${(coin.symbol as string).padEnd(6)} $${String(coin.current_price).padEnd(12)} ${c(changeColor, `${arrow} ${change.toFixed(2)}%`)}`);
  }
  console.log('');

  // Top Opportunity
  const analysis = (aiData as Record<string, unknown>)?.data as Record<string, unknown> | undefined;
  const analysisInner = analysis?.analysis as Record<string, unknown> | undefined;
  const opportunities = analysisInner?.opportunities as Array<Record<string, unknown>> | undefined;

  if (opportunities?.[0]) {
    const opp = opportunities[0];
    console.log(c('green', '  🎯 TOP OPPORTUNITY'));
    console.log(`  Asset:      ${c('bold', opp.asset as string)}`);
    console.log(`  Action:     ${c('green', opp.action as string)}`);
    console.log(`  Confidence: ${c('bold', `${((opp.confidence as number) * 100).toFixed(0)}%`)}`);
    console.log(`  Target:     $${opp.target_price}`);
    console.log(`  Stop Loss:  $${opp.stop_loss}`);
    console.log(`  Timeframe:  ${opp.timeframe}`);
    console.log(`  ${c('dim', opp.reasoning as string)}`);
    console.log('');
  }

  // Whale Activity
  const whales = (whaleData as Record<string, unknown>)?.data as Record<string, unknown> | undefined;
  const alerts = whales?.alerts as Array<Record<string, unknown>> | undefined;

  if (alerts?.length) {
    console.log(c('magenta', '  🐋 WHALE ACTIVITY (Last 24h)'));
    for (const alert of alerts.slice(0, 3)) {
      const value = alert.value_usd as number;
      console.log(`  ${alert.type as string} — ${alert.label as string}: ${c('bold', `$${(value / 1_000_000).toFixed(1)}M`)} ${alert.asset as string}`);
    }
    console.log('');
  }

  // Sentiment
  const sentiment = (sentimentData as Record<string, unknown>)?.data as Record<string, unknown> | undefined;
  const overall = sentiment?.overall as Record<string, unknown> | undefined;

  if (overall) {
    const fearGreed = sentiment?.fear_greed as Record<string, unknown> | undefined;
    console.log(c('blue', '  📊 MARKET SENTIMENT'));
    console.log(`  Overall:     ${c('green', overall.label as string)} (${((overall.score as number) * 100).toFixed(0)}/100)`);
    console.log(`  Fear/Greed:  ${fearGreed?.value ?? 'N/A'} — ${c('yellow', (fearGreed?.label as string) ?? 'N/A')}`);
    console.log(`  Sources:     ${(overall.sources_analyzed as number)?.toLocaleString() ?? 'N/A'} analyzed`);
    console.log('');
  }

  // DeFi Best Yield
  const defi = (defiData as Record<string, unknown>)?.data as Record<string, unknown> | undefined;
  const protocols = defi?.protocols as Array<Record<string, unknown>> | undefined;

  if (protocols?.length) {
    console.log(c('yellow', '  🌾 BEST DEFI YIELDS'));
    for (const protocol of protocols.slice(0, 3)) {
      const pools = protocol.top_pools as Array<Record<string, unknown>> | undefined;
      const bestPool = pools?.[0];
      if (bestPool) {
        console.log(`  ${(protocol.name as string).padEnd(15)} ${(bestPool.asset as string).padEnd(10)} ${c('green', `${bestPool.apy}% APY`)}  (Risk: ${protocol.risk_score}/10)`);
      }
    }
    console.log('');
  }

  // ─── Phase 7: Receipt ───────────────────────────────────────

  printDoubleLine();
  console.log('');
  console.log(c('bold', '  🧾  GAS STATION RECEIPT'));
  console.log('');

  for (const receipt of receipts) {
    console.log(`  ${c('green', '✓')} ${receipt.pumpName.padEnd(30)} ${c('cyan', formatUsd(receipt.priceUsd).padStart(8))}  ${c('dim', `(${receipt.latencyMs}ms)`)}`);
  }

  printLine();
  console.log(`  ${'TOTAL SPENT'.padEnd(30)} ${c('bold', formatUsd(totalSpent).padStart(8))}`);
  console.log(`  ${'WALLET BALANCE'.padEnd(30)} ${c('green', formatUsd(INITIAL_BALANCE_USDC - totalSpent).padStart(8))}`);
  console.log(`  ${'DATA SOURCES'.padEnd(30)} ${c('cyan', String(receipts.length).padStart(8))}`);
  console.log(`  ${'NETWORK'.padEnd(30)} ${c('blue', 'Base Sepolia'.padStart(8))}`);
  console.log('');

  printDoubleLine();
  console.log('');

  await typeMessage(
    `  ${c('cyan', AGENT_NAME + ':')} `,
    '"Mission complete. Spent ' + formatUsd(totalSpent) + ' across ' + receipts.length + ' data sources. Your best play is ETH — 87% confidence, target $4,200. The whales agree."',
    20,
  );

  console.log('');
  console.log(c('dim', '  give your agent access to money.'));
  console.log('');
}

// ─── Run ──────────────────────────────────────────────────────

runGasStationDemo().catch(err => {
  console.error('Demo failed:', err);
  process.exit(1);
});
