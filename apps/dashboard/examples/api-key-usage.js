/**
 * API Key Usage Example for Crypto Data Aggregator
 *
 * This example shows how to:
 * 1. Make authenticated requests with an API key
 * 2. Check your usage and rate limits
 * 3. Handle rate limit errors
 *
 * Get your API key at: https://free-crypto-news.vercel.app/developers
 */

const API_BASE = 'https://free-crypto-news.vercel.app';

// Get API key from environment
const API_KEY = process.env.CRYPTO_NEWS_API_KEY;

if (!API_KEY) {
  console.error('❌ Set CRYPTO_NEWS_API_KEY environment variable');
  console.log('   Get your free key at: https://free-crypto-news.vercel.app/developers');
  process.exit(1);
}

/**
 * Make an authenticated API request
 */
async function apiRequest(endpoint, options = {}) {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      'X-API-Key': API_KEY,
      Accept: 'application/json',
      ...options.headers,
    },
  });

  // Extract rate limit info
  const rateLimit = {
    limit: response.headers.get('X-RateLimit-Limit'),
    remaining: response.headers.get('X-RateLimit-Remaining'),
    resetAt: response.headers.get('X-RateLimit-Reset'),
  };

  // Handle rate limit exceeded
  if (response.status === 429) {
    const resetDate = new Date(parseInt(rateLimit.resetAt));
    throw new Error(`Rate limit exceeded. Resets at ${resetDate.toISOString()}`);
  }

  // Handle unauthorized
  if (response.status === 401) {
    throw new Error('Invalid API key');
  }

  // Handle payment required (shouldn't happen with valid API key)
  if (response.status === 402) {
    throw new Error('Payment required - API key may be invalid or expired');
  }

  const data = await response.json();
  return { data, rateLimit };
}

/**
 * Get API usage statistics
 */
async function getUsage() {
  const { data } = await apiRequest('/api/v1/usage');
  return data;
}

/**
 * Get top coins
 */
async function getCoins(limit = 10) {
  const { data, rateLimit } = await apiRequest(`/api/v1/coins?per_page=${limit}`);
  return { coins: data.data, rateLimit };
}

/**
 * Get historical data
 */
async function getHistorical(coinId, days = 30) {
  const { data, rateLimit } = await apiRequest(`/api/v1/historical/${coinId}?days=${days}`);
  return { historical: data, rateLimit };
}

// Main demo
async function main() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('          Crypto Data Aggregator - API Key Usage Demo          ');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`\n🔑 Using API key: ${API_KEY.substring(0, 12)}...`);

  try {
    // 1. Check usage
    console.log('\n📊 Checking API usage...');
    const usage = await getUsage();
    console.log(`   Tier: ${usage.tier}`);
    console.log(`   Used today: ${usage.usageToday}/${usage.limit}`);
    console.log(`   Remaining: ${usage.remaining}`);
    console.log(`   Resets at: ${usage.resetAt}`);

    // 2. Get top coins
    console.log('\n💰 Fetching top 5 coins...');
    const { coins, rateLimit } = await getCoins(5);

    for (const coin of coins) {
      const change = coin.price_change_percentage_24h;
      const emoji = change >= 0 ? '🟢' : '🔴';
      console.log(
        `   ${emoji} ${coin.name}: $${coin.current_price.toLocaleString()} (${change.toFixed(2)}%)`
      );
    }

    console.log(`\n   Rate limit: ${rateLimit.remaining}/${rateLimit.limit} remaining`);

    // 3. Get Bitcoin historical data
    console.log('\n📈 Fetching Bitcoin 7-day history...');
    const { historical } = await getHistorical('bitcoin', 7);

    if (historical.data?.prices) {
      const prices = historical.data.prices;
      const first = prices[0][1];
      const last = prices[prices.length - 1][1];
      const change = (((last - first) / first) * 100).toFixed(2);
      console.log(`   7-day change: ${change}%`);
      console.log(`   Data points: ${prices.length}`);
    }

    // 4. Final usage check
    console.log('\n📊 Final usage check...');
    const finalUsage = await getUsage();
    console.log(`   Requests used: ${finalUsage.usageToday}/${finalUsage.limit}`);
  } catch (error) {
    console.error(`\n❌ Error: ${error.message}`);

    if (error.message.includes('Rate limit')) {
      console.log('   💡 Tip: Upgrade to Pro for 10,000 requests/day');
    }
  }

  console.log('\n═══════════════════════════════════════════════════════════════');
}

main();
