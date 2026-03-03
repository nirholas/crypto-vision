---
name: Free Crypto News API 
type: api
category: cryptocurrency
auth: none
pricing: free
endpoints: 150+
sources: 200+
llms_txt: https://cryptocurrency.cv/llms.txt
openapi: https://cryptocurrency.cv/api/openapi.json
mcp_server: "@anthropic-ai/mcp-server-crypto-news"
---

🌐 **Languages (42):** [English](README.md) | [العربية](README.ar.md) | [Български](README.bg.md) | [বাংলা](README.bn.md) | [Čeština](README.cs.md) | [Dansk](README.da.md) | [Deutsch](README.de.md) | [Ελληνικά](README.el.md) | [Español](README.es.md) | [فارسی](README.fa.md) | [Suomi](README.fi.md) | [Français](README.fr.md) | [עברית](README.he.md) | [हिन्दी](README.hi.md) | [Hrvatski](README.hr.md) | [Magyar](README.hu.md) | [Indonesia](README.id.md) | [Italiano](README.it.md) | [日本語](README.ja.md) | [한국어](README.ko.md) | [Melayu](README.ms.md) | [Nederlands](README.nl.md) | [Norsk](README.no.md) | [Polski](README.pl.md) | [Português](README.pt.md) | [Română](README.ro.md) | [Русский](README.ru.md) | [Slovenčina](README.sk.md) | [Slovenščina](README.sl.md) | [Српски](README.sr.md) | [Svenska](README.sv.md) | [Kiswahili](README.sw.md) | [தமிழ்](README.ta.md) | [తెలుగు](README.te.md) | [ไทย](README.th.md) | [Filipino](README.tl.md) | [Türkçe](README.tr.md) | [Українська](README.uk.md) | [اردو](README.ur.md) | [Tiếng Việt](README.vi.md) | [简体中文](README.zh-CN.md) | [繁體中文](README.zh-TW.md)

---

# 🆓 Free Crypto News API 

<p align="center">
  <a href="https://github.com/nirholas/free-crypto-news/stargazers"><img src="https://img.shields.io/github/stars/nirholas/free-crypto-news?style=for-the-badge&logo=github&color=yellow" alt="GitHub Stars"></a>
  <a href="https://github.com/nirholas/free-crypto-news/blob/main/LICENSE"><img src="https://img.shields.io/github/license/nirholas/free-crypto-news?style=for-the-badge&color=blue" alt="License"></a>
  <a href="https://github.com/nirholas/free-crypto-news/actions/workflows/ci.yml"><img src="https://img.shields.io/github/actions/workflow/status/nirholas/free-crypto-news/ci.yml?style=for-the-badge&logo=github-actions&label=CI" alt="CI Status"></a>
  <a href="https://codecov.io/gh/nirholas/free-crypto-news"><img src="https://img.shields.io/codecov/c/github/nirholas/free-crypto-news?style=for-the-badge&logo=codecov&label=Coverage" alt="Coverage"></a>
  <a href="https://github.com/nirholas/free-crypto-news/issues"><img src="https://img.shields.io/github/issues/nirholas/free-crypto-news?style=for-the-badge&color=orange" alt="Issues"></a>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@nirholas/crypto-news"><img src="https://img.shields.io/npm/v/@nirholas/crypto-news?style=flat-square&logo=npm&color=red" alt="npm version"></a>
  <a href="https://www.npmjs.com/package/@nirholas/crypto-news"><img src="https://img.shields.io/npm/dm/@nirholas/crypto-news?style=flat-square&logo=npm" alt="npm downloads"></a>
  <a href="https://pypi.org/project/free-crypto-news/"><img src="https://img.shields.io/pypi/v/free-crypto-news?style=flat-square&logo=python&color=blue" alt="PyPI version"></a>
  <a href="https://hub.docker.com/r/nirholas/free-crypto-news"><img src="https://img.shields.io/docker/pulls/nirholas/free-crypto-news?style=flat-square&logo=docker" alt="Docker Pulls"></a>
  <a href="https://discord.gg/cryptonews"><img src="https://img.shields.io/discord/1234567890?style=flat-square&logo=discord&label=Discord" alt="Discord"></a>
</p>

> **🤖 AI Agents:** Free, no-auth crypto news API with 200+ sources. `curl https://cryptocurrency.cv/api/news` • [LLM Docs](/llms.txt) • [Full API Docs](/llms-full.txt) • [OpenAPI](/api/openapi.json) • MCP: `npx @anthropic-ai/mcp-server-crypto-news`

<p align="center">
  <a href="#-quick-start">Quick Start</a> •
  <a href="#-sdks">SDKs</a> •
  <a href="#-api-endpoints">API</a> •
  <a href="#-cli">CLI</a> •
  <a href="#-docker">Docker</a> •
  <a href="https://cryptocurrency.cv/developers">Docs</a>
</p>

<p align="center">
  <img src=".github/demo.svg" alt="Free Crypto News API Demo" width="700">
</p>

> ⭐ **If you find this useful, please star the repo!** It helps others discover this project and motivates continued development.

---

Get real-time crypto news from **200+ sources** with one API call. 

```bash
curl https://cryptocurrency.cv/api/news
```

---

|                   | Free Crypto News                | CryptoPanic  | Others   |
| ----------------- | ------------------------------- | ------------ | -------- |
| **Price**         | 🆓 Free forever                 | $29-299/mo   | Paid     |
| **API Key**       | ❌ None needed                  | Required     | Required |
| **Rate Limit**    | Unlimited\*                     | 100-1000/day | Limited  |
| **Sources**       | 130+ English + 75 International | 1            | Varies   |
| **Historical**    | 📚 662,000+ articles (2017-2025) | Limited      | None     |
| **International** | 🌏 KO, ZH, JA, ES + translation | No           | No       |
| **Self-host**     | ✅ One click                    | No           | No       |
| **PWA**           | ✅ Installable                  | No           | No       |
| **MCP**           | ✅ Claude + ChatGPT             | No           | No       |

---

## 📚 Historical Archive

Access **662,000+ crypto news articles** spanning 2017-2025 — the largest free crypto news dataset available!

| Metric | Value |
| ------ | ----- |
| **Total Articles** | 662,047 |
| **Date Range** | September 2017 - February 2025 |
| **Languages** | English + Chinese |
| **Unique Sources** | 100+ |
| **Top Tickers** | BTC (81k), ETH (50k), USDT (19k), SOL (16k), XRP (13k) |
| **Search Terms** | 79,512 indexed |

**Data Sources:**
- **CryptoPanic** — 346,031 articles from 200+ English sources
- **Odaily 星球日报** — 316,016 Chinese crypto news articles

```bash
# Query historical archive
curl "https://cryptocurrency.cv/api/archive?date=2024-01"

# Search by ticker
curl "https://cryptocurrency.cv/api/archive?ticker=BTC&limit=100"

# Full-text search
curl "https://cryptocurrency.cv/api/archive?q=bitcoin%20etf"
```

📁 Raw data available in [`/archive/`](archive/) — JSONL format by month.

---

## 🌿 Branches

| Branch                 | Description                                                                                                                       |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `main`                 | Stable production branch — Original API-focused design                                                                            |

To try the redesign locally:

```bash
git checkout redesign/pro-news-ui
npm install && npm run dev
```

---

## 🌍 International News Sources

Get crypto news from **75 international sources** across 30+ languages — with automatic English translation!

### Supported Sources by Language

| Language           | Count | Sample Sources                                                                                                             |
| ------------------ | ----- | -------------------------------------------------------------------------------------------------------------------------- |
| 🇨🇳 Chinese (zh)    | 10    | 8BTC, Jinse Finance, Odaily, ChainNews, PANews, TechFlow, BlockBeats, MarsBit, Wu Blockchain, Foresight News               |
| 🇰🇷 Korean (ko)     | 9     | Block Media, TokenPost, CoinDesk Korea, Decenter, Cobak, The B.Chain, Upbit Blog, Blockchain Today Korea, CryptoQuant Blog |
| 🇯🇵 Japanese (ja)   | 6     | CoinPost, CoinDesk Japan, Cointelegraph Japan, btcnews.jp, Crypto Times Japan, CoinJinja                                   |
| 🇧🇷 Portuguese (pt) | 5     | Cointelegraph Brasil, Livecoins, Portal do Bitcoin, BeInCrypto Brasil, Bitcoin Block                                       |
| 🇮🇳 Hindi (hi)      | 5     | CoinSwitch, CoinDCX, WazirX, ZebPay, Crypto News India                                                                     |
| 🇪🇸 Spanish (es)    | 5     | Cointelegraph Español, Diario Bitcoin, CriptoNoticias, BeInCrypto Español, Bitcoiner Today                                 |
| 🇩🇪 German (de)     | 4     | BTC-ECHO, Cointelegraph Deutsch, Coincierge, CryptoMonday                                                                  |
| 🇫🇷 French (fr)     | 4     | Journal du Coin, Cryptonaute, Cointelegraph France, Cryptoast                                                              |
| 🇮🇷 Persian (fa)    | 4     | Arz Digital, Mihan Blockchain, Ramz Arz, Nobitex                                                                           |
| 🇹🇷 Turkish (tr)    | 3     | Cointelegraph Türkçe, Koin Medya, Coinsider                                                                                |
| 🇷🇺 Russian (ru)    | 3     | ForkLog, Cointelegraph Russia, Bits.Media                                                                                  |
| 🇮🇹 Italian (it)    | 3     | Cointelegraph Italia, The Cryptonomist, Criptovalute.it                                                                    |
| 🇮🇩 Indonesian (id) | 3     | Cointelegraph Indonesia, Blockchain Media, Pintu Academy                                                                   |
| 🇻🇳 Vietnamese (vi) | 2     | Tạp chí Bitcoin, Coin68                                                                                                    |
| 🇹🇭 Thai (th)       | 2     | Siam Blockchain, Bitcoin Addict Thailand                                                                                   |
| 🇵🇱 Polish (pl)     | 2     | Kryptowaluty.pl, Bitcoin.pl                                                                                                |
| 🇳🇱 Dutch (nl)      | 2     | Bitcoin Magazine NL, Crypto Insiders                                                                                       |
| 🇸🇦 Arabic (ar)     | 2     | Cointelegraph Arabic, ArabiCrypto                                                                                          |

### Legacy Region View

| Region | Sources |
| 🇰🇷 **Korea** | Block Media, TokenPost, CoinDesk Korea |
| 🇨🇳 **China** | 8BTC (巴比特), Jinse Finance (金色财经), Odaily (星球日报) |
| 🇯🇵 **Japan** | CoinPost, CoinDesk Japan, Cointelegraph Japan |
| 🇪🇸 **Latin America** | Cointelegraph Español, Diario Bitcoin, CriptoNoticias |

### Quick Examples

**cURL:**
```bash
# Get latest news
curl "https://cryptocurrency.cv/api/news?limit=10"

# Get Bitcoin sentiment
curl "https://cryptocurrency.cv/api/ai/sentiment?asset=BTC"

# Search articles
curl "https://cryptocurrency.cv/api/search?q=ethereum%20upgrade"

# Get international news with translation
curl "https://cryptocurrency.cv/api/news/international?language=ko&translate=true"
```

**Python:**
```python
import requests

BASE_URL = "https://cryptocurrency.cv"

# Get latest news
news = requests.get(f"{BASE_URL}/api/news?limit=10").json()
for article in news["articles"]:
    print(f"• {article['title']} ({article['source']})")

# Get Bitcoin sentiment analysis
sentiment = requests.get(f"{BASE_URL}/api/ai/sentiment?asset=BTC").json()
print(f"BTC Sentiment: {sentiment['label']} ({sentiment['score']:.2f})")

# Get Fear & Greed Index
fg = requests.get(f"{BASE_URL}/api/market/fear-greed").json()
print(f"Market: {fg['classification']} ({fg['value']}/100)")

# Stream real-time updates
import sseclient
response = requests.get(f"{BASE_URL}/api/stream", stream=True)
client = sseclient.SSEClient(response)
for event in client.events():
    print(f"New: {event.data}")
```

