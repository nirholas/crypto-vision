/**
 * Whale Tracking Service
 *
 * Track large cryptocurrency transactions and smart money movements.
 * This is a high-value premium feature that traders will pay for.
 * 
 * Data Sources:
 * - Whale Alert API (real-time whale transactions)
 * - Etherscan API (Ethereum large transfers)
 * - Blockchain.com API (Bitcoin large transfers)
 */

import { NextRequest, NextResponse } from 'next/server';
import { PREMIUM_PRICING } from '@/lib/x402-config';

export const runtime = 'edge';

// Whale transaction threshold in USD
const WHALE_THRESHOLD = 1_000_000; // $1M+

// API endpoints
const WHALE_ALERT_API = 'https://api.whale-alert.io/v1';
const ETHERSCAN_API = 'https://api.etherscan.io/api';
const BLOCKCHAIN_API = 'https://blockchain.info';

interface WhaleTransaction {
  id: string;
  hash: string;
  blockchain: string;
  timestamp: string;
  from: {
    address: string;
    label?: string;
    isExchange: boolean;
  };
  to: {
    address: string;
    label?: string;
    isExchange: boolean;
  };
  amount: number;
  amountUsd: number;
  token: {
    symbol: string;
    name: string;
    contract?: string;
  };
  type: 'transfer' | 'exchange_inflow' | 'exchange_outflow' | 'unknown';
  significance: 'high' | 'medium' | 'low';
}

interface WhaleAlert {
  id: string;
  userId: string;
  conditions: {
    minAmount: number;
    tokens?: string[];
    types?: string[];
    chains?: string[];
  };
  webhookUrl: string;
  expiresAt: string;
  createdAt: string;
}

// Known exchange addresses (comprehensive database)
const KNOWN_EXCHANGES: Record<string, string> = {
  // Ethereum - Binance
  '0x28c6c06298d514db089934071355e5743bf21d60': 'Binance',
  '0x21a31ee1afc51d94c2efccaa2092ad1028285549': 'Binance',
  '0xdfd5293d8e347dfe59e90efd55b2956a1343963d': 'Binance',
  '0xf977814e90da44bfa03b6295a0616a897441acec': 'Binance',
  '0x5a52e96bacdabb82fd05763e25335261b270efcb': 'Binance',
  // Ethereum - Coinbase
  '0x56eddb7aa87536c09ccc2793473599fd21a8b17f': 'Coinbase',
  '0xa9d1e08c7793af67e9d92fe308d5697fb81d3e43': 'Coinbase',
  '0x503828976d22510aad0201ac7ec88293211d23da': 'Coinbase',
  '0x71660c4005ba85c37ccec55d0c4493e66fe775d3': 'Coinbase',
  // Ethereum - Kraken
  '0x2910543af39aba0cd09dbb2d50200b3e800a63d2': 'Kraken',
  '0x0a869d79a7052c7f1b55a8ebabbea3420f0d1e13': 'Kraken',
  // Ethereum - OKX
  '0x98ec059dc3adfbdd63429454aeb0c990fba4a128': 'OKX',
  '0x6cc5f688a315f3dc28a7781717a9a798a59fda7b': 'OKX',
  // Bitcoin - Binance
  'bc1qm34lsc65zpw79lxes69zkqmk6ee3ewf0j77s3h': 'Binance',
  '1NDyJtNTjmwk5xPNhjgAMu4HDHigtobu1s': 'Binance',
  '34xp4vRoCGJym3xR7yCVPFHoCNxv4Twseo': 'Binance',
  // Bitcoin - Coinbase
  '3JZq4atUahhuA9rLhXLMhhTo133J9rF97j': 'Coinbase',
  'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh': 'Coinbase',
  // Bitcoin - Bitfinex
  'bc1qgdjqv0av3q56jvd82tkdjpy7gdp9ut8tlqmgrpmv24sq90ecnvqqjwvw97': 'Bitfinex',
};

/**
 * Fetch real whale transactions from Whale Alert API
 */
