/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"

export function registerNewsPrompts(server: McpServer) {
  // Daily crypto news briefing prompt
  server.prompt(
    "crypto_news_briefing",
    "Get a comprehensive daily crypto news briefing",
    {
      focus: z
        .string()
        .optional()
        .describe(
          "Focus area: 'general' for all news, 'defi' for DeFi, 'bitcoin' for BTC, or 'breaking' for recent"
        )
    },
    ({ focus = "general" }) => ({
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text: `Provide a comprehensive crypto news briefing${focus !== "general" ? ` focused on ${focus}` : ""}.

Use the crypto news tools to gather information:
${focus === "defi" ? "- Use get_defi_news to get DeFi-specific news" : ""}
${focus === "bitcoin" ? "- Use get_bitcoin_news to get Bitcoin-specific news" : ""}
${focus === "breaking" ? "- Use get_breaking_crypto_news to get the latest breaking news" : ""}
${focus === "general" ? "- Use get_crypto_news to get the latest news from all sources" : ""}

Format the briefing as:

## 📰 Crypto News Briefing
${focus !== "general" ? `*Focus: ${focus.charAt(0).toUpperCase() + focus.slice(1)}*\n` : ""}
### Top Stories
For each major story, provide:
- **Headline**: [Title]
- **Source**: [Source name]
- **Summary**: Brief 1-2 sentence summary
- **Link**: [URL]

### Market Sentiment
Based on the news, provide a brief sentiment analysis.

### Key Themes
List 3-5 key themes emerging from today's news.

### Worth Watching
Highlight any developing stories that could have significant impact.`
          }
        }
      ]
    })
  )

  // News search and analysis prompt
  server.prompt(
    "crypto_news_research",
    "Research a specific crypto topic across news sources",
    {
      topic: z
        .string()
        .describe("The topic to research (e.g., 'ethereum ETF', 'bitcoin halving', 'defi hack')")
    },
    ({ topic }) => ({
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text: `Research the topic "${topic}" across crypto news sources.

Use search_crypto_news to find relevant articles about "${topic}".

Provide a research report:

## 📊 Research Report: ${topic}

### Recent Coverage
List relevant articles found, including:
- Title
- Source
- Publication time
- Key points

### Timeline of Events
If applicable, create a timeline of related events.

### Multiple Perspectives
Summarize different viewpoints from various sources.

### Analysis
- What is the consensus view?
- Are there any contradicting reports?
- What information is still unclear?

### Recommended Reading
Top 3-5 articles for deeper understanding.`
          }
        }
      ]
    })
  )

  // Source comparison prompt
  server.prompt(
    "compare_crypto_sources",
    "Compare coverage of a topic across different crypto news sources",
    {
      topic: z
        .string()
        .describe("Topic to compare coverage for")
    },
    ({ topic }) => ({
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text: `Compare how different crypto news sources are covering "${topic}".

First, use get_crypto_news_sources to see available sources.
Then, use search_crypto_news to find articles about "${topic}".

Create a comparison:

## 📰 Source Coverage Comparison: ${topic}

### Coverage by Source
For each source that has covered this topic:

| Source | # Articles | Tone | Key Focus |
|--------|------------|------|-----------|
[Fill in data]

### Notable Differences
Highlight any significant differences in:
- Framing of the story
- Facts emphasized
- Expert sources quoted
- Conclusions drawn

### Most Comprehensive Coverage
Which source provides the most thorough coverage?

### Bias Check
Note any apparent biases in coverage.`
          }
        }
      ]
    })
  )

  // Breaking news alert prompt
  server.prompt(
    "crypto_breaking_alert",
    "Get and analyze breaking crypto news",
    {},
    () => ({
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text: `Get the latest breaking crypto news and analyze its potential market impact.

Use get_breaking_crypto_news to fetch the most recent news.

Provide an alert-style analysis:

## 🚨 Breaking Crypto News Alert

### Latest Headlines
List the breaking news items with timestamps.

### Immediate Market Implications
For significant news:
- Potential price impact
- Affected assets
- Related protocols or companies

### Action Items
What should traders/investors be aware of?

### Developing Stories
Flag any stories that are still developing.

### Verification Status
Note if any stories require additional confirmation.`
          }
        }
      ]
    })
  )
}
