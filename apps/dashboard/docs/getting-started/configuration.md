# Configuration

Configure Crypto Data Aggregator for your environment.

## Environment Variables

Create a `.env.local` file in the project root:

```bash
cp .env.example .env.local
```

### x402 Payment Configuration

| Variable               | Description                                | Default                        |
| ---------------------- | ------------------------------------------ | ------------------------------ |
| `X402_PAY_TO_ADDRESS`  | Your wallet address for receiving payments | Required                       |
| `X402_NETWORK`         | Blockchain network                         | `eip155:84532` (Base Sepolia)  |
| `X402_FACILITATOR_URL` | Payment facilitator URL                    | `https://x402.org/facilitator` |

```bash
# Development (Base Sepolia testnet)
X402_PAY_TO_ADDRESS=0xYourTestnetWallet
X402_NETWORK=eip155:84532

# Production (Base mainnet)
X402_PAY_TO_ADDRESS=0xYourMainnetWallet
X402_NETWORK=eip155:8453
```

### API Keys (Optional)

| Variable            | Description                      | Required                  |
| ------------------- | -------------------------------- | ------------------------- |
| `COINGECKO_API_KEY` | CoinGecko Pro API key            | No (improves rate limits) |
| `GROQ_API_KEY`      | Groq API for AI features         | For AI features           |
| `OPENAI_API_KEY`    | OpenAI API (alternative to Groq) | For AI features           |

```bash
COINGECKO_API_KEY=CG-xxxxxxxxxxxxx
GROQ_API_KEY=gsk_xxxxxxxxxxxxx
```

### Application Settings

```bash
# Your production domain
NEXT_PUBLIC_BASE_URL=https://your-domain.com

# Enable debug logging
DEBUG=false

# Analytics (optional)
NEXT_PUBLIC_GA_ID=G-XXXXXXXXXX
```

## Network Configuration

### Supported Networks

| Network      | Chain ID       | Use Case               |
| ------------ | -------------- | ---------------------- |
| Base Sepolia | `eip155:84532` | Development/Testing    |
| Base Mainnet | `eip155:8453`  | Production             |
| Ethereum     | `eip155:1`     | Alternative production |

### Testnet Setup

1. Get Base Sepolia ETH from
   [Base Faucet](https://www.coinbase.com/faucets/base-ethereum-sepolia-faucet)
2. Get test USDC from the faucet
3. Set your testnet wallet address in `X402_PAY_TO_ADDRESS`

## Pricing Configuration

Pricing is configured in `src/lib/x402-server.ts`:

```typescript
export const pricing = {
  basic: '$0.001', // Basic API call
  history: '$0.005', // Historical data
  analytics: '$0.01', // Advanced analytics
  ai: '$0.05', // AI-powered features
  export: '$0.10', // Data export
};
```

## Rate Limiting

Configure rate limits for API key tiers in `src/lib/x402.ts`:

```typescript
export const API_TIERS = {
  free: { requestsPerDay: 100 },
  pro: { requestsPerDay: 10000 },
  enterprise: { requestsPerDay: -1 }, // Unlimited
};
```

## Next Steps

- [Development Guide](../guides/development.md) - Start developing
- [API Reference](../api/overview.md) - Explore endpoints