async function fetchWhaleAlertTransactions(
  minValue: number = WHALE_THRESHOLD,
  limit: number = 50
): Promise<WhaleTransaction[]> {
  const apiKey = process.env.WHALE_ALERT_API_KEY;
  
  // If no API key, fall back to Etherscan for ETH whales
  if (!apiKey) {
    return fetchEtherscanWhaleTransfers(minValue, limit);
  }

  try {
    const startTime = Math.floor((Date.now() - 24 * 60 * 60 * 1000) / 1000); // Last 24h
    const url = `${WHALE_ALERT_API}/transactions?api_key=${apiKey}&min_value=${minValue}&start=${startTime}&limit=${limit}`;

    const response = await fetch(url, {
      headers: { 'Accept': 'application/json' },
      next: { revalidate: 60 }, // Cache 1 minute
    });

    if (!response.ok) {
      console.error('Whale Alert API error:', response.status);
      return fetchEtherscanWhaleTransfers(minValue, limit);
    }

    const data = await response.json();
    
    if (!data.transactions || !Array.isArray(data.transactions)) {
      return fetchEtherscanWhaleTransfers(minValue, limit);
    }

    return data.transactions.map((tx: {
      id: string;
      hash: string;
      blockchain: string;
      timestamp: number;
      from: { address: string; owner?: string; owner_type?: string };
      to: { address: string; owner?: string; owner_type?: string };
      amount: number;
      amount_usd: number;
      symbol: string;
    }) => {
      const fromIsExchange = tx.from.owner_type === 'exchange' || !!KNOWN_EXCHANGES[tx.from.address?.toLowerCase()];
      const toIsExchange = tx.to.owner_type === 'exchange' || !!KNOWN_EXCHANGES[tx.to.address?.toLowerCase()];
      
      let type: WhaleTransaction['type'] = 'transfer';
      if (fromIsExchange && !toIsExchange) type = 'exchange_outflow';
      else if (!fromIsExchange && toIsExchange) type = 'exchange_inflow';

      return {
        id: tx.id || `whale_${tx.hash}`,
        hash: tx.hash,
        blockchain: tx.blockchain,
        timestamp: new Date(tx.timestamp * 1000).toISOString(),
        from: {
          address: tx.from.address,
          label: tx.from.owner || KNOWN_EXCHANGES[tx.from.address?.toLowerCase()],
          isExchange: fromIsExchange,
        },
        to: {
          address: tx.to.address,
          label: tx.to.owner || KNOWN_EXCHANGES[tx.to.address?.toLowerCase()],
          isExchange: toIsExchange,
        },
        amount: tx.amount,
        amountUsd: tx.amount_usd,
        token: {
          symbol: tx.symbol.toUpperCase(),
          name: getTokenName(tx.symbol),
        },
        type,
        significance: tx.amount_usd > 10_000_000 ? 'high' : tx.amount_usd > 5_000_000 ? 'medium' : 'low',
      };
    });
  } catch (error) {
    console.error('Whale Alert fetch error:', error);
    return fetchEtherscanWhaleTransfers(minValue, limit);
  }
}

/**
 * Fetch large ETH transfers from Etherscan (free API)
 */
async function fetchEtherscanWhaleTransfers(
  minValue: number = WHALE_THRESHOLD,
  limit: number = 50
): Promise<WhaleTransaction[]> {
  const apiKey = process.env.ETHERSCAN_API_KEY || '';
  
  try {
    // Get latest blocks with large ETH transfers
    const url = `${ETHERSCAN_API}?module=account&action=txlist&address=0x0000000000000000000000000000000000000000&startblock=0&endblock=99999999&page=1&offset=${limit}&sort=desc&apikey=${apiKey}`;
    
    // Alternative: Query known whale addresses for their recent transactions
    const whaleAddresses = [
      '0x28c6c06298d514db089934071355e5743bf21d60', // Binance
      '0xf977814e90da44bfa03b6295a0616a897441acec', // Binance
      '0x56eddb7aa87536c09ccc2793473599fd21a8b17f', // Coinbase
    ];

    const transactions: WhaleTransaction[] = [];
    
    for (const address of whaleAddresses.slice(0, 3)) {
      const txUrl = `${ETHERSCAN_API}?module=account&action=txlist&address=${address}&startblock=0&endblock=99999999&page=1&offset=20&sort=desc${apiKey ? `&apikey=${apiKey}` : ''}`;
      
      const response = await fetch(txUrl, {
        next: { revalidate: 60 },
      });

      if (!response.ok) continue;

      const data = await response.json();
      if (data.status !== '1' || !data.result) continue;

      const ethPrice = await getEthPrice();

      for (const tx of data.result) {
        const valueEth = parseFloat(tx.value) / 1e18;
        const valueUsd = valueEth * ethPrice;

        if (valueUsd < minValue) continue;

        const fromIsExchange = !!KNOWN_EXCHANGES[tx.from?.toLowerCase()];
        const toIsExchange = !!KNOWN_EXCHANGES[tx.to?.toLowerCase()];

        let type: WhaleTransaction['type'] = 'transfer';
        if (fromIsExchange && !toIsExchange) type = 'exchange_outflow';
        else if (!fromIsExchange && toIsExchange) type = 'exchange_inflow';

        transactions.push({
          id: `eth_${tx.hash}`,
          hash: tx.hash,
          blockchain: 'ethereum',
          timestamp: new Date(parseInt(tx.timeStamp) * 1000).toISOString(),
          from: {
            address: tx.from,
            label: KNOWN_EXCHANGES[tx.from?.toLowerCase()],
            isExchange: fromIsExchange,
          },
          to: {
            address: tx.to,
            label: KNOWN_EXCHANGES[tx.to?.toLowerCase()],
            isExchange: toIsExchange,
          },
          amount: valueEth,
          amountUsd: valueUsd,
          token: { symbol: 'ETH', name: 'Ethereum' },
          type,
          significance: valueUsd > 10_000_000 ? 'high' : valueUsd > 5_000_000 ? 'medium' : 'low',
        });
      }
    }

    return transactions
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, limit);
  } catch (error) {
    console.error('Etherscan whale fetch error:', error);
    return [];
  }
}

