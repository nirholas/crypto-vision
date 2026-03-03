/**
 * URL Utilities
 * 
 * Centralized URL generation for SEO-friendly, consistent URLs throughout the app.
 * 
 * @module lib/urls
 */

// =============================================================================
// SYMBOL TO COINGECKO ID MAPPING
// =============================================================================

/**
 * Maps common ticker symbols to CoinGecko IDs
 * This is needed because CoinGecko uses different IDs than ticker symbols
 * 
 * Note: For coins not in this map, the symbol lowercase is used as fallback
 */
const SYMBOL_TO_ID: Record<string, string> = {
  // Top 50 by market cap
  'BTC': 'bitcoin',
  'ETH': 'ethereum',
  'USDT': 'tether',
  'BNB': 'binancecoin',
  'SOL': 'solana',
  'XRP': 'ripple',
  'USDC': 'usd-coin',
  'ADA': 'cardano',
  'AVAX': 'avalanche-2',
  'DOGE': 'dogecoin',
  'TRX': 'tron',
  'DOT': 'polkadot',
  'LINK': 'chainlink',
  'MATIC': 'matic-network',
  'POL': 'matic-network', // Polygon renamed
  'SHIB': 'shiba-inu',
  'TON': 'the-open-network',
  'DAI': 'dai',
  'LTC': 'litecoin',
  'BCH': 'bitcoin-cash',
  'ATOM': 'cosmos',
  'UNI': 'uniswap',
  'LEO': 'leo-token',
  'ETC': 'ethereum-classic',
  'XLM': 'stellar',
  'OKB': 'okb',
  'XMR': 'monero',
  'HBAR': 'hedera-hashgraph',
  'FIL': 'filecoin',
  'APT': 'aptos',
  'CRO': 'crypto-com-chain',
  'MKR': 'maker',
  'LDO': 'lido-dao',
  'VET': 'vechain',
  'INJ': 'injective-protocol',
  'ARB': 'arbitrum',
  'OP': 'optimism',
  'NEAR': 'near',
  'AAVE': 'aave',
  'GRT': 'the-graph',
  'ALGO': 'algorand',
  'RUNE': 'thorchain',
  'QNT': 'quant-network',
  'FTM': 'fantom',
  'EGLD': 'elrond-erd-2',
  'SAND': 'the-sandbox',
  'MANA': 'decentraland',
  'AXS': 'axie-infinity',
  'THETA': 'theta-token',
  'EOS': 'eos',
  'XTZ': 'tezos',
  'FLOW': 'flow',
  'NEO': 'neo',
  'SNX': 'synthetix-network-token',
  'CHZ': 'chiliz',
  'KAVA': 'kava',
  'CAKE': 'pancakeswap-token',
  'ZEC': 'zcash',
  'MINA': 'mina-protocol',
  'XDC': 'xdce-crowd-sale',
  'IOTA': 'iota',
  'CRV': 'curve-dao-token',
  'PEPE': 'pepe',
  'WIF': 'dogwifcoin',
  'FLOKI': 'floki',
  'BONK': 'bonk',
  'RENDER': 'render-token',
  'FET': 'fetch-ai',
  'RNDR': 'render-token',
  'IMX': 'immutable-x',
  'SUI': 'sui',
  'SEI': 'sei-network',
  'TIA': 'celestia',
  'JUP': 'jupiter',
  'PYTH': 'pyth-network',
  'STX': 'blockstack',
  'WLD': 'worldcoin-wld',
  'BLUR': 'blur',
  'ORDI': 'ordi',
  'WOO': 'woo-network',
  'GMT': 'stepn',
  'APE': 'apecoin',
  'COMP': 'compound-governance-token',
  'RPL': 'rocket-pool',
  'GMX': 'gmx',
  'ENS': 'ethereum-name-service',
  '1INCH': '1inch',
  'SUSHI': 'sushi',
  'BAT': 'basic-attention-token',
  'YFI': 'yearn-finance',
  'GALA': 'gala',
  'ILV': 'illuvium',
  'ZIL': 'zilliqa',
  'KCS': 'kucoin-shares',
  'KLAY': 'klay-token',
  'CFX': 'conflux-token',
  'ROSE': 'oasis-network',
  'CELO': 'celo',
  'ONE': 'harmony',
  'KSM': 'kusama',
  'WAVES': 'waves',
  'ICX': 'icon',
  'ZRX': '0x',
  'LRC': 'loopring',
  'ENJ': 'enjincoin',
  'AUDIO': 'audius',
  'SUPER': 'superfarm',
  'MASK': 'mask-network',
};

/**
 * Normalize a coin identifier to a CoinGecko-compatible ID
 * 
 * @param identifier - Symbol (BTC), ID (bitcoin), or name (Bitcoin)
 * @returns CoinGecko-compatible ID
 */
