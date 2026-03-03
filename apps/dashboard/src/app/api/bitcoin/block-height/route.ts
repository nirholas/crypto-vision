/**
 * Bitcoin Block Height API
 *
 * Fetches current Bitcoin block height from multiple sources
 * with fallback for reliability.
 *
 * @endpoint GET /api/bitcoin/block-height
 * @returns { blockHeight: number, timestamp: string, source: string }
 */

import { NextResponse } from 'next/server';

interface BlockHeightResponse {
  blockHeight: number;
  timestamp: string;
  source: string;
  halvingData: {
    currentHalving: number;
    nextHalvingBlock: number;
    blocksRemaining: number;
    currentReward: number;
    nextReward: number;
    progress: number;
    estimatedDate: string;
  };
}

const BLOCKS_PER_HALVING = 210_000;
const INITIAL_BLOCK_REWARD = 50;
const AVG_BLOCK_TIME_MINUTES = 10;

// Cache for 30 seconds
let cache: { data: BlockHeightResponse; timestamp: number } | null = null;
const CACHE_TTL = 30 * 1000;

function calculateHalvingData(blockHeight: number) {
  const currentHalving = Math.floor(blockHeight / BLOCKS_PER_HALVING);
  const nextHalvingBlock = (currentHalving + 1) * BLOCKS_PER_HALVING;
  const blocksRemaining = nextHalvingBlock - blockHeight;
  const currentReward = INITIAL_BLOCK_REWARD / Math.pow(2, currentHalving);
  const nextReward = currentReward / 2;

  const blocksIntoEpoch = blockHeight - currentHalving * BLOCKS_PER_HALVING;
  const progress = (blocksIntoEpoch / BLOCKS_PER_HALVING) * 100;

  const minutesRemaining = blocksRemaining * AVG_BLOCK_TIME_MINUTES;
  const estimatedDate = new Date(Date.now() + minutesRemaining * 60 * 1000);

  return {
    currentHalving: currentHalving + 1,
    nextHalvingBlock,
    blocksRemaining,
    currentReward,
    nextReward,
    progress,
    estimatedDate: estimatedDate.toISOString(),
  };
}

async function fetchFromBlockchainInfo(): Promise<number> {
  const response = await fetch('https://blockchain.info/q/getblockcount', {
    next: { revalidate: 30 },
  });
  if (!response.ok) throw new Error('Blockchain.info failed');
  const text = await response.text();
  return parseInt(text, 10);
}

async function fetchFromMempool(): Promise<number> {
  const response = await fetch('https://mempool.space/api/blocks/tip/height', {
    next: { revalidate: 30 },
  });
  if (!response.ok) throw new Error('Mempool.space failed');
  return await response.json();
}

async function fetchFromBlockstream(): Promise<number> {
  const response = await fetch('https://blockstream.info/api/blocks/tip/height', {
    next: { revalidate: 30 },
  });
  if (!response.ok) throw new Error('Blockstream failed');
  const text = await response.text();
  return parseInt(text, 10);
}

export async function GET() {
  try {
    // Check cache
    if (cache && Date.now() - cache.timestamp < CACHE_TTL) {
      return NextResponse.json(cache.data, {
        headers: {
          'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60',
        },
      });
    }

    // Try multiple sources with fallback
    const sources = [
      { name: 'mempool.space', fetcher: fetchFromMempool },
      { name: 'blockchain.info', fetcher: fetchFromBlockchainInfo },
      { name: 'blockstream.info', fetcher: fetchFromBlockstream },
    ];

    let blockHeight: number | null = null;
    let sourceName = 'unknown';

    for (const source of sources) {
      try {
        blockHeight = await source.fetcher();
        sourceName = source.name;
        break;
      } catch {
        continue;
      }
    }

    if (blockHeight === null) {
      // Last resort fallback - estimate based on genesis date
      // Bitcoin genesis: Jan 3, 2009
      const genesisTimestamp = new Date('2009-01-03T18:15:05Z').getTime();
      const minutesSinceGenesis = (Date.now() - genesisTimestamp) / (1000 * 60);
      blockHeight = Math.floor(minutesSinceGenesis / AVG_BLOCK_TIME_MINUTES);
      sourceName = 'estimated';
    }

    const response: BlockHeightResponse = {
      blockHeight,
      timestamp: new Date().toISOString(),
      source: sourceName,
      halvingData: calculateHalvingData(blockHeight),
    };

    // Update cache
    cache = { data: response, timestamp: Date.now() };

    return NextResponse.json(response, {
      headers: {
        'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60',
      },
    });
  } catch (error) {
    console.error('Error fetching block height:', error);
    return NextResponse.json({ error: 'Failed to fetch block height' }, { status: 500 });
  }
}
