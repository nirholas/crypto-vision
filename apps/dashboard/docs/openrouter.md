# Using Crypto Data Aggregator with OpenRouter

Crypto Data Aggregator is an AI-powered platform that aggregates cryptocurrency data from multiple sources. It supports OpenRouter for AI-powered analysis features.

## What is OpenRouter?

[OpenRouter](https://openrouter.ai) provides a unified API to access 200+ AI models - perfect for cost-effective AI analysis at scale.

## Setup

### 1. Get Your OpenRouter API Key

1. Sign up at [openrouter.ai](https://openrouter.ai)
2. Generate an API key at [openrouter.ai/settings/keys](https://openrouter.ai/settings/keys)

### 2. Configure Environment

```bash
export OPENROUTER_API_KEY=sk-or-v1-your-key-here

# Optional: specify model
export OPENROUTER_MODEL=anthropic/claude-sonnet-4
```

### 3. Run

```bash
npm install
npm run dev
```

## AI Features

With OpenRouter configured:

- **Market Sentiment Analysis** - AI-powered sentiment scoring
- **Event Classification** - Categorize market events automatically
- **Claim Extraction** - Extract verifiable claims from news
- **AI Debates** - Generate bull/bear arguments
- **Smart Summaries** - Condense complex market data

## Provider Auto-Detection

Supports multiple providers with auto-detection:

```
Priority: Groq → OpenAI → Anthropic → OpenRouter
```

Set only `OPENROUTER_API_KEY` to use OpenRouter exclusively.

## Recommended Models

| Model | Best For |
|-------|----------|
| `anthropic/claude-sonnet-4` | Deep analysis |
| `meta-llama/llama-3-70b-instruct` | Balanced performance |
| `mistralai/mixtral-8x7b-instruct` | Cost-effective |

## Resources

- [GitHub](https://github.com/nirholas/crypto-data-aggregator)
- [OpenRouter Docs](https://openrouter.ai/docs)
