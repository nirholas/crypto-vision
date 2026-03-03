import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { tokens, users, type NewToken, type NewUser } from "../src/db/schema.js";
import "dotenv/config";

// ============================================================================
// Whitelist Tokens by Chain
// ============================================================================

const WHITELIST_TOKENS: NewToken[] = [
  // ============ Ethereum Mainnet ============
  {
    address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    chain: "ethereum",
    symbol: "USDC",
    tokenName: "USD Coin",
    decimals: "6",
    isWhitelisted: true,
    coingeckoId: "usd-coin",
  },
  {
    address: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
    chain: "ethereum",
    symbol: "USDT",
    tokenName: "Tether USD",
    decimals: "6",
    isWhitelisted: true,
    coingeckoId: "tether",
  },
  {
    address: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
    chain: "ethereum",
    symbol: "WETH",
    tokenName: "Wrapped Ether",
    decimals: "18",
    isWhitelisted: true,
    coingeckoId: "weth",
  },
  {
    address: "0x6B175474E89094C44Da98b954EesfdKAD3eF3eBF",
    chain: "ethereum",
    symbol: "DAI",
    tokenName: "Dai Stablecoin",
    decimals: "18",
    isWhitelisted: true,
    coingeckoId: "dai",
  },
  {
    address: "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599",
    chain: "ethereum",
    symbol: "WBTC",
    tokenName: "Wrapped BTC",
    decimals: "8",
    isWhitelisted: true,
    coingeckoId: "wrapped-bitcoin",
  },

  // ============ Base ============
  {
    address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    chain: "base",
    symbol: "USDC",
    tokenName: "USD Coin",
    decimals: "6",
    isWhitelisted: true,
    coingeckoId: "usd-coin",
  },
  {
    address: "0x4200000000000000000000000000000000000006",
    chain: "base",
    symbol: "WETH",
    tokenName: "Wrapped Ether",
    decimals: "18",
    isWhitelisted: true,
    coingeckoId: "weth",
  },
  {
    address: "0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb",
    chain: "base",
    symbol: "DAI",
    tokenName: "Dai Stablecoin",
    decimals: "18",
    isWhitelisted: true,
    coingeckoId: "dai",
  },
  {
    address: "0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2",
    chain: "base",
    symbol: "USDT",
    tokenName: "Tether USD",
    decimals: "6",
    isWhitelisted: true,
    coingeckoId: "tether",
  },

  // ============ Arbitrum ============
  {
    address: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
    chain: "arbitrum",
    symbol: "USDC",
    tokenName: "USD Coin",
    decimals: "6",
    isWhitelisted: true,
    coingeckoId: "usd-coin",
  },
  {
    address: "0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8",
    chain: "arbitrum",
    symbol: "USDC.e",
    tokenName: "Bridged USDC",
    decimals: "6",
    isWhitelisted: true,
    coingeckoId: "usd-coin",
  },
  {
    address: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9",
    chain: "arbitrum",
    symbol: "USDT",
    tokenName: "Tether USD",
    decimals: "6",
    isWhitelisted: true,
    coingeckoId: "tether",
  },
  {
    address: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1",
    chain: "arbitrum",
    symbol: "WETH",
    tokenName: "Wrapped Ether",
    decimals: "18",
    isWhitelisted: true,
    coingeckoId: "weth",
  },
  {
    address: "0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1",
    chain: "arbitrum",
    symbol: "DAI",
    tokenName: "Dai Stablecoin",
    decimals: "18",
    isWhitelisted: true,
    coingeckoId: "dai",
  },

  // ============ Polygon ============
  {
    address: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359",
    chain: "polygon",
    symbol: "USDC",
    tokenName: "USD Coin",
    decimals: "6",
    isWhitelisted: true,
    coingeckoId: "usd-coin",
  },
  {
    address: "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174",
    chain: "polygon",
    symbol: "USDC.e",
    tokenName: "Bridged USDC",
    decimals: "6",
    isWhitelisted: true,
    coingeckoId: "usd-coin",
  },
  {
    address: "0xc2132D05D31c914a87C6611C10748AEb04B58e8F",
    chain: "polygon",
    symbol: "USDT",
    tokenName: "Tether USD",
    decimals: "6",
    isWhitelisted: true,
    coingeckoId: "tether",
  },
  {
    address: "0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619",
    chain: "polygon",
    symbol: "WETH",
    tokenName: "Wrapped Ether",
    decimals: "18",
    isWhitelisted: true,
    coingeckoId: "weth",
  },
  {
    address: "0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063",
    chain: "polygon",
    symbol: "DAI",
    tokenName: "Dai Stablecoin",
    decimals: "18",
    isWhitelisted: true,
    coingeckoId: "dai",
  },

  // ============ BNB Chain ============
  {
    address: "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d",
    chain: "bsc",
    symbol: "USDC",
    tokenName: "USD Coin",
    decimals: "18",
    isWhitelisted: true,
    coingeckoId: "usd-coin",
  },
  {
    address: "0x55d398326f99059fF775485246999027B3197955",
    chain: "bsc",
    symbol: "USDT",
    tokenName: "Tether USD",
    decimals: "18",
    isWhitelisted: true,
    coingeckoId: "tether",
  },
  {
    address: "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c",
    chain: "bsc",
    symbol: "WBNB",
    tokenName: "Wrapped BNB",
    decimals: "18",
    isWhitelisted: true,
    coingeckoId: "wbnb",
  },
  {
    address: "0x2170Ed0880ac9A755fd29B2688956BD959F933F8",
    chain: "bsc",
    symbol: "ETH",
    tokenName: "Binance-Peg Ethereum",
    decimals: "18",
    isWhitelisted: true,
    coingeckoId: "ethereum",
  },

  // ============ Optimism ============
  {
    address: "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85",
    chain: "optimism",
    symbol: "USDC",
    tokenName: "USD Coin",
    decimals: "6",
    isWhitelisted: true,
    coingeckoId: "usd-coin",
  },
  {
    address: "0x94b008aA00579c1307B0EF2c499aD98a8ce58e58",
    chain: "optimism",
    symbol: "USDT",
    tokenName: "Tether USD",
    decimals: "6",
    isWhitelisted: true,
    coingeckoId: "tether",
  },
  {
    address: "0x4200000000000000000000000000000000000006",
    chain: "optimism",
    symbol: "WETH",
    tokenName: "Wrapped Ether",
    decimals: "18",
    isWhitelisted: true,
    coingeckoId: "weth",
  },
  {
    address: "0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1",
    chain: "optimism",
    symbol: "DAI",
    tokenName: "Dai Stablecoin",
    decimals: "18",
    isWhitelisted: true,
    coingeckoId: "dai",
  },

  // ============ Linea ============
  {
    address: "0x176211869cA2b568f2A7D4EE941E073a821EE1ff",
    chain: "linea",
    symbol: "USDC",
    tokenName: "USD Coin",
    decimals: "6",
    isWhitelisted: true,
    coingeckoId: "usd-coin",
  },
  {
    address: "0xA219439258ca9da29E9Cc4cE5596924745e12B93",
    chain: "linea",
    symbol: "USDT",
    tokenName: "Tether USD",
    decimals: "6",
    isWhitelisted: true,
    coingeckoId: "tether",
  },
  {
    address: "0xe5D7C2a44FfDDf6b295A15c148167daaAf5Cf34f",
    chain: "linea",
    symbol: "WETH",
    tokenName: "Wrapped Ether",
    decimals: "18",
    isWhitelisted: true,
    coingeckoId: "weth",
  },

  // ============ Solana (SPL Tokens) ============
  {
    address: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    chain: "solana",
    symbol: "USDC",
    tokenName: "USD Coin",
    decimals: "6",
    isWhitelisted: true,
    coingeckoId: "usd-coin",
  },
  {
    address: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",
    chain: "solana",
    symbol: "USDT",
    tokenName: "Tether USD",
    decimals: "6",
    isWhitelisted: true,
    coingeckoId: "tether",
  },
  {
    address: "So11111111111111111111111111111111111111112",
    chain: "solana",
    symbol: "SOL",
    tokenName: "Wrapped SOL",
    decimals: "9",
    isWhitelisted: true,
    coingeckoId: "solana",
  },
];