**JavaScript:**
```javascript
const BASE_URL = 'https://cryptocurrency.cv';

// Get latest news
const news = await fetch(`${BASE_URL}/api/news?limit=10`).then(r => r.json());
news.articles.forEach(a => console.log(`• ${a.title} (${a.source})`));

// Get AI-powered summary
const summary = await fetch(`${BASE_URL}/api/summarize?style=bullet`).then(r => r.json());
console.log(summary.summary);

// Stream real-time updates
const events = new EventSource(`${BASE_URL}/api/stream`);
events.onmessage = (e) => console.log('New:', JSON.parse(e.data).title);

// Ask questions about crypto news
const answer = await fetch(`${BASE_URL}/api/ask?q=What's happening with Bitcoin?`).then(r => r.json());
console.log(answer.response);
```

📚 **[Full Tutorials & Examples](docs/tutorials/index.md)** — 19 comprehensive guides covering 150+ endpoints with complete working code.

### Features

- ✅ **Auto-translation** to English via Groq AI
- ✅ **7-day translation cache** for efficiency
- ✅ **Original + English** text preserved
- ✅ **Rate-limited** (1 req/sec) to respect APIs
- ✅ **Fallback handling** for unavailable sources
- ✅ **Deduplication** across sources

See [API docs](docs/API.md#get-apinewsinternational) for full details.

---

## 📱 Progressive Web App (PWA)

Free Crypto News is a **fully installable PWA** that works offline!

### Features

| Feature                   | Description                                     |
| ------------------------- | ----------------------------------------------- |
| 📲 **Installable**        | Add to home screen on any device                |
| 📴 **Offline Mode**       | Read cached news without internet               |
| 🔔 **Push Notifications** | Get breaking news alerts                        |
| ⚡ **Lightning Fast**     | Aggressive caching strategies                   |
| 🔄 **Background Sync**    | Auto-updates when back online                   |
| 🎯 **App Shortcuts**      | Quick access to Latest, Breaking, Bitcoin       |
| 📤 **Share Target**       | Share links directly to the app                 |
| 🚨 **Real-Time Alerts**   | Configurable alerts for price & news conditions |

### Install the App

**Desktop (Chrome/Edge):**

1. Visit [cryptocurrency.cv](https://cryptocurrency.cv)
2. Click the install icon (⊕) in the address bar
3. Click "Install"

**iOS Safari:**

1. Visit the site in Safari
2. Tap Share (📤) → "Add to Home Screen"

**Android Chrome:**

1. Visit the site
2. Tap the install banner or Menu → "Install app"

### Service Worker Caching

The PWA uses smart caching strategies:

| Content       | Strategy                         | Cache Duration |
| ------------- | -------------------------------- | -------------- |
| API responses | Network-first                    | 5 minutes      |
| Static assets | Cache-first                      | 7 days         |
| Images        | Cache-first                      | 30 days        |
| Navigation    | Network-first + offline fallback | 24 hours       |

### Keyboard Shortcuts

Power through news with keyboard navigation:

| Shortcut  | Action                  |
| --------- | ----------------------- |
| `j` / `k` | Next / previous article |
| `/`       | Focus search            |
| `Enter`   | Open selected article   |
| `d`       | Toggle dark mode        |
| `g h`     | Go to Home              |
| `g t`     | Go to Trending          |
| `g s`     | Go to Sources           |
| `g b`     | Go to Bookmarks         |
| `?`       | Show all shortcuts      |
| `Escape`  | Close modal             |

📖 **Full user guide:** [docs/USER-GUIDE.md](docs/USER-GUIDE.md)

---

## 🌐 Interactive Pages

The web interface provides rich, interactive pages for exploring crypto data:

### 📰 News & Content

| Page              | Description                     |
| ----------------- | ------------------------------- |
| `/`               | Home page with latest news feed |
| `/trending`       | Trending topics & sentiment     |
| `/search`         | Full-text search with filters   |
| `/sources`        | Browse news by source           |
| `/source/[id]`    | Individual source page          |
| `/tags/[slug]`    | Tag-based news filtering        |
| `/article/[slug]` | Article detail page             |
| `/topic/[slug]`   | Topic-based news                |
| `/topics`         | All topics overview             |
| `/buzz`           | Social buzz & mentions          |

### 📊 Market Data

| Page                  | Description                            |
| --------------------- | -------------------------------------- |
| `/markets`            | Market overview with prices            |
| `/markets/categories` | Market categories browser              |
| `/coin/[coinId]`      | Detailed coin page (CoinGecko-quality) |
| `/fear-greed`         | Fear & Greed Index with breakdown      |
| `/funding`            | Funding rates across exchanges         |
| `/signals`            | AI trading signals (educational)       |
| `/whales`             | Whale alert tracking                   |
| `/orderbook`          | Order book visualization               |
| `/liquidations`       | Liquidation tracking                   |
| `/dominance`          | Market dominance charts                |
| `/movers`             | Top gainers/losers                     |
| `/heatmap`            | Market heatmap visualization           |
| `/gas`                | ETH gas tracker                        |
| `/arbitrage`          | Arbitrage opportunities                |
| `/options`            | Options market data                    |
| `/oracle`             | Oracle price feeds                     |

### 🧠 AI Analysis

| Page            | Description                   |
| --------------- | ----------------------------- |
| `/ai`           | AI analysis dashboard         |
| `/ai-agent`     | AI agent interface            |
| `/factcheck`    | Claim verification dashboard  |
| `/entities`     | Entity extraction viewer      |
| `/claims`       | Extracted claims browser      |
| `/clickbait`    | Clickbait detection & scoring |
| `/narratives`   | Market narrative tracking     |
| `/onchain`      | On-chain event correlation    |
| `/origins`      | Original source finder        |
| `/citations`    | Citation network explorer     |
| `/sentiment`    | Sentiment analysis            |
| `/coverage-gap` | Coverage gap analysis         |

### 🔬 Research Tools

| Page           | Description                     |
| -------------- | ------------------------------- |
| `/backtest`    | News-based strategy backtesting |
| `/influencers` | Influencer prediction tracking  |
| `/predictions` | Prediction market integration   |
| `/portfolio`   | Portfolio-based news feed       |
| `/screener`    | Custom news screener            |
| `/correlation` | News-price correlation analysis |

### ⚙️ User Features

| Page         | Description               |
| ------------ | ------------------------- |
| `/settings`  | User preferences & themes |
| `/watchlist` | Personalized watchlist    |
| `/bookmarks` | Saved articles            |
| `/saved`     | Saved content manager     |
| `/read`      | Reading list              |
| `/digest`    | Personalized news digest  |

### 📖 Documentation & Tools

| Page          | Description                 |
| ------------- | --------------------------- |
| `/developers` | Developer portal & API docs |
| `/examples`   | Code examples & demos       |
| `/about`      | About the project           |
| `/pricing`    | Pricing tiers               |
| `/install`    | Installation guide          |
| `/blog`       | Project blog                |
| `/calculator` | Crypto calculator           |
| `/compare`    | Coin comparison             |
| `/charts`     | Advanced charting           |
| `/analytics`  | Usage analytics             |
| `/regulatory` | Regulatory tracking         |
| `/status`     | System health dashboard     |

### 🎨 UI/UX Features

| Feature | Description |
| ------- | ----------- |
| Skeleton Loading | Full-page loading skeletons during navigation |
| Swipe Gestures | Swipe-to-close mobile navigation |
| Bookmark/Share | Quick action buttons on news cards |
| Scroll Indicators | Fade edges + arrows for horizontal scroll |
| Dark Mode | System-aware with flash prevention |
| Reduced Motion | Respects `prefers-reduced-motion` |
| Accessibility | Skip links, focus rings, ARIA labels |

---

### Generate PNG Icons

SVG icons work in modern browsers. For legacy support:

```bash
npm install sharp
npm run pwa:icons
```

---

## Sources

We aggregate from **130+ trusted English outlets** across 21 categories:

### 📰 Tier 1 News Outlets

- 🟠 **CoinDesk** — General crypto news
- 🔵 **The Block** — Institutional & research
- 🟢 **Decrypt** — Web3 & culture
- 🟡 **CoinTelegraph** — Global crypto news
- 🟤 **Bitcoin Magazine** — Bitcoin maximalist
- 🟣 **Blockworks** — DeFi & institutions
- 🔴 **The Defiant** — DeFi native

### 🏦 Institutional Research

- **Galaxy Digital** — Institutional-grade research
- **Grayscale** — Market reports
- **CoinShares** — Weekly fund flows
- **Pantera Capital** — Blockchain letters
- **Multicoin Capital** — Investment thesis
- **ARK Invest** — Innovation research

### 📊 On-Chain Analytics

- **Glassnode** — On-chain metrics
- **Messari** — Protocol research
- **Kaiko** — Market microstructure
- **CryptoQuant** — Exchange flows
- **Coin Metrics** — Network data

### 🎯 Macro & Quant

- **Lyn Alden** — Macro analysis
- **AQR Insights** — Quantitative research
- **Two Sigma** — Data science
- **Deribit Insights** — Options/derivatives

### 💼 Traditional Finance

- **Bloomberg Crypto** — Mainstream coverage
- **Reuters Crypto** — Wire service
- **Goldman Sachs** — Bank research
- **Finextra** — Fintech news

---

## Endpoints

| Endpoint                            | Description                            |
| ----------------------------------- | -------------------------------------- |
| `/api/news`                         | Latest from all sources                |
| `/api/news?category=institutional`  | Filter by category                     |
| `/api/news/categories`              | List all categories                    |
| `/api/news/international`           | International sources with translation |
| `/api/search?q=bitcoin`             | Search by keywords                     |
| `/api/defi`                         | DeFi-specific news                     |
| `/api/bitcoin`                      | Bitcoin-specific news                  |
| `/api/breaking`                     | Last 2 hours only                      |
| `/api/trending`                     | Trending topics with sentiment         |
| `/api/tags`                         | Tag discovery and filtering            |
| `/api/archive`                      | Historical news archive                |
| `/api/archive/status`               | Archive health status                  |
| `/api/rss`                          | RSS 2.0 feed                           |
| `/api/atom`                         | Atom feed                              |
| `/api/opml`                         | OPML export for RSS readers            |
| `/api/health`                       | API health check                       |
| `/api/cache`                        | Cache statistics                       |
| `/api/stats`                        | API usage statistics                   |
| `/api/webhooks`                     | Webhook registration                   |
| `/api/push`                         | Web Push notifications                 |
| `/api/newsletter`                   | Newsletter subscription                |
| `/api/alerts`                       | Configurable alert rules               |
| `/api/sse`                          | Server-Sent Events stream              |
| `/api/ws`                           | WebSocket connection info              |
| `/api/export`                       | Data export (JSON, CSV, Parquet)       |
| `/api/exports`                      | Bulk export job management             |
| `/api/storage/cas`                  | Content-addressable storage            |
| `/api/views`                        | Article view tracking                  |
| `/api/register`                     | API key registration                   |
| `/api/keys`                         | API key management                     |
| `/api/gateway`                      | Unified API gateway for integrations   |
| `/api/docs`                         | Interactive Swagger UI documentation   |
| `/api/openapi.json`                 | OpenAPI 3.1 specification              |
| `/api/v1/`                          | Legacy v1 API endpoints                |
| `/api/market/orderbook`             | Order book depth for trading pairs     |
| `/api/social`                       | Aggregated social media trends         |
| `/api/social/monitor`               | Real-time social monitoring            |
| `/api/premium/streams/orderbook`    | Real-time order book stream            |
| `/api/premium/streams/liquidations` | Real-time liquidation stream           |
| `/api/premium/export/history`       | Historical data export                 |
| `/api/cron/archive`                 | Archive maintenance (cron job)         |
| `/api/cron/social`                  | Social data collection (cron job)      |
| `/api/cron/feeds`                   | Feed health monitoring (cron job)      |
| `/api/market/orderbook`             | Order book depth for trading pairs     |
| `/api/social`                       | Aggregated social media trends         |
| `/api/social/monitor`               | Real-time social monitoring            |
| `/api/premium/streams/orderbook`    | Real-time order book stream            |
| `/api/premium/streams/liquidations` | Real-time liquidation stream           |
| `/api/premium/export/history`       | Historical data export                 |
| `/api/cron/archive`                 | Archive maintenance (cron job)         |
| `/api/cron/social`                  | Social data collection (cron job)      |
| `/api/cron/feeds`                   | Feed health monitoring (cron job)      |

### 📂 Category Filter

Filter news by specialized categories:

```bash
# Get institutional/VC research
curl "https://cryptocurrency.cv/api/news?category=institutional"

# Get on-chain analytics news
curl "https://cryptocurrency.cv/api/news?category=onchain"

# Get ETF and asset manager news
curl "https://cryptocurrency.cv/api/news?category=etf"

# Get macro economic analysis
curl "https://cryptocurrency.cv/api/news?category=macro"

# Get quantitative research
curl "https://cryptocurrency.cv/api/news?category=quant"

# List all available categories
curl "https://cryptocurrency.cv/api/news/categories"
```

Available categories: `general`, `bitcoin`, `defi`, `nft`, `research`, `institutional`, `etf`, `derivatives`, `onchain`, `fintech`, `macro`, `quant`, `journalism`, `ethereum`, `asia`, `tradfi`, `mainstream`, `mining`, `gaming`, `altl1`, `stablecoin`

### 🌍 API Translation (18 Languages)

All news endpoints support real-time translation via the `?lang=` parameter:

```bash
# Get news in Spanish
curl "https://cryptocurrency.cv/api/news?lang=es"

# Get breaking news in Japanese
curl "https://cryptocurrency.cv/api/breaking?lang=ja"

# Get DeFi news in Arabic
curl "https://cryptocurrency.cv/api/defi?lang=ar"

# Get Bitcoin news in Chinese (Simplified)
curl "https://cryptocurrency.cv/api/bitcoin?lang=zh-CN"
```

**Supported Languages:** `en`, `es`, `fr`, `de`, `pt`, `ja`, `zh-CN`, `zh-TW`, `ko`, `ar`, `ru`, `it`, `nl`, `pl`, `tr`, `vi`, `th`, `id`

**Requirements:**

- Set `GROQ_API_KEY` environment variable (FREE at [console.groq.com/keys](https://console.groq.com/keys))
- Set `FEATURE_TRANSLATION=true` to enable

**Endpoints with Translation Support:**
| Endpoint | `?lang=` Support |
|----------|------------------|
| `/api/news` | ✅ |
| `/api/breaking` | ✅ |
| `/api/defi` | ✅ |
| `/api/bitcoin` | ✅ |
| `/api/archive` | ✅ |
| `/api/archive/v2` | ✅ (redirects to /api/archive) |
| `/api/trending` | Trending topics with sentiment |
| `/api/analyze` | News with topic classification |
| `/api/stats` | Analytics & statistics |
| `/api/sources` | List all sources |
| `/api/health` | API & feed health status |
| `/status` | System status dashboard (UI) |
| `/api/rss` | Aggregated RSS feed |
| `/api/atom` | Aggregated Atom feed |
| `/api/opml` | OPML export for RSS readers |
| `/api/docs` | Interactive API documentation |
| `/api/webhooks` | Webhook registration |
| `/api/archive` | Historical news archive |
| `/api/push` | Web Push notifications |
| `/api/origins` | Find original news sources |
| `/api/portfolio` | Portfolio-based news + prices |
| `/api/news/international` | International sources with translation |

### 🤖 AI-Powered Endpoints (FREE via Groq)

| Endpoint                 | Description                                                                                                                                    | Provider |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| `/api/ai`                | Unified AI endpoint (7 actions)                                                                                                                | All      |
| `/api/summarize`         | AI summaries with style options (brief/detailed/bullet/eli5/technical)                                                                         | Groq     |
| `/api/ask?q=...`         | Ask questions about crypto news                                                                                                                | Groq     |
| `/api/digest`            | AI-generated news digest (6h/12h/24h periods)                                                                                                  | Groq     |
| `/api/sentiment`         | Deep sentiment analysis with confidence scores                                                                                                 | Groq     |
| `/api/entities`          | Extract entities (7 types: ticker/person/company/protocol/exchange/regulator/event)                                                            | Groq     |
| `/api/narratives`        | Identify market narratives with strength scoring                                                                                               | Groq     |
| `/api/factcheck`         | Extract & verify claims (verified/likely/unverified/disputed)                                                                                  | Groq     |
| `/api/clickbait`         | Detect clickbait with scoring (0-100) and rewritten titles                                                                                     | Groq     |
| `/api/classify`          | Event classification (13 types: funding/hack/regulation/launch/partnership/listing/airdrop/upgrade/legal/market/executive/acquisition/general) | All      |
| `/api/claims`            | Claim extraction with attribution (fact/opinion/prediction/announcement)                                                                       | All      |
| `/api/ai/brief`          | Daily brief with executive summary & market overview                                                                                           | All      |
| `/api/ai/counter`        | Counter-arguments with strength scoring                                                                                                        | All      |
| `/api/ai/debate`         | Bull vs Bear debate generation                                                                                                                 | All      |
| `/api/ai/oracle`         | The Oracle - natural language crypto intelligence chat                                                                                         | Groq     |
| `/api/ai/agent`          | AI Market Agent for signal aggregation & regime detection                                                                                      | All      |
| `/api/ai/summarize`      | Enterprise summarization with compression ratio                                                                                                | Groq     |
| `/api/ai/entities`       | Enterprise entity extraction with graph support                                                                                                | Groq     |
| `/api/ai/relationships`  | Relationship extraction (11 types) with clustering                                                                                             | Groq     |
| `/api/ai/synthesize`     | Auto-cluster duplicate articles into comprehensive summaries                                                                                   | Groq     |
| `/api/ai/explain`        | AI explains why any topic is trending with full context                                                                                        | Groq     |
| `/api/ai/portfolio-news` | Score news by relevance to your portfolio holdings                                                                                             | Groq     |
| `/api/ai/correlation`    | Detect correlations between news and price movements                                                                                           | Groq     |
| `/api/ai/flash-briefing` | Ultra-short AI summaries for voice assistants                                                                                                  | Groq     |
| `/api/ai/narratives`     | Track crypto narratives through lifecycle phases (emerging/growing/peak/declining)                                                             | Groq     |
| `/api/ai/cross-lingual`  | Regional sentiment divergence & alpha signal detection                                                                                         | Groq     |
| `/api/ai/source-quality` | AI-powered source scoring & clickbait detection                                                                                                | Groq     |
| `/api/ai/research`       | Deep-dive research reports on any crypto topic                                                                                                 | Groq     |
| `/api/detect/ai-content` | AI-generated content detection (offline, no API needed)                                                                                        | None     |
| `/api/i18n/translate`    | Article translation (30+ languages)                                                                                                             | Groq     |

**Supported AI Providers (priority order):**

1. **OpenAI** - `OPENAI_API_KEY` (gpt-4o-mini default)
2. **Anthropic** - `ANTHROPIC_API_KEY` (claude-3-haiku default)
3. **Groq** - `GROQ_API_KEY` (llama-3.3-70b-versatile default) ⭐ FREE
4. **OpenRouter** - `OPENROUTER_API_KEY` (llama-3-8b-instruct default)

### 🧠 RAG System (Retrieval-Augmented Generation)

Production-grade question answering over crypto news using vector search + LLMs.

```typescript
import { askUltimate, askFast, searchNews } from '@/lib/rag';

// Ask natural language questions
const answer = await askUltimate("What happened to Bitcoin after the ETF approval?");
// Returns: answer + sources + confidence score + suggested follow-ups

// Fast mode for quick queries  
const quick = await askFast("BTC price news");

