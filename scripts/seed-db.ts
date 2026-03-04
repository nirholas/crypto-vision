/**
 * Crypto Vision — Database Seed Script
 *
 * Seeds the database with initial development data:
 * - A default development API key
 * - Sample market snapshots (BTC + ETH, last 24h hourly)
 * - Sample anomaly events
 *
 * Usage: npx tsx scripts/seed-db.ts
 *
 * @copyright 2024-2026 nirholas. All rights reserved.
 */

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../src/lib/db/schema.js";
import {
  createApiKey,
  insertMarketSnapshots,
  insertAnomaly,
} from "../src/lib/db/queries.js";
import type { Db } from "../src/lib/db/index.js";

async function seed(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL is required to seed the database.");
    process.exit(1);
  }

  const client = postgres(url, { max: 1, onnotice: () => {} });
  const db = drizzle(client, { schema }) as unknown as Db;

  console.log("Seeding database…\n");

  // ─── 1. Default API Key ────────────────────────────────────

  console.log("Creating default development API key…");
  const { rawKey, record } = await createApiKey(db, "dev-default", "pro");
  console.log(`  Name:   ${record.name}`);
  console.log(`  Tier:   ${record.tier}`);
  console.log(`  Prefix: ${record.keyPrefix}`);
  console.log(`  Key:    ${rawKey}`);
  console.log("  ⚠ Save this key — it will not be shown again.\n");

  // ─── 2. Sample Market Snapshots ────────────────────────────

  console.log("Inserting sample BTC + ETH market snapshots (24h hourly)…");

  const now = Date.now();
  const HOUR = 60 * 60 * 1000;
  const btcBasePrice = 97_000;
  const ethBasePrice = 3_800;

  const snapshots: schema.NewMarketSnapshot[] = [];

  for (let i = 24; i >= 0; i--) {
    const ts = new Date(now - i * HOUR);

    // BTC: random walk ±1.5%
    const btcJitter = 1 + (Math.random() - 0.5) * 0.03;
    const btcPrice = btcBasePrice * btcJitter;
    snapshots.push({
      coinId: "bitcoin",
      symbol: "BTC",
      price: btcPrice,
      marketCap: btcPrice * 19_500_000,
      volume24h: 28_000_000_000 + Math.random() * 4_000_000_000,
      priceChange24h: (btcJitter - 1) * 100,
      priceChange7d: 2.5 + (Math.random() - 0.5) * 3,
      rank: 1,
      snapshotAt: ts,
    });

    // ETH: random walk ±2%
    const ethJitter = 1 + (Math.random() - 0.5) * 0.04;
    const ethPrice = ethBasePrice * ethJitter;
    snapshots.push({
      coinId: "ethereum",
      symbol: "ETH",
      price: ethPrice,
      marketCap: ethPrice * 120_000_000,
      volume24h: 14_000_000_000 + Math.random() * 3_000_000_000,
      priceChange24h: (ethJitter - 1) * 100,
      priceChange7d: 1.8 + (Math.random() - 0.5) * 4,
      rank: 2,
      snapshotAt: ts,
    });
  }

  await insertMarketSnapshots(db, snapshots);
  console.log(`  Inserted ${snapshots.length} snapshots.\n`);

  // ─── 3. Sample Anomaly Events ──────────────────────────────

  console.log("Inserting sample anomaly events…");

  await insertAnomaly(db, {
    coinId: "bitcoin",
    symbol: "BTC",
    type: "volume_surge",
    severity: "medium",
    description: "BTC 24h volume surged 3.2σ above the 30-day moving average",
    magnitude: 3.2,
    contextData: {
      currentVolume: 32_000_000_000,
      avgVolume: 24_000_000_000,
      stdDev: 2_500_000_000,
    },
    detectedAt: new Date(now - 6 * HOUR),
  });

  await insertAnomaly(db, {
    coinId: "ethereum",
    symbol: "ETH",
    type: "whale_movement",
    severity: "high",
    description: "Large ETH transfer: 15,000 ETH moved to exchange wallet",
    magnitude: 4.1,
    contextData: {
      amount: 15_000,
      fromLabel: "Unknown Wallet",
      toLabel: "Binance Hot Wallet",
      usdValue: 57_000_000,
    },
    detectedAt: new Date(now - 2 * HOUR),
  });

  await insertAnomaly(db, {
    coinId: "solana",
    symbol: "SOL",
    type: "price_spike",
    severity: "low",
    description: "SOL price spiked 5.2% in 15 minutes",
    magnitude: 2.1,
    contextData: {
      priceBefore: 142.5,
      priceAfter: 149.91,
      durationMinutes: 15,
    },
    detectedAt: new Date(now - 1 * HOUR),
  });

  console.log("  Inserted 3 anomaly events.\n");

  // ─── Done ─────────────────────────────────────────────────

  await client.end();
  console.log("Seed completed successfully.");
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
