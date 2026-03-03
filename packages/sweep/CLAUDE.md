# sweep

> Multi-chain dust sweeper that consolidates small token balances into DeFi yield. Supports Ethereum, Base, Arbitrum, Polygon, Solana & more. Gasless transactions via ERC-4337 account abstraction. MEV-protected swaps through CoW Protocol. Route dust to Aave, Yearn, Lido, Beefy & Jito yield vaults.

### Terminal Management

- **Always use background terminals** (`isBackground: true`) for every command so a terminal ID is returned
- **Always kill the terminal** after the command completes, whether it succeeds or fails — never leave terminals open
- Do not reuse foreground shell sessions — stale sessions block future terminal operations in Codespaces
- In GitHub Codespaces, agent-spawned terminals may be hidden — they still work. Do not assume a terminal is broken if you cannot see it
- If a terminal appears unresponsive, kill it and create a new one rather than retrying in the same terminal
