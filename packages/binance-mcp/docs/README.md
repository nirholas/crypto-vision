# Binance.US MCP Server Documentation

Welcome to the Binance.US MCP Server documentation. This server provides a complete interface to Binance.US exchange APIs through the Model Context Protocol.

## Documentation Index

| Document | Description |
|----------|-------------|
| [Tool Reference](TOOLS.md) | Complete list of all available tools with parameters |
| [API Reference](API.md) | API client details, authentication, and error handling |
| [Configuration](CONFIGURATION.md) | Setup, environment variables, and Claude Desktop config |
| [Security](SECURITY.md) | Best practices for API keys and safe usage |
| [Examples](EXAMPLES.md) | Common workflows and usage examples |

## Quick Start

1. **Install dependencies**: `npm install`
2. **Configure API keys**: Set `BINANCE_US_API_KEY` and `BINANCE_US_API_SECRET`
3. **Build**: `npm run build`
4. **Run**: `npm start` or configure in Claude Desktop

## Key Features

### US-Exclusive APIs
- **Custodial Solution API**: For institutional custody partners
- **Credit Line API**: For institutional credit agreements

### Standard APIs
- Market data (public, no auth required)
- Spot trading (requires TRADE permission)
- Wallet management (requires USER_DATA permission)
- Staking operations
- OTC trading
- Sub-account management

## Tool Categories Overview

| Category | Tools | Auth Required |
|----------|-------|---------------|
| General | 4 | Mixed |
| Market Data | 10 | No |
| Trading - Orders | 8 | Yes (TRADE) |
| Trading - OCO | 5 | Yes (TRADE) |
| Account | 5 | Yes (USER_DATA) |
| Wallet | 6 | Yes (USER_DATA) |
| Staking | 6 | Yes |
| OTC | 6 | Yes |
| Sub-Account | 6 | Yes |
| User Data Stream | 4 | Yes |
| Custodial | 19 | Special Key |
| Custodial Solution | 9 | Special Key |
| Credit Line | 5 | Special Key |
| **Total** | **93** | |

## Important Differences from Binance.com

| Feature | Binance.US | Binance.com |
|---------|------------|-------------|
| Base URL | `api.binance.us` | `api.binance.com` |
| WebSocket | `stream.binance.us:9443` | `stream.binance.com:9443` |
| Futures | ❌ | ✅ |
| Margin | ❌ | ✅ |
| Lending | ❌ | ✅ |
| Custodial API | ✅ | ❌ |
| Credit Line API | ✅ | ❌ |

## Support

- [Binance.US API Documentation](https://docs.binance.us/)
- [MCP Protocol](https://modelcontextprotocol.io/)
- [GitHub Issues](https://github.com/nirholas/universal-crypto-mcp/issues)
