# HTTP Server Mode

Documentation for running BNB-Chain-MCP as an HTTP server for web integrations and ChatGPT Developer Mode.

---

## Overview

HTTP mode enables BNB-Chain-MCP to serve requests over HTTP, making it compatible with:

- **ChatGPT Developer Mode** - OpenAI's custom tools
- **Web Applications** - Direct API integration
- **Custom Agents** - LangChain, AutoGen, CrewAI
- **REST Clients** - Postman, curl, httpie

---

## Quick Start

### Start the Server

```bash
# Using npx (recommended)
npx @nirholas/bnb-chain-mcp@latest --http

# With environment variables
PRIVATE_KEY=0x... PORT=3001 npx @nirholas/bnb-chain-mcp@latest --http

# Local development
cd bnb-chain-mcp
bun run dev:http
```

### Default Configuration

| Setting | Value |
|---------|-------|
| Port | 3001 |
| Host | 0.0.0.0 |
| Protocol | HTTP |
| MCP Endpoint | `/mcp` |

---

## ChatGPT Developer Mode Setup

### Prerequisites

1. ChatGPT Plus or Team subscription
2. Developer Mode enabled in settings
3. BNB-Chain-MCP running in HTTP mode

### Step-by-Step Setup

#### 1. Start the Server

```bash
npx @nirholas/bnb-chain-mcp@latest --http
```

Server starts at `http://localhost:3001`

#### 2. Expose to Internet

For ChatGPT to reach your local server, use a tunnel:

=== "ngrok"
    ```bash
    ngrok http 3001
    # Copy the https URL: https://abc123.ngrok.io
    ```

=== "cloudflared"
    ```bash
    cloudflared tunnel --url http://localhost:3001
    # Copy the https URL
    ```

=== "localtunnel"
    ```bash
    npx localtunnel --port 3001
    # Copy the https URL
    ```

#### 3. Configure in ChatGPT

1. Go to **Settings** → **Apps** → **Developer Mode**
2. Click **Create App**
3. Enter:
   - **Name:** BNB-Chain-MCP
   - **URL:** `https://your-tunnel-url.ngrok.io/mcp`
4. Click **Save**

#### 4. Use in Conversations

Start a new conversation and select your app from the Developer Mode menu. Then ask:

> "What's the current price of Ethereum?"

ChatGPT will call your MCP server to get the answer.

---

## API Endpoints

### MCP Protocol Endpoint

```
POST /mcp
Content-Type: application/json
```

Handles MCP protocol messages including tool calls, resource requests, and prompts.

### Health Check

```
GET /health
```

Returns server status:

```json
{
  "status": "ok",
  "version": "1.0.0",
  "uptime": 3600,
  "tools": 120
}
```

### Tool List

```
GET /tools
```

Returns available tools:

```json
{
  "tools": [
    {
      "name": "network_get_info",
      "description": "Get network information",
      "inputSchema": {...}
    }
  ]
}
```

---

## Request/Response Format

### Tool Call Request

```bash
curl -X POST http://localhost:3001/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/call",
    "params": {
      "name": "market_get_coin_by_id",
      "arguments": {
        "coinId": "bitcoin"
      }
    }
  }'
```

### Tool Call Response

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "content": [
      {
        "type": "text",
        "text": "{\"id\":\"bitcoin\",\"name\":\"Bitcoin\",\"price\":43250.00,...}"
      }
    ]
  }
}
```

### List Tools Request

```bash
curl -X POST http://localhost:3001/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/list"
  }'
```

---

## Configuration

### Environment Variables

```bash
# Server configuration
PORT=3001                          # HTTP port
HOST=0.0.0.0                       # Listen address

# Wallet (for write operations)
PRIVATE_KEY=0x...                  # Wallet private key

# API Keys
COINGECKO_API_KEY=your_key
COINSTATS_API_KEY=your_key
LUNARCRUSH_API_KEY=your_key
CRYPTOPANIC_API_KEY=your_key

# Logging
LOG_LEVEL=INFO                     # DEBUG, INFO, WARN, ERROR
```

### CORS Configuration

By default, CORS is enabled for all origins. For production, restrict:

```bash
CORS_ORIGINS=https://chat.openai.com,https://yourapp.com
```

---

## Production Deployment

### Docker

```dockerfile
FROM oven/bun:1