// Search documents
const results = await searchNews("Ethereum merge", { currencies: ['ETH'] });
```

**RAG Capabilities:**

| Feature | Description |
|---------|-------------|
| **Hybrid Search** | BM25 + semantic vector search with RRF fusion |
| **Query Routing** | Intelligent strategy selection (semantic/keyword/temporal/agentic) |
| **Advanced Reranking** | LLM reranking + time decay + source credibility + MMR diversity |
| **Self-RAG** | Adaptive retrieval with hallucination detection |
| **Contextual Compression** | Extract key facts, reduce context to relevant content |
| **Answer Attribution** | Inline citations `[1]`, `[2]` with source quotes |
| **Confidence Scoring** | Multi-dimensional quality assessment (high/medium/low) |
| **Conversation Memory** | Multi-turn context for follow-up questions |
| **Suggested Questions** | AI-generated follow-up questions |
| **Related Articles** | Content discovery based on context |

**Service Modes:**

| Mode | Function | Speed | Use Case |
|------|----------|-------|----------|
| Fast | `askFast()` | ~220ms | Quick queries, high volume |
| Balanced | `askUltimate()` | ~520ms | Most use cases (recommended) |
| Complete | `askComplete()` | ~850ms | Maximum quality, all features |

**Example Response:**

```json
{
  "answer": "Bitcoin rose 10% [1] after the SEC approved spot ETFs [2]...",
  "sources": [
    { "title": "Bitcoin Surges Post-ETF", "source": "CoinDesk", "url": "..." }
  ],
  "confidence": { "overall": 0.87, "level": "high" },
  "suggestedQuestions": [
    { "question": "How did other cryptocurrencies react?", "type": "expansion" }
  ],
  "citations": {
    "claims": [{ "claim": "Bitcoin rose 10%", "sourceIndex": 1 }]
  }
}
```

📖 **Full RAG documentation:** [docs/RAG.md](docs/RAG.md) | **Roadmap:** [docs/RAG-ROADMAP.md](docs/RAG-ROADMAP.md)

### 📊 Analytics & Intelligence

| Endpoint                     | Description                                                                                                  |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `/api/analytics/anomalies`   | Detect unusual patterns (volume spikes/coordinated publishing/sentiment shifts/ticker surges/source outages) |
| `/api/analytics/credibility` | Source credibility scoring with accuracy/timeliness metrics                                                  |
| `/api/analytics/headlines`   | Headline mutation tracking with sentiment shift detection                                                    |
| `/api/analytics/causality`   | Causal inference (Granger/diff-in-diff/event study methods)                                                  |
| `/api/regulatory`            | Multi-jurisdictional regulatory tracking (15 jurisdictions, 30+ agencies)                                    |
| `/api/influencers`           | Influencer reliability scoring with accuracy rates                                                           |
| `/api/predictions`           | Prediction tracking with outcome resolution & leaderboards                                                   |
| `/api/citations`             | Academic citation network with bibliometric metrics                                                          |

### 🔗 Relationship & Entity Analysis

| Endpoint              | Description                                                                                                                                                             |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/api/relationships`  | Extract entity relationships (11 types: partnership/competition/investment/acquisition/collaboration/conflict/regulation/development/market_impact/mention/association) |
| `/api/predictions`    | Prediction registry with timestamped predictions & accuracy scoring                                                                                                     |
| `/api/onchain/events` | Link news to on-chain events                                                                                                                                            |

### 💼 Portfolio Tools

| Endpoint                     | Description                           |
| ---------------------------- | ------------------------------------- |
| `/api/portfolio`             | Portfolio-based news + prices         |
| `/api/portfolio/performance` | Performance charts, P&L, risk metrics |
| `/api/portfolio/tax`         | Tax report generation (Form 8949)     |

### � Research & Backtesting

| Endpoint                 | Description                                    |
| ------------------------ | ---------------------------------------------- |
| `/api/research/backtest` | Strategy backtesting with historical news data |
| `/api/academic`          | Academic access program registration           |
| `/api/citations`         | Academic citation network analysis             |
| `/api/predictions`       | Prediction tracking with accuracy scoring      |

**Backtest Example:**

```bash
# Backtest a sentiment-based strategy
curl -X POST "https://fcn.dev/api/research/backtest" \
  -H "Content-Type: application/json" \
  -d '{"strategy": "sentiment_momentum", "asset": "BTC", "period": "1y"}'
```

### 📡 Social Monitoring

| Endpoint                       | Description                                        |
| ------------------------------ | -------------------------------------------------- |
| `/api/social/monitor`          | Discord & Telegram channel monitoring via webhooks |
| `/api/social/influencer-score` | Influencer reliability scoring                     |

**Social Monitor Example:**

```bash
# Ingest messages via webhook integration
curl -X POST "https://fcn.dev/api/social/monitor" \
  -H "Content-Type: application/json" \
  -d '{"platform": "discord", "channel": "alpha-chat", "content": "BTC bullish"}'
```

### 🗄️ Data Storage & Export

| Endpoint            | Description                                      |
| ------------------- | ------------------------------------------------ |
| `/api/storage/cas`  | Content-addressable storage (IPFS-style hashing) |
| `/api/export`       | Export data in CSV/JSON/Parquet formats          |
| `/api/exports`      | Bulk export job management                       |
| `/api/exports/[id]` | Download export file                             |

### �🔔 Real-Time & Infrastructure

| Endpoint                    | Description                                  |
| --------------------------- | -------------------------------------------- |
| `/api/sse`                  | Server-Sent Events for real-time news stream |
| `/api/ws`                   | WebSocket connection info & SSE fallback     |
| `/api/webhooks`             | Webhook registration & management            |
| `/api/push`                 | Web Push notification registration           |
| `/api/newsletter/subscribe` | Newsletter subscription                      |
| `/api/alerts`               | Price & news alerts                          |
| `/api/cache`                | Cache management                             |
| `/api/views`                | Article view tracking                        |
| `/api/keys`                 | API key management                           |
| `/api/gateway`              | Unified API gateway                          |
| `/api/billing`              | Subscription & billing management            |
| `/api/billing/usage`        | Current billing usage                        |
| `/api/upgrade`              | API key tier upgrades (x402)                 |
| `/api/register`             | User registration                            |

**SSE Real-Time Stream:**

```javascript
const events = new EventSource("/api/sse?sources=coindesk,theblock");
events.onmessage = (e) => console.log(JSON.parse(e.data));
```

### 🐦 Social Intelligence

| Endpoint                  | Description                              |
| ------------------------- | ---------------------------------------- |
| `/api/social/discord`     | Discord channel monitoring               |
| `/api/social/x/lists`     | Manage X/Twitter influencer lists        |
| `/api/social/x/sentiment` | X sentiment from custom influencer lists |

### 🐦 X/Twitter Sentiment (No API Key!)

Automated X/Twitter sentiment analysis without paid API:

```bash
# Get sentiment from default crypto influencers
curl https://fcn.dev/api/social/x/sentiment

# Create custom influencer list
curl -X POST https://fcn.dev/api/social/x/lists \
  -H "Content-Type: application/json" \
  -d '{
    "name": "ETH Builders",
    "users": [
      {"username": "VitalikButerin", "category": "founder", "weight": 0.9},
      {"username": "sassal0x", "category": "influencer", "weight": 0.8}
    ]
  }'

# Get sentiment from your list
curl https://fcn.dev/api/social/x/sentiment?list=list_xxx
```

**Features:**

- ✅ **No API key required** - Uses Nitter RSS feeds
- ✅ **Automated cron** - Updates every 30 minutes
- ✅ **Custom lists** - Track your own influencers
- ✅ **AI analysis** - Groq-powered sentiment scoring
- ✅ **Webhook alerts** - Discord/Slack/Telegram notifications

### 📈 Market Data

| Endpoint                        | Description                                   |
| ------------------------------- | --------------------------------------------- |
| `/api/market/coins`             | List all coins with market data               |
| `/api/market/trending`          | Trending cryptocurrencies                     |
| `/api/market/categories`        | Market categories                             |
| `/api/market/exchanges`         | Exchange listings                             |
| `/api/market/search`            | Search coins                                  |
| `/api/market/compare`           | Compare multiple coins                        |
| `/api/market/history/[coinId]`  | Historical price data                         |
| `/api/market/ohlc/[coinId]`     | OHLC candlestick data                         |
| `/api/market/snapshot/[coinId]` | Real-time coin snapshot                       |
| `/api/market/social/[coinId]`   | Social metrics for coin                       |
| `/api/market/tickers/[coinId]`  | Trading pairs for coin                        |
| `/api/market/defi`              | DeFi market overview                          |
| `/api/market/derivatives`       | Derivatives market data                       |
| `/api/charts`                   | Chart data for visualizations                 |
| `/api/fear-greed`               | Crypto Fear & Greed Index with 30-day history |

### 🏗️ DeFi Tools

| Endpoint                                     | Description                     |
| -------------------------------------------- | ------------------------------- |
| `/api/defi`                                  | DeFi news and protocol coverage |
| `/api/defi/protocol-health`                  | Protocol health & risk scoring  |
| `/api/defi/protocol-health?action=ranking`   | Protocol safety rankings        |
| `/api/defi/protocol-health?action=incidents` | Security incident tracker       |

**Protocol Health Example:**

```bash
# Get AAVE v3 health score
curl "https://fcn.dev/api/defi/protocol-health?protocol=aave-v3"

# Get top lending protocols by safety
curl "https://fcn.dev/api/defi/protocol-health?action=ranking&category=lending"

# Get recent security incidents
curl "https://fcn.dev/api/defi/protocol-health?action=incidents&limit=20"
```

### 📺 Integrations

| Endpoint                        | Description                                  |
| ------------------------------- | -------------------------------------------- |
| `/api/integrations/tradingview` | TradingView widgets & Pine Script generation |
| `/api/tradingview`              | TradingView webhook receiver                 |

**TradingView Example:**

```bash
# Get chart widget embed code
curl "https://fcn.dev/api/integrations/tradingview?action=widget&type=chart&symbol=BTC"

# Generate Pine Script indicator
curl "https://fcn.dev/api/integrations/tradingview?action=indicator&name=newsAlert"
```

### 📊 Trading Tools

| Endpoint                 | Description                                                |
| ------------------------ | ---------------------------------------------------------- |
| `/api/arbitrage`         | Cross-exchange arbitrage scanner with triangular arb       |
| `/api/trading/arbitrage` | Real-time arbitrage opportunities (spot + triangular)      |
| `/api/funding`           | Funding rate dashboard (Binance, Bybit, OKX, Hyperliquid)  |
| `/api/options`           | Options flow, volatility surface, max pain, gamma exposure |
| `/api/trading/options`   | Options dashboard from Deribit, OKX, Bybit                 |
| `/api/liquidations`      | Real-time liquidations feed (CoinGlass integration)        |
| `/api/orderbook`         | Multi-exchange order book aggregation                      |
| `/api/trading/orderbook` | Aggregated orderbook with slippage & liquidity analysis    |

**Supported Exchanges:**

- **Arbitrage:** Binance, Bybit, OKX, Kraken, Coinbase, KuCoin
- **Options:** Deribit, OKX, Bybit
- **Order Book:** Binance, Bybit, OKX, Kraken, Coinbase (aggregated)
- **Funding Rates:** Binance, Bybit, OKX, Hyperliquid

**Arbitrage Features:**

- Cross-exchange spot arbitrage
- Triangular arbitrage detection
- Real-time spread monitoring
- Profit estimation with fees
- Volume analysis

**Options Analytics:**

- Unusual options activity detection
- Volatility surface visualization
- Max pain analysis
- Gamma exposure tracking
- Block trade monitoring

**Order Book Analysis:**

- Multi-exchange aggregation
- Slippage estimation for orders
- Liquidity depth visualization
- Order book imbalance detection
- Support/resistance levels

**Supported Exchanges:**

- **Arbitrage:** Binance, Bybit, OKX, Kraken, Coinbase, KuCoin
- **Options:** Deribit, OKX, Bybit
- **Order Book:** Binance, Bybit, OKX, Kraken, Coinbase (aggregated)
- **Funding Rates:** Binance, Bybit, OKX, Hyperliquid

**Arbitrage Features:**

- Cross-exchange spot arbitrage
- Triangular arbitrage detection
- Real-time spread monitoring
- Profit estimation with fees
- Volume analysis

**Options Analytics:**

- Unusual options activity detection
- Volatility surface visualization
- Max pain analysis
- Gamma exposure tracking
- Block trade monitoring

**Order Book Analysis:**

- Multi-exchange aggregation
- Slippage estimation for orders
- Liquidity depth visualization
- Order book imbalance detection
- Support/resistance levels

**Arbitrage Scanner Example:**

```bash
# Get cross-exchange arbitrage opportunities
curl "https://fcn.dev/api/arbitrage?minProfit=0.5&limit=20"

# Get triangular arbitrage opportunities
curl "https://fcn.dev/api/trading/arbitrage?type=triangular&minSpread=0.3"
```

**Options Flow Example:**

```bash
# Get options dashboard
curl "https://fcn.dev/api/options?view=dashboard&underlying=BTC"

# Get max pain analysis
curl "https://fcn.dev/api/trading/options?view=maxpain&underlying=ETH"

# Get volatility surface
curl "https://fcn.dev/api/trading/options?view=surface"
```

**Order Book Example:**

```bash
# Get aggregated order book
curl "https://fcn.dev/api/orderbook?symbol=BTC&market=spot"

# Estimate slippage for $100k order
curl "https://fcn.dev/api/trading/orderbook?symbol=BTCUSDT&view=slippage&size=100000"
```

### 🐋 Whale Intelligence

| Endpoint            | Description                                          |
| ------------------- | ---------------------------------------------------- |
| `/api/whale-alerts` | Monitor large transactions across blockchains        |
| `/api/influencers`  | Influencer reliability tracking & prediction scoring |

**Whale Alerts Example:**

```bash
# Get recent whale transactions
curl "https://fcn.dev/api/whale-alerts?limit=50"

# Filter by blockchain
curl "https://fcn.dev/api/whale-alerts?blockchain=ethereum&minUsd=1000000"
```

### 🏛️ Regulatory Intelligence

| Endpoint                               | Description                                         |
| -------------------------------------- | --------------------------------------------------- |
| `/api/regulatory`                      | Regulatory news with jurisdiction & agency tracking |
| `/api/regulatory?action=jurisdictions` | Jurisdiction profiles                               |
| `/api/regulatory?action=agencies`      | Agency information                                  |
| `/api/regulatory?action=deadlines`     | Upcoming compliance deadlines                       |
| `/api/regulatory?action=summary`       | Intelligence summary                                |

### 📰 Coverage & Research

| Endpoint            | Description                                   |
| ------------------- | --------------------------------------------- |
| `/api/coverage-gap` | Analyze under-covered topics and assets       |
| `/api/extract`      | Full article content extraction from URLs     |
| `/api/academic`     | Academic access program for researchers       |
| `/api/citations`    | Citation network analysis for academic papers |

### 💎 Premium API (x402 Micropayments)

Premium endpoints powered by x402 USDC micropayments. Pay per request or get access passes.

| Endpoint                           | Description                         | Price |
| ---------------------------------- | ----------------------------------- | ----- |
| `/api/premium`                     | Premium API documentation & pricing | Free  |
| `/api/premium/ai/sentiment`        | Advanced AI sentiment analysis      | $0.02 |
| `/api/premium/ai/analyze`          | Deep article analysis               | $0.03 |
| `/api/premium/ai/signals`          | Premium trading signals             | $0.05 |
| `/api/premium/ai/summary`          | Extended summaries                  | $0.02 |
| `/api/premium/ai/compare`          | Multi-asset AI comparison           | $0.03 |
| `/api/premium/whales/alerts`       | Real-time whale alerts              | $0.05 |
| `/api/premium/whales/transactions` | Whale transaction history           | $0.03 |
| `/api/premium/smart-money`         | Smart money flow tracking           | $0.05 |
| `/api/premium/screener/advanced`   | Advanced coin screener              | $0.03 |
| `/api/premium/analytics/screener`  | Analytics screener                  | $0.03 |
| `/api/premium/market/coins`        | Premium market data                 | $0.02 |
| `/api/premium/market/history`      | Extended price history              | $0.02 |
| `/api/premium/defi/protocols`      | DeFi protocol analytics             | $0.03 |
| `/api/premium/streams/prices`      | Real-time price streams             | $0.01 |
| `/api/premium/portfolio/analytics` | Portfolio analytics                 | $0.03 |
| `/api/premium/export/portfolio`    | Portfolio data export               | $0.05 |
| `/api/premium/alerts/whales`       | Whale alert configuration           | $0.02 |
| `/api/premium/alerts/custom`       | Custom alert rules                  | $0.02 |
| `/api/premium/api-keys`            | API key management                  | Free  |

**Access Passes:**
| Pass | Price | Duration |
|------|-------|----------|
| 1 Hour Pass | $0.25 | 1 hour |
| 24 Hour Pass | $2.00 | 24 hours |
| Weekly Pass | $10.00 | 7 days |

