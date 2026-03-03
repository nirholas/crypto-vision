/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
import { z } from 'zod';
import { ToolConfig } from './toolFactory.js';

// Collection of all tool configurations
export const allToolConfigs: ToolConfig<any>[] = [
    // Coin List Tool Configuration
    {
        name: 'get-coins',
        description:
            'Get comprehensive data about all cryptocurrencies: Price, market cap, and volume. Price changes (1h, 24h, 7d). Supply information. Trading metrics. Social links and metadata.',
        endpoint: '/coins',
        method: 'GET',
        parameters: {
            name: z.string().optional().describe('Search coins by name'),
            page: z.number().optional().describe('Page number').default(1),
            limit: z.number().optional().describe('Number of results per page').default(20),
            currency: z.string().optional().describe('Currency for price data').default('USD'),
            symbol: z.string().optional().describe('Get coins by symbol'),
            blockchains: z.string().optional().describe('Blockchain filters, separated by commas (e.g., ethereum,solana)'),
            includeRiskScore: z.string().optional().describe('Include risk score: true or false. Default - false'),
            categories: z.string().optional().describe('Category filters, separated by commas (e.g., memecoins,sports)'),
            sortBy: z.string().optional().describe('Field to sort by'),
            sortDir: z.enum(['asc', 'desc']).optional().describe('Sort direction'),

            // Market Cap filters
            'marketCap-greaterThan': z.number().optional().describe('Marketcap Greater Than'),
            'marketCap-equals': z.number().optional().describe('Marketcap Equals'),
            'marketCap-lessThan': z.number().optional().describe('Marketcap Less Than'),

            // Fully Diluted Valuation filters
            'fullyDilutedValuation-greaterThan': z.number().optional().describe('Fully Diluted Valuation Greater Than'),
            'fullyDilutedValuation-equals': z.number().optional().describe('Fully Diluted Valuation Equals'),
            'fullyDilutedValuation-lessThan': z.number().optional().describe('Fully Diluted Valuation Less Than'),

            // Volume filters
            'volume-greaterThan': z.number().optional().describe('Volume Greater Than'),
            'volume-equals': z.number().optional().describe('Volume Equals'),
            'volume-lessThan': z.number().optional().describe('Volume Less Than'),

            // Price Change filters
            'priceChange1h-greaterThan': z.number().optional().describe('Price Change 1h Greater Than'),
            'priceChange1h-equals': z.number().optional().describe('Price Change 1h Equals'),
            'priceChange1h-lessThan': z.number().optional().describe('Price Change 1h Less Than'),

            'priceChange1d-greaterThan': z.number().optional().describe('Price Change 1d Greater Than'),
            'priceChange1d-equals': z.number().optional().describe('Price Change 1d Equals'),
            'priceChange1d-lessThan': z.number().optional().describe('Price Change 1d Less Than'),

            'priceChange7d-greaterThan': z.number().optional().describe('Price Change 7d Greater Than'),
            'priceChange7d-equals': z.number().optional().describe('Price Change 7d Equals'),
            'priceChange7d-lessThan': z.number().optional().describe('Price Change 7d Less Than'),

            // Supply filters
            'availableSupply-greaterThan': z.number().optional().describe('Available Supply Greater Than'),
            'availableSupply-equals': z.number().optional().describe('Available Supply Equals'),
            'availableSupply-lessThan': z.number().optional().describe('Available Supply Less Than'),

            'totalSupply-greaterThan': z.number().optional().describe('Total Supply Greater Than'),
            'totalSupply-equals': z.number().optional().describe('Total Supply Equals'),
            'totalSupply-lessThan': z.number().optional().describe('Total Supply Less Than'),

            // Rank filters
            'rank-greaterThan': z.number().optional().describe('Rank Greater Than'),
            'rank-equals': z.number().optional().describe('Rank Equals'),
            'rank-lessThan': z.number().optional().describe('Rank Less Than'),

            // Price filters
            'price-greaterThan': z.number().optional().describe('Price Greater Than'),
            'price-equals': z.number().optional().describe('Price Equals'),
            'price-lessThan': z.number().optional().describe('Price Less Than'),

            // Risk Score filters
            'riskScore-greaterThan': z.number().optional().describe('Risk Score Greater Than (Only if includeRiskScore=true)'),
            'riskScore-equals': z.number().optional().describe('Risk Score Equals (Only if includeRiskScore=true)'),
            'riskScore-lessThan': z.number().optional().describe('Risk Score Less Than (Only if includeRiskScore=true)'),
        },
    },

    // Coin by ID Tool Configuration
    {
        name: 'get-coin-by-id',
        description: 'Get detailed information about a specific cryptocurrency based on its unique identifier.',
        endpoint: '/coins/{coinId}',
        method: 'GET',
        parameters: {
            coinId: z.string().describe('The identifier of coin, which you received from /coins call response.'),
            currency: z.string().optional().describe('Currency for price data').default('USD'),
        },
    },

    // Coin Chart by ID Tool Configuration
    {
        name: 'get-coin-chart-by-id',
        description: 'Get chart data for a specific cryptocurrency based on its unique identifier, specifying different time ranges.',
        endpoint: '/coins/{coinId}/charts',
        method: 'GET',
        parameters: {
            coinId: z.string().describe('The identifier of coin, which you received from /coins call response.'),
            period: z.enum(['all', '24h', '1w', '1m', '3m', '6m', '1y']).describe('Time period for chart data'),
        },
    },

    // Coin Average Price Tool Configuration
    {
        name: 'get-coin-avg-price',
        description: 'Get the historical average price for a specific cryptocurrency based on its unique identifier and a specific date.',
        endpoint: '/coins/price/avg',
        method: 'GET',
        parameters: {
            coinId: z.string().describe('The identifier of coin'),
            timestamp: z.number().describe('Unix timestamp'),
        },
    },

    // Coin Exchange Price Tool Configuration
    {
        name: 'get-coin-exchange-price',
        description: 'Get the historical price data for a specific cryptocurrency on a particular exchange.',
        endpoint: '/coins/price/exchange',
        method: 'GET',
        parameters: {
            exchange: z.string().describe('Exchange name'),
            from: z.string().describe('From currency/coin symbol'),
            to: z.string().describe('To currency/coin symbol'),
            timestamp: z.number().describe('Unix timestamp'),
        },
    },

    // Ticker Exchanges Tool Configuration
    {
        name: 'get-ticker-exchanges',
        description: 'Get a list of supported exchanges.',
        endpoint: '/tickers/exchanges',
        method: 'GET',
        parameters: {},
    },

    // Ticker Markets Tool Configuration
    {
        name: 'get-ticker-markets',
        description: 'Get a list of tickers for a specific cryptocurrency across different exchanges.',
        endpoint: '/tickers/markets',
        method: 'GET',
        parameters: {
            page: z.number().optional().describe('Page number').default(1),
            limit: z.number().optional().describe('Number of results per page').default(20),
            exchange: z.string().optional().describe('Exchange name'),
            fromCoin: z.string().optional().describe('From currency/coin symbol'),
            toCoin: z.string().optional().describe('To currency/coin symbol'),
            coinId: z.string().optional().describe('Coin identifier'),
            onlyVerified: z.boolean().optional().describe('Filter only verified exchanges'),
        },
    },

    // Wallet Blockchains Tool Configuration
    {
        name: 'get-blockchains',
        description: 'Get a list of supported blockchains by Universal Crypto.',
        endpoint: '/wallet/blockchains',
        method: 'GET',
        parameters: {},
    },

    // Wallet Balance Tool Configuration
    {
        name: 'get-wallet-balance',
        description: 'Get the balance data for a provided wallet address on a specific blockchain network.',
        endpoint: '/wallet/balance',
        method: 'GET',
        parameters: {
            address: z.string().describe('Wallet address'),
            connectionId: z.string().describe('The identifier of connection, which you received from /wallet/blockchains call response.'),
        },
    },

    // Wallet Balances Tool Configuration
    {
        name: 'get-wallet-balances',
        description: 'Get the balance data for a provided wallet address on all Universal Crypto supported networks.',
        endpoint: '/wallet/balances',
        method: 'GET',
        parameters: {
            address: z.string().describe('The wallet address for which the balance is being queried'),
            networks: z
                .string()
                .optional()
                .describe('Blockchain networks to query, comma-separated (e.g., "ethereum,polygon,binance")')
                .default('all'),
        },
    },

    // Wallet Sync Status Tool Configuration
    {
        name: 'get-wallet-sync-status',
        description: 'Get the syncing status of the wallet with the blockchain network.',
        endpoint: '/wallet/status',
        method: 'GET',
        parameters: {
            address: z.string().describe('Wallet address'),
            connectionId: z.string().describe('The identifier of connection, which you received from /wallet/blockchains call response.'),
        },
    },

    // Wallet Transactions Tool Configuration
    {
        name: 'get-wallet-transactions',
        description: 'Get transaction data for a specific wallet. Ensure transactions are synced by calling PATCH /transactions first.',
        endpoint: '/wallet/transactions',
        method: 'GET',
        parameters: {
            address: z.string().describe('Wallet address'),
            connectionId: z.string().describe('The identifier of connection, which you received from /wallet/blockchains call response.'),
            page: z.number().optional().describe('Page number').default(1),
            limit: z.number().optional().describe('Number of results per page').default(20),
            from: z.string().optional().describe('Start date in ISO 8601 format'),
            to: z.string().optional().describe('End date in ISO 8601 format'),
            currency: z.string().optional().describe('Currency for price data').default('USD'),
            types: z.string().optional().describe('Transaction types, comma separated (deposit,withdraw,approve,executed,balance,fee)'),
            txId: z.string().optional().describe('To search with transaction hash'),
        },
    },

    // Wallet Transactions Sync Tool Configuration
    {
        name: 'transactions-sync',
        description: 'Initiate the syncing process to update transaction data for a specific wallet.',
        endpoint: '/wallet/transactions',
        method: 'PATCH',
        parameters: {
            address: z.string().describe('Wallet address'),
            connectionId: z.string().describe('The identifier of connection, which you received from /wallet/blockchains call response.'),
        },
    },

    // Exchange Support Tool Configuration
    {
        name: 'get-exchanges',
        description: 'Get a list of supported exchange portfolio connections by Universal Crypto.',
        endpoint: '/exchange/support',
        method: 'GET',
        parameters: {},
    },

    // Exchange Balance Tool Configuration
    {
        name: 'get-exchange-balance',
        description: 'Get the balance data for a provided Exchange.',
        endpoint: '/exchange/balance',
        method: 'POST',
        parameters: {
            connectionFields: z.object({}).describe('The credentials given from exchange. key, secret etc.'),
            connectionId: z.string().describe('The exchange connection id'),
        },
    },

    // Exchange Sync Status Tool Configuration
    {
        name: 'get-exchange-sync-status',
        description: 'Get the syncing status of the exchange portfolio.',
        endpoint: '/exchange/status',
        method: 'GET',
        parameters: {
            portfolioId: z.string().describe('The identifier of portfolio, which you received from /exchange/balance call response.'),
        },
    },

    // Exchange Transactions Tool Configuration
    {
        name: 'get-exchange-transactions',
        description: 'Get transaction data for a specific exchange.',
        endpoint: '/exchange/transactions',
        method: 'GET',
        parameters: {
            portfolioId: z.string().describe('The identifier of portfolio, which you received from /exchange/balance response.'),
            page: z.number().optional().describe('Page number').default(1),
            limit: z.number().optional().describe('Number of results per page').default(20),
            from: z.string().optional().describe('Start date in ISO 8601 format'),
            to: z.string().optional().describe('End date in ISO 8601 format'),
            currency: z.string().optional().describe('Currency for price data').default('USD'),
            types: z.string().optional().describe('Transaction types, comma separated (deposit,withdraw,approve,executed,balance,fee)'),
        },
    },

    // Fiats Tool Configuration
    {
        name: 'get-fiat-currencies',
        description: 'Get a list of fiat currencies supported by Universal Crypto.',
        endpoint: '/fiats',
        method: 'GET',
        parameters: {},
    },

    // News Sources Tool Configuration
    {
        name: 'get-news-sources',
        description: 'Get news sources.',
        endpoint: '/news/sources',
        method: 'GET',
        parameters: {},
    },

    // News Tool Configuration
    {
        name: 'get-news',
        description: 'Get news articles with pagination.',
        endpoint: '/news',
        method: 'GET',
        parameters: {
            page: z.number().optional().describe('Page number').default(1),
            limit: z.number().optional().describe('Number of results per page').default(20),
            from: z.string().optional().describe('Start date in ISO 8601 format'),
            to: z.string().optional().describe('End date in ISO 8601 format'),
        },
    },

    // News by Type Tool Configuration
    {
        name: 'get-news-by-type',
        description: 'Get news articles based on a type.',
        endpoint: '/news/type/{type}',
        method: 'GET',
        parameters: {
            type: z.enum(['handpicked', 'trending', 'latest', 'bullish', 'bearish']).describe('News type'),
            page: z.number().optional().describe('Page number').default(1),
            limit: z.number().optional().describe('Number of results per page').default(20),
        },
    },

    // News by ID Tool Configuration
    {
        name: 'get-news-by-id',
        description: 'Get news by id.',
        endpoint: '/news/{id}',
        method: 'GET',
        parameters: {
            id: z.string().describe('News article ID'),
        },
    },

    // Markets Tool Configuration
    {
        name: 'get-market-cap',
        description: 'Get global market data.',
        endpoint: '/markets',
        method: 'GET',
        parameters: {},
    },

    // Portfolio Coins Tool Configuration
    {
        name: 'get-portfolio-coins',
        description: 'Get a list of portfolio coins with P/L and other data displayed on Universal Crypto web.',
        endpoint: '/portfolio/coins',
        method: 'GET',
        parameters: {
            shareToken: z
                .string()
                .optional()
                .describe(
                    'Portfolio share token. You can get your share token from the portfolio you want to retrive data from by clicking Share button on Universal Crypto web app portfolio tracker section - top right.'
                ),
            page: z.number().optional().describe('Page number').default(1),
            limit: z.number().optional().describe('Number of results per page').default(20),
            includeRiskScore: z.string().optional().describe('Include risk score: true or false. Default - false'),
        },
    },

    // Portfolio Chart Tool Configuration
    {
        name: 'get-portfolio-chart',
        description: 'Get portfolio performance chart data.',
        endpoint: '/portfolio/chart',
        method: 'GET',
        parameters: {
            shareToken: z
                .string()
                .optional()
                .describe(
                    'Portfolio share token. You can get your share token from the portfolio you want to retrive data from by clicking Share button on Universal Crypto web app portfolio tracker section - top right.'
                ),
            type: z.string().describe('One of 24h, 1w, 1m, 3m, 6m, 1y, all'),
        },
    },

    // Portfolio Transactions Tool Configuration
    {
        name: 'get-portfolio-transactions',
        description: 'Get a list of portfolio transactions.',
        endpoint: '/portfolio/transactions',
        method: 'GET',
        parameters: {
            shareToken: z
                .string()
                .optional()
                .describe(
                    'Portfolio share token. You can get your share token from the portfolio you want to retrive data from by clicking Share button on Universal Crypto web app portfolio tracker section - top right.'
                ),
            page: z.number().optional().describe('Page number').default(1),
            limit: z.number().optional().describe('Number of results per page').default(20),
            currency: z.string().describe('Currency for price data'),
            coinId: z.string().optional().describe('Filter by coin ID'),
        },
    },

    // Add Portfolio Transaction Tool Configuration
    {
        name: 'add-portfolio-transaction',
        description: 'Add a transaction to a manual portfolio.',
        endpoint: '/portfolio/transaction',
        method: 'POST',
        parameters: {
            shareToken: z.string().optional().describe('Portfolio share token'),
            // This endpoint requires a request body which would need to match the AddTransactionDto schema
            // For simplicity, we're defining a basic structure that matches the expected input
            coinId: z.string().describe('Coin ID'),
            type: z.string().describe('Transaction type'),
            date: z.string().describe('Transaction date in ISO format'),
            amount: z.number().describe('Transaction amount'),
            price: z.number().describe('Price per coin'),
            fee: z.number().optional().describe('Transaction fee'),
            notes: z.string().optional().describe('Transaction notes'),
        },
    },

    // Currencies Tool Configuration
    {
        name: 'get-currencies',
        description: 'Get a list of fiat currencies supported by Universal Crypto.',
        endpoint: '/currencies',
        method: 'GET',
        parameters: {},
    },

    // Save Share Token Tool Configuration
    {
        name: 'save-share-token',
        description: 'Saves the provided portfolio share token to a local cache for future use across sessions.',
        // This tool operates locally and does not call an external API endpoint.
        // The logic to call saveToCache('shareToken', shareToken) will be handled
        // by the tool execution mechanism based on this tool's name.
        endpoint: '', // Empty string since this is a local operation
        method: 'POST', // Using POST since we're saving data
        parameters: {
            shareToken: z.string().describe('The portfolio share token to save locally.'),
        },
        isLocal: true, // Flag indicating this is a local operation that doesn't use an API
    },

    // Get Share Token Tool Configuration
    {
        name: 'get-share-token',
        description: 'Retrieves the saved portfolio share token from local cache.',
        endpoint: '', // Empty string since this is a local operation
        method: 'GET',
        parameters: {},
        isLocal: true, // Flag indicating this is a local operation that doesn't use an API
    },
];
