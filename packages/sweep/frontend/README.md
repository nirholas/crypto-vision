# Sweep Frontend

Next.js 14 frontend for the Sweep dust sweeper application.

## Features

- **Multi-chain Support**: Ethereum, Base, Arbitrum, Polygon, BNB Chain, Linea, Solana
- **Wallet Connection**: MetaMask, Coinbase Wallet, WalletConnect, and more
- **Gasless Transactions**: Using Coinbase Smart Wallet with paymaster
- **Real-time Updates**: SSE-based transaction status updates
- **Beautiful UI**: Tailwind CSS with custom sweep theme

## Getting Started

```bash
# Install dependencies
npm install

# Copy environment file
cp .env.example .env.local

# Start development server
npm run dev
```

## Environment Variables

```env
# API URL
NEXT_PUBLIC_API_URL=http://localhost:3001

# WalletConnect Project ID (get from https://cloud.walletconnect.com)
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_project_id

# RPC URLs (optional - uses public RPCs by default)
NEXT_PUBLIC_ETH_RPC=
NEXT_PUBLIC_BASE_RPC=
NEXT_PUBLIC_ARB_RPC=
NEXT_PUBLIC_POLYGON_RPC=
NEXT_PUBLIC_BSC_RPC=
NEXT_PUBLIC_LINEA_RPC=
```

## Project Structure

```
frontend/
├── app/                    # Next.js App Router
│   ├── globals.css         # Global styles
│   ├── layout.tsx          # Root layout
│   ├── page.tsx            # Landing page
│   └── dashboard/
│       └── page.tsx        # Main dashboard
├── components/
│   ├── Providers.tsx       # React Query + wagmi providers
│   ├── WalletConnect.tsx   # Wallet connection button
│   ├── ChainSelector.tsx   # Chain toggle component
│   ├── DustTokenList.tsx   # Token list with selection
│   ├── SweepPreview.tsx    # Quote preview
│   ├── SweepExecute.tsx    # Execute sweep
│   └── TransactionStatus.tsx # Status display
├── hooks/
│   ├── useDustTokens.ts    # Fetch dust tokens
│   ├── useSweepQuote.ts    # Get quotes
│   └── useSweepExecute.ts  # Execute sweeps
└── lib/
    ├── api.ts              # API client
    ├── chains.ts           # Chain config
    ├── types.ts            # TypeScript types
    └── wagmi.ts            # Wallet config
```

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Wallet**: wagmi v2 + viem
- **Styling**: Tailwind CSS
- **State**: TanStack Query
- **Auth**: SIWE (Sign-In with Ethereum)

## Development

```bash
# Run development server
npm run dev

# Type check
npm run type-check

# Lint
npm run lint

# Build for production
npm run build
```
