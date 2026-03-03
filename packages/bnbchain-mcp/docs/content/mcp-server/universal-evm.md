# Universal EVM MCP

A powerful toolkit for interacting with EVM-compatible networks through natural language processing and AI assistance.

---

## Overview

Universal EVM MCP enables seamless interaction with blockchain networks through AI-powered interfaces. It provides a comprehensive set of tools and resources for blockchain development, smart contract interaction, and network management.

**Supported Networks:**

- BNB Smart Chain (BSC)
- opBNB
- Arbitrum
- Ethereum
- Polygon
- Base
- Optimism
- + All testnets

---

## Core Modules

| Module | Description |
|--------|-------------|
| **Blocks** | Query and manage blockchain blocks |
| **Bridge** | Cross-chain transfers |
| **Contracts** | Interact with smart contracts |
| **Deployment** | Deploy and upgrade contracts |
| **Domains** | ENS and name service operations |
| **Events** | Query and decode event logs |
| **Gas** | Gas price monitoring and optimization |
| **Governance** | DAO proposals, voting, and delegation |
| **Lending** | DeFi lending protocols (Aave, Compound) |
| **MEV** | MEV protection and Flashbots |
| **Multicall** | Batch operations |
| **Network** | Network information |
| **NFT** | NFT (ERC721/ERC1155) operations |
| **Portfolio** | Track holdings across chains |
| **Price Feeds** | Token prices and oracles |
| **Security** | Token and contract security analysis |
| **Signatures** | Message signing and verification |
| **Staking** | Staking and liquid staking (Lido) |
| **Swap** | DEX swaps and liquidity provision |
| **Tokens** | Token (ERC20) operations |
| **Transactions** | Transaction management |
| **Wallet** | Wallet operations |

---

## Integration with Cursor

```json
{
  "mcpServers": {
    "universal-crypto-mcp": {
      "command": "npx",
      "args": ["-y", "@nirholas/universal-crypto-mcp@latest"],
      "env": {
        "PRIVATE_KEY": "your_private_key_here (optional)"
      }
    }
  }
}
```

---

## Integration with Claude Desktop

```json
{
  "mcpServers": {
    "universal-crypto-mcp": {
      "command": "npx",
      "args": ["-y", "@nirholas/universal-crypto-mcp@latest"],
      "env": {
        "PRIVATE_KEY": "your_private_key_here (optional)"
      }
    }
  }
}
```

---

## Local Development

```bash
git clone https://github.com/nirholas/universal-crypto-mcp
cd universal-crypto-mcp
bun install
bun dev:sse
```

---

## Available Tools

### Block Tools

| Name | Description |
|------|-------------|
| `get_block_by_hash` | Get a block by hash |
| `get_block_by_number` | Get a block by number |
| `get_latest_block` | Get the latest block |
| `get_block_transactions` | Get transactions in a block |
| `get_block_range` | Get multiple blocks |

### Transaction Tools

| Name | Description |
|------|-------------|
| `get_transaction` | Get transaction by hash |
| `get_transaction_receipt` | Get transaction receipt |
| `estimate_gas` | Estimate gas cost |
| `send_transaction` | Send a transaction |
| `speed_up_transaction` | Replace with higher gas |
| `cancel_transaction` | Cancel pending transaction |
| `decode_transaction` | Decode transaction input |
| `simulate_transaction` | Simulate before sending |

### Token Tools

| Name | Description |
|------|-------------|
| `get_erc20_token_info` | Get ERC20 token information |
| `get_native_balance` | Get native token balance |
| `get_erc20_balance` | Get ERC20 token balance |
| `transfer_native_token` | Transfer native tokens |
| `transfer_erc20` | Transfer ERC20 tokens |
| `batch_transfer_erc20` | Transfer to multiple recipients |
| `approve_token_spending` | Approve token spending |
| `revoke_token_approval` | Revoke token approval |
| `check_token_allowance` | Check approval amount |
| `burn_erc20_tokens` | Burn tokens |
| `get_token_supply_info` | Get supply statistics |

### NFT Tools

