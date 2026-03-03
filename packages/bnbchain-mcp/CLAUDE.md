# bnbchain-mcp

> Developer tools for AI crypto agents  🛠️ Build apps with DeFi trading, DEX swaps, smart contract deployment, token operations, staking, bridging, wallet automation, honeypot detection, security analysis, price oracles, market data & protocol analytics on BSC and opBNB

### Terminal Management

- **Always use background terminals** (`isBackground: true`) for every command so a terminal ID is returned
- **Always kill the terminal** after the command completes, whether it succeeds or fails — never leave terminals open
- Do not reuse foreground shell sessions — stale sessions block future terminal operations in Codespaces
- In GitHub Codespaces, agent-spawned terminals may be hidden — they still work. Do not assume a terminal is broken if you cannot see it
- If a terminal appears unresponsive, kill it and create a new one rather than retrying in the same terminal