export function normalizeCoinId(identifier: string): string {
  if (!identifier) return '';
  
  const upper = identifier.toUpperCase();
  const lower = identifier.toLowerCase();
  
  // Check if it's a known symbol
  if (SYMBOL_TO_ID[upper]) {
    return SYMBOL_TO_ID[upper];
  }
  
  // Already a valid ID format (lowercase with hyphens)
  if (lower === identifier && /^[a-z0-9-]+$/.test(lower)) {
    return lower;
  }
  
  // Convert name to slug (e.g., "Bitcoin Cash" -> "bitcoin-cash")
  return lower
    .replace(/[^a-z0-9\s-]/g, '') // Remove special characters
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Collapse multiple hyphens
    .replace(/^-|-$/g, ''); // Trim hyphens from ends
}

// =============================================================================
// URL GENERATORS
// =============================================================================

/**
 * Get the URL for a coin page
 * 
 * @param coinIdOrSymbol - CoinGecko ID (bitcoin), symbol (BTC), or name
 * @returns URL path like "/coin/bitcoin"
 * 
 * @example
 * getCoinUrl('bitcoin') // => '/coin/bitcoin'
 * getCoinUrl('BTC') // => '/coin/bitcoin'
 * getCoinUrl('Bitcoin') // => '/coin/bitcoin'
 */
export function getCoinUrl(coinIdOrSymbol: string): string {
  const coinId = normalizeCoinId(coinIdOrSymbol);
  return `/coin/${coinId}`;
}

/**
 * Get the URL for a coin's chart
 */
export function getCoinChartUrl(coinIdOrSymbol: string): string {
  const coinId = normalizeCoinId(coinIdOrSymbol);
  return `/coin/${coinId}#chart`;
}

/**
 * Get the URL for comparing coins
 */
export function getCompareUrl(coin1: string, coin2: string): string {
  const id1 = normalizeCoinId(coin1);
  const id2 = normalizeCoinId(coin2);
  return `/compare?coins=${id1},${id2}`;
}

/**
 * Get URL for a category page
 */
export function getCategoryUrl(categoryId: string): string {
  const slug = categoryId.toLowerCase().replace(/\s+/g, '-');
  return `/markets/categories/${slug}`;
}

/**
 * Get URL for a topic page
 */
export function getTopicUrl(topic: string): string {
  const slug = topic.toLowerCase().replace(/\s+/g, '-');
  return `/topics/${slug}`;
}

/**
 * Get URL for a news source page
 */
export function getSourceUrl(source: string): string {
  const slug = source.toLowerCase().replace(/\s+/g, '-');
  return `/sources/${slug}`;
}

/**
 * Get URL for an article
 * Supports both legacy ID-only URLs and new SEO-friendly slugs
 * @param articleId - The article's unique identifier
 * @param title - Optional title for SEO-friendly slug generation
 */
export function getArticleUrl(articleId: string, title?: string): string {
  if (title) {
    // Generate SEO-friendly slug: title-slug-shortid
    const slug = title
      .toLowerCase()
      .trim()
      .replace(/['']/g, '')
      .replace(/[$]/g, '')
      .replace(/[&]/g, 'and')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .replace(/-+/g, '-')
      .slice(0, 60);
    const shortId = articleId.slice(0, 8);
    return `/article/${slug}-${shortId}`;
  }
  return `/article/${articleId}`;
}

/**
 * Get URL for the reader view of an article
 */
export function getReaderUrl(articleId: string): string {
  return `/read/${articleId}`;
}

/**
 * Get the API URL for a coin
 */
export function getCoinApiUrl(coinIdOrSymbol: string): string {
  const coinId = normalizeCoinId(coinIdOrSymbol);
  return `/api/market/coins/${coinId}`;
}

/**
 * Check if a string looks like a ticker symbol (uppercase, 2-10 chars)
 */
export function isTickerSymbol(str: string): boolean {
  return /^[A-Z0-9]{2,10}$/.test(str);
}

/**
 * Get symbol from coin ID if known
 */
export function getSymbolFromId(coinId: string): string | null {
  const lower = coinId.toLowerCase();
  for (const [symbol, id] of Object.entries(SYMBOL_TO_ID)) {
    if (id === lower) return symbol;
  }
  return null;
}

// =============================================================================
// EXPORTS
// =============================================================================

export const urls = {
  coin: getCoinUrl,
  coinChart: getCoinChartUrl,
  compare: getCompareUrl,
  category: getCategoryUrl,
  topic: getTopicUrl,
  source: getSourceUrl,
  article: getArticleUrl,
  reader: getReaderUrl,
  coinApi: getCoinApiUrl,
  normalize: normalizeCoinId,
  isSymbol: isTickerSymbol,
  getSymbol: getSymbolFromId,
};

export default urls;