| Name | Description |
|------|-------------|
| `get_nft_info` | Get NFT information |
| `get_nft_collection_info` | Get collection metadata |
| `get_nfts_by_owner` | Get NFTs owned by address |
| `check_nft_ownership` | Check NFT ownership |
| `get_nft_balance` | Get NFT balance |
| `transfer_nft` | Transfer NFT |
| `batch_transfer_nfts` | Transfer multiple NFTs |
| `approve_nft_for_marketplace` | Approve for trading |
| `revoke_nft_approval` | Revoke NFT approval |
| `fetch_nft_metadata` | Get metadata from URI |
| `get_erc1155_balance` | Get ERC1155 balance |
| `transfer_erc1155` | Transfer ERC1155 tokens |

### Security Tools

| Name | Description |
|------|-------------|
| `analyze_token_security` | Full security analysis |
| `detect_rug_pull_risk` | Rug pull detection (mint, ownership, liquidity) |
| `detect_honeypot` | Honeypot detection (simulate buy/sell) |
| `check_contract_ownership` | Check ownership status (renounced/multisig/timelock) |
| `get_holder_distribution` | Holder concentration & whale analysis |
| `analyze_contract_permissions` | Dangerous permissions detection |
| `verify_contract_source` | Verify source on block explorer |

### Staking Tools

| Name | Description |
|------|-------------|
| `get_staking_position` | Get staking position |
| `stake_tokens` | Stake tokens |
| `unstake_tokens` | Unstake tokens |
| `claim_staking_rewards` | Claim rewards |
| `stake_eth_lido` | Stake ETH for stETH |
| `wrap_steth` | Wrap stETH to wstETH |
| `unwrap_wsteth` | Unwrap wstETH |
| `get_lido_stats` | Lido statistics |
| `stake_lp_tokens` | Farm LP tokens |
| `withdraw_lp_tokens` | Withdraw from farm |
| `get_farming_position` | Get farm position |

### Governance Tools

| Name | Description |
|------|-------------|
| `get_proposal_details` | Get proposal info |
| `cast_vote` | Vote on proposal |
| `get_voting_power` | Get voting power |
| `delegate_votes` | Delegate votes |
| `get_delegation_info` | Get delegation status |
| `queue_proposal` | Queue for execution |
| `execute_proposal` | Execute proposal |
| `cancel_proposal` | Cancel proposal |

### Contract Tools

| Name | Description |
|------|-------------|
| `read_contract` | Read from contract |
| `write_contract` | Write to contract |
| `is_contract` | Check if address is contract |
| `deploy_contract` | Deploy contract from bytecode |
| `deploy_create2` | Deterministic CREATE2 deployment |
| `deploy_proxy` | Deploy upgradeable proxy (Transparent/UUPS) |
| `upgrade_proxy` | Upgrade proxy implementation |
| `verify_contract` | Verify source on block explorer |
| `predict_create2_address` | Predict CREATE2 deployment address |

### Network Tools

| Name | Description |
|------|-------------|
| `get_chain_info` | Get chain information |
| `get_supported_networks` | List supported networks |
| `get_gas_price` | Get current gas price |
| `get_eip1559_fees` | Get EIP-1559 fees |

### ENS/Domain Tools

| Name | Description |
|------|-------------|
| `resolve_ens_name` | Resolve ENS to address |
| `reverse_resolve_address` | Get ENS for address |
| `check_ens_availability` | Check name availability |
| `get_ens_name_details` | Get comprehensive ENS info |
| `register_ens_name` | Register ENS domain (commit-reveal) |
| `set_ens_records` | Set address, text, contenthash records |
| `transfer_ens` | Transfer ENS ownership |
| `renew_ens` | Renew registration |
| `create_subdomain` | Create subdomain |

### MEV Protection Tools

| Name | Description |
|------|-------------|
| `send_private_transaction` | Send via Flashbots Protect (bypass mempool) |
| `simulate_bundle` | Simulate transaction bundle |
| `check_mev_exposure` | Analyze MEV risk for swaps |
| `get_mev_protection_info` | Get MEV protection options |

### Utility Tools

| Name | Description |
|------|-------------|
| `keccak256_hash` | Compute hash |
| `sign_message` | Sign message |
| `verify_signature` | Verify signature |
| `encode_packed` | ABI encode packed |
| `abi_encode` | ABI encode |
| `abi_decode` | ABI decode |
| `get_storage_at` | Read storage slot |

---

## Related Resources

- [EVM Module](evm-module.md) - General EVM operations
- [Extended Tools](tools-extended.md) - Advanced DeFi tools

---

## Credits

Built by **[nich](https://x.com/nichxbt)** ([:material-github: nirholas](https://github.com/nirholas))
