# Web3 Research MCP Server

Deep Research for crypto - free & fully local. A Model Context Protocol server for comprehensive cryptocurrency token research.

## Author

**Nich**
- Twitter: [@nichxbt](https://x.com/nichxbt)
- GitHub: [@nirholas](https://github.com/nirholas)

## Features

- **Token Research**: Comprehensive analysis of cryptocurrency tokens
- **Web Search**: Search multiple sources for token information
- **Research Planning**: Structured research plans with status tracking
- **Resource Management**: Store and retrieve research resources
- **Multi-Source Search**: Search across CoinMarketCap, Dune, IQ Wiki, and more

## Tools

### `search`
General web/news/images/videos search.

### `create-research-plan`
Creates a structured research plan for a token.

### `research-with-keywords`
Searches for a token with multiple keywords.

### `update-status`
Updates the status of a research section.

### `fetch-content`
Fetches content from a URL or resource.

### `search-source`
Searches a specific source for token information.

### `research-source`
Researches a single source for token information.

### `research-token`
Comprehensive token research from a specific source.

### `list-resources`
Lists all available research resources.

## Resources

### `research://status`
Current research status.

### `research://plan`
Current research plan.

### `research://logs`
Research activity logs.

### `research://resources`
List of collected resources.

### `research://data`
Research data.

### `research://resource/{id}`
Access specific resource by ID.

## Prompts

### `token-research`
Initiates comprehensive token research with structured guidance.

## Dependencies

- `@modelcontextprotocol/sdk`
- `duck-duck-scrape`
- `cheerio`
- `node-fetch`
- `turndown`
- `zod`

## Usage

```bash
# Run with Node.js
node dist/server.js

# Or use with npx
npx web3-research-mcp
```

## License

Apache-2.0 License
