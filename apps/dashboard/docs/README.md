# Documentation Index

Welcome to the Crypto Data Aggregator documentation! This guide will help you understand, use, and
contribute to the project.

---

## 📚 Documentation Overview

| Document                                | Description                             | Audience      |
| --------------------------------------- | --------------------------------------- | ------------- |
| [README](../README.md)                  | Project overview, quick start, features | Everyone      |
| [CONTRIBUTING](../CONTRIBUTING.md)      | How to contribute to the project        | Contributors  |
| [API Reference](API.md)                 | Complete API endpoint documentation     | Developers    |
| [Swagger Docs](/docs/swagger)           | Interactive API documentation           | Developers    |
| [AI Agents](AI_AGENTS.md)               | AI agent discoverability guide          | AI Developers |
| [Archive System](ARCHIVE.md)            | Historical data collection              | Developers    |
| [Architecture](ARCHITECTURE.md)         | System design and data flow             | Developers    |
| [Tech Stack](TECH_STACK.md)             | Technologies, libraries, and tools      | Developers    |
| [Components](COMPONENTS.md)             | React component reference               | Developers    |
| [Data Sources](DATA_SOURCES.md)         | External APIs and caching               | Developers    |
| [Development](DEVELOPMENT.md)           | Local setup and workflow                | Contributors  |
| [Testing](TESTING.md)                   | Testing guide and best practices        | Contributors  |
| [Deployment](DEPLOYMENT.md)             | Production deployment guide             | DevOps        |
| [Performance](PERFORMANCE.md)           | Optimization strategies                 | Developers    |
| [Security](SECURITY.md)                 | Security guidelines                     | Everyone      |
| [PWA](PWA.md)                           | Progressive Web App features            | Developers    |
| [x402 Integration](X402_INTEGRATION.md) | x402 payment protocol guide             | Developers    |
| [Troubleshooting](TROUBLESHOOTING.md)   | Common issues and solutions             | Everyone      |
| [Changelog](CHANGELOG.md)               | Version history and changes             | Everyone      |

---

## 🚀 Quick Links

### Getting Started

- [Quick Start](../README.md#-quick-start) - Get running in 30 seconds
- [Development Setup](DEVELOPMENT.md#quick-start) - Full dev environment
- [Contributing Guide](../CONTRIBUTING.md) - Start contributing

### For Developers

- [API Endpoints](API.md#market-data) - All available endpoints
- [Swagger UI](/docs/swagger) - Interactive API documentation
- [OpenAPI Spec](/api/v2/openapi.json) - Machine-readable API spec
- [Component Library](COMPONENTS.md#data-display-components) - UI components
- [Design System](DESIGN_SYSTEM.md) - Colors, tokens, and styling
- [Tech Stack Details](TECH_STACK.md#core-framework) - Framework details

### Architecture Deep Dives

- [Data Flow](ARCHITECTURE.md#data-flow) - How data moves through the app
- [Caching Strategy](DATA_SOURCES.md#caching-strategy) - Multi-layer caching
- [State Management](ARCHITECTURE.md#state-management) - SWR and context

### Operations

- [Deployment Options](DEPLOYMENT.md) - Vercel, Docker, self-hosted
- [Performance Monitoring](PERFORMANCE.md#monitoring) - Core Web Vitals
- [Security Checklist](SECURITY.md#security-checklist) - Security review

---

## 🏗️ Architecture at a Glance

```
┌─────────────────────────────────────────────────────────────────┐
│                         Browser                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │    React     │  │   SWR        │  │   LocalStorage       │  │
│  │  Components  │──│   Cache      │  │  (Portfolio/Alerts)  │  │
│  └──────────────┘  └──────────────┘  └──────────────────────┘  │
└────────────────────────────┬────────────────────────────────────┘
                             │ HTTP
┌────────────────────────────┼────────────────────────────────────┐
│                    Next.js Server                                │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │ API Routes   │──│ Memory Cache │──│  External APIs       │  │
│  │ (Edge)       │  │ (TTL-based)  │  │  CoinGecko/DeFiLlama │  │
│  └──────────────┘  └──────────────┘  └──────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📦 Tech Stack Summary

| Category          | Technology    | Version |
| ----------------- | ------------- | ------- |
| **Framework**     | Next.js       | 16.x    |
| **UI Library**    | React         | 19.x    |
| **Language**      | TypeScript    | 5.x     |
| **Styling**       | Tailwind CSS  | 4.x     |
| **Data Fetching** | SWR           | 2.x     |
| **Charts**        | Recharts      | 2.x     |
| **Animations**    | Framer Motion | 12.x    |
| **Testing**       | Vitest        | 4.x     |

[View full tech stack →](TECH_STACK.md)

---

## 🔌 API Quick Reference

### Market Data

```
GET /api/market/coins          # Top coins by market cap
GET /api/market/coins/:id      # Single coin details
GET /api/market/history/:id    # Historical prices
GET /api/market/ohlc/:id       # OHLC candlestick data
GET /api/market/search?q=      # Search coins
```

### DeFi

```
GET /api/defi                  # DeFi protocols
GET /api/defi/chains           # Blockchain TVL
```

### Other

```
GET /api/sentiment             # Fear & Greed Index
GET /api/trending              # Trending coins
GET /api/charts/:id            # Chart data
```

[View full API reference →](API.md)

---

## 🎯 Feature Documentation

### Portfolio Tracking

- Store holdings locally (no account needed)
- Track P&L, cost basis, allocation
- Export as JSON/CSV

See: [Components → Portfolio](COMPONENTS.md#portfolio)

### Price Alerts

- Set price above/below targets
- Browser notifications
- Persisted in localStorage

See: [Components → Alerts](COMPONENTS.md#alertsprovider)

### PWA Features

- Installable on mobile/desktop
- Offline browsing
- Background updates

See: [PWA Guide](PWA.md)

---

## 🛠️ Development Workflow

1. **Setup**: `./scripts/setup.sh` or `npm install`
2. **Develop**: `npm run dev` - Start dev server
3. **Test**: `npm run test` - Run tests
4. **Check**: `npm run check-all` - Lint + typecheck + test
5. **Commit**: Husky runs pre-commit hooks automatically
6. **PR**: Follow [PR template](../.github/PULL_REQUEST_TEMPLATE.md)

[View full development guide →](DEVELOPMENT.md)

---

## 📖 Additional Resources

### External Documentation

- [Next.js Documentation](https://nextjs.org/docs)
- [React Documentation](https://react.dev)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- [SWR Documentation](https://swr.vercel.app)

### API Provider Docs

- [CoinGecko API](https://www.coingecko.com/api/documentation)
- [DeFiLlama API](https://defillama.com/docs/api)
- [Alternative.me API](https://alternative.me/crypto/fear-and-greed-index/#api)

---

## 📝 Contributing to Docs

Found an error or want to improve the docs?

1. Fork the repository
2. Edit files in `/docs`
3. Submit a PR with your changes

Documentation follows these conventions:

- Markdown format with proper headings
- Code examples with syntax highlighting
- Tables for structured data
- Mermaid diagrams for architecture

---

## 📧 Getting Help

- **Questions**: Open a
  [Question issue](https://github.com/nirholas/crypto-data-aggregator/issues/new?template=question.yml)
- **Bugs**: Open a
  [Bug report](https://github.com/nirholas/crypto-data-aggregator/issues/new?template=bug_report.yml)
- **Features**: Open a
  [Feature request](https://github.com/nirholas/crypto-data-aggregator/issues/new?template=feature_request.yml)
