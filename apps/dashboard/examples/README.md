# Examples

Ready-to-use code examples for integrating Free Crypto News API.

## Available Examples

### curl.sh

Basic shell script using cURL to fetch news.

```bash
./curl.sh
```

### discord-bot.js

Discord bot that responds to news commands.

**Setup:**

```bash
npm install discord.js
export DISCORD_TOKEN=your-token
node discord-bot.js
```

**Commands:**

- `!news` - Latest crypto news
- `!bitcoin` - Bitcoin news
- `!defi` - DeFi news
- `!search <query>` - Search news

### slack-bot.js

Slack bot for crypto news in your workspace.

**Setup:**

```bash
npm install @slack/bolt
export SLACK_BOT_TOKEN=your-token
export SLACK_SIGNING_SECRET=your-secret
node slack-bot.js
```

### telegram-bot.py

Basic Telegram bot with news commands.

**Setup:**

```bash
pip install python-telegram-bot
export TELEGRAM_TOKEN=your-token
python telegram-bot.py
```

### telegram-digest.py

Advanced Telegram bot with scheduled daily digests.

**Setup:**

```bash
pip install python-telegram-bot aiohttp
export TELEGRAM_TOKEN=your-token
python telegram-digest.py
```

**Features:**

- `/news` - Latest news
- `/bitcoin` - Bitcoin news
- `/defi` - DeFi news
- `/trending` - Trending topics
- `/digest` - Full daily digest
- `/subscribe` - Daily digest subscription
- Scheduled digests at 9 AM UTC

### langchain-tool.py

LangChain tool integration for AI agents.

**Setup:**

```bash
pip install langchain openai
python langchain-tool.py
```

### ai-analysis.py

Demonstrates AI-powered article analysis.

**Setup:**

```bash
pip install requests
python ai-analysis.py
```

**Features:**

- Article summarization (short/medium/long)
- Sentiment analysis with confidence scores
- Fact extraction (entities, numbers, dates)
- Fact checking with verdicts
- Follow-up question generation
- Auto-categorization
- Translation to any language

### realtime-stream.js

Real-time news streaming using Server-Sent Events (SSE).

**Browser:**

```html
<script src="realtime-stream.js"></script>
```

**Node.js:**

```bash
npm install eventsource
node realtime-stream.js
```

**Features:**

- Live news updates every 30 seconds
- Breaking news alerts
- Price updates
- Auto-reconnect with exponential backoff
- Graceful shutdown handling

### x402-payment.py

Demonstrates x402 micropayment protocol for pay-per-request access.

**Setup:**

```bash
pip install requests eth-account
python x402-payment.py
```

**Features:**

- Get payment requirements from 402 response
- Create payment signatures
- Make authenticated requests
- Fallback to API key authentication

### api-key-usage.js

Shows how to use API keys and monitor usage/rate limits.

**Setup:**

```bash
export CRYPTO_NEWS_API_KEY=cda_free_xxxxx
node api-key-usage.js
```

**Features:**

- API key authentication
- Usage statistics
- Rate limit monitoring
- Error handling for 429 responses

## Authentication

### Free Endpoints (No Auth)

Public endpoints like `/api/news`, `/api/search`, and `/api/trending` require no authentication.

### Premium Endpoints (Auth Required)

Premium endpoints (`/api/v1/*`) require either:

1. **API Key** - Get free at [/developers](https://free-crypto-news.vercel.app/developers)

   ```bash
   curl -H "X-API-Key: cda_free_xxxxx" https://free-crypto-news.vercel.app/api/v1/coins
   ```

2. **x402 Micropayment** - Pay per request with USDC
   ```bash
   curl -H "X-PAYMENT: <payment-header>" https://free-crypto-news.vercel.app/api/v1/coins
   ```

See [Authentication Guide](../docs/AUTHENTICATION.md) for details.

## Self-Hosted

To use a self-hosted API, change the base URL in each example:

```javascript
const API_URL = 'https://your-instance.vercel.app';
```

```python
API_URL = 'https://your-instance.vercel.app'
```

## More Resources

- [API Documentation](../docs/API.md)
- [AI Features Guide](../docs/AI-FEATURES.md)
- [Real-Time Guide](../docs/REALTIME.md)
- [SDK Documentation](../sdk/)
