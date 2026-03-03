# Sweep Documentation

> **⚠️ CRITICAL: This application handles user funds. Read all documentation carefully before making any changes.**

## Table of Contents

1. [Overview](#overview)
2. [Architecture](./architecture/SYSTEM_ARCHITECTURE.md)
3. [Smart Contracts](./CONTRACTS.md)
4. [API Reference](./API.md)
5. [Security](./SECURITY.md)
6. [Deployment](./DEPLOYMENT.md)
7. [Development Guide](./DEVELOPMENT.md)
8. [Database](./DATABASE.md)
9. [Queue Workers](./QUEUE_WORKERS.md)
10. [Testing](./TESTING.md)
11. [Monitoring](./MONITORING.md)

## Quick Links

### Core Documentation

| Document | Description |
|----------|-------------|
| [CONTRACTS.md](./CONTRACTS.md) | Smart contract documentation and security considerations |
| [API.md](./API.md) | Complete REST API reference with OpenAPI spec |
| [SECURITY.md](./SECURITY.md) | Security model and threat mitigations |
| [SYSTEM_ARCHITECTURE.md](./architecture/SYSTEM_ARCHITECTURE.md) | Full system architecture and design |

### Development

| Document | Description |
|----------|-------------|
| [DEVELOPMENT.md](./DEVELOPMENT.md) | Local development setup and workflow |
| [TESTING.md](./TESTING.md) | Testing guide with coverage requirements |
| [DATABASE.md](./DATABASE.md) | Database schema, ERD, and migrations |
| [QUEUE_WORKERS.md](./QUEUE_WORKERS.md) | Background job workers documentation |

### Operations

| Document | Description |
|----------|-------------|
| [DEPLOYMENT.md](./DEPLOYMENT.md) | Production deployment with Kubernetes |
| [MONITORING.md](./MONITORING.md) | Observability, metrics, and alerting |

### Project

| Document | Description |
|----------|-------------|
| [CONTRIBUTING.md](../CONTRIBUTING.md) | Contribution guidelines and code style |
| [CHANGELOG.md](../CHANGELOG.md) | Version history and release notes |
| [README.md](../README.md) | Project overview and quick start |

## Overview

Sweep is a multi-chain dust sweeper that consolidates small token balances ("dust") across EVM chains and Solana into a single valuable token or DeFi position.

### Key Features

- **Multi-Chain Support**: Ethereum, Base, Arbitrum, Polygon, BSC, Optimism, Linea, Solana
- **Gasless Transactions**: ERC-4337 account abstraction with sponsored gas
- **DeFi Integration**: Deposit swept funds directly into Aave, Yearn, Beefy, or Lido
- **Cross-Chain Bridging**: Aggregate dust across chains with Across, Stargate, Hop
- **Security First**: Multi-oracle price validation, honeypot detection, MEV protection

### How It Works

```
┌─────────────────────────────────────────────────────────────────┐
│                         USER FLOW                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. Connect Wallet → 2. Scan Dust → 3. Get Quote → 4. Execute   │
│                                                                  │
│  ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐      │
│  │ Wallet  │───▶│ Scanner │───▶│ Quoter  │───▶│ Executor│      │
│  │ Connect │    │ (Multi- │    │ (DEX    │    │ (AA +   │      │
│  │         │    │  chain) │    │  Agg)   │    │  Permit2)│     │
│  └─────────┘    └─────────┘    └─────────┘    └─────────┘      │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Project Structure

```
sweep/
├── contracts/           # Solidity smart contracts (Foundry)
│   ├── src/
│   │   ├── SweepBatchSwap.sol      # Batch swap execution
│   │   ├── SweepPermit2Batcher.sol # Permit2 integration
│   │   ├── SweepDustSweeper.sol    # Main entry point
│   │   ├── SweepVaultRouter.sol    # DeFi vault routing
│   │   └── SweepFeeCollector.sol   # Fee management
│   └── test/            # Foundry tests
│
├── src/                 # Backend TypeScript (Hono + Node.js)
│   ├── api/             # REST API server
│   │   ├── routes/      # API route handlers
│   │   └── middleware/  # Auth, metrics, validation
│   ├── services/        # Business logic
│   │   ├── defi/        # DeFi protocol integrations
│   │   ├── dex/         # DEX aggregator layer
│   │   ├── bridge/      # Cross-chain bridge aggregator
│   │   ├── executor/    # Transaction execution (ERC-4337)
│   │   ├── wallet/      # Wallet scanning
│   │   └── price/       # Price oracles
│   ├── db/              # Database schema (Drizzle ORM)
│   ├── queue/           # Background job workers
│   ├── config/          # Chain configurations
│   └── utils/           # Shared utilities
│
├── frontend/            # Next.js 14 frontend
│   ├── app/             # App Router pages
│   ├── components/      # React components
│   ├── hooks/           # Custom React hooks
│   └── lib/             # Client utilities
│
├── docs/                # Documentation
│   ├── API.md           # API reference
│   ├── CONTRACTS.md     # Smart contract docs
│   ├── DATABASE.md      # Database schema
│   ├── DEPLOYMENT.md    # Deployment guide
│   ├── DEVELOPMENT.md   # Development guide
│   ├── MONITORING.md    # Observability
│   ├── QUEUE_WORKERS.md # Background jobs
│   ├── SECURITY.md      # Security model
│   ├── TESTING.md       # Testing guide
│   └── architecture/    # System architecture
│
├── k8s/                 # Kubernetes manifests
├── monitoring/          # Prometheus + Grafana
├── scripts/             # Deployment & maintenance
└── tests/               # Integration tests
```

## Supported Chains

| Chain | Chain ID | Native Token | Status |
|-------|----------|--------------|--------|
| Ethereum | 1 | ETH | ✅ Production |
| Base | 8453 | ETH | ✅ Production |
| Arbitrum | 42161 | ETH | ✅ Production |
| Polygon | 137 | MATIC | ✅ Production |
| BSC | 56 | BNB | ✅ Production |
| Optimism | 10 | ETH | ✅ Production |
| Linea | 59144 | ETH | ✅ Production |
| Solana | - | SOL | ✅ Production |

## Technology Stack

### Backend
- **Runtime**: Node.js 20+
- **Framework**: Hono (lightweight, fast)
- **Database**: PostgreSQL 16 + Drizzle ORM
- **Cache**: Redis 7
- **Queue**: BullMQ

### Frontend
- **Framework**: Next.js 14 (App Router)
- **Wallet**: wagmi + viem
- **Styling**: Tailwind CSS

### Smart Contracts
- **Framework**: Foundry
- **Standards**: ERC-4337, Permit2, ERC-2612
- **Security**: OpenZeppelin contracts

### Infrastructure
- **Container**: Docker
- **Orchestration**: Kubernetes
- **CI/CD**: GitHub Actions
- **Monitoring**: Prometheus + Grafana

## Getting Started

See [DEVELOPMENT.md](./DEVELOPMENT.md) for complete local setup instructions.

```bash
# Quick start
git clone https://github.com/nirholas/sweep.git
cd sweep
npm install
npm run docker:up      # Start Postgres, Redis
npm run db:migrate     # Run migrations
npm run db:seed        # Seed test data (optional)
npm run dev            # Start API server
```

For frontend development:
```bash
cd frontend
npm install
npm run dev            # Start Next.js at http://localhost:3001
```

For smart contract development:
```bash
cd contracts
forge install
forge build
forge test
```

## Contributing

1. Read the [CONTRIBUTING.md](../CONTRIBUTING.md) guide
2. Follow the [Security Documentation](./SECURITY.md)
3. Set up your environment with [DEVELOPMENT.md](./DEVELOPMENT.md)
4. Write tests following [TESTING.md](./TESTING.md)
5. Ensure all tests pass
6. Submit PR with detailed description

## Documentation Status

| Document | Status | Lines |
|----------|--------|-------|
| [SYSTEM_ARCHITECTURE.md](./architecture/SYSTEM_ARCHITECTURE.md) | ✅ Complete | 2189 |
| [API.md](./API.md) | ✅ Complete | 1039 |
| [CONTRACTS.md](./CONTRACTS.md) | ✅ Complete | 598 |
| [DATABASE.md](./DATABASE.md) | ✅ Complete | New |
| [DEPLOYMENT.md](./DEPLOYMENT.md) | ✅ Complete | New |
| [DEVELOPMENT.md](./DEVELOPMENT.md) | ✅ Complete | New |
| [MONITORING.md](./MONITORING.md) | ✅ Complete | New |
| [QUEUE_WORKERS.md](./QUEUE_WORKERS.md) | ✅ Complete | New |
| [SECURITY.md](./SECURITY.md) | ✅ Complete | 137 |
| [TESTING.md](./TESTING.md) | ✅ Complete | New |

## License

MIT License - see [LICENSE](../LICENSE)
