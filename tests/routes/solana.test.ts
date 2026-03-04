/**
 * Integration tests for /api/solana/* — Solana ecosystem routes
 *
 * All Jupiter, CoinGecko, and Solana RPC calls are mocked — no live API traffic.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mock source modules BEFORE importing routes ─────────────

vi.mock("@/sources/jupiter.js", () => ({
  getPrice: vi.fn(),
  getPriceVs: vi.fn(),
  getTokenPrices: vi.fn(),
  getQuote: vi.fn(),
  getTokenList: vi.fn(),
  getStrictTokenList: vi.fn(),
  getPopularPrices: vi.fn(),
  getTopTokensByMarketCap: vi.fn(),
  searchTokens: vi.fn(),
  getTokenByMint: vi.fn(),
  getNewTokens: vi.fn(),
  getMemecoins: vi.fn(),
  getRecentTps: vi.fn(),
  getSolSupply: vi.fn(),
  getValidators: vi.fn(),
  getStakingStats: vi.fn(),
  getEpochInfo: vi.fn(),
  getClusterNodes: vi.fn(),
  getTopPrograms: vi.fn(),
  getSolanaDexPools: vi.fn(),
  getSolanaDexVolume: vi.fn(),
  getSolanaNftCollections: vi.fn(),
}));

vi.mock("@/sources/coingecko.js", () => ({
  getCoinDetail: vi.fn(),
}));

import { Hono } from "hono";
import { solanaRoutes } from "@/routes/solana.js";
import * as jupiter from "@/sources/jupiter.js";
import * as cg from "@/sources/coingecko.js";

const app = new Hono();
app.route("/", solanaRoutes);

// ─── Fixtures ────────────────────────────────────────────────

const MOCK_SOL_DETAIL = {
  id: "solana",
  symbol: "sol",
  name: "Solana",
  description: { en: "Solana is a blockchain." },
  categories: ["Smart Contract Platform"],
  platforms: {},
  links: {
    homepage: ["https://solana.com"],
    blockchain_site: ["https://explorer.solana.com"],
    repos_url: { github: ["https://github.com/solana-labs/solana"] },
  },
  market_data: {
    current_price: { usd: 145.5 },
    market_cap: { usd: 65_000_000_000 },
    total_volume: { usd: 3_200_000_000 },
    price_change_percentage_24h: 3.2,
    price_change_percentage_7d: 8.5,
    price_change_percentage_30d: 15.1,
    circulating_supply: 440_000_000,
    total_supply: 580_000_000,
    max_supply: null,
  },
};

const MOCK_TOKEN: jupiter.JupiterToken = {
  address: "So11111111111111111111111111111111111111112",
  chainId: 101,
  decimals: 9,
  name: "Wrapped SOL",
  symbol: "SOL",
  logoURI: "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png",
  tags: ["old-registry"],
};

const MOCK_MEME_TOKEN: jupiter.JupiterToken = {
  address: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263",
  chainId: 101,
  decimals: 5,
  name: "Bonk",
  symbol: "BONK",
  logoURI: "https://example.com/bonk.png",
  tags: ["meme", "community"],
};

const MOCK_PRICE: jupiter.JupiterPrice = {
  id: "So11111111111111111111111111111111111111112",
  mintSymbol: "SOL",
  vsToken: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  vsTokenSymbol: "USDC",
  price: 145.5,
  timeTaken: 0.003,
};

const MOCK_QUOTE: jupiter.JupiterQuote = {
  inputMint: "So11111111111111111111111111111111111111112",
  inAmount: "1000000000",
  outputMint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  outAmount: "145500000",
  otherAmountThreshold: "145227750",
  swapMode: "ExactIn",
  slippageBps: 50,
  priceImpactPct: "0.01",
  routePlan: [
    {
      swapInfo: {
        ammKey: "ammkey123",
        label: "Raydium",
        inputMint: "So11111111111111111111111111111111111111112",
        outputMint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
        inAmount: "1000000000",
        outAmount: "145500000",
        feeAmount: "50000",
        feeMint: "So11111111111111111111111111111111111111112",
      },
      percent: 100,
    },
  ],
};

const MOCK_VALIDATOR: jupiter.ValidatorInfo = {
  votePubkey: "vote111111111111111111111111111111111111111",
  nodePubkey: "node111111111111111111111111111111111111111",
  activatedStake: 5_000_000_000_000_000, // 5M SOL in lamports
  activatedStakeSol: 5_000_000,
  commission: 5,
  lastVote: 300_000_000,
  epochCredits: 400_000,
  delinquent: false,
};

const MOCK_DELINQUENT_VALIDATOR: jupiter.ValidatorInfo = {
  votePubkey: "delinquent1111111111111111111111111111111111",
  nodePubkey: "nodeDelinquent1111111111111111111111111111",
  activatedStake: 100_000_000_000, // 100 SOL in lamports
  activatedStakeSol: 100,
  commission: 10,
  lastVote: 100_000_000,
  epochCredits: 100_000,
  delinquent: true,
};

const MOCK_TPS = {
  tps: 3500,
  nonVoteTps: 800,
  sampleCount: 10,
  avgSlotTime: 0.4,
};

const MOCK_SUPPLY = {
  totalSol: 580_000_000,
  circulatingSol: 440_000_000,
  nonCirculatingSol: 140_000_000,
};

const MOCK_STAKING_STATS: jupiter.StakingStats = {
  totalValidators: 2000,
  activeValidators: 1900,
  delinquentValidators: 100,
  totalStakedSol: 380_000_000,
  averageCommission: 7.5,
  medianCommission: 7,
  stakingApy: 0.0685,
};

const MOCK_EPOCH_INFO: jupiter.EpochInfo = {
  epoch: 600,
  slotIndex: 200_000,
  slotsInEpoch: 432_000,
  absoluteSlot: 260_000_000,
  blockHeight: 240_000_000,
  transactionCount: 500_000_000_000,
};

const MOCK_POOL: jupiter.SolanaPool = {
  id: "solana_raydium_pool1",
  name: "SOL / USDC",
  address: "pool_address_123",
  baseTokenPriceUsd: "145.5",
  quoteTokenPriceUsd: "1.0",
  fdvUsd: "65000000000",
  marketCapUsd: "65000000000",
  priceChangeH1: "0.5",
  priceChangeH24: "3.2",
  volumeH24: "50000000",
  reserveUsd: "100000000",
  txnsH24Buys: 15000,
  txnsH24Sells: 12000,
};

const MOCK_PROGRAM: jupiter.ProgramAccount = {
  pubkey: "11111111111111111111111111111111",
  lamports: 10_000_000_000_000,
  lamportsSol: 10_000,
  executable: false,
};

const MOCK_NFT_COLLECTION: jupiter.SolanaNftCollection = {
  id: "degods",
  name: "DeGods",
  symbol: "DEGOD",
  floorPriceUsd: 500,
  floorPriceSol: 3.4,
  volume24hUsd: 150_000,
  marketCapUsd: 5_000_000,
  holders: 5000,
};

// ─── Setup ───────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── GET /overview ───────────────────────────────────────────

describe("GET /overview", () => {
  it("returns full Solana ecosystem overview", async () => {
    vi.mocked(cg.getCoinDetail).mockResolvedValue(MOCK_SOL_DETAIL as ReturnType<typeof cg.getCoinDetail> extends Promise<infer U> ? U : never);
    vi.mocked(jupiter.getTokenList).mockResolvedValue([MOCK_TOKEN, MOCK_MEME_TOKEN]);
    vi.mocked(jupiter.getRecentTps).mockResolvedValue(MOCK_TPS);
    vi.mocked(jupiter.getValidators).mockResolvedValue([MOCK_VALIDATOR, MOCK_DELINQUENT_VALIDATOR]);
    vi.mocked(jupiter.getSolSupply).mockResolvedValue(MOCK_SUPPLY);
    vi.mocked(jupiter.getEpochInfo).mockResolvedValue(MOCK_EPOCH_INFO);

    const res = await app.request("/overview");
    expect(res.status).toBe(200);

    const body = (await res.json()) as Record<string, any> as Record<string, unknown>;
    const data = body.data as Record<string, unknown>;

    expect(data).toHaveProperty("price");
    expect(data).toHaveProperty("network");
    expect(data).toHaveProperty("supply");
    expect(data).toHaveProperty("ecosystem");

    const price = data.price as Record<string, unknown>;
    expect(price.usd).toBe(145.5);
    expect(price.change24h).toBe(3.2);
    expect(price.marketCap).toBe(65_000_000_000);

    const network = data.network as Record<string, unknown>;
    expect(network.tps).toBe(3500);
    expect(network.validatorCount).toBe(2);
    expect(network.epoch).toBe(600);

    const supply = data.supply as Record<string, unknown>;
    expect(supply.totalSol).toBe(580_000_000);

    const ecosystem = data.ecosystem as Record<string, unknown>;
    expect(ecosystem.registeredTokens).toBe(2);
  });

  it("handles partial failures gracefully", async () => {
    vi.mocked(cg.getCoinDetail).mockRejectedValue(new Error("CG down"));
    vi.mocked(jupiter.getTokenList).mockResolvedValue([MOCK_TOKEN]);
    vi.mocked(jupiter.getRecentTps).mockRejectedValue(new Error("RPC down"));
    vi.mocked(jupiter.getValidators).mockResolvedValue([MOCK_VALIDATOR]);
    vi.mocked(jupiter.getSolSupply).mockRejectedValue(new Error("RPC down"));
    vi.mocked(jupiter.getEpochInfo).mockRejectedValue(new Error("RPC down"));

    const res = await app.request("/overview");
    expect(res.status).toBe(200);

    const body = (await res.json()) as Record<string, any> as Record<string, unknown>;
    const data = body.data as Record<string, unknown>;

    expect(data.price).toBeNull();
    expect((data.network as Record<string, unknown>).tps).toBeNull();
    expect(data.supply).toBeNull();
    expect((data.ecosystem as Record<string, unknown>).registeredTokens).toBe(1);
  });
});

// ─── GET /tokens ─────────────────────────────────────────────

describe("GET /tokens", () => {
  it("returns top tokens by market cap", async () => {
    vi.mocked(jupiter.getTopTokensByMarketCap).mockResolvedValue([MOCK_TOKEN]);

    const res = await app.request("/tokens");
    expect(res.status).toBe(200);

    const body = (await res.json()) as Record<string, any> as Record<string, unknown>;
    const data = body.data as Array<Record<string, unknown>>;
    expect(data).toHaveLength(1);
    expect(data[0]).toMatchObject({
      mint: MOCK_TOKEN.address,
      name: "Wrapped SOL",
      symbol: "SOL",
      decimals: 9,
    });
    expect(body.count).toBe(1);
  });

  it("respects limit parameter", async () => {
    vi.mocked(jupiter.getTopTokensByMarketCap).mockResolvedValue([]);

    await app.request("/tokens?limit=25");
    expect(jupiter.getTopTokensByMarketCap).toHaveBeenCalledWith(25);
  });

  it("caps limit at 200", async () => {
    vi.mocked(jupiter.getTopTokensByMarketCap).mockResolvedValue([]);

    await app.request("/tokens?limit=999");
    expect(jupiter.getTopTokensByMarketCap).toHaveBeenCalledWith(200);
  });
});

// ─── GET /token/:mint ────────────────────────────────────────

describe("GET /token/:mint", () => {
  it("returns token detail with price", async () => {
    vi.mocked(jupiter.getTokenByMint).mockResolvedValue(MOCK_TOKEN);
    vi.mocked(jupiter.getPrice).mockResolvedValue({
      data: { [MOCK_TOKEN.address]: MOCK_PRICE },
    });

    const res = await app.request(`/token/${MOCK_TOKEN.address}`);
    expect(res.status).toBe(200);

    const body = (await res.json()) as Record<string, any> as Record<string, unknown>;
    const data = body.data as Record<string, unknown>;
    expect(data.mint).toBe(MOCK_TOKEN.address);
    expect(data.name).toBe("Wrapped SOL");
    expect(data.price).toBeTruthy();
    expect((data.price as Record<string, unknown>).usd).toBe(145.5);
  });

  it("returns 404 for unknown mint", async () => {
    vi.mocked(jupiter.getTokenByMint).mockResolvedValue(null);

    const res = await app.request("/token/unknown_mint_address");
    expect(res.status).toBe(404);
  });
});

// ─── GET /quote ──────────────────────────────────────────────

describe("GET /quote", () => {
  it("returns Jupiter swap quote with full route details", async () => {
    vi.mocked(jupiter.getQuote).mockResolvedValue(MOCK_QUOTE);

    const res = await app.request(
      "/quote?input_mint=So11111111111111111111111111111111111111112&output_mint=EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v&amount=1000000000",
    );
    expect(res.status).toBe(200);

    const body = (await res.json()) as Record<string, any> as Record<string, unknown>;
    const data = body.data as Record<string, unknown>;
    expect(data.inputAmount).toBe("1000000000");
    expect(data.outputAmount).toBe("145500000");
    expect(data.priceImpactPct).toBe("0.01");
    expect((data.routePlan as Array<Record<string, unknown>>)).toHaveLength(1);
    expect((data.routePlan as Array<Record<string, unknown>>)[0].label).toBe("Raydium");
  });

  it("accepts legacy inputMint/outputMint params", async () => {
    vi.mocked(jupiter.getQuote).mockResolvedValue(MOCK_QUOTE);

    const res = await app.request(
      "/quote?inputMint=So11111111111111111111111111111111111111112&outputMint=EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v&amount=1000000000",
    );
    expect(res.status).toBe(200);
  });

  it("returns error when parameters are missing", async () => {
    const res = await app.request("/quote");
    expect(res.status).toBe(400);

    const body = (await res.json()) as Record<string, any> as Record<string, unknown>;
    expect(body).toHaveProperty("error");
  });

  it("passes slippage and dexes params", async () => {
    vi.mocked(jupiter.getQuote).mockResolvedValue(MOCK_QUOTE);

    await app.request(
      "/quote?input_mint=So11111111111111111111111111111111111111112&output_mint=EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v&amount=1000000000&slippage=100&dexes=Raydium,Orca",
    );

    expect(jupiter.getQuote).toHaveBeenCalledWith(
      "So11111111111111111111111111111111111111112",
      "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
      "1000000000",
      100,
      ["Raydium", "Orca"],
    );
  });
});

// ─── GET /routes/:inputMint/:outputMint ──────────────────────

describe("GET /routes/:inputMint/:outputMint", () => {
  it("returns best swap routes", async () => {
    vi.mocked(jupiter.getQuote).mockResolvedValue(MOCK_QUOTE);

    const res = await app.request(
      "/routes/So11111111111111111111111111111111111111112/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    );
    expect(res.status).toBe(200);

    const body = (await res.json()) as Record<string, any> as Record<string, unknown>;
    const data = body.data as Record<string, unknown>;
    expect(data).toHaveProperty("routes");
    expect((data.routes as Array<Record<string, unknown>>)).toHaveLength(1);
  });

  it("uses custom amount if provided", async () => {
    vi.mocked(jupiter.getQuote).mockResolvedValue(MOCK_QUOTE);

    await app.request(
      "/routes/So11111111111111111111111111111111111111112/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v?amount=5000000000",
    );

    expect(jupiter.getQuote).toHaveBeenCalledWith(
      "So11111111111111111111111111111111111111112",
      "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
      "5000000000",
      50,
    );
  });
});

// ─── GET /price/:mint ────────────────────────────────────────

describe("GET /price/:mint", () => {
  it("returns price for a specific mint", async () => {
    vi.mocked(jupiter.getPrice).mockResolvedValue({
      data: { [MOCK_TOKEN.address]: MOCK_PRICE },
    });

    const res = await app.request(`/price/${MOCK_TOKEN.address}`);
    expect(res.status).toBe(200);

    const body = (await res.json()) as Record<string, any> as Record<string, unknown>;
    const data = body.data as Record<string, unknown>;
    expect(data.price).toBe(145.5);
    expect(data.symbol).toBe("SOL");
  });

  it("returns 404 for non-existent token price", async () => {
    vi.mocked(jupiter.getPrice).mockResolvedValue({ data: {} });

    const res = await app.request("/price/nonexistent_mint");
    expect(res.status).toBe(404);
  });

  it("supports vs query param", async () => {
    vi.mocked(jupiter.getPriceVs).mockResolvedValue({
      data: {
        [MOCK_TOKEN.address]: {
          ...MOCK_PRICE,
          vsToken: "custom_vs_token",
          vsTokenSymbol: "CUSTOM",
        },
      },
    });

    const res = await app.request(`/price/${MOCK_TOKEN.address}?vs=custom_vs_token`);
    expect(res.status).toBe(200);
    expect(jupiter.getPriceVs).toHaveBeenCalledWith(MOCK_TOKEN.address, "custom_vs_token");
  });
});

// ─── GET /prices ─────────────────────────────────────────────

describe("GET /prices", () => {
  it("returns batch prices", async () => {
    vi.mocked(jupiter.getPrice).mockResolvedValue({
      data: { [MOCK_TOKEN.address]: MOCK_PRICE },
    });

    const res = await app.request(`/prices?ids=${MOCK_TOKEN.address}`);
    expect(res.status).toBe(200);

    const body = (await res.json()) as Record<string, any> as Record<string, unknown>;
    const data = body.data as Array<Record<string, unknown>>;
    expect(data).toHaveLength(1);
    expect(body.count).toBe(1);
  });

  it("returns error when ids parameter is missing", async () => {
    const res = await app.request("/prices");
    expect(res.status).toBe(400);
  });
});

// ─── GET /dex/pools ──────────────────────────────────────────

describe("GET /dex/pools", () => {
  it("returns Solana DEX pools", async () => {
    vi.mocked(jupiter.getSolanaDexPools).mockResolvedValue([MOCK_POOL]);

    const res = await app.request("/dex/pools");
    expect(res.status).toBe(200);

    const body = (await res.json()) as Record<string, any> as Record<string, unknown>;
    const data = body.data as Array<Record<string, unknown>>;
    expect(data).toHaveLength(1);
    expect(data[0].name).toBe("SOL / USDC");
    expect(body.page).toBe(1);
  });

  it("passes page parameter", async () => {
    vi.mocked(jupiter.getSolanaDexPools).mockResolvedValue([]);

    await app.request("/dex/pools?page=3");
    expect(jupiter.getSolanaDexPools).toHaveBeenCalledWith(3);
  });
});

// ─── GET /dex/volume ─────────────────────────────────────────

describe("GET /dex/volume", () => {
  it("returns DEX volume stats", async () => {
    vi.mocked(jupiter.getSolanaDexVolume).mockResolvedValue({
      totalVolumeH24: 500_000_000,
      poolCount: 50,
      topPools: [MOCK_POOL],
    });

    const res = await app.request("/dex/volume");
    expect(res.status).toBe(200);

    const body = (await res.json()) as Record<string, any> as Record<string, unknown>;
    const data = body.data as Record<string, unknown>;
    expect(data.totalVolumeH24).toBe(500_000_000);
    expect(data.poolCount).toBe(50);
    expect((data.topPools as Array<Record<string, unknown>>)).toHaveLength(1);
  });
});

// ─── GET /validators ─────────────────────────────────────────

describe("GET /validators", () => {
  it("returns validator rankings excluding delinquent by default", async () => {
    vi.mocked(jupiter.getValidators).mockResolvedValue([
      MOCK_VALIDATOR,
      MOCK_DELINQUENT_VALIDATOR,
    ]);

    const res = await app.request("/validators");
    expect(res.status).toBe(200);

    const body = (await res.json()) as Record<string, any> as Record<string, unknown>;
    const data = body.data as Array<Record<string, unknown>>;
    expect(data).toHaveLength(1);
    expect(data[0].delinquent).toBe(false);
    expect(body.totalValidators).toBe(2);
  });

  it("includes delinquent when requested", async () => {
    vi.mocked(jupiter.getValidators).mockResolvedValue([
      MOCK_VALIDATOR,
      MOCK_DELINQUENT_VALIDATOR,
    ]);

    const res = await app.request("/validators?include_delinquent=true");
    expect(res.status).toBe(200);

    const body = (await res.json()) as Record<string, any> as Record<string, unknown>;
    const data = body.data as Array<Record<string, unknown>>;
    expect(data).toHaveLength(2);
  });

  it("respects limit parameter", async () => {
    const validators = Array.from({ length: 100 }, (_, i) => ({
      ...MOCK_VALIDATOR,
      votePubkey: `validator_${i}`,
    }));
    vi.mocked(jupiter.getValidators).mockResolvedValue(validators);

    const res = await app.request("/validators?limit=10");
    const body = (await res.json()) as Record<string, any> as Record<string, unknown>;
    expect((body.data as Array<unknown>)).toHaveLength(10);
  });
});

// ─── GET /tps ────────────────────────────────────────────────

describe("GET /tps", () => {
  it("returns current TPS data", async () => {
    vi.mocked(jupiter.getRecentTps).mockResolvedValue(MOCK_TPS);

    const res = await app.request("/tps");
    expect(res.status).toBe(200);

    const body = (await res.json()) as Record<string, any> as Record<string, unknown>;
    const data = body.data as Record<string, unknown>;
    expect(data.tps).toBe(3500);
    expect(data.nonVoteTps).toBe(800);
    expect(data.sampleCount).toBe(10);
  });
});

// ─── GET /supply ─────────────────────────────────────────────

describe("GET /supply", () => {
  it("returns SOL supply breakdown with percentages", async () => {
    vi.mocked(jupiter.getSolSupply).mockResolvedValue(MOCK_SUPPLY);

    const res = await app.request("/supply");
    expect(res.status).toBe(200);

    const body = (await res.json()) as Record<string, any> as Record<string, unknown>;
    const data = body.data as Record<string, unknown>;
    expect(data.totalSol).toBe(580_000_000);
    expect(data.circulatingSol).toBe(440_000_000);
    expect(data.nonCirculatingSol).toBe(140_000_000);
    // 440M / 580M ≈ 75.86%
    expect(data.circulatingPct).toBeCloseTo(75.86, 1);
  });
});

// ─── GET /staking ────────────────────────────────────────────

describe("GET /staking", () => {
  it("returns staking statistics", async () => {
    vi.mocked(jupiter.getStakingStats).mockResolvedValue(MOCK_STAKING_STATS);

    const res = await app.request("/staking");
    expect(res.status).toBe(200);

    const body = (await res.json()) as Record<string, any> as Record<string, unknown>;
    const data = body.data as Record<string, unknown>;
    expect(data.totalValidators).toBe(2000);
    expect(data.activeValidators).toBe(1900);
    expect(data.delinquentValidators).toBe(100);
    expect(data.totalStakedSol).toBe(380_000_000);
    expect(data.averageCommission).toBe(7.5);
    expect(data.medianCommission).toBe(7);
    // 0.0685 * 10000 / 100 = 6.85
    expect(data.estimatedApy).toBeCloseTo(6.85, 1);
  });
});

// ─── GET /programs/top ───────────────────────────────────────

describe("GET /programs/top", () => {
  it("returns top programs", async () => {
    vi.mocked(jupiter.getTopPrograms).mockResolvedValue([MOCK_PROGRAM]);

    const res = await app.request("/programs/top");
    expect(res.status).toBe(200);

    const body = (await res.json()) as Record<string, any> as Record<string, unknown>;
    const data = body.data as Array<Record<string, unknown>>;
    expect(data).toHaveLength(1);
    expect(data[0].rank).toBe(1);
    expect(data[0].pubkey).toBe(MOCK_PROGRAM.pubkey);
    expect(data[0].balanceSol).toBe(10000);
  });

  it("respects limit parameter", async () => {
    vi.mocked(jupiter.getTopPrograms).mockResolvedValue([]);

    await app.request("/programs/top?limit=10");
    expect(jupiter.getTopPrograms).toHaveBeenCalledWith(10);
  });
});

// ─── GET /nft/collections ────────────────────────────────────

describe("GET /nft/collections", () => {
  it("returns Solana NFT collections", async () => {
    vi.mocked(jupiter.getSolanaNftCollections).mockResolvedValue([MOCK_NFT_COLLECTION]);

    const res = await app.request("/nft/collections");
    expect(res.status).toBe(200);

    const body = (await res.json()) as Record<string, any> as Record<string, unknown>;
    const data = body.data as Array<Record<string, unknown>>;
    expect(data).toHaveLength(1);
    expect(data[0].name).toBe("DeGods");
    expect(data[0].floorPriceUsd).toBe(500);
    expect(body.count).toBe(1);
  });
});

// ─── GET /new-tokens ─────────────────────────────────────────

describe("GET /new-tokens", () => {
  it("returns recently created SPL tokens", async () => {
    vi.mocked(jupiter.getNewTokens).mockResolvedValue([MOCK_MEME_TOKEN]);

    const res = await app.request("/new-tokens");
    expect(res.status).toBe(200);

    const body = (await res.json()) as Record<string, any> as Record<string, unknown>;
    const data = body.data as Array<Record<string, unknown>>;
    expect(data).toHaveLength(1);
    expect(data[0].mint).toBe(MOCK_MEME_TOKEN.address);
    expect(data[0].symbol).toBe("BONK");
  });

  it("caps limit at 100", async () => {
    vi.mocked(jupiter.getNewTokens).mockResolvedValue([]);

    await app.request("/new-tokens?limit=500");
    expect(jupiter.getNewTokens).toHaveBeenCalledWith(100);
  });
});

// ─── GET /memecoins ──────────────────────────────────────────

describe("GET /memecoins", () => {
  it("returns trending memecoins with prices", async () => {
    vi.mocked(jupiter.getMemecoins).mockResolvedValue([MOCK_MEME_TOKEN]);
    vi.mocked(jupiter.getTokenPrices).mockResolvedValue({
      [MOCK_MEME_TOKEN.address]: { price: 0.000025, volume24h: null },
    });

    const res = await app.request("/memecoins");
    expect(res.status).toBe(200);

    const body = (await res.json()) as Record<string, any> as Record<string, unknown>;
    const data = body.data as Array<Record<string, unknown>>;
    expect(data).toHaveLength(1);
    expect(data[0].symbol).toBe("BONK");
    expect(data[0].price).toBe(0.000025);
    expect(data[0].mint).toBe(MOCK_MEME_TOKEN.address);
    expect((data[0].tags as string[])).toContain("meme");
  });

  it("filters out tokens without prices", async () => {
    vi.mocked(jupiter.getMemecoins).mockResolvedValue([MOCK_MEME_TOKEN]);
    vi.mocked(jupiter.getTokenPrices).mockResolvedValue({});

    const res = await app.request("/memecoins");
    expect(res.status).toBe(200);

    const body = (await res.json()) as Record<string, any> as Record<string, unknown>;
    const data = body.data as Array<unknown>;
    expect(data).toHaveLength(0);
    expect(body.count).toBe(0);
  });
});

// ─── Legacy Routes ───────────────────────────────────────────

describe("Legacy Routes", () => {
  it("GET /search returns token search results", async () => {
    vi.mocked(jupiter.searchTokens).mockResolvedValue([MOCK_TOKEN]);

    const res = await app.request("/search?q=SOL");
    expect(res.status).toBe(200);

    const body = (await res.json()) as Record<string, any> as Record<string, unknown>;
    expect(body.query).toBe("SOL");
    expect((body.data as Array<unknown>)).toHaveLength(1);
  });

  it("GET /search returns 400 without q param", async () => {
    const res = await app.request("/search");
    expect(res.status).toBe(400);
  });

  it("GET /tokens/strict returns strict token list", async () => {
    vi.mocked(jupiter.getStrictTokenList).mockResolvedValue([MOCK_TOKEN]);

    const res = await app.request("/tokens/strict");
    expect(res.status).toBe(200);

    const body = (await res.json()) as Record<string, any> as Record<string, unknown>;
    expect(body.count).toBe(1);
  });

  it("GET /tokens/popular returns popular prices", async () => {
    vi.mocked(jupiter.getPopularPrices).mockResolvedValue({
      [MOCK_TOKEN.address]: MOCK_PRICE,
    });

    const res = await app.request("/tokens/popular");
    expect(res.status).toBe(200);
  });
});