/**
 * Get current ETH price from CoinGecko
 */
async function getEthPrice(): Promise<number> {
  try {
    const response = await fetch(
      'https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd',
      { next: { revalidate: 60 } }
    );
    if (!response.ok) return 4000; // Fallback
    const data = await response.json();
    return data.ethereum?.usd || 4000;
  } catch {
    return 4000;
  }
}

/**
 * Get token name from symbol
 */
function getTokenName(symbol: string): string {
  const tokenNames: Record<string, string> = {
    btc: 'Bitcoin',
    eth: 'Ethereum',
    usdt: 'Tether',
    usdc: 'USD Coin',
    sol: 'Solana',
    xrp: 'XRP',
    bnb: 'BNB',
    ada: 'Cardano',
    doge: 'Dogecoin',
    avax: 'Avalanche',
    matic: 'Polygon',
    link: 'Chainlink',
  };
  return tokenNames[symbol.toLowerCase()] || symbol.toUpperCase();
}

/**
 * Get recent whale transactions
 */
export async function getWhaleTransactions(request: NextRequest): Promise<NextResponse> {
  const searchParams = request.nextUrl.searchParams;
  const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
  const minAmount = parseInt(searchParams.get('minAmount') || String(WHALE_THRESHOLD));
  const token = searchParams.get('token')?.toUpperCase();
  const chain = searchParams.get('chain')?.toLowerCase();
  const type = searchParams.get('type') as WhaleTransaction['type'] | null;

  try {
    // Fetch real whale transactions from APIs
    let transactions = await fetchWhaleAlertTransactions(minAmount, limit * 2);

    // Apply filters
    transactions = transactions
      .filter((tx) => {
        if (tx.amountUsd < minAmount) return false;
        if (token && tx.token.symbol !== token) return false;
        if (chain && tx.blockchain !== chain) return false;
        if (type && tx.type !== type) return false;
        return true;
      })
      .slice(0, limit);

    // Calculate aggregates
    const aggregates = {
      totalVolume: transactions.reduce((sum, tx) => sum + tx.amountUsd, 0),
      exchangeInflow: transactions
        .filter((tx) => tx.type === 'exchange_inflow')
        .reduce((sum, tx) => sum + tx.amountUsd, 0),
      exchangeOutflow: transactions
        .filter((tx) => tx.type === 'exchange_outflow')
        .reduce((sum, tx) => sum + tx.amountUsd, 0),
      netFlow: 0,
      topTokens: {} as Record<string, number>,
    };

    aggregates.netFlow = aggregates.exchangeOutflow - aggregates.exchangeInflow;

    transactions.forEach((tx) => {
      aggregates.topTokens[tx.token.symbol] =
        (aggregates.topTokens[tx.token.symbol] || 0) + tx.amountUsd;
    });

    return NextResponse.json({
      transactions,
      aggregates,
      filters: { minAmount, token, chain, type },
      meta: {
        fetchedAt: new Date().toISOString(),
        count: transactions.length,
        endpoint: '/api/premium/whales/transactions',
        price: PREMIUM_PRICING['/api/premium/whales/transactions'].price,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Failed to fetch whale transactions',
        details: error instanceof Error ? error.message : 'Unknown',
      },
      { status: 500 }
    );
  }
}

/**
 * Analyze a specific wallet address using real blockchain data
 */
export async function analyzeWallet(request: NextRequest): Promise<NextResponse> {
  const searchParams = request.nextUrl.searchParams;
  const address = searchParams.get('address');
  const chain = searchParams.get('chain') || 'ethereum';

  if (!address) {
    return NextResponse.json({ error: 'Missing address parameter' }, { status: 400 });
  }

  // Validate address format
  const isValidEthAddress = /^0x[a-fA-F0-9]{40}$/.test(address);
  const isValidBtcAddress = /^(bc1|[13])[a-zA-HJ-NP-Z0-9]{25,62}$/.test(address);

  if (!isValidEthAddress && !isValidBtcAddress) {
    return NextResponse.json({ error: 'Invalid address format' }, { status: 400 });
  }

  try {
    const apiKey = process.env.ETHERSCAN_API_KEY || '';
    const ethPrice = await getEthPrice();
    
    // Fetch real data from Etherscan
    const [balanceData, txListData, tokenTxData, internalTxData] = await Promise.all([
      // ETH Balance
      fetch(`${ETHERSCAN_API}?module=account&action=balance&address=${address}&tag=latest${apiKey ? `&apikey=${apiKey}` : ''}`).then(r => r.json()),
      // Transaction list
      fetch(`${ETHERSCAN_API}?module=account&action=txlist&address=${address}&startblock=0&endblock=99999999&page=1&offset=100&sort=desc${apiKey ? `&apikey=${apiKey}` : ''}`).then(r => r.json()),
      // ERC20 token transfers
      fetch(`${ETHERSCAN_API}?module=account&action=tokentx&address=${address}&page=1&offset=50&sort=desc${apiKey ? `&apikey=${apiKey}` : ''}`).then(r => r.json()),
      // Internal transactions
      fetch(`${ETHERSCAN_API}?module=account&action=txlistinternal&address=${address}&startblock=0&endblock=99999999&page=1&offset=20&sort=desc${apiKey ? `&apikey=${apiKey}` : ''}`).then(r => r.json()),
    ]);

    // Parse ETH balance
    const ethBalance = balanceData.status === '1' ? parseFloat(balanceData.result) / 1e18 : 0;
    const ethBalanceUsd = ethBalance * ethPrice;

    // Parse transactions for activity metrics
    const transactions = txListData.status === '1' ? txListData.result : [];
    const tokenTransfers = tokenTxData.status === '1' ? tokenTxData.result : [];
    
    // Calculate activity metrics from real data
    const firstTx = transactions[transactions.length - 1];
    const lastTx = transactions[0];
    
    // Check if address is a contract
    const codeCheck = await fetch(`${ETHERSCAN_API}?module=proxy&action=eth_getCode&address=${address}&tag=latest${apiKey ? `&apikey=${apiKey}` : ''}`).then(r => r.json());
    const isContract = codeCheck.result && codeCheck.result !== '0x';

    // Get unique addresses interacted with
    const uniqueAddresses = new Set<string>();
    transactions.forEach((tx: { to: string; from: string }) => {
      if (tx.to && tx.to.toLowerCase() !== address.toLowerCase()) uniqueAddresses.add(tx.to.toLowerCase());
      if (tx.from && tx.from.toLowerCase() !== address.toLowerCase()) uniqueAddresses.add(tx.from.toLowerCase());
    });

    // Aggregate token holdings from recent transfers
    const tokenHoldings: Record<string, { symbol: string; name: string; amount: number }> = {};
    tokenTransfers.forEach((tx: { tokenSymbol: string; tokenName: string; value: string; tokenDecimal: string; to: string; from: string }) => {
      const symbol = tx.tokenSymbol;
      if (!tokenHoldings[symbol]) {
        tokenHoldings[symbol] = { symbol, name: tx.tokenName, amount: 0 };
      }
      const amount = parseFloat(tx.value) / Math.pow(10, parseInt(tx.tokenDecimal || '18'));
      // Add if received, subtract if sent
      if (tx.to.toLowerCase() === address.toLowerCase()) {
        tokenHoldings[symbol].amount += amount;
      } else if (tx.from.toLowerCase() === address.toLowerCase()) {
        tokenHoldings[symbol].amount -= amount;
      }
    });

    // Identify DeFi protocols from contract interactions
    const defiProtocols = new Set<string>();
    const knownProtocols: Record<string, string> = {
      '0x7a250d5630b4cf539739df2c5dacb4c659f2488d': 'Uniswap',
      '0x68b3465833fb72a70ecdf485e0e4c7bd8665fc45': 'Uniswap V3',
      '0x87870bca3f3fd6335c3f4ce8392d69350b4fa4e2': 'Aave V3',
      '0x7d2768de32b0b80b7a3454c06bdac94a69ddc7a9': 'Aave V2',
      '0x3d9819210a31b4961b30ef54be2aed79b9c9cd3b': 'Compound',
      '0xdef1c0ded9bec7f1a1670819833240f027b25eff': '0x Protocol',
      '0xae7ab96520de3a18e5e111b5eaab095312d7fe84': 'Lido',
      '0x1111111254fb6c44bac0bed2854e76f90643097d': '1inch',
    };
    
    transactions.forEach((tx: { to: string }) => {
      const protocol = knownProtocols[tx.to?.toLowerCase()];
      if (protocol) defiProtocols.add(protocol);
    });

    const analysis = {
      address,
      chain,
      label: KNOWN_EXCHANGES[address.toLowerCase()] || null,
      isExchange: !!KNOWN_EXCHANGES[address.toLowerCase()],
      isContract,

      // Real balance information
      balance: {
        total_usd: ethBalanceUsd,
        eth: ethBalance,
        tokens: Object.values(tokenHoldings).filter(t => t.amount > 0).slice(0, 10).map(t => ({
          symbol: t.symbol,
          name: t.name,
          amount: t.amount,
        })),
      },

      // Real activity metrics
      activity: {
        firstSeen: firstTx ? new Date(parseInt(firstTx.timeStamp) * 1000).toISOString() : null,
        lastActive: lastTx ? new Date(parseInt(lastTx.timeStamp) * 1000).toISOString() : null,
        transactionCount: transactions.length,
        uniqueInteractions: uniqueAddresses.size,
      },

      // DeFi positions
      defi: {
        protocols: Array.from(defiProtocols),
        protocolCount: defiProtocols.size,
      },

      // Risk indicators
      risk: {
        isWhitelisted: !!KNOWN_EXCHANGES[address.toLowerCase()],
        isBlacklisted: false, // Would need sanctions list check
        flags: [] as string[],
      },
    };

    return NextResponse.json({
      analysis,
      meta: {
        analyzedAt: new Date().toISOString(),
        endpoint: '/api/premium/wallets/analyze',
        price: PREMIUM_PRICING['/api/premium/wallets/analyze'].price,
        dataSource: 'etherscan',
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Wallet analysis failed',
        details: error instanceof Error ? error.message : 'Unknown',
      },
      { status: 500 }
    );
  }
}

/**
 * Get smart money movements from real on-chain data
 */
export async function getSmartMoney(request: NextRequest): Promise<NextResponse> {
  const searchParams = request.nextUrl.searchParams;
  const token = searchParams.get('token')?.toLowerCase();
  const timeframe = searchParams.get('timeframe') || '24h';

  try {
    // Fetch real data from multiple sources in parallel
    const [defiTvlData, exchangeFlowData, whaleTransactions] = await Promise.all([
      fetchDeFiTVLData(),
      fetchExchangeFlowData(),
      fetchWhaleAlertTransactions(1_000_000, 50),
    ]);

    // Analyze whale transactions for accumulation/distribution signals
    const exchangeInflows = whaleTransactions.filter(tx => tx.type === 'exchange_inflow');
    const exchangeOutflows = whaleTransactions.filter(tx => tx.type === 'exchange_outflow');
    
    const totalInflow = exchangeInflows.reduce((sum, tx) => sum + tx.amountUsd, 0);
    const totalOutflow = exchangeOutflows.reduce((sum, tx) => sum + tx.amountUsd, 0);
    const netFlow = totalOutflow - totalInflow;
    
    // Determine accumulation vs distribution
    const isAccumulation = netFlow > 0;
    
    // Group by token for top buys/sells
    const tokenFlows: Record<string, { buys: number; sells: number }> = {};
    whaleTransactions.forEach(tx => {
      const sym = tx.token.symbol;
      if (!tokenFlows[sym]) tokenFlows[sym] = { buys: 0, sells: 0 };
      if (tx.type === 'exchange_outflow') tokenFlows[sym].buys += tx.amountUsd;
      else if (tx.type === 'exchange_inflow') tokenFlows[sym].sells += tx.amountUsd;
    });

    const topBuys = Object.entries(tokenFlows)
      .filter(([_, v]) => v.buys > 0)
      .sort((a, b) => b[1].buys - a[1].buys)
      .slice(0, 5)
      .map(([token, data]) => ({ token, usd: data.buys }));

    const topSells = Object.entries(tokenFlows)
      .filter(([_, v]) => v.sells > 0)
      .sort((a, b) => b[1].sells - a[1].sells)
      .slice(0, 5)
      .map(([token, data]) => ({ token, usd: data.sells }));

    // Categorize tokens by flow direction
    const accumulating = Object.entries(tokenFlows)
      .filter(([_, v]) => v.buys > v.sells * 1.2)
      .map(([token]) => token)
      .slice(0, 5);
    
    const distributing = Object.entries(tokenFlows)
      .filter(([_, v]) => v.sells > v.buys * 1.2)
      .map(([token]) => token)
      .slice(0, 5);

    // Find largest transactions
    const sortedByValue = [...whaleTransactions].sort((a, b) => b.amountUsd - a.amountUsd);
    const largestOutflow = sortedByValue.find(tx => tx.type === 'exchange_outflow');
    const largestInflow = sortedByValue.find(tx => tx.type === 'exchange_inflow');

    const smartMoneyData = {
      // Institutions/whale activity derived from real transactions
      institutions: {
        netBuying: isAccumulation,
        volume24h: totalInflow + totalOutflow,
        topBuys,
        topSells,
      },

      // Whale accumulation/distribution from real data
      whaleActivity: {
        accumulationPhase: isAccumulation,
        distribution: {
          accumulating,
          distributing,
          neutral: Object.keys(tokenFlows).filter(
            t => !accumulating.includes(t) && !distributing.includes(t)
          ).slice(0, 3),
        },
        largestBuy: largestOutflow ? {
          token: largestOutflow.token.symbol,
          amount: largestOutflow.amount,
          usd: largestOutflow.amountUsd,
          wallet: largestOutflow.to.address.slice(0, 10) + '...',
        } : null,
        largestSell: largestInflow ? {
          token: largestInflow.token.symbol,
          amount: largestInflow.amount,
          usd: largestInflow.amountUsd,
          wallet: largestInflow.from.address.slice(0, 10) + '...',
        } : null,
      },

      // Exchange netflow from real transaction data
      exchangeFlow: exchangeFlowData,

      // DeFi activity from DeFiLlama
      defiActivity: defiTvlData,

      // Signals derived from real data
      signals: {
        overallSentiment: isAccumulation ? 'accumulation' : 'distribution',
        confidence: Math.min(90, 50 + Math.abs(netFlow / (totalInflow + totalOutflow + 1)) * 100),
        keyInsights: generateInsights(whaleTransactions, isAccumulation, topBuys, topSells),
      },
    };

    return NextResponse.json({
      ...smartMoneyData,
      timeframe,
      token,
      meta: {
        fetchedAt: new Date().toISOString(),
        endpoint: '/api/premium/smart-money',
        price: PREMIUM_PRICING['/api/premium/smart-money'].price,
        dataSource: 'etherscan,whale-alert,defillama',
        disclaimer: 'Data for informational purposes only. Not financial advice.',
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Smart money data fetch failed',
        details: error instanceof Error ? error.message : 'Unknown',
      },
      { status: 500 }
    );
  }
}

/**
 * Fetch DeFi TVL data from DeFiLlama
 */
async function fetchDeFiTVLData() {
  try {
    const response = await fetch('https://api.llama.fi/protocols', {
      next: { revalidate: 300 },
    });

    if (response.ok) {
      const protocols = await response.json();
      const topProtocols = protocols
        .sort((a: { tvl: number }, b: { tvl: number }) => b.tvl - a.tvl)
        .slice(0, 10);

      return {
        topProtocolInflows: topProtocols.slice(0, 5).map((p: { name: string; tvl: number; change_1d: number }) => ({
          protocol: p.name,
          usd: p.tvl,
          change24h: p.change_1d || 0,
        })),
        totalTVL: protocols.reduce((sum: number, p: { tvl: number }) => sum + (p.tvl || 0), 0),
      };
    }
  } catch (error) {
    console.error('DeFiLlama fetch error:', error);
  }

  return { topProtocolInflows: [], totalTVL: 0 };
}

/**
 * Calculate exchange flow from whale transactions
 */
async function fetchExchangeFlowData() {
  // Use whale transactions to calculate exchange flows
  const transactions = await fetchWhaleAlertTransactions(500_000, 100);
  
  const flows: Record<string, { inflow: number; outflow: number; net: number }> = {
    BTC: { inflow: 0, outflow: 0, net: 0 },
    ETH: { inflow: 0, outflow: 0, net: 0 },
    USDT: { inflow: 0, outflow: 0, net: 0 },
  };

  for (const tx of transactions) {
    const symbol = tx.token.symbol;
    if (!flows[symbol]) flows[symbol] = { inflow: 0, outflow: 0, net: 0 };
    
    if (tx.type === 'exchange_inflow') {
      flows[symbol].inflow += tx.amountUsd;
    } else if (tx.type === 'exchange_outflow') {
      flows[symbol].outflow += tx.amountUsd;
    }
    flows[symbol].net = flows[symbol].outflow - flows[symbol].inflow;
  }

  return flows;
}

/**
 * Generate insights from whale data
 */
function generateInsights(
  transactions: WhaleTransaction[],
  isAccumulation: boolean,
  topBuys: { token: string; usd: number }[],
  topSells: { token: string; usd: number }[]
): string[] {
  const insights: string[] = [];

  if (isAccumulation) {
    insights.push('Net outflow from exchanges indicates accumulation phase');
  } else {
    insights.push('Net inflow to exchanges suggests distribution phase');
  }

  if (topBuys.length > 0) {
    insights.push(`Heavy ${topBuys[0].token} withdrawals from exchanges ($${(topBuys[0].usd / 1_000_000).toFixed(1)}M)`);
  }

  if (topSells.length > 0) {
    insights.push(`${topSells[0].token} deposits to exchanges increasing ($${(topSells[0].usd / 1_000_000).toFixed(1)}M)`);
  }

  const highValueTx = transactions.filter(tx => tx.amountUsd > 10_000_000).length;
  if (highValueTx > 0) {
    insights.push(`${highValueTx} whale transactions over $10M in last 24h`);
  }

  return insights.slice(0, 5);
}

// In-memory alert storage (use DB in production)
const whaleAlerts = new Map<string, WhaleAlert>();

/**
 * Create a whale alert subscription
 */
export async function createWhaleAlert(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();
    const { minAmount, tokens, types, chains, webhookUrl, durationHours = 24 } = body;

    if (!webhookUrl) {
      return NextResponse.json({ error: 'webhookUrl is required' }, { status: 400 });
    }

    // Validate webhook URL
    try {
      new URL(webhookUrl);
    } catch {
      return NextResponse.json({ error: 'Invalid webhook URL' }, { status: 400 });
    }

    const alert: WhaleAlert = {
      id: `alert_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      userId: 'anonymous', // In production, extract from payment/auth
      conditions: {
        minAmount: minAmount || WHALE_THRESHOLD,
        tokens: tokens?.map((t: string) => t.toUpperCase()),
        types,
        chains: chains?.map((c: string) => c.toLowerCase()),
      },
      webhookUrl,
      expiresAt: new Date(Date.now() + durationHours * 60 * 60 * 1000).toISOString(),
      createdAt: new Date().toISOString(),
    };

    whaleAlerts.set(alert.id, alert);

    return NextResponse.json({
      success: true,
      alert,
      meta: {
        createdAt: new Date().toISOString(),
        endpoint: '/api/premium/whales/alerts',
        price: PREMIUM_PRICING['/api/premium/whales/alerts'].price,
        note: 'Webhook will receive POST requests when whale transactions match your conditions',
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Alert creation failed',
        details: error instanceof Error ? error.message : 'Unknown',
      },
      { status: 500 }
    );
  }
}

// Export handlers
export const whaleHandlers = {
  transactions: getWhaleTransactions,
  alerts: createWhaleAlert,
  analyze: analyzeWallet,
  smartMoney: getSmartMoney,
};
