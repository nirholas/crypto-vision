# Resources & Prompts

Built-in resources and prompts for AI agents.

---

## Prompts

Prompts provide structured guidance for common tasks.

### Core Analysis Prompts

| Prompt | Description |
|--------|-------------|
| `analyze_block` | Analyze a block and its contents |
| `analyze_transaction` | Analyze a specific transaction |
| `analyze_address` | Analyze an EVM address |
| `interact_with_contract` | Guide for contract interaction |
| `explain_evm_concept` | Explain EVM concepts |
| `compare_networks` | Compare different EVM networks |
| `analyze_token` | Analyze an ERC20 or NFT token |

### DeFi Prompts

| Prompt | Description |
|--------|-------------|
| `analyze_defi_position` | Analyze lending/borrowing position |
| `swap_guide` | Guide for executing swaps |
| `liquidity_guide` | Guide for providing liquidity |
| `staking_guide` | Guide for staking operations |
| `bridge_guide` | Guide for cross-chain bridges |

### Security Prompts

| Prompt | Description |
|--------|-------------|
| `security_check` | Token/contract security analysis |
| `rug_pull_detection` | Rug pull risk analysis |
| `approve_safely` | Safe token approval guide |
| `honeypot_check` | Detect honeypot tokens |
| `contract_permissions_check` | Analyze dangerous permissions |

### Governance Prompts

| Prompt | Description |
|--------|-------------|
| `governance_guide` | DAO voting and delegation |
| `proposal_analysis` | Analyze governance proposal |

### Deployment Prompts

| Prompt | Description |
|--------|-------------|
| `deploy_contract_guide` | Guide for deploying smart contracts |
| `proxy_deployment_guide` | Guide for upgradeable proxy deployment |
| `create2_deployment_guide` | Guide for deterministic CREATE2 deployment |
| `proxy_upgrade_guide` | Guide for upgrading proxy contracts |
| `contract_verification_guide` | Guide for verifying contracts on explorers |

### MEV Protection Prompts

| Prompt | Description |
|--------|-------------|
| `mev_protection_guide` | Guide for MEV protection strategies |
| `private_transaction_guide` | Guide for Flashbots Protect |
| `mev_analysis` | Analyze MEV exposure for transactions |

---

## Using Prompts

### Example: Analyze Transaction

```
Analyze this transaction: 0x123...
```

The AI will use the `analyze_transaction` prompt to provide:
- Transaction details
- Gas usage analysis
- Contract interactions
- Token transfers

### Example: Compare Networks

```
Compare BSC and Arbitrum for DeFi
```

Uses `compare_networks` to explain:
- Gas costs
- Transaction speed
- Ecosystem differences
- Bridge options

### Example: Security Check

```
Check if this token is safe: 0x...
```

Uses `security_check` to analyze:
- Honeypot detection
- Ownership status
- Tax/fee analysis
- Holder distribution

---

## Prompt Parameters

Each prompt accepts specific parameters:

### analyze_block

| Parameter | Type | Description |
|-----------|------|-------------|
| `blockNumber` | number | Block to analyze |
| `network` | string | Network name |

### analyze_address

| Parameter | Type | Description |
|-----------|------|-------------|
| `address` | string | EVM address |
| `network` | string | Network name |

### analyze_token

| Parameter | Type | Description |
|-----------|------|-------------|
| `address` | string | Token contract address |
| `network` | string | Network name |

### security_check

| Parameter | Type | Description |
|-----------|------|-------------|
| `address` | string | Token/contract address |
| `network` | string | Network name |

### swap_guide

| Parameter | Type | Description |
|-----------|------|-------------|
| `tokenIn` | string | Input token address |
| `tokenOut` | string | Output token address |
| `amount` | string | Amount to swap |
| `network` | string | Network name |

---

## Credits

Built by **[nich](https://x.com/nichxbt)** ([github.com/nirholas](https://github.com/nirholas))
