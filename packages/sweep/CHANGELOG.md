# Changelog

All notable changes to Sweep will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Documentation: DEVELOPMENT.md - Local development guide
- Documentation: DEPLOYMENT.md - Production deployment guide
- Documentation: DATABASE.md - Database schema documentation
- Documentation: QUEUE_WORKERS.md - Background job documentation
- Documentation: TESTING.md - Comprehensive testing guide
- Documentation: MONITORING.md - Observability guide
- Documentation: CONTRIBUTING.md - Contribution guidelines

### Changed
- Updated docs/README.md with links to all documentation

### Fixed
- None

---

## [0.1.0] - 2026-01-22

### Added

#### Core Features
- Multi-chain dust sweeper supporting Ethereum, Base, Arbitrum, Polygon, BSC, Optimism, Linea
- Gasless transactions via ERC-4337 account abstraction
- Permit2 integration for gasless token approvals
- DeFi routing to Aave V3, Yearn V3, Beefy, Lido

#### Smart Contracts
- `SweepDustSweeper` - Main entry point contract
- `SweepBatchSwap` - Batch swap execution
- `SweepPermit2Batcher` - Permit2 integration
- `SweepVaultRouter` - DeFi vault routing
- `SweepFeeCollector` - Protocol fee management

#### Backend API
- REST API with Hono framework
- SIWE (Sign-In with Ethereum) authentication
- Wallet scanning endpoint (`POST /api/wallet/scan`)
- Quote generation endpoint (`POST /api/quote`)
- Sweep execution endpoint (`POST /api/sweep/execute`)
- Status tracking endpoint (`GET /api/status/:id`)
- DeFi destinations endpoint (`GET /api/defi/vaults`)
- Bridge routes endpoint (`GET /api/bridge/routes`)
- Health check endpoints (`/health`, `/health/live`, `/health/ready`)

#### Background Workers
- Wallet scan worker
- Price update worker
- Sweep execution worker
- Sweep tracking worker
- Bridge execution worker
- Bridge tracking worker
- Subscription monitoring worker

#### Database
- PostgreSQL 16 with Drizzle ORM
- Users, tokens, sweeps, quotes tables
- Subscriptions and auto-sweep tables
- API payments and credits tables
- Price cache with multi-source validation

#### Frontend
- Next.js 14 App Router
- Wallet connection with wagmi v2
- Chain selector component
- Dust token list with selection
- Sweep preview and execution
- Transaction status tracking

#### Infrastructure
- Docker and Docker Compose setup
- Kubernetes manifests for deployment
- Prometheus metrics and Grafana dashboards
- GitHub Actions CI/CD pipeline

#### Security
- Multi-oracle price validation
- Token whitelist/blacklist registry
- Rate limiting and input validation
- Reentrancy protection on all contracts
- Emergency pause mechanism

### Security
- Initial security review completed
- Threat model documented in SECURITY.md

---

## Version History

### Versioning Scheme

We use [Semantic Versioning](https://semver.org/):

- **MAJOR** (1.0.0): Breaking changes to API or contracts
- **MINOR** (0.1.0): New features, backward compatible
- **PATCH** (0.0.1): Bug fixes, backward compatible

### Release Process

1. Create release branch: `release/vX.Y.Z`
2. Update CHANGELOG.md
3. Update package.json version
4. Create GitHub release with tag
5. CI deploys to production

---

## Links

- [GitHub Releases](https://github.com/nirholas/sweep/releases)
- [GitHub Issues](https://github.com/nirholas/sweep/issues)
- [Documentation](./docs/README.md)

[Unreleased]: https://github.com/nirholas/sweep/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/nirholas/sweep/releases/tag/v0.1.0