**How to Pay:**

```bash
# 1. Make request, receive 402 with payment requirements
curl https://fcn.dev/api/premium/ai/sentiment

# 2. Pay with USDC using x402-compatible wallet
# 3. Include payment proof in header
curl -H "X-Payment: <base64-payment>" https://fcn.dev/api/premium/ai/sentiment
```

### 🔐 Admin API

| Endpoint               | Description                |
| ---------------------- | -------------------------- |
| `/api/admin`           | Admin dashboard & API info |
| `/api/admin/analytics` | System-wide analytics      |
| `/api/admin/keys`      | API key management (CRUD)  |
| `/api/admin/licenses`  | License management         |
| `/api/admin/stats`     | Usage statistics           |

> ⚠️ Admin endpoints require `ADMIN_TOKEN` authentication

### 🔢 Versioned API (v1)

Stable versioned API with x402 micropayment support for production integrations.

| Endpoint                           | Description                    |
| ---------------------------------- | ------------------------------ |
| `/api/v1`                          | API documentation & pricing    |
| `/api/v1/coins`                    | Coin listings with market data |
| `/api/v1/coin/[coinId]`            | Individual coin details        |
| `/api/v1/market-data`              | Global market data             |
| `/api/v1/trending`                 | Trending coins                 |
| `/api/v1/search`                   | Search coins                   |
| `/api/v1/exchanges`                | Exchange listings              |
| `/api/v1/defi`                     | DeFi protocols data            |
| `/api/v1/gas`                      | Gas price tracker              |
| `/api/v1/global`                   | Global crypto market stats     |
| `/api/v1/assets`                   | Asset listings                 |
| `/api/v1/assets/[assetId]/history` | Asset price history            |
| `/api/v1/historical/[coinId]`      | Historical data                |
| `/api/v1/alerts`                   | Price alerts                   |
| `/api/v1/export`                   | Data export                    |
| `/api/v1/usage`                    | API usage stats                |
| `/api/v1/x402`                     | x402 payment info              |