WORKDIR /app
COPY package.json bun.lockb ./
RUN bun install --frozen-lockfile

COPY . .

EXPOSE 3001
ENV PORT=3001

CMD ["bun", "run", "start:http"]
```

```bash
docker build -t bnb-chain-mcp .
docker run -p 3001:3001 -e PRIVATE_KEY=0x... bnb-chain-mcp
```

### Docker Compose

```yaml
version: '3.8'
services:
  crypto-mcp:
    build: .
    ports:
      - "3001:3001"
    environment:
      - PORT=3001
      - PRIVATE_KEY=${PRIVATE_KEY}
      - COINGECKO_API_KEY=${COINGECKO_API_KEY}
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3001/health"]
      interval: 30s
      timeout: 10s
      retries: 3
```

### Kubernetes

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: crypto-mcp
spec:
  replicas: 2
  selector:
    matchLabels:
      app: crypto-mcp
  template:
    metadata:
      labels:
        app: crypto-mcp
    spec:
      containers:
      - name: crypto-mcp
        image: your-registry/bnb-chain-mcp:latest
        ports:
        - containerPort: 3001
        env:
        - name: PORT
          value: "3001"
        - name: PRIVATE_KEY
          valueFrom:
            secretKeyRef:
              name: crypto-mcp-secrets
              key: private-key
        resources:
          requests:
            memory: "256Mi"
            cpu: "100m"
          limits:
            memory: "512Mi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /health
            port: 3001
          initialDelaySeconds: 10
          periodSeconds: 30
---
apiVersion: v1
kind: Service
metadata:
  name: crypto-mcp
spec:
  selector:
    app: crypto-mcp
  ports:
  - port: 80
    targetPort: 3001
  type: LoadBalancer
```

---

## Load Balancing

### Nginx Configuration

```nginx
upstream crypto_mcp {
    least_conn;
    server 127.0.0.1:3001;
    server 127.0.0.1:3002;
    server 127.0.0.1:3003;
}

server {
    listen 80;
    server_name api.yourservice.com;

    location /mcp {
        proxy_pass http://crypto_mcp;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_cache_bypass $http_upgrade;
        
        # Timeouts for long-running operations
        proxy_read_timeout 300s;
        proxy_send_timeout 300s;
    }

    location /health {
        proxy_pass http://crypto_mcp;
    }
}
```

---

## Security

### TLS/HTTPS

For production, always use HTTPS:

```bash
# Using Let's Encrypt with nginx
certbot --nginx -d api.yourservice.com
```

### API Key Authentication

Implement authentication middleware:

```typescript
// Add to server configuration
const API_KEY = process.env.API_KEY;

app.use('/mcp', (req, res, next) => {
  const key = req.headers['x-api-key'];
  if (key !== API_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
});
```

### Rate Limiting

```typescript
import rateLimit from 'express-rate-limit';

const limiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute
  message: { error: 'Rate limit exceeded' }
});

app.use('/mcp', limiter);
```

---

## Monitoring

### Prometheus Metrics

```typescript
import { collectDefaultMetrics, register } from 'prom-client';

collectDefaultMetrics();

app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});
```

### Logging

```bash
# Enable structured logging
LOG_FORMAT=json LOG_LEVEL=INFO npx @nirholas/bnb-chain-mcp --http

# Output
{"level":"info","timestamp":"2024-01-26T12:00:00Z","message":"Tool called","tool":"market_get_coin_by_id","duration":245}
```

---

## Troubleshooting

### Common Issues

| Issue | Solution |
|-------|----------|
| Port already in use | Change PORT env or kill existing process |
| Connection refused | Check firewall rules |
| CORS errors | Configure CORS_ORIGINS |
| Timeout errors | Increase proxy timeouts |
| 502 Bad Gateway | Check server is running |

### Debug Mode

```bash
LOG_LEVEL=DEBUG npx @nirholas/bnb-chain-mcp --http
```

### Test Connection

```bash
# Health check
curl http://localhost:3001/health

# List tools
curl -X POST http://localhost:3001/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'

# Call tool
curl -X POST http://localhost:3001/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"network_get_info","arguments":{"network":"ethereum"}}}'
```

---

## Next Steps

- [LangChain Integration](langchain.md) - Use with Python AI frameworks
- [AutoGen Integration](autogen.md) - Multi-agent systems
- [Custom Clients](custom-clients.md) - Build your own client
