# ChatGPT Developer Mode Setup

Connect Universal Crypto MCP to ChatGPT using Developer Mode.

---

## Prerequisites

- ChatGPT Pro, Plus, Business, Enterprise, or Education account
- [Developer Mode enabled](https://chatgpt.com/#settings/Connectors/Advanced)
- Universal Crypto MCP server running (local or deployed)

---

## Quick Start

### 1. Start the HTTP Server

```bash
# Local development
bun dev:http

# Or with npm
npm run dev:http

# Production
bun start:http
```

The server will start on `http://localhost:3001` by default.

### 2. Enable Developer Mode in ChatGPT

1. Go to [ChatGPT Settings](https://chatgpt.com/#settings/Connectors)
2. Click **Advanced settings**
3. Enable **Developer mode**

### 3. Create an App

1. In ChatGPT Settings → Apps, click **Create app**
2. Enter your MCP server URL:
   - Local: `http://localhost:3001/mcp`
   - Deployed: `https://your-server.com/mcp`
3. Select **No Authentication** (or configure OAuth if needed)
4. Click **Create**

### 4. Use in Conversations

1. Start a new conversation
2. Click the **Plus menu** in the composer
3. Select **Developer mode**
4. Choose your Universal Crypto MCP app
5. Start chatting!

---

## Server Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/mcp` | POST | Main MCP protocol endpoint |
| `/mcp` | GET | SSE stream for notifications |
| `/mcp` | DELETE | Terminate session |
| `/health` | GET | Health check |
| `/` | GET | Server info |

---

## Example Prompts

### Get Crypto News

```
Use the Universal Crypto MCP to get the latest Bitcoin news.
Do not use other tools.
```

### Check Token Balance

```
Using Universal Crypto MCP's "get_token_balance" tool, check the USDT 
balance for 0x... on Ethereum mainnet.
```

### Analyze Token Security

```
Use the "detect_rug_pull_risk" tool from Universal Crypto MCP to analyze 
the token at 0x... on BSC.
```

### Get Gas Prices

```
Get current gas prices on Ethereum using Universal Crypto MCP.
Compare with Arbitrum and Base.
```

### Swap Quote

```
Use Universal Crypto MCP to get a quote for swapping 1 ETH to USDC 
on Uniswap (Ethereum mainnet).
```

---

## Tool Categories

### Read-Only Tools (No Confirmation)

These tools are marked with `readOnlyHint: true` and won't require confirmation:

- `get_balance` - Check wallet balance
- `get_token_info` - Get token details
- `get_token_balance` - Check token balance
- `resolve_ens` - Resolve ENS names
- `get_gas_price` - Current gas prices
- `get_crypto_news` - Fetch news
- `get_swap_quote` - DEX price quotes
- `detect_honeypot` - Security analysis
- `get_block` - Block information

### Write Tools (Requires Confirmation)

These tools perform transactions and require confirmation:

- `transfer_tokens` - Send tokens
- `swap_tokens` - Execute swaps
- `approve_token` - Token approvals
- `deploy_contract` - Deploy contracts
- `stake_eth_lido` - Stake ETH

---

## Deployment Options

### Option 1: Local Development

```bash
# Start server
bun dev:http

# Expose via ngrok (for ChatGPT access)
ngrok http 3001
```

Use the ngrok URL in ChatGPT: `https://xxxx.ngrok.io/mcp`

### Option 2: Deploy to Cloud

#### Vercel

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel
```

#### Railway

```bash
# Link to Railway
railway link

# Deploy
railway up
```

#### Docker

```dockerfile
FROM oven/bun:1
WORKDIR /app
COPY package.json bun.lockb ./
RUN bun install --frozen-lockfile
COPY . .
RUN bun run build
EXPOSE 3001
CMD ["bun", "start:http"]
```

---

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `PORT` | Server port (default: 3001) | No |
| `PRIVATE_KEY` | Wallet private key | For transactions |
| `LOG_LEVEL` | DEBUG, INFO, WARN, ERROR | No |

---

## Troubleshooting

### "No valid session found"

The session expired or wasn't initialized. ChatGPT will automatically retry.

### Tool not found

1. Refresh the app in ChatGPT Settings → Apps → Your App → Refresh
2. Check the server is running: `curl http://localhost:3001/health`

### Connection refused

1. Ensure the server is running: `bun dev:http`
2. Check firewall settings
3. For local development, use ngrok or similar tunnel

### CORS errors

The server includes CORS headers by default. If deploying behind a proxy, ensure CORS headers are preserved.

---

## Security Considerations

⚠️ **Important Security Notes:**

1. **Private Keys**: Never expose private keys in public deployments
2. **Write Actions**: Always review transaction details before confirming
3. **Public Deployment**: Consider adding authentication for production
4. **Rate Limiting**: Add rate limiting for public endpoints

### Recommended: Read-Only Mode

For public deployments, consider running in read-only mode by not setting `PRIVATE_KEY`:

```bash
PORT=3001 bun start:http
```

This disables all write operations (transfers, swaps, etc.).

---

## Protocol Details

### MCP Session Flow

```
1. ChatGPT → POST /mcp (initialize)
2. Server → Returns session ID
3. ChatGPT → POST /mcp (tool calls)
4. Server → Returns tool results
5. (Optional) GET /mcp for SSE notifications
6. DELETE /mcp to end session
```

### Supported MCP Features

- ✅ Tools (read and write)
- ✅ Prompts
- ✅ Resources
- ✅ Session management
- ✅ Streamable HTTP transport
- ✅ SSE notifications

---

## Credits

Built by **[nich](https://x.com/nichxbt)** ([github.com/nirholas](https://github.com/nirholas))
