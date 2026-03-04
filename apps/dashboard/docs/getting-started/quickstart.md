# Quick Start

Get Crypto Data Aggregator running in under 5 minutes.

## Prerequisites

- Node.js 18.17+
- npm or pnpm
- Git

## Installation

### 1. Clone the Repository

```bash
git clone https://github.com/nirholas/crypto-data-aggregator.git
cd crypto-data-aggregator
```

### 2. Install Dependencies

```bash
npm install
# or
pnpm install
```

### 3. Set Up Environment

```bash
cp .env.example .env.local
```

Edit `.env.local` with your configuration:

```bash
# x402 Payment Address (your wallet for receiving payments)
X402_PAY_TO_ADDRESS=0xYourWalletAddress

# Network (testnet for development)
X402_NETWORK=eip155:84532
```

### 4. Start Development Server

```bash
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000) to see the app!

## What's Next?

<div class="grid cards" markdown>

- :material-api:{ .lg .middle } **Explore the API**

  ***

  Learn about available endpoints

  [:octicons-arrow-right-24: API Reference](../api/overview.md)

- :material-credit-card:{ .lg .middle } **Set Up Payments**

  ***

  Configure x402 for premium features

  [:octicons-arrow-right-24: x402 Guide](../api/x402.md)

- :material-cog:{ .lg .middle } **Configuration**

  ***

  Customize for your needs

  [:octicons-arrow-right-24: Configuration](configuration.md)

</div>

## Verify Installation

Test the API is working:

```bash
curl http://localhost:3000/api/market
```

You should see market data returned as JSON.

## Troubleshooting

### Port Already in Use

```bash
# Use a different port
npm run dev -- -p 3001
```

### Module Not Found Errors

```bash
# Clear cache and reinstall
rm -rf node_modules .next
npm install
```

See the [Troubleshooting Guide](../reference/troubleshooting.md) for more solutions.