> 💡 AI endpoints require `GROQ_API_KEY` (free at [console.groq.com](https://console.groq.com/keys))

---

## 🖥️ Web App Pages

The web app includes **95+ pages** for market data, portfolio management, AI tools, and more:

**Page Breakdown:** 52 server components + 43 client components across 14 major categories.

### Market Data

| Page                 | Description                                       |
| -------------------- | ------------------------------------------------- |
| `/markets`           | Market overview with global stats and coin tables |
| `/markets/gainers`   | 🆕 Top gaining coins (24h)                        |
| `/markets/losers`    | 🆕 Top losing coins (24h)                         |
| `/markets/trending`  | 🆕 Trending coins by volume & social              |
| `/markets/new`       | 🆕 Newly listed cryptocurrencies                  |
| `/markets/exchanges` | 🆕 Exchange directory with volumes                |
| `/trending`          | Trending cryptocurrencies                         |
| `/movers`            | Top gainers and losers (24h)                      |

### Market Tools

| Page            | Description                              |
| --------------- | ---------------------------------------- |
| `/calculator`   | Crypto calculator with conversion & P/L  |
| `/gas`          | Ethereum gas tracker with cost estimates |
| `/heatmap`      | Market heatmap visualization             |
| `/screener`     | Advanced coin screener with filters      |
| `/correlation`  | Price correlation matrix (7/30/90 days)  |
| `/dominance`    | Market cap dominance chart               |
| `/liquidations` | Real-time liquidations feed              |
| `/buzz`         | Social buzz & trending sentiment         |
| `/charts`       | TradingView-style charts                 |

### Trading Tools

| Page         | Description                        |
| ------------ | ---------------------------------- |
| `/arbitrage` | Cross-exchange arbitrage scanner   |
| `/options`   | Options flow & analytics dashboard |
| `/orderbook` | Multi-exchange order book view     |

### Coin Details

| Page             | Description                                      |
| ---------------- | ------------------------------------------------ |
| `/coin/[coinId]` | Comprehensive coin page with charts, stats, news |
| `/compare`       | Compare multiple cryptocurrencies side-by-side   |

### AI & Analytics

| Page                   | Description                       |
| ---------------------- | --------------------------------- |
| `/ai/oracle`           | The Oracle - AI crypto assistant  |
| `/ai/brief`            | AI-generated market brief         |
| `/ai/debate`           | AI Bull vs Bear debate generator  |
| `/ai/counter`          | AI counter-argument generator     |
| `/ai-agent`            | AI Market Agent dashboard         |
| `/sentiment`           | Sentiment analysis dashboard      |
| `/analytics`           | News analytics overview           |
| `/analytics/headlines` | 🆕 Headline tracking & mutations  |
| `/predictions`         | Prediction tracking & leaderboard |
| `/digest`              | AI-generated daily digest         |

### Social & Influencers

| Page           | Description                        |
| -------------- | ---------------------------------- |
| `/influencers` | Influencer reliability leaderboard |
| `/whales`      | Whale alerts & tracking            |
| `/buzz`        | Social buzz & trending sentiment   |

### Research & Intelligence

| Page               | Description                       |
| ------------------ | --------------------------------- |
| `/regulatory`      | Regulatory intelligence dashboard |
| `/coverage-gap`    | Coverage gap analysis             |
| `/protocol-health` | DeFi protocol health monitor      |

### User Features

| Page         | Description                                 |
| ------------ | ------------------------------------------- |
| `/portfolio` | Portfolio management with holdings tracking |
| `/watchlist` | Watchlist with price alerts                 |
| `/bookmarks` | 🆕 Saved articles & reading list            |
| `/settings`  | User preferences and notifications          |
| `/install`   | 🆕 PWA installation guide                   |

### Content

| Page                   | Description                     |
| ---------------------- | ------------------------------- |
| `/search`              | Search news articles            |
| `/topic/[topic]`       | Topic-specific news             |
| `/topics`              | Browse all topics               |
| `/source/[source]`     | Source-specific news            |
| `/sources`             | All news sources                |
| `/category/[category]` | Category-specific news          |
| `/article/[id]`        | Individual article view         |
| `/read/[id]`           | 🆕 Distraction-free reader mode |
| `/share/[id]`          | 🆕 Share & embed articles       |
| `/defi`                | DeFi news section               |
| `/blog`                | Blog posts                      |

### Administration

| Page          | Description                       |
| ------------- | --------------------------------- |
| `/admin`      | Admin dashboard                   |
| `/billing`    | Billing & subscription management |
| `/pricing`    | Pricing plans                     |
| `/developers` | Developer documentation           |

---

## SDKs & Components

### 📊 Component & Library Overview

**Total Components:** 185+ React components organized in 10 directories  
**Total Library Functions:** 298+ exported functions across 90+ library files  
**Custom Hooks:** 5 React hooks for state management

**Component Distribution:**

- Root Level: 133 components (~65 Client, ~68 Server)
- cards/: 10 article display variants
- charts/: 4 TradingView integrations
- portfolio/: 7 portfolio management components
- watchlist/: 4 watchlist features
- alerts/: 4 price alert components
- billing/: 3 subscription management
- sidebar/: 4 sidebar widgets
- admin/: 1 admin dashboard

**Library Categories:**

- AI/ML: 12 files, 45 functions (sentiment, summarization, NER, signals)
- Market Data: 10 files, 60 functions (prices, OHLC, exchanges, DeFi)
- Social Intelligence: 3 files, 20 functions (Twitter, Discord, Telegram)
- Analytics: 10 files, 40 functions (backtesting, predictions, anomalies)
- Database: 2 files, 25 functions (storage abstraction, CAS)
- Auth & Security: 4 files, 15 functions (API keys, rate limiting)
- x402 Payments: 9 files, 35 functions (payment protocol, verification)
- Utilities: 12 files, 50 functions (validation, logging, translation)

### 📦 Official SDKs

| Package                             | Description                             | Version |
| ----------------------------------- | --------------------------------------- | ------- |
| [React](sdk/react/)                 | `<CryptoNews />` drop-in components     | v0.1.0  |
| [TypeScript](sdk/typescript/)       | Full TypeScript SDK with type safety    | v0.1.0  |
| [Python](sdk/python/)               | Zero-dependency Python client           | v0.1.0  |
| [JavaScript](sdk/javascript/)       | Browser & Node.js SDK                   | v0.1.0  |
| [Go](sdk/go/)                       | Go client library                       | v0.1.0  |
| [PHP](sdk/php/)                     | PHP SDK                                 | v0.1.0  |
| [Ruby](sdk/ruby/)                   | Ruby gem with async support             | v0.2.0  |
| [Rust](sdk/rust/)                   | Rust crate with async/sync clients      | v0.2.0  |
| [UI Components](docs/components.md) | Internal navigation & search components | -       |

### 🔌 Platform Integrations

**Total Integrations:** 8 official SDKs + 5 platform integrations + 200+ code examples

| Integration                    | Description                               | Documentation                           | Status          |
| ------------------------------ | ----------------------------------------- | --------------------------------------- | --------------- |
| [ChatGPT](chatgpt/)            | Custom GPT with OpenAPI schema            | [Guide](docs/integrations/chatgpt.md)   | ✅ Production   |
| [MCP Server](mcp/)             | Model Context Protocol (stdio + HTTP/SSE) | [Guide](docs/integrations/mcp.md)       | ✅ Production   |
| [Chrome Extension](extension/) | Browser extension (Manifest V3)           | [Guide](docs/integrations/extension.md) | ✅ Chrome Ready |
| [Alfred Workflow](alfred/)     | macOS Alfred 4+ integration               | [Guide](docs/integrations/alfred.md)    | ✅ Production   |
| [Raycast](raycast/)            | Raycast extension (6 commands)            | [Guide](docs/integrations/raycast.md)   | ✅ Production   |
| [Widgets](widget/)             | 3 embeddable widget types                 | [Guide](docs/integrations/widgets.md)   | ✅ Production   |
| [CLI](cli/)                    | Command-line interface                    | [README](cli/README.md)                 | ✅ Production   |
| [Postman](postman/)            | Postman collection (182 endpoints)        | [README](postman/README.md)             | ✅ Complete     |

**Widget Types:**

| Widget      | Type       | Use Case                |
| ----------- | ---------- | ----------------------- |
| Main Widget | iframe     | Full news feed embed    |
| Ticker      | JavaScript | Scrolling header ticker |
| Carousel    | JavaScript | Featured news rotator   |

### 🧠 RAG AI System

Production-grade **Retrieval-Augmented Generation** for intelligent crypto news Q&A.

| Feature | Description |
|---------|-------------|
| **Hybrid Search** | BM25 + semantic search with reciprocal rank fusion |
| **Multi-hop Reasoning** | Agentic RAG for complex questions requiring multiple articles |
| **Conversation Memory** | Multi-turn chat with context tracking |
| **Advanced Reranking** | LLM scoring, time decay, source credibility, MMR diversity |
| **Query Understanding** | Intent classification, decomposition, HyDE |
| **Streaming API** | Real-time SSE responses with step-by-step updates |

**Quick Start:**
```typescript
import { ragService } from '@/lib/rag';

// Simple question answering
const response = await ragService.ask("What happened to Bitcoin last week?");
console.log(response.answer);

// Multi-hop reasoning for complex questions  
const reasoning = await ragService.askWithReasoning(
  "How did the ETF approval affect Bitcoin compared to Ethereum?"
);
```

**API Endpoints:**
```bash
# Standard RAG query
curl -X POST /api/rag -d '{"query": "Latest Bitcoin news"}'

# Streaming with progress updates
curl -N -X POST /api/rag/stream -d '{"query": "Why did crypto crash?"}'

# Search without answer generation
curl -X POST /api/rag/search -d '{"query": "DeFi hacks", "limit": 10}'
```

📚 **[Full RAG Documentation](src/lib/rag/README.md)** — Architecture, API reference, configuration, and advanced features.

### 🚀 Code Examples & SDKs (200+ Examples)

Complete examples for all 184 API endpoints across 5 languages:

| Language | Files | Functions | Description |
|----------|-------|-----------|-------------|
| [Python](examples/python/) | 12 files | 150+ | Full SDK with all endpoints |
| [JavaScript](examples/javascript/) | 11 files | 120+ | Node.js & browser examples |
| [TypeScript](examples/typescript/) | 3 files | 80+ | Type-safe SDK |
| [Go](examples/go/) | 1 file |  | Go client library |
| [cURL](examples/curl/) | 1 file | 100+ | Shell script examples |

**Python Example Files:**
- `news.py` - News feeds, search, categories (13 functions)
- `ai.py` - Sentiment, summarization, NLP (20 functions)
- `market.py` - Coins, OHLC, exchanges (16 functions)
- `trading.py` - Arbitrage, signals, funding (10 functions)
- `social.py` - Twitter, Reddit, Discord (15 functions)
- `blockchain.py` - DeFi, NFT, on-chain (17 functions)
- `regulatory.py` - ETF, SEC, regulations (14 functions)
- `analytics.py` - Trends, correlations (15 functions)
- `feeds.py` - RSS, exports, webhooks (13 functions)
- `portfolio.py` - Alerts, watchlists (15 functions)
- `premium.py` - Premium tier features (12 functions)

**Quick Start (Python):**
```python
import requests
BASE_URL = "https://cryptocurrency.cv"

# Get latest news
news = requests.get(f"{BASE_URL}/api/news?limit=10").json()

# Get Bitcoin sentiment
sentiment = requests.get(f"{BASE_URL}/api/ai/sentiment?asset=BTC").json()
print(f"BTC: {sentiment['label']} ({sentiment['score']:.2f})")

# Get Fear & Greed
fg = requests.get(f"{BASE_URL}/api/market/fear-greed").json()
print(f"Market: {fg['classification']} ({fg['value']})")
```

**Quick Start (JavaScript):**
```javascript
const BASE_URL = 'https://cryptocurrency.cv';

// Get latest news
const news = await fetch(`${BASE_URL}/api/news?limit=10`).then(r => r.json());

// Stream real-time updates
const events = new EventSource(`${BASE_URL}/api/stream`);
events.onmessage = (e) => console.log('New:', JSON.parse(e.data).title);
```

📚 **[Full Examples Documentation](examples/README.md)** | **[API Tutorial](docs/EXAMPLES.md)**

**Bot Integration Examples:**

| Example          | Language   | File                          | Purpose                   |
| ---------------- | ---------- | ----------------------------- | ------------------------- |
| AI Analysis      | Python     | `examples/ai-analysis.py`     | Sentiment & summarization |
| LangChain Tool   | Python     | `examples/langchain-tool.py`  | AI agent integration      |
| Discord Bot      | JavaScript | `examples/discord-bot.js`     | Channel posting           |
| Telegram Bot     | Python     | `examples/telegram-bot.py`    | Command handler           |
| Telegram Digest  | Python     | `examples/telegram-digest.py` | Scheduled digests         |
| Slack Bot        | JavaScript | `examples/slack-bot.js`       | Webhook posting           |
| Real-time Stream | JavaScript | `examples/realtime-stream.js` | SSE streaming             |
| curl Examples    | Shell      | `examples/curl.sh`            | API testing               |
| x402 Python      | Python     | `examples/x402-client.py`     | Payment protocol          |
| x402 TypeScript  | TypeScript | `examples/x402-client.ts`     | Payment protocol          |
| x402 Go          | Go         | `examples/x402-client.go`     | Payment protocol          |

### 📖 Complete API Tutorials

Step-by-step tutorials with full working code for every API endpoint:

| Tutorial | Endpoints Covered | Description |
|----------|-------------------|-------------|
| [News Basics](docs/tutorials/news-basics.md) | `/api/news`, `/api/latest`, `/api/breaking`, `/api/trending` | Fetching, filtering, and paginating news articles |
| [Search & Filtering](docs/tutorials/search-filtering.md) | `/api/search`, `/api/news?source=`, `/api/categories` | Full-text search, source filtering, category browsing |
| [Archive & Export](docs/tutorials/archive-export.md) | `/api/archive`, `/api/export`, `/api/rss`, `/api/atom` | Historical data access, bulk exports, RSS/Atom feeds |
| [International News](docs/tutorials/international-news.md) | `/api/news/international`, `/api/sources/international`, `/api/languages`, `/api/regions` | Multi-language news with auto-translation |
| [AI Sentiment](docs/tutorials/ai-sentiment.md) | `/api/ai/sentiment`, `/api/ai/sentiment/history`, `/api/ai/sentiment/market` | Real-time sentiment analysis for any asset |
| [AI Features](docs/tutorials/ai-features.md) | `/api/ask`, `/api/summarize`, `/api/digest`, `/api/entities`, `/api/narratives`, `/api/signals` | Q&A, summarization, NER, narratives, trading signals |
| [Trading Signals](docs/tutorials/trading-signals.md) | `/api/trading/arbitrage`, `/api/trading/signals`, `/api/trading/funding` | Arbitrage opportunities, AI signals, funding rates |
| [Market Data](docs/tutorials/market-data.md) | `/api/market/coins`, `/api/market/ohlc`, `/api/market/fear-greed`, `/api/market/dominance` | Price data, OHLCV, market indicators |
| [DeFi & NFT](docs/tutorials/defi-nft.md) | `/api/defi`, `/api/defi/protocols`, `/api/defi/yields`, `/api/nft`, `/api/nft/collections` | DeFi protocols, yield farming, NFT analytics |
| [Analytics & Research](docs/tutorials/analytics-research.md) | `/api/analytics/trends`, `/api/analytics/correlations`, `/api/research` | Market analytics, correlation analysis, research tools |
| [Social Intelligence](docs/tutorials/social-intelligence.md) | `/api/social/twitter`, `/api/social/reddit`, `/api/social/discord` | Social media monitoring and sentiment |
| [Portfolio & Watchlist](docs/tutorials/portfolio-watchlist.md) | `/api/portfolio`, `/api/watchlist`, `/api/alerts` | Portfolio tracking, watchlists, price alerts |
| [Premium Features](docs/tutorials/premium-features.md) | `/api/premium/*`, `/api/x402/*` | Premium API access, x402 micropayments |
| [Real-time SSE](docs/tutorials/realtime-sse.md) | `/api/stream`, `/api/prices/stream` | Server-Sent Events for live updates |
| [User Alerts](docs/tutorials/user-alerts.md) | `/api/alerts`, `/api/notifications` | Push notifications, price alerts, webhooks |
| [Webhooks & Integrations](docs/tutorials/webhooks-integrations.md) | `/api/webhooks`, `/api/webhooks/events` | Webhook management, event subscriptions |
| [Utility Endpoints](docs/tutorials/utility-endpoints.md) | `/api/health`, `/api/status`, `/api/sources`, `/api/categories`, `/api/config` | Health checks, system status, metadata |
| [Article Extraction](docs/tutorials/article-extraction.md) | `/api/extract`, `/api/extract/batch`, `/api/ai/detect` | Full article content, batch extraction, AI detection |

📚 **[View All Tutorials](docs/tutorials/index.md)** — Complete documentation covering 150+ endpoints with Python, JavaScript, TypeScript, and cURL examples.

**MCP Server Modes:**

- **stdio:** For Claude Desktop (local)
- **HTTP/SSE:** For ChatGPT Developer Mode (remote)
- **Tools:** 40 tools available for AI assistants

### 📚 Documentation

| Document                                             | Description                        |
| ---------------------------------------------------- | ---------------------------------- |
| [API Reference](docs/API.md)                         | Full API documentation             |
| [**Tutorials**](docs/tutorials/index.md)             | **19 step-by-step guides with code** |
| [AI Features](docs/AI-FEATURES.md)                   | AI endpoint documentation          |
| [**RAG System**](docs/RAG.md)                        | **Question answering over news**   |
| [RAG Roadmap](docs/RAG-ROADMAP.md)                   | RAG future enhancements            |
| [Architecture](docs/CDA-ARCHITECTURE-COMPLETE.md)    | System architecture                |
| [Developer Guide](docs/DEVELOPER-GUIDE.md)           | Contributing & development         |
| [Quickstart](docs/QUICKSTART.md)                     | Getting started guide              |
| [User Guide](docs/USER-GUIDE.md)                     | End-user documentation             |
| [Internationalization](docs/INTERNATIONALIZATION.md) | i18n & localization                |
| [Real-Time](docs/REALTIME.md)                        | SSE & WebSocket guide              |
| [x402 Payments](docs/X402-IMPLEMENTATION.md)         | Micropayments implementation       |
| [Testing](docs/TESTING.md)                           | Test coverage & strategies         |
| [Deployment](DEPLOYMENT.md)                          | Deployment guide                   |

**Base URL:** `https://cryptocurrency.cv`

**Failsafe Mirror:** `https://nirholas.github.io/free-crypto-news/`

### Query Parameters

| Parameter   | Endpoints               | Description             |
| ----------- | ----------------------- | ----------------------- |
| `limit`     | All news endpoints      | Max articles (1-50)     |
| `source`    | `/api/news`             | Filter by source        |
| `from`      | `/api/news`             | Start date (ISO 8601)   |
| `to`        | `/api/news`             | End date (ISO 8601)     |
| `page`      | `/api/news`             | Page number             |
| `per_page`  | `/api/news`             | Items per page          |
| `hours`     | `/api/trending`         | Time window (1-72)      |
| `topic`     | `/api/analyze`          | Filter by topic         |
| `sentiment` | `/api/analyze`          | bullish/bearish/neutral |
| `feed`      | `/api/rss`, `/api/atom` | all/defi/bitcoin        |

### AI Endpoint Parameters

| Parameter        | Endpoints         | Description                    |
| ---------------- | ----------------- | ------------------------------ |
| `q`              | `/api/ask`        | Question to ask about news     |
| `style`          | `/api/summarize`  | brief/detailed/bullet          |
| `period`         | `/api/digest`     | 6h/12h/24h                     |
| `type`           | `/api/entities`   | ticker/person/company/protocol |
| `threshold`      | `/api/clickbait`  | Min clickbait score (0-100)    |
| `asset`          | `/api/sentiment`  | Filter by ticker (BTC, ETH)    |
| `emerging`       | `/api/narratives` | true = only new narratives     |
| `min_confidence` | `/api/signals`    | Min confidence (0-100)         |
| `date`           | `/api/ai/brief`   | Date for brief (YYYY-MM-DD)    |
| `format`         | `/api/ai/brief`   | full/summary                   |

---

## Response Format

```json
{
  "articles": [
    {
      "title": "Bitcoin Hits New ATH",
      "link": "https://coindesk.com/...",
      "description": "Bitcoin surpassed...",
      "pubDate": "2025-01-02T12:00:00Z",
      "source": "CoinDesk",
      "timeAgo": "2h ago"
    }
  ],
  "totalCount": 150,
  "fetchedAt": "2025-01-02T14:30:00Z"
}
```

---

## 🤖 AI Endpoint Examples

**Ask questions about crypto news:**

```bash
curl "https://cryptocurrency.cv/api/ask?q=What%20is%20happening%20with%20Bitcoin%20today"
```

**Get AI-powered summaries:**

```bash
curl "https://cryptocurrency.cv/api/summarize?limit=5&style=brief"
```

**Daily digest:**

```bash
curl "https://cryptocurrency.cv/api/digest?period=24h"
```

**Deep sentiment analysis:**

```bash
curl "https://cryptocurrency.cv/api/sentiment?asset=BTC"
```

**Extract entities (people, companies, tickers):**

```bash
curl "https://cryptocurrency.cv/api/entities?type=person"
```

**Identify market narratives:**

```bash
curl "https://cryptocurrency.cv/api/narratives?emerging=true"
```

**News-based trading signals:**

```bash
curl "https://cryptocurrency.cv/api/signals?min_confidence=70"
```

**Fact-check claims:**

```bash
curl "https://cryptocurrency.cv/api/factcheck?type=prediction"
```

**Detect clickbait:**

```bash
curl "https://cryptocurrency.cv/api/clickbait?threshold=50"
```

### 🆕 AI Products

**Daily Brief** - Comprehensive crypto news digest:

```bash
curl "https://cryptocurrency.cv/api/ai/brief?format=full"
```

**Bull vs Bear Debate** - Generate balanced perspectives:

```bash
curl -X POST "https://cryptocurrency.cv/api/ai/debate" \
  -H "Content-Type: application/json" \
  -d '{"topic": "Bitcoin reaching $200k in 2026"}'
```

**Counter-Arguments** - Challenge any claim:

```bash
curl -X POST "https://cryptocurrency.cv/api/ai/counter" \
  -H "Content-Type: application/json" \
  -d '{"claim": "Ethereum will flip Bitcoin by market cap"}'
```

---

## 🏗️ Technical Architecture

### Runtime & Performance

**Edge Runtime:** 140+ endpoints optimized for Edge runtime  
**Target Metrics:**

- TTFB: <200ms (actual ~150ms on Edge)
- FCP: <1.8s (actual ~1.2s)
- LCP: <2.5s (actual ~2.0s)
- CLS: <0.1 (actual ~0.05)
- TTI: <3.8s (actual ~2.8s)

### Caching Strategy (4-Layer)

| Layer       | Technology          | TTL      | Purpose             |
| ----------- | ------------------- | -------- | ------------------- |
| L1 - Memory | In-memory Map       | 180-300s | Hot data            |
| L2 - Redis  | Vercel KV / Upstash | Variable | Persistent cache    |
| L3 - ISR    | Next.js             | 60-300s  | Static regeneration |
| L4 - CDN    | Vercel Edge         | Custom   | Global distribution |

### Database Backends

**Supported Storage:**

- ✅ Vercel KV (Primary - Production)
- ✅ Upstash Redis (Alternative - Production)
- 🔧 Memory (Development only)
- 🔧 File System (Local testing)

**Features:**

- Document-based operations with versioning
- TTL support for automatic expiration
- Batch operations (mget, mset)
- Pattern matching for keys
- Statistics and monitoring
- Content-addressable storage (CAS)

### Data Architecture

**Database Schema Patterns:**

| Pattern                   | Example              | Purpose             |
| ------------------------- | -------------------- | ------------------- |
| `feed:{source}`           | `feed:coindesk`      | Cached RSS feeds    |
| `article:{id}`            | `article:abc123`     | Individual articles |
| `user:{userId}:watchlist` | `user:123:watchlist` | User watchlists     |
| `portfolio:{userId}`      | `portfolio:123`      | User portfolios     |
| `alert:{id}`              | `alert:xyz789`       | Price alerts        |
| `apikey:{hash}`           | `apikey:sha256...`   | API key hashing     |

### Real-time Updates

| Method    | Use Case                      | Implementation |
| --------- | ----------------------------- | -------------- |
| WebSocket | Live prices, liquidations     | Binance stream |
| SSE       | News updates, breaking alerts | `/api/sse`     |
| Polling   | Portfolio updates             | Client-side    |

---

## 🔐 Authentication & Security

### API Key System

**Key Format:** `cda_{tier}_{random}`

**Tiers & Limits:**

| Tier       | Daily Limit     | Rate Limit | Price   |
| ---------- | --------------- | ---------- | ------- |
| Free       | 100 requests    | 10/min     | $0/mo   |
| Pro        | 10,000 requests | 100/min    | $29/mo  |
| Enterprise | Unlimited       | 1,000/min  | $299/mo |

**Features:**

- SHA-256 key hashing for security
- Per-key rate limiting
- Usage tracking and analytics
- Automatic expiration support
- Tier upgrades via x402 payments
- API key management endpoints

**Create API Key:**

```bash
curl -X POST https://cryptocurrency.cv/api/register \
  -H "Content-Type: application/json" \
  -d '{"email": "your@email.com", "tier": "free"}'
```

**Use API Key:**

```bash
curl -H "X-API-Key: cda_free_abc123" \
  https://cryptocurrency.cv/api/news
```

### Security Headers

| Header                    | Value                           |
| ------------------------- | ------------------------------- |
| X-Content-Type-Options    | nosniff                         |
| X-Frame-Options           | SAMEORIGIN                      |
| X-XSS-Protection          | 1; mode=block                   |
| Strict-Transport-Security | max-age=63072000                |
| Referrer-Policy           | strict-origin-when-cross-origin |

### x402 Payment Security

**Protocol:** x402 v2  
**Network:** Base Mainnet (eip155:8453)  
**Token:** USDC (0x833589...)

**Verification Steps:**

1. Parse payment signature from `PAYMENT-SIGNATURE` header
2. Validate signature format and structure
3. Verify payment amount matches endpoint price
4. Check facilitator confirmation
5. Verify wallet signature cryptographically
6. Grant access if all checks pass

**Discovery:** `/.well-known/x402` provides machine-readable pricing

---

## 🧪 Testing & Quality Assurance

### Test Coverage

**Test Suites:**

- **E2E Tests:** 9 Playwright test files covering critical user paths
- **Component Tests:** 8 Storybook stories for key UI components
- **API Tests:** Postman collection with 182 endpoint tests
- **Unit Tests:** Vitest for core utility functions

**E2E Test Coverage:**

| Suite         | File                        | Tests                     |
| ------------- | --------------------------- | ------------------------- |
| API           | `e2e/api.spec.ts`           | API endpoint validation   |
| Home          | `e2e/home.spec.ts`          | Homepage functionality    |
| i18n          | `e2e/i18n.spec.ts`          | Internationalization      |
| Order Book    | `e2e/orderbook.spec.ts`     | Trading order book        |
| TradingView   | `e2e/tradingview.spec.ts`   | Chart integrations        |
| x402          | `e2e/x402.spec.ts`          | Payment protocol          |
| Exports       | `e2e/exports.spec.ts`       | Data export functionality |
| Article Slugs | `e2e/article-slugs.spec.ts` | URL routing               |
| Regulatory    | `e2e/regulatory.spec.ts`    | Regulatory tracking       |

**Run Tests:**

```bash
# E2E tests
npm run test:e2e

# Component tests
npm run storybook

# Unit tests
npm run test
```

---

## 🏗️ Technical Architecture

### Runtime & Performance

**Edge Runtime:** 140+ endpoints optimized for Edge runtime  
**Target Metrics:**

- TTFB: <200ms (actual ~150ms on Edge)
- FCP: <1.8s (actual ~1.2s)
- LCP: <2.5s (actual ~2.0s)
- CLS: <0.1 (actual ~0.05)
- TTI: <3.8s (actual ~2.8s)

### Caching Strategy (4-Layer)

| Layer       | Technology          | TTL      | Purpose             |
| ----------- | ------------------- | -------- | ------------------- |
| L1 - Memory | In-memory Map       | 180-300s | Hot data            |
| L2 - Redis  | Vercel KV / Upstash | Variable | Persistent cache    |
| L3 - ISR    | Next.js             | 60-300s  | Static regeneration |
| L4 - CDN    | Vercel Edge         | Custom   | Global distribution |

### Database Backends

**Supported Storage:**

- ✅ Vercel KV (Primary - Production)
- ✅ Upstash Redis (Alternative - Production)
- 🔧 Memory (Development only)
- 🔧 File System (Local testing)

**Features:**

- Document-based operations with versioning
- TTL support for automatic expiration
- Batch operations (mget, mset)
- Pattern matching for keys
- Statistics and monitoring
- Content-addressable storage (CAS)

### Data Architecture

**Database Schema Patterns:**

| Pattern                   | Example              | Purpose             |
| ------------------------- | -------------------- | ------------------- |
| `feed:{source}`           | `feed:coindesk`      | Cached RSS feeds    |
| `article:{id}`            | `article:abc123`     | Individual articles |
| `user:{userId}:watchlist` | `user:123:watchlist` | User watchlists     |
| `portfolio:{userId}`      | `portfolio:123`      | User portfolios     |
| `alert:{id}`              | `alert:xyz789`       | Price alerts        |
| `apikey:{hash}`           | `apikey:sha256...`   | API key hashing     |

### Real-time Updates

| Method    | Use Case                      | Implementation |
| --------- | ----------------------------- | -------------- |
| WebSocket | Live prices, liquidations     | Binance stream |
| SSE       | News updates, breaking alerts | `/api/sse`     |
| Polling   | Portfolio updates             | Client-side    |

---

## 🔐 Authentication & Security

### API Key System

**Key Format:** `cda_{tier}_{random}`

**Tiers & Limits:**

| Tier       | Daily Limit     | Rate Limit | Price   |
| ---------- | --------------- | ---------- | ------- |
| Free       | 100 requests    | 10/min     | $0/mo   |
| Pro        | 10,000 requests | 100/min    | $29/mo  |
| Enterprise | Unlimited       | 1,000/min  | $299/mo |

**Features:**

- SHA-256 key hashing for security
- Per-key rate limiting
- Usage tracking and analytics
- Automatic expiration support
- Tier upgrades via x402 payments
- API key management endpoints

**Create API Key:**

```bash
curl -X POST https://cryptocurrency.cv/api/register \
  -H "Content-Type: application/json" \
  -d '{"email": "your@email.com", "tier": "free"}'
```

**Use API Key:**

```bash
curl -H "X-API-Key: cda_free_abc123" \
  https://cryptocurrency.cv/api/news
```

### Security Headers

| Header                    | Value                           |
| ------------------------- | ------------------------------- |
| X-Content-Type-Options    | nosniff                         |
| X-Frame-Options           | SAMEORIGIN                      |
| X-XSS-Protection          | 1; mode=block                   |
| Strict-Transport-Security | max-age=63072000                |
| Referrer-Policy           | strict-origin-when-cross-origin |

### x402 Payment Security

**Protocol:** x402 v2  
**Network:** Base Mainnet (eip155:8453)  
**Token:** USDC (0x833589...)

**Verification Steps:**

1. Parse payment signature from `PAYMENT-SIGNATURE` header
2. Validate signature format and structure
3. Verify payment amount matches endpoint price
4. Check facilitator confirmation
5. Verify wallet signature cryptographically
6. Grant access if all checks pass

**Discovery:** `/.well-known/x402` provides machine-readable pricing

---

## ✨ Advanced Features

### 📦 Content-Addressable Storage (CAS)

IPFS-style content addressing for articles:

```bash
# Store content with automatic hash
curl -X POST https://cryptocurrency.cv/api/storage/cas \
  -H "Content-Type: application/json" \
  -d '{"content": "Article content here"}'

# Returns: {"hash": "bafybei..."}

# Retrieve by hash
curl https://cryptocurrency.cv/api/storage/cas?hash=bafybei...
```

### 📊 Data Export Formats

Export news data in multiple formats:

**Supported Formats:**

- JSON (structured)
- CSV (spreadsheet-compatible)
- Parquet (analytics/big data)

```bash
# Create export job
curl -X POST https://cryptocurrency.cv/api/export \
  -H "Content-Type: application/json" \
  -d '{
    "format": "csv",
    "dateFrom": "2026-01-01",
    "dateTo": "2026-01-31",
    "sources": ["coindesk", "theblock"]
  }'

# Returns: {"exportId": "exp_123"}

# Download export
curl https://cryptocurrency.cv/api/exports/exp_123 -o news.csv
```

**Bulk Export Management:**

```bash
# List all exports
curl https://cryptocurrency.cv/api/exports

# Get export status
curl https://cryptocurrency.cv/api/exports/exp_123

# Delete export
curl -X DELETE https://cryptocurrency.cv/api/exports/exp_123
```

### 🏛️ Regulatory Intelligence

Multi-jurisdictional regulatory tracking:

**Coverage:**

- **15 jurisdictions** (US, EU, UK, CN, JP, KR, SG, etc.)
- **30+ agencies** (SEC, CFTC, FCA, ESMA, etc.)
- **Compliance deadlines** tracking
- **Regulatory change detection**

```bash
# Get regulatory news
curl https://cryptocurrency.cv/api/regulatory

# Get jurisdiction profiles
curl https://cryptocurrency.cv/api/regulatory?action=jurisdictions

# Get agency information
curl https://cryptocurrency.cv/api/regulatory?action=agencies

# Get upcoming deadlines
curl https://cryptocurrency.cv/api/regulatory?action=deadlines

# Get intelligence summary
curl https://cryptocurrency.cv/api/regulatory?action=summary
```

### 🏥 DeFi Protocol Health Monitoring

**Features:**

- Protocol health & risk scoring
- Security incident tracking
- TVL monitoring
- Smart contract risk assessment
- Protocol safety rankings

```bash
# Get protocol health score
curl "https://cryptocurrency.cv/api/defi/protocol-health?protocol=aave-v3"

# Get safety rankings by category
curl "https://cryptocurrency.cv/api/defi/protocol-health?action=ranking&category=lending"

# Get recent security incidents
curl "https://cryptocurrency.cv/api/defi/protocol-health?action=incidents&limit=20"
```

### 🐋 Whale Alert Features

**Capabilities:**

- Large transaction monitoring
- Multi-blockchain support (ETH, BTC, SOL, etc.)
- Exchange flow tracking
- Wallet address identification
- Historical whale activity

```bash
# Get recent whale transactions
curl "https://cryptocurrency.cv/api/whale-alerts?limit=50"

# Filter by blockchain and minimum value
curl "https://cryptocurrency.cv/api/whale-alerts?blockchain=ethereum&minUsd=1000000"
```

### 🎯 Prediction Tracking System

**Features:**

- Timestamped prediction registry
- Accuracy scoring and leaderboards
- Influencer reliability tracking
- Outcome resolution
- Historical performance analysis

```bash
# Get predictions
curl https://cryptocurrency.cv/api/predictions

# Get prediction leaderboard
curl https://cryptocurrency.cv/api/predictions?action=leaderboard

# Get influencer track record
curl https://cryptocurrency.cv/api/influencers?username=crypto_analyst
```

### 📈 Strategy Backtesting

Backtest news-based trading strategies:

**Available Strategies:**

- Sentiment momentum
- News volume signals
- Narrative tracking
- Entity mention correlation
- Breaking news reaction

```bash
curl -X POST https://cryptocurrency.cv/api/research/backtest \
  -H "Content-Type: application/json" \
  -d '{
    "strategy": "sentiment_momentum",
    "asset": "BTC",
    "period": "1y",
    "capital": 10000
  }'
```

**Returns:**

- Total return & annualized return
- Sharpe ratio & max drawdown
- Win rate & profit factor
- Trade-by-trade breakdown

### 🔍 Coverage Gap Analysis

Identify under-covered topics and assets:

```bash
# Analyze coverage gaps
curl https://cryptocurrency.cv/api/coverage-gap

# Returns:
# - Under-covered assets
# - Emerging topics with low coverage
# - Source diversity metrics
# - Recommended coverage expansions
```

### 🎓 Academic Access Program

Free access for researchers:

```bash
# Register for academic access
curl -X POST https://cryptocurrency.cv/api/academic \
  -H "Content-Type: application/json" \
  -d '{
    "institution": "University Name",
    "email": "researcher@university.edu",
    "purpose": "Research on crypto market sentiment"
  }'
```

**Benefits:**

- Unlimited API access
- Historical data exports
- Citation network access
- Priority support

---

# Integration Examples

Pick your platform. Copy the code. Ship it.

---

## 🐍 Python

**Zero dependencies.** Just copy the file.

```bash
curl -O https://raw.githubusercontent.com/nirholas/free-crypto-news/main/sdk/python/crypto_news.py
```

```python
from crypto_news import CryptoNews

news = CryptoNews()

# Get latest news
for article in news.get_latest(5):
    print(f"📰 {article['title']}")
    print(f"   {article['source']} • {article['timeAgo']}")
    print(f"   {article['link']}\n")

# Search for topics
eth_news = news.search("ethereum,etf", limit=5)

# DeFi news
defi = news.get_defi(5)

# Bitcoin news
btc = news.get_bitcoin(5)

# Breaking (last 2 hours)
breaking = news.get_breaking(5)
```

**One-liner:**

```python
import urllib.request, json
news = json.loads(urllib.request.urlopen("https://cryptocurrency.cv/api/news?limit=5").read())
print(news["articles"][0]["title"])
```

---

## 🟨 JavaScript / TypeScript

**Works in Node.js and browsers.**

### TypeScript SDK (npm)

```bash
npm install @nirholas/crypto-news
```

```typescript
import { CryptoNews } from "@nirholas/crypto-news";

const client = new CryptoNews();

// Fully typed responses
const articles = await client.getLatest(10);
const health = await client.getHealth();
```

### Vanilla JavaScript

```bash
curl -O https://raw.githubusercontent.com/nirholas/free-crypto-news/main/sdk/javascript/crypto-news.js
```

```javascript
import { CryptoNews } from "./crypto-news.js";

const news = new CryptoNews();

// Get latest
const articles = await news.getLatest(5);
articles.forEach((a) => console.log(`${a.title} - ${a.source}`));

// Search
const eth = await news.search("ethereum");

// DeFi / Bitcoin / Breaking
const defi = await news.getDefi(5);
const btc = await news.getBitcoin(5);
const breaking = await news.getBreaking(5);
```

**One-liner:**

```javascript
const news = await fetch(
  "https://cryptocurrency.cv/api/news?limit=5",
).then((r) => r.json());
console.log(news.articles[0].title);
```

---

## 🤖 ChatGPT (Custom GPT)

Build a crypto news GPT in 2 minutes.

1. Go to [chat.openai.com](https://chat.openai.com) → Create GPT
2. Click **Configure** → **Actions** → **Create new action**
3. Paste this OpenAPI schema:

```yaml
openapi: 3.1.0
info:
  title: Free Crypto News
  version: 1.0.0
servers:
  - url: https://cryptocurrency.cv
paths:
  /api/news:
    get:
      operationId: getNews
      summary: Get latest crypto news
      parameters:
        - name: limit
          in: query
          schema:
            type: integer
            default: 10
  /api/search:
    get:
      operationId: searchNews
      summary: Search crypto news
      parameters:
        - name: q
          in: query
          required: true
          schema:
            type: string
  /api/defi:
    get:
      operationId: getDefiNews
      summary: Get DeFi news
  /api/bitcoin:
    get:
      operationId: getBitcoinNews
      summary: Get Bitcoin news
  /api/breaking:
    get:
      operationId: getBreakingNews
      summary: Get breaking news
```

4. No authentication needed
5. Save and test: _"What's the latest crypto news?"_

Full schema: [`chatgpt/openapi.yaml`](chatgpt/openapi.yaml)

---

## 🔮 MCP Server (Claude Desktop & ChatGPT Developer Mode)

The MCP server provides **40 tools** for AI assistants to access crypto news.

### Available Tools

| Tool                    | Description                    |
| ----------------------- | ------------------------------ |
| `get_crypto_news`       | Latest news from 130+ sources  |
| `search_crypto_news`    | Search by keywords             |
| `get_defi_news`         | DeFi-specific news             |
| `get_bitcoin_news`      | Bitcoin-specific news          |
| `get_breaking_news`     | Breaking news (last 2 hours)   |
| `get_news_sources`      | List all sources               |
| `get_api_health`        | API health check               |
| `get_trending_topics`   | Trending topics with sentiment |
| `get_crypto_stats`      | Analytics & statistics         |
| `analyze_news`          | News with sentiment analysis   |
| `get_archive`           | Historical news archive        |
| `get_archive_stats`     | Archive statistics             |
| `find_original_sources` | Original source tracking       |
| `get_portfolio_news`    | Portfolio news with prices     |

### Option 1: Claude Desktop (stdio)

**1. Clone & install:**

```bash
git clone https://github.com/nirholas/free-crypto-news.git
cd free-crypto-news/mcp && npm install
```

**2. Add to config**

**Mac:** `~/Library/Application Support/Claude/claude_desktop_config.json`  
**Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "crypto-news": {
      "command": "node",
      "args": ["/path/to/free-crypto-news/mcp/index.js"]
    }
  }
}
```

**3. Restart Claude.** Ask: _"Get me the latest crypto news"_

### Option 2: ChatGPT Developer Mode (HTTP/SSE)

**Live Server:** `https://plugins.support/sse`

**Or run locally:**

```bash
cd free-crypto-news/mcp
npm install
npm run start:http  # Starts on port 3001
```

**In ChatGPT:**

1. Enable Developer Mode in Settings → Apps → Advanced
2. Create new app with protocol: **SSE**
3. Endpoint: `https://plugins.support/sse` (or `http://localhost:3001/sse`)
4. No authentication needed

Full documentation: [`mcp/README.md`](mcp/README.md)

---

## 🦜 LangChain

```python
from langchain.tools import tool
import requests

@tool
def get_crypto_news(limit: int = 5) -> str:
    """Get latest cryptocurrency news from 130+ sources."""
    r = requests.get(f"https://cryptocurrency.cv/api/news?limit={limit}")
    return "\n".join([f"• {a['title']} ({a['source']})" for a in r.json()["articles"]])

@tool
def search_crypto_news(query: str) -> str:
    """Search crypto news by keyword."""
    r = requests.get(f"https://cryptocurrency.cv/api/search?q={query}")
    return "\n".join([f"• {a['title']}" for a in r.json()["articles"]])

# Use in your agent
tools = [get_crypto_news, search_crypto_news]
```

Full example: [`examples/langchain-tool.py`](examples/langchain-tool.py)

---

## 🎮 Discord Bot

```javascript
const { Client, EmbedBuilder } = require("discord.js");

client.on("messageCreate", async (msg) => {
  if (msg.content === "!news") {
    const { articles } = await fetch(
      "https://cryptocurrency.cv/api/breaking?limit=5",
    ).then((r) => r.json());

    const embed = new EmbedBuilder()
      .setTitle("🚨 Breaking Crypto News")
      .setColor(0x00ff00);

    articles.forEach((a) =>
      embed.addFields({
        name: a.source,
        value: `[${a.title}](${a.link})`,
      }),
    );

    msg.channel.send({ embeds: [embed] });
  }
});
```

Full bot: [`examples/discord-bot.js`](examples/discord-bot.js)

---

## 🤖 Telegram Bot

```python
from telegram import Update
from telegram.ext import Application, CommandHandler
import aiohttp

async def news(update: Update, context):
    async with aiohttp.ClientSession() as session:
        async with session.get('https://cryptocurrency.cv/api/news?limit=5') as r:
            data = await r.json()

    msg = "📰 *Latest Crypto News*\n\n"
    for a in data['articles']:
        msg += f"• [{a['title']}]({a['link']})\n"

    await update.message.reply_text(msg, parse_mode='Markdown')

app = Application.builder().token("YOUR_TOKEN").build()
app.add_handler(CommandHandler("news", news))
app.run_polling()
```

Full bot: [`examples/telegram-bot.py`](examples/telegram-bot.py)

---

## 🌐 HTML Widget

Embed on any website:

```html
<script>
  async function loadNews() {
    const { articles } = await fetch(
      "https://cryptocurrency.cv/api/news?limit=5",
    ).then((r) => r.json());
    document.getElementById("news").innerHTML = articles
      .map(
        (a) =>
          `<div><a href="${a.link}">${a.title}</a> <small>${a.source}</small></div>`,
      )
      .join("");
  }
  loadNews();
</script>
<div id="news">Loading...</div>
```

Full styled widget: [`widget/crypto-news-widget.html`](widget/crypto-news-widget.html)

---

## 🖥️ cURL / Terminal

```bash
# Latest news
curl -s https://cryptocurrency.cv/api/news | jq '.articles[:3]'

# Search
curl -s "https://cryptocurrency.cv/api/search?q=bitcoin,etf" | jq

# DeFi news
curl -s https://cryptocurrency.cv/api/defi | jq

# Pretty print titles
curl -s https://cryptocurrency.cv/api/news | jq -r '.articles[] | "📰 \(.title) (\(.source))"'
```

---

## ✨ Advanced Features

### 📦 Content-Addressable Storage (CAS)

IPFS-style content addressing for articles:

```bash
# Store content with automatic hash
curl -X POST https://cryptocurrency.cv/api/storage/cas \
  -H "Content-Type: application/json" \
  -d '{"content": "Article content here"}'

# Returns: {"hash": "bafybei..."}

# Retrieve by hash
curl https://cryptocurrency.cv/api/storage/cas?hash=bafybei...
```

### 📊 Data Export Formats

Export news data in multiple formats:

**Supported Formats:**

- JSON (structured)
- CSV (spreadsheet-compatible)
- Parquet (analytics/big data)

```bash
# Create export job
curl -X POST https://cryptocurrency.cv/api/export \
  -H "Content-Type: application/json" \
  -d '{
    "format": "csv",
    "dateFrom": "2026-01-01",
    "dateTo": "2026-01-31",
    "sources": ["coindesk", "theblock"]
  }'

# Returns: {"exportId": "exp_123"}

# Download export
curl https://cryptocurrency.cv/api/exports/exp_123 -o news.csv
```

**Bulk Export Management:**

```bash
# List all exports
curl https://cryptocurrency.cv/api/exports

# Get export status
curl https://cryptocurrency.cv/api/exports/exp_123

# Delete export
curl -X DELETE https://cryptocurrency.cv/api/exports/exp_123
```

### 🏛️ Regulatory Intelligence

Multi-jurisdictional regulatory tracking:

**Coverage:**

- **15 jurisdictions** (US, EU, UK, CN, JP, KR, SG, etc.)
- **30+ agencies** (SEC, CFTC, FCA, ESMA, etc.)
- **Compliance deadlines** tracking
- **Regulatory change detection**

```bash
# Get regulatory news
curl https://cryptocurrency.cv/api/regulatory

# Get jurisdiction profiles
curl https://cryptocurrency.cv/api/regulatory?action=jurisdictions

# Get agency information
curl https://cryptocurrency.cv/api/regulatory?action=agencies

# Get upcoming deadlines
curl https://cryptocurrency.cv/api/regulatory?action=deadlines

# Get intelligence summary
curl https://cryptocurrency.cv/api/regulatory?action=summary
```

### 🏥 DeFi Protocol Health Monitoring

**Features:**

- Protocol health & risk scoring
- Security incident tracking
- TVL monitoring
- Smart contract risk assessment
- Protocol safety rankings

```bash
# Get protocol health score
curl "https://cryptocurrency.cv/api/defi/protocol-health?protocol=aave-v3"

# Get safety rankings by category
curl "https://cryptocurrency.cv/api/defi/protocol-health?action=ranking&category=lending"

# Get recent security incidents
curl "https://cryptocurrency.cv/api/defi/protocol-health?action=incidents&limit=20"
```

### 🐋 Whale Alert Features

**Capabilities:**

- Large transaction monitoring
- Multi-blockchain support (ETH, BTC, SOL, etc.)
- Exchange flow tracking
- Wallet address identification
- Historical whale activity

```bash
# Get recent whale transactions
curl "https://cryptocurrency.cv/api/whale-alerts?limit=50"

# Filter by blockchain and minimum value
curl "https://cryptocurrency.cv/api/whale-alerts?blockchain=ethereum&minUsd=1000000"
```

### 🎯 Prediction Tracking System

**Features:**

- Timestamped prediction registry
- Accuracy scoring and leaderboards
- Influencer reliability tracking
- Outcome resolution
- Historical performance analysis

```bash
# Get predictions
curl https://cryptocurrency.cv/api/predictions

# Get prediction leaderboard
curl https://cryptocurrency.cv/api/predictions?action=leaderboard

# Get influencer track record
curl https://cryptocurrency.cv/api/influencers?username=crypto_analyst
```

### 📈 Strategy Backtesting

Backtest news-based trading strategies:

**Available Strategies:**

- Sentiment momentum
- News volume signals
- Narrative tracking
- Entity mention correlation
- Breaking news reaction

```bash
curl -X POST https://cryptocurrency.cv/api/research/backtest \
  -H "Content-Type: application/json" \
  -d '{
    "strategy": "sentiment_momentum",
    "asset": "BTC",
    "period": "1y",
    "capital": 10000
  }'
```

**Returns:**

- Total return & annualized return
- Sharpe ratio & max drawdown
- Win rate & profit factor
- Trade-by-trade breakdown

### 🔍 Coverage Gap Analysis

Identify under-covered topics and assets:

```bash
# Analyze coverage gaps
curl https://cryptocurrency.cv/api/coverage-gap

# Returns:
# - Under-covered assets
# - Emerging topics with low coverage
# - Source diversity metrics
# - Recommended coverage expansions
```

### 🎓 Academic Access Program

Free access for researchers:

```bash
# Register for academic access
curl -X POST https://cryptocurrency.cv/api/academic \
  -H "Content-Type: application/json" \
  -d '{
    "institution": "University Name",
    "email": "researcher@university.edu",
    "purpose": "Research on crypto market sentiment"
  }'
```

**Benefits:**

- Unlimited API access
- Historical data exports
- Citation network access
- Priority support

---

# Self-Hosting

## One-Click Deploy

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fnirholas%2Ffree-crypto-news)