// ============================================================================
// Test User (development only)
// ============================================================================

const TEST_USER: NewUser = {
  walletAddress: "0x742d35Cc6634C0532925a3b844Bc9e7595f1D123",
  smartWalletAddress: "0x1234567890123456789012345678901234567890",
  settings: {
    defaultOutputToken: "USDC",
    defaultChain: "base",
    slippageTolerance: 0.5,
    autoSweepEnabled: false,
  },
};

// ============================================================================
// Seed Function
// ============================================================================

async function seed() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    console.error("❌ DATABASE_URL environment variable is not set");
    process.exit(1);
  }

  console.log("🌱 Starting database seed...");
  console.log(`📍 Database: ${databaseUrl.replace(/:[^:@]+@/, ":****@")}`);

  const client = postgres(databaseUrl);
  const db = drizzle(client);

  try {
    // Seed whitelist tokens
    console.log("\n📝 Seeding whitelist tokens...");
    
    let insertedTokens = 0;
    let skippedTokens = 0;

    for (const token of WHITELIST_TOKENS) {
      try {
        await db
          .insert(tokens)
          .values(token)
          .onConflictDoUpdate({
            target: [tokens.address, tokens.chain],
            set: {
              symbol: token.symbol,
              tokenName: token.tokenName,
              decimals: token.decimals,
              isWhitelisted: token.isWhitelisted,
              coingeckoId: token.coingeckoId,
              updatedAt: new Date(),
            },
          });
        insertedTokens++;
      } catch (error) {
        skippedTokens++;
        console.warn(`   ⚠️ Skipped ${token.symbol} on ${token.chain}`);
      }
    }

    console.log(`   ✅ Inserted/updated ${insertedTokens} tokens`);
    if (skippedTokens > 0) {
      console.log(`   ⚠️ Skipped ${skippedTokens} tokens`);
    }

    // Seed test user in development
    if (process.env.NODE_ENV === "development") {
      console.log("\n👤 Seeding test user (development mode)...");

      try {
        await db
          .insert(users)
          .values(TEST_USER)
          .onConflictDoNothing();
        console.log(`   ✅ Test user created: ${TEST_USER.walletAddress}`);
      } catch (error) {
        console.log("   ⚠️ Test user already exists or failed to create");
      }
    }

    console.log("\n✅ Database seeding completed!");

    // Summary
    console.log("\n📊 Summary:");
    console.log(`   Tokens: ${insertedTokens} inserted/updated`);
    console.log(`   Chains covered: ethereum, base, arbitrum, polygon, bsc, optimism, linea, solana`);

  } catch (error) {
    console.error("❌ Seeding failed:", error);
    process.exit(1);
  } finally {
    await client.end();
    console.log("\n🔌 Database connection closed");
  }
}

// Run seed
seed();
