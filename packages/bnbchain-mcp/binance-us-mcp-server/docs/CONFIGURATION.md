# Configuration Guide

Complete guide to configuring the Binance.US MCP Server.

## Quick Setup

### 1. Install Dependencies

```bash
cd binance-us-mcp-server
npm install
```

### 2. Configure Environment

Create a `.env` file:

```bash
BINANCE_US_API_KEY=your_api_key_here
BINANCE_US_API_SECRET=your_api_secret_here
```

### 3. Build

```bash
npm run build
```

### 4. Test

```bash
npm run dev  # Development mode with hot reload
npm test     # Test with MCP Inspector
```

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `BINANCE_US_API_KEY` | For authenticated endpoints | Your Binance.US API key |
| `BINANCE_US_API_SECRET` | For signed endpoints | Your Binance.US API secret |

### Getting API Keys

1. Log into [Binance.US](https://www.binance.us)
2. Go to **Profile** → **API Management**
3. Create a new API key
4. Save both the API Key and Secret Key securely

⚠️ **Important**: The secret key is only shown once. Save it immediately!

---

## Claude Desktop Configuration

### Location

| OS | Path |
|----|------|
| macOS | `~/Library/Application Support/Claude/claude_desktop_config.json` |
| Windows | `%APPDATA%\Claude\claude_desktop_config.json` |
| Linux | `~/.config/Claude/claude_desktop_config.json` |

### Basic Configuration

```json
{
  "mcpServers": {
    "binance-us-mcp": {
      "command": "node",
      "args": ["/absolute/path/to/binance-us-mcp-server/build/index.js"],
      "env": {
        "BINANCE_US_API_KEY": "your_api_key",
        "BINANCE_US_API_SECRET": "your_api_secret"
      }
    }
  }
}
```

### With npx (if published)

```json
{
  "mcpServers": {
    "binance-us-mcp": {
      "command": "npx",
      "args": ["@nirholas/binance-us-mcp-server"],
      "env": {
        "BINANCE_US_API_KEY": "your_api_key",
        "BINANCE_US_API_SECRET": "your_api_secret"
      }
    }
  }
}
```

### Read-Only Mode (No Trading)

For market data only (no API keys needed):

```json
{
  "mcpServers": {
    "binance-us-mcp": {
      "command": "node",
      "args": ["/path/to/build/index.js"]
    }
  }
}
```

---

## API Key Permissions

### Permission Types

| Permission | Required For |
|------------|--------------|
| **Read** | Account info, balances, order history |
| **Trade** | Placing and canceling orders |
| **Withdraw** | Crypto/fiat withdrawals |

### Recommended Setup

For most use cases, create an API key with:
- ✅ Read
- ✅ Trade (if you want to trade)
- ❌ Withdraw (avoid unless necessary)

### IP Restrictions

Always set IP restrictions for your API keys:

1. In Binance.US API Management
2. Click "Edit restrictions"
3. Add your IP address(es)
4. Enable "Restrict access to trusted IPs only"

---

## TypeScript Configuration

The server uses this `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "./build",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "resolveJsonModule": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "build"]
}
```

---

## Package Scripts

| Script | Command | Description |
|--------|---------|-------------|
| `npm start` | `node build/index.js` | Run production server |
| `npm run dev` | `tsx watch src/index.ts` | Development with hot reload |
| `npm run build` | `tsc` | Compile TypeScript |
| `npm test` | MCP Inspector | Test with inspector tool |

---

## Multiple Environments

### Development vs Production

Create separate `.env` files:

**.env.development**
```bash
BINANCE_US_API_KEY=dev_key
BINANCE_US_API_SECRET=dev_secret
```

**.env.production**
```bash
BINANCE_US_API_KEY=prod_key
BINANCE_US_API_SECRET=prod_secret
```

Load with:
```bash
NODE_ENV=development npm run dev
NODE_ENV=production npm start
```

---

## Troubleshooting

### "Cannot find module" Error

Ensure you've built the project:
```bash
npm run build
```

### "Invalid signature" Error

1. Check API key and secret are correct
2. Ensure system clock is synchronized
3. Verify recvWindow is not too small

### "IP banned" Error

You've exceeded rate limits. Wait for the `Retry-After` period.

### Connection Refused

1. Check internet connection
2. Verify Binance.US is accessible from your location
3. Check if there's a firewall blocking requests

### API Key Not Working

1. Verify the key is for Binance.US (not Binance.com)
2. Check key permissions match your needs
3. Ensure IP restrictions allow your IP
4. Confirm the key hasn't expired

---

## Logging

The server logs to stderr to not interfere with MCP protocol:

```typescript
console.error("Binance.US MCP server started");
```

To enable verbose logging, you can modify the client to log requests:

```typescript
// In binanceUsClient.ts
const DEBUG = process.env.DEBUG === 'true';

if (DEBUG) {
  console.error(`Request: ${method} ${path}`, params);
}
```