## Manual

```bash
git clone https://github.com/nirholas/free-crypto-news.git
cd free-crypto-news
pnpm install
pnpm dev
```

Open http://localhost:3000/api/news

## Environment Variables

**All environment variables are optional.** The project works out of the box with zero configuration.

| Variable               | Default           | Description                                                                                                                 |
| ---------------------- | ----------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `GROQ_API_KEY`         | -                 | Enables i18n auto-translation (30+ languages). **FREE!** Get yours at [console.groq.com/keys](https://console.groq.com/keys) |
| `FEATURE_TRANSLATION`  | `false`           | Set to `true` to enable real-time translation                                                                               |
| `REDDIT_CLIENT_ID`     | -                 | Enables Reddit social signals                                                                                               |
| `REDDIT_CLIENT_SECRET` | -                 | Reddit OAuth secret                                                                                                         |
| `X_AUTH_TOKEN`         | -                 | X/Twitter signals via [XActions](https://github.com/nirholas/XActions)                                                      |
| `ARCHIVE_DIR`          | `./archive`       | Archive storage path                                                                                                        |
| `API_URL`              | Production Vercel | API endpoint for archive collection                                                                                         |

### Feature Flags

| Variable              | Default | Description                               |
| --------------------- | ------- | ----------------------------------------- |
| `FEATURE_MARKET`      | `true`  | Market data (CoinGecko, DeFiLlama)        |
| `FEATURE_ONCHAIN`     | `true`  | On-chain events (BTC stats, DEX volumes)  |
| `FEATURE_SOCIAL`      | `true`  | Social signals (Reddit sentiment)         |
| `FEATURE_PREDICTIONS` | `true`  | Prediction markets (Polymarket, Manifold) |
| `FEATURE_CLUSTERING`  | `true`  | Story clustering & deduplication          |
| `FEATURE_RELIABILITY` | `true`  | Source reliability tracking               |

### GitHub Secrets (for Actions)

For full functionality, add these secrets to your repository:

```
GROQ_API_KEY        # For i18n translations (FREE! https://console.groq.com/keys)
FEATURE_TRANSLATION # Set to 'true' to enable translations
REDDIT_CLIENT_ID    # For Reddit data (register at reddit.com/prefs/apps)
REDDIT_CLIENT_SECRET
X_AUTH_TOKEN        # For X/Twitter (from XActions login)
```

---

# Tech Stack

- **Runtime:** Next.js 14 Edge Functions
- **Hosting:** Vercel free tier
- **Data:** Direct RSS parsing (no database)
- **Cache:** 5-minute edge cache

---

# Contributing

PRs welcome! Ideas:

- [ ] More news sources (Korean, Chinese, Japanese, Spanish)
- [x] ~~Sentiment analysis~~ ✅ Done
- [x] ~~Topic classification~~ ✅ Done
- [x] ~~WebSocket real-time feed~~ ✅ Done
- [x] ~~Configurable alert system~~ ✅ Done
- [x] Rust / Ruby SDKs ✅
- [x] ~~Mobile app (React Native)~~ ✅ Done - See [mobile/](mobile/)

---

# New Features

## 📡 RSS Feed Output

Subscribe to the aggregated feed in any RSS reader:

```
https://cryptocurrency.cv/api/rss
https://cryptocurrency.cv/api/rss?feed=defi
https://cryptocurrency.cv/api/rss?feed=bitcoin
```

## 🏥 Health Check

Monitor API and source health:

```bash
curl https://cryptocurrency.cv/api/health | jq
```

Returns status of all 7 RSS sources with response times.

## 📖 Interactive Docs

Swagger UI documentation:

```
https://cryptocurrency.cv/api/docs
```

## 🔔 Webhooks

Register for push notifications:

```bash
curl -X POST https://cryptocurrency.cv/api/webhooks \
  -H "Content-Type: application/json" \
  -d '{"url": "https://your-server.com/webhook", "secret": "your-secret"}'
```

---

## 📊 Trending & Analytics

### Trending Topics

```bash
curl https://cryptocurrency.cv/api/trending?hours=24
```

Returns topics with sentiment (bullish/bearish/neutral) and mention counts.

### News with Classification

```bash
# Get all analyzed news
curl https://cryptocurrency.cv/api/analyze

# Filter by topic
curl "https://cryptocurrency.cv/api/analyze?topic=DeFi"

# Filter by sentiment
curl "https://cryptocurrency.cv/api/analyze?sentiment=bullish"
```

### Statistics

```bash
curl https://cryptocurrency.cv/api/stats
```

Returns articles per source, hourly distribution, and category breakdown.

---

## 📦 SDKs

| Language   | Install                                              |
| ---------- | ---------------------------------------------------- |
| TypeScript | `npm install @nirholas/crypto-news`                  |
| Python     | `curl -O .../sdk/python/crypto_news.py`              |
| Go         | `go get github.com/nirholas/free-crypto-news/sdk/go` |
| PHP        | `curl -O .../sdk/php/CryptoNews.php`                 |
| JavaScript | `curl -O .../sdk/javascript/crypto-news.js`          |
| Rust       | `cargo add fcn-sdk`                                  |
| Ruby       | `gem install fcn-sdk`                                |

See [`/sdk`](./sdk) for documentation.

---

## 🤖 Integrations

- **Claude Desktop MCP**: [`/mcp`](./mcp)
- **ChatGPT Plugin**: [`/chatgpt`](./chatgpt)
- **Postman Collection**: [`/postman`](./postman)
- **Bot Examples**: Discord, Telegram, Slack in [`/examples`](./examples)
- **Embeddable Widget**: [`/widget`](./widget)

---

## 📚 Historical Archive

Query historical news data stored in GitHub:

```bash
# Get archive statistics
curl "https://cryptocurrency.cv/api/archive?stats=true"

# Query by date range
curl "https://cryptocurrency.cv/api/archive?start_date=2025-01-01&end_date=2025-01-07"

# Search historical articles
curl "https://cryptocurrency.cv/api/archive?q=bitcoin&limit=50"

# Get archive index
curl "https://cryptocurrency.cv/api/archive?index=true"
```

Archive is automatically updated every 6 hours via GitHub Actions.

---

## 🛡️ Failsafe Mirror

If the main Vercel deployment is down, use the **GitHub Pages backup**:

### Failsafe URL

```
https://nirholas.github.io/free-crypto-news/
```

### Static JSON Endpoints

| Endpoint               | Description                 |
| ---------------------- | --------------------------- |
| `/cache/latest.json`   | Latest cached news (hourly) |
| `/cache/bitcoin.json`  | Bitcoin news cache          |
| `/cache/defi.json`     | DeFi news cache             |
| `/cache/trending.json` | Trending topics cache       |
| `/cache/sources.json`  | Source list                 |
| `/archive/index.json`  | Historical archive index    |

### Status Page

View real-time system health at:

```
https://cryptocurrency.cv/status
```

The status page shows:
- ✅ Service health (API, Cache, External APIs, x402 Facilitator)
- 📊 System metrics (version, uptime, active sources)
- 📰 News source activity (articles per source in last 24h)
- 🔗 API endpoint status

**Legacy static status page:**
```
https://nirholas.github.io/free-crypto-news/status.html
```

Real-time monitoring of all API endpoints with auto-refresh.

### How It Works

1. **GitHub Actions** runs every hour to cache data from main API
2. **GitHub Pages** serves the static JSON files
3. **Failsafe page** auto-detects if main API is down and switches to cache
4. **Archive workflow** runs every 6 hours to store historical data

### Client-Side Failsafe Pattern

```javascript
const MAIN_API = "https://cryptocurrency.cv";
const FAILSAFE = "https://nirholas.github.io/free-crypto-news";

async function getNews() {
  try {
    // Try main API first (5s timeout)
    const controller = new AbortController();
    setTimeout(() => controller.abort(), 5000);

    const res = await fetch(`${MAIN_API}/api/news`, {
      signal: controller.signal,
    });
    if (res.ok) return res.json();
    throw new Error("API error");
  } catch {
    // Fallback to GitHub Pages cache
    const res = await fetch(`${FAILSAFE}/cache/latest.json`);
    return res.json();
  }
}
```

---

## 🔍 Original Source Finder

Track where news originated before being picked up by aggregators:

```bash
# Find original sources for recent news
curl "https://cryptocurrency.cv/api/origins?limit=20"

# Filter by source type
curl "https://cryptocurrency.cv/api/origins?source_type=government"

# Search specific topic
curl "https://cryptocurrency.cv/api/origins?q=SEC"
```

Source types: `official`, `press-release`, `social`, `blog`, `government`

Identifies sources like SEC, Federal Reserve, Binance, Coinbase, Vitalik Buterin, X/Twitter, etc.

---

## 🔔 Web Push Notifications

Subscribe to real-time push notifications:

```javascript
// Get VAPID public key
const { publicKey } = await fetch(
  "https://cryptocurrency.cv/api/push",
).then((r) => r.json());

// Register subscription
await fetch("https://cryptocurrency.cv/api/push", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    subscription: pushSubscription,
    topics: ["bitcoin", "breaking", "defi"],
  }),
});
```

---

## 🎨 Embeddable Widgets

### News Ticker

```html
<div id="crypto-ticker" class="crypto-ticker" data-auto-init>
  <div class="crypto-ticker-label">📰 CRYPTO</div>
  <div class="crypto-ticker-track"></div>
</div>
<script src="https://nirholas.github.io/free-crypto-news/widget/ticker.js"></script>
```

### News Carousel

```html
<div id="crypto-carousel" class="crypto-carousel" data-auto-init>
  <div class="crypto-carousel-viewport">
    <div class="crypto-carousel-track"></div>
  </div>
</div>
<script src="https://nirholas.github.io/free-crypto-news/widget/carousel.js"></script>
```

See full widget examples in [`/widget`](./widget)

---

# 🗄️ Archive v2: The Definitive Crypto News Record

We're building the most comprehensive open historical archive of crypto news. Every headline. Every hour. Forever.

## What's in v2

| Feature               | Description                                      |
| --------------------- | ------------------------------------------------ |
| **Hourly collection** | Every hour, not every 6 hours                    |
| **Append-only**       | Never overwrite - every unique article preserved |
| **Deduplication**     | Content-addressed IDs prevent duplicates         |
| **Entity extraction** | Auto-extracted tickers ($BTC, $ETH, etc.)        |
| **Named entities**    | People, companies, protocols identified          |
| **Sentiment scoring** | Every headline scored positive/negative/neutral  |
| **Market context**    | BTC/ETH prices + Fear & Greed at capture time    |
| **Content hashing**   | SHA256 for integrity verification                |
| **Hourly snapshots**  | What was trending each hour                      |
| **Indexes**           | Fast lookups by source, ticker, date             |
| **JSONL format**      | Streamable, append-friendly, grep-able           |

## Archive API Endpoints

```bash
# Get enriched articles with all metadata
curl "https://cryptocurrency.cv/api/archive?limit=20"

# Filter by ticker
curl "https://cryptocurrency.cv/api/archive?ticker=BTC"

# Filter by sentiment
curl "https://cryptocurrency.cv/api/archive?sentiment=positive"

# Get archive statistics
curl "https://cryptocurrency.cv/api/archive?stats=true"

# Get trending tickers (last 24h)
curl "https://cryptocurrency.cv/api/archive?trending=true"

# Get market history for a month
curl "https://cryptocurrency.cv/api/archive?market=2026-01"
```

## Archive Directory Structure

```
archive/
    articles/           # JSONL files, one per month
      2026-01.jsonl     # All articles from January 2026
    snapshots/          # Hourly trending state
      2026/01/11/
        00.json         # What was trending at midnight
        01.json         # What was trending at 1am
        ...
    market/             # Price/sentiment history
      2026-01.jsonl     # Market data for January 2026
    indexes/            # Fast lookups
      by-source.json    # Article IDs grouped by source
      by-ticker.json    # Article IDs grouped by ticker
      by-date.json      # Article IDs grouped by date
    meta/
      schema.json       # Schema version and definition
      stats.json        # Running statistics
```

## Enriched Article Schema

```json
{
  "id": "a1b2c3d4e5f6g7h8",
  "schema_version": "2.0.0",
  "title": "BlackRock adds $900M BTC...",
  "link": "https://...",
  "canonical_link": "https://... (normalized)",
  "description": "...",
  "source": "CoinTelegraph",
  "source_key": "cointelegraph",
  "category": "bitcoin",
  "pub_date": "2026-01-08T18:05:00.000Z",
  "first_seen": "2026-01-08T18:10:00.000Z",
  "last_seen": "2026-01-08T23:05:00.000Z",
  "fetch_count": 5,
  "tickers": ["BTC"],
  "entities": {
    "people": ["Larry Fink"],
    "companies": ["BlackRock"],
    "protocols": ["Bitcoin"]
  },
  "tags": ["institutional", "price"],
  "sentiment": {
    "score": 0.65,
    "label": "positive",
    "confidence": 0.85
  },
  "market_context": {
    "btc_price": 94500,
    "eth_price": 3200,
    "fear_greed_index": 65
  },
  "content_hash": "h8g7f6e5d4c3b2a1",
  "meta": {
    "word_count": 23,
    "has_numbers": true,
    "is_breaking": false,
    "is_opinion": false
  }
}
```

---

# 🚀 Roadmap

Building the definitive open crypto intelligence platform.

## ✅ Complete

- [x] Real-time aggregation from 7 sources
- [x] REST API with multiple endpoints
- [x] RSS/Atom feeds
- [x] SDKs (Python, JavaScript, TypeScript, Go, PHP, React, Rust, Ruby)
- [x] MCP server for AI assistants
- [x] Embeddable widgets
- [x] Archive v2 with enrichment
- [x] Hourly archive collection workflow
- [x] Entity/ticker extraction
- [x] Sentiment analysis
- [x] Market context capture (CoinGecko + DeFiLlama)
- [x] Story clustering engine
- [x] Source reliability tracking
- [x] On-chain event tracking (Bitcoin, DeFi TVL, DEX volumes, bridges)
- [x] X/Twitter social signals via [XActions](https://github.com/nirholas/XActions) (no API key needed!)
- [x] Prediction market tracking (Polymarket, Manifold)
- [x] AI training data exporter
- [x] Analytics engine with daily/weekly digests
- [x] Market data visualization components (Heatmap, Dominance, Correlation)
- [x] Advanced coin screener with filters
- [x] Live WebSocket price updates
- [x] Crypto calculator & converter
- [x] Gas tracker (Ethereum)
- [x] Social buzz & sentiment dashboard
- [x] Liquidations feed (real-time)
- [x] Data export (CSV/JSON)
- [x] Multi-currency selector
- [x] Admin usage dashboard
- [x] API key management system (self-service registration)
- [x] Tiered API access (Free/Pro/Enterprise)
- [x] Admin key management endpoints
- [x] Admin usage statistics dashboard
- [x] Subscription expiry cron job
- [x] Webhook testing endpoint
- [x] Centralized admin authentication
- [x] CoinCap API integration (free market data)
- [x] CoinPaprika API integration (free market data)
- [x] Bitcoin on-chain data (Mempool.space)
- [x] DeFi yields integration (Llama.fi)
- [x] Real-time price WebSocket (CoinCap)
- [x] x402 micropayments infrastructure (Base L2)

## 🔨 In Progress

- [ ] Full test of enhanced collection pipeline
- [x] LunarCrush / Santiment social metrics integration ✅
- [x] Wire up new market tools to navigation ✅
- [x] x402 payment flow testing (Base Sepolia) ✅
- [x] TradingView chart embeds ✅
- [x] Portfolio performance charts ✅
- [x] The Oracle: Natural language queries over all data ✅

## 📋 Short-Term (Q1 2026)

### Data Enrichment

- [x] Full article extraction (where legally permissible)
- [x] AI-powered summarization (1-sentence, 1-paragraph)
- [x] Advanced entity extraction with AI ✅
- [x] Event classification (funding, hack, regulation, etc.) ✅
- [x] Claim extraction (factual claims as structured data) ✅
- [x] Relationship extraction (who did what to whom) ✅

### API Infrastructure

- [x] Self-service API key registration ✅
- [x] Tiered rate limiting (Free/Pro/Enterprise) ✅
- [x] Usage tracking & statistics ✅
- [x] Admin management dashboard ✅
- [x] Webhook delivery system ✅
- [x] API key analytics & insights ✅
- [x] Usage-based billing integration (Stripe) ✅

### Multi-Lingual

- [x] i18n workflow with 30+ languages (auto-translation via Groq - FREE!)
- [x] Translated README and docs
- [x] Korean sources ✅
- [x] Chinese sources ✅
- [x] Japanese sources ✅
- [x] Spanish sources ✅

### Real-Time Features

- [x] WebSocket streaming
- [x] Configurable alert system (8 condition types)
- [x] Alert WebSocket subscriptions
- [x] Alert webhook delivery
- [x] Live price components with flash animations ✅
- [x] Faster webhook delivery

### Market Tools

- [x] Crypto calculator with profit/loss ✅
- [x] Ethereum gas tracker ✅
- [x] Market heatmap visualization ✅
- [x] Correlation matrix (7/30/90 day) ✅
- [x] Market dominance chart ✅
- [x] Advanced screener with filters ✅
- [x] Liquidations feed ✅
- [x] Social buzz metrics ✅

## 📋 Medium-Term (Q2-Q3 2026)

### x402 Premium Features

- [x] x402 payment protocol integration ✅
- [x] Pay-per-request micropayments (USDC on Base) ✅
- [x] Payment provider React component ✅
- [x] Payment button component ✅
- [x] Payment lifecycle hooks ✅
- [x] Premium endpoint definitions ✅
- [x] Full payment flow E2E testing ✅
- [ ] Mainnet deployment

### Intelligence Layer (Partial - In Progress)

- [x] Story clustering (group related articles) ✅
- [x] Headline mutation tracking (detect changes) ✅
- [x] Source first-mover tracking (who breaks news) ✅
- [x] Coordinated narrative detection ✅
- [x] Prediction tracking & accuracy scoring
- [x] Anomaly detection (unusual coverage patterns) ✅

### Social Intelligence (Partial - In Progress)

- [x] X/Twitter integration via XActions (browser automation - FREE!) ✅
- [x] Social buzz dashboard (trending coins, sentiment) ✅
- [x] Discord public channel monitoring ✅
- [x] Telegram channel aggregation ✅
- [x] Influencer reliability scoring ✅
- [x] LunarCrush integration (Galaxy Score, AltRank, social volume) ✅
- [x] Santiment integration (social metrics, dev activity) ✅
- [x] Social Intelligence Dashboard component ✅
- [x] Influencer Leaderboard with accuracy tracking ✅

### On-Chain Correlation (Partial - In Progress)

- [x] Bitcoin on-chain data (Mempool.space integration) ✅
- [x] Link news to on-chain events ✅
- [x] Whale movement correlation (structure ready) ✅
- [x] DEX volume correlation ✅
- [x] Bridge volume tracking ✅
- [x] Liquidations feed integration ✅
- [x] Coverage gap analysis (what's NOT being covered)

### AI Products

- [x] **The Oracle**: Natural language queries over all data ✅
- [x] **The Brief**: Personalized AI-generated digests ✅
- [x] **The Debate**: Multi-perspective synthesis ✅
- [x] **The Counter**: Fact-checking as a service ✅

### Portfolio & Watchlist

- [x] Portfolio tracking with holdings table ✅
- [x] Portfolio summary with P/L ✅
- [x] Watchlist with export ✅
- [x] Price alerts system ✅
- [x] Portfolio performance charts ✅
- [x] Tax report generation ✅

## 📋 Long-Term (2027+)

### Research Infrastructure

- [x] Causal inference engine ✅
- [x] Backtesting infrastructure
- [x] Hypothesis testing platform ✅
- [x] Academic access program ✅

### Trust & Verification

- [x] Content-addressed storage (IPFS-style) ✅
- [x] Periodic merkle roots anchored to blockchain ✅
- [x] Deep fake / AI content detection ✅
- [x] Source network forensics ✅

### Formats & Access (Partial - In Progress)

- [x] CSV/JSON export for all data types ✅
- [x] Parquet exports for analytics ✅
- [x] SQLite monthly exports ✅
- [x] Embedding vectors for semantic search (export ready) ✅
- [x] LLM fine-tuning ready datasets ✅

### The Meta-Play

- [x] Industry-standard reference for disputes ✅
- [x] Academic citation network ✅
- [x] AI training data licensing ✅
- [x] Prediction registry (timestamped predictions with outcomes) ✅

### Advanced Trading Tools

- [x] TradingView integration ✅
- [x] Multi-exchange order book aggregation ✅
- [x] Arbitrage opportunity scanner ✅
- [x] Options flow tracking ✅
- [x] Funding rate dashboard ✅

---

## 📂 Archive Data Structure

The enhanced archive system captures comprehensive crypto intelligence:

```
archive/
├── articles/              # JSONL, append-only articles
│   └── 2026-01.jsonl     # ~50 new articles per hour
├── market/               # Full market snapshots
│   └── 2026-01.jsonl     # CoinGecko + DeFiLlama data
├── onchain/              # On-chain events
│   └── 2026-01.jsonl     # BTC stats, DEX volumes, bridges
├── social/               # Social signals
│   └── 2026-01.jsonl     # Reddit sentiment, trending
├── predictions/          # Prediction markets
│   └── 2026-01.jsonl     # Polymarket + Manifold odds
├── snapshots/            # Hourly trending snapshots
│   └── 2026/01/11/
│       └── 08.json       # Complete state at 08:00 UTC
├── analytics/            # Generated insights
│   ├── digest-2026-01-11.json
│   ├── narrative-momentum.json
│   └── coverage-patterns.json
├── exports/training/     # AI-ready exports
│   ├── instruction-tuning.jsonl
│   ├── qa-pairs.jsonl
│   ├── sentiment-dataset.jsonl
│   ├── embeddings-data.jsonl
│   └── ner-training.jsonl
├── indexes/              # Fast lookups
│   ├── by-source.json
│   ├── by-ticker.json
│   └── by-date.json
└── meta/
    ├── schema.json
    ├── stats.json
    └── source-stats.json # Reliability scores
```

### Per-Article Data

Each article is enriched with:

```json
{
  "id": "sha256:abc123...",
  "schema_version": "2.0.0",
  "title": "Bitcoin Surges Past $100K",
  "link": "https://...",
  "description": "...",
  "source": "CoinDesk",
  "source_key": "coindesk",
  "pub_date": "2026-01-11T10:00:00Z",
  "first_seen": "2026-01-11T10:05:00Z",
  "last_seen": "2026-01-11T18:05:00Z",
  "fetch_count": 8,
  "tickers": ["BTC", "ETH"],
  "categories": ["market", "bitcoin"],
  "sentiment": "bullish",
  "market_context": {
    "btc_price": 100500,
    "eth_price": 4200,
    "fear_greed": 75,
    "btc_dominance": 52.3
  }
}
```

### Hourly Snapshot Data

Each hour captures:

- **Articles**: Count, sentiment breakdown, top tickers, source distribution
- **Market**: Top 100 coins, DeFi TVL, yields, stablecoins, trending
- **On-Chain**: BTC network stats, DEX volumes, bridge activity
- **Social**: Reddit sentiment, active users, trending topics
- **Predictions**: Polymarket/Manifold crypto prediction odds
- **Clustering**: Story clusters, first-movers, coordinated releases

---

## Why This Matters

**Time is our moat.**

If we capture complete data now with proper structure, in 2 years we'll have something nobody can recreate. The compound value:

- **Year 1**: Interesting dataset
- **Year 3**: Valuable for research
- **Year 5**: Irreplaceable historical record
- **Year 10**: The definitive source, cited in papers, used by institutions

Every day we delay proper archiving is data lost forever.

---

## ⭐ Star History

<a href="https://star-history.com/#nirholas/free-crypto-news&Date">
 <picture>
   <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/svg?repos=nirholas/free-crypto-news&type=Date&theme=dark" />
   <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/svg?repos=nirholas/free-crypto-news&type=Date" />
   <img alt="Star History Chart" src="https://api.star-history.com/svg?repos=nirholas/free-crypto-news&type=Date" />
 </picture>
</a>

---

## 🤝 Contributing

We welcome contributions! Whether it's:

- 🐛 Bug fixes
- ✨ New features
- 📰 Adding news sources
- 📖 Improving documentation
- 🌍 Translations

Please read our [**Contributing Guide**](CONTRIBUTING.md) to get started.

---

## 📚 Documentation

| Document                                   | Description                                 |
| ------------------------------------------ | ------------------------------------------- |
| [User Guide](docs/USER-GUIDE.md)           | End-user features, keyboard shortcuts, PWA  |
| [Developer Guide](docs/DEVELOPER-GUIDE.md) | Architecture, components, extending the app |
| [API Reference](docs/API.md)               | Full API documentation                      |
| [RAG System](docs/RAG.md)                  | Retrieval-Augmented Generation documentation |
| [RAG Roadmap](docs/RAG-ROADMAP.md)         | RAG future enhancements & timeline          |
| [Contributing](CONTRIBUTING.md)            | How to contribute                           |
| [Changelog](CHANGELOG.md)                  | Version history                             |
| [Security](SECURITY.md)                    | Security policy                             |

---

# License

MIT © 2025 [nich](https://github.com/nirholas)

---

<p align="center">
  <b>Stop paying for crypto news APIs.</b><br>
  <sub>Made with 💜 for the community</sub>
</p>

<p align="center">
  <br>
  ⭐ <b>Found this useful? Give it a star!</b> ⭐<br>
  <sub>It helps others discover this project and keeps development going. Please contribute to the repo, it's beneficial for everyone when you make fixes directly to this repo rather than JUST your own. Thanks!</sub><br><br>
  <a href="https://github.com/nirholas/free-crypto-news/stargazers">
    <img src="https://img.shields.io/github/stars/nirholas/free-crypto-news?style=social" alt="Star on GitHub">
  </a>
</p>

---

## 🌐 Live HTTP Deployment

**Free Crypto News** is deployed and accessible over HTTP via [MCP Streamable HTTP](https://modelcontextprotocol.io/specification/2025-03-26/basic/transports#streamable-http) transport — no local installation required.

**Endpoint:**
```
https://modelcontextprotocol.name/mcp/free-crypto-news
```

### Connect from any MCP Client

Add to your MCP client configuration (Claude Desktop, Cursor, SperaxOS, etc.):

```json
{
  "mcpServers": {
    "free-crypto-news": {
      "type": "http",
      "url": "https://modelcontextprotocol.name/mcp/free-crypto-news"
    }
  }
}
```

### Available Tools (4)

| Tool | Description |
|------|-------------|
| `get_latest_news` | Get latest cryptocurrency news |
| `get_bitcoin_news` | Bitcoin-specific news |
| `get_ethereum_news` | Ethereum-specific news |
| `get_defi_news` | DeFi-related news |

### Example Requests

**Get latest cryptocurrency news:**
```bash
curl -X POST https://modelcontextprotocol.name/mcp/free-crypto-news \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"get_latest_news","arguments":{"limit":5}}}'
```

**Bitcoin-specific news:**
```bash
curl -X POST https://modelcontextprotocol.name/mcp/free-crypto-news \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"get_bitcoin_news","arguments":{"limit":5}}}'
```

**Ethereum-specific news:**
```bash
curl -X POST https://modelcontextprotocol.name/mcp/free-crypto-news \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"get_ethereum_news","arguments":{"limit":5}}}'
```

### List All Tools

```bash
curl -X POST https://modelcontextprotocol.name/mcp/free-crypto-news \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

### Also Available On

- **[SperaxOS](https://speraxos.vercel.app)** — Browse and install from the [MCP marketplace](https://speraxos.vercel.app/community/mcp)
- **All 27 MCP servers** — See the full catalog at [modelcontextprotocol.name](https://modelcontextprotocol.name)

> Powered by [modelcontextprotocol.name](https://modelcontextprotocol.name) — the open MCP HTTP gateway
