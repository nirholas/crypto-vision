# EVM Module

General Ethereum Virtual Machine tools for blockchain interaction.

---

## Overview

The EVM module provides universal tools for interacting with EVM-compatible blockchains. These tools work across multiple networks including Arbitrum, Ethereum, BSC, Polygon, and more.

---

## Blocks

Query block data from the blockchain.

### get_block

Get block information by number or hash.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| blockNumber | number | No | Block number |
| blockHash | string | No | Block hash |
| network | string | No | Network (default: arbitrum) |

**Returns:**
```json
{
  "number": 12345678,
  "hash": "0x...",
  "timestamp": 1234567890,
  "gasUsed": "15000000",
  "gasLimit": "30000000",
  "transactions": 150,
  "miner": "0x..."
}
```

---

### get_latest_block

Get the latest block.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| network | string | No | Network name |

---

### get_block_transactions

Get all transactions in a block.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| blockNumber | number | Yes | Block number |
| network | string | No | Network name |

---

## Contracts

Read smart contract state.

### read_contract

Call a read-only contract function.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| address | string | Yes | Contract address |
| abi | array | Yes | Contract ABI |
| functionName | string | Yes | Function to call |
| args | array | No | Function arguments |
| network | string | No | Network name |

**Returns:**
```json
{
  "result": "1000000000000000000"
}
```

---

### get_contract_code

Get contract bytecode.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| address | string | Yes | Contract address |
| network | string | No | Network name |

---

### verify_contract

Check if an address is a contract.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| address | string | Yes | Address to check |
| network | string | No | Network name |

---

## Tokens

ERC20 token operations.

### get_erc20_token_info

Get token metadata.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| tokenAddress | string | Yes | Token contract address |
| network | string | No | Network name |

**Returns:**
```json
{
  "name": "USD Coin",
  "symbol": "USDC",
  "decimals": 6,
  "totalSupply": "50000000000000"
}
```

---

### get_erc20_balance

Get token balance for an address.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| tokenAddress | string | Yes | Token contract |
| address | string | Yes | Wallet address |
| network | string | No | Network name |

**Returns:**
```json
{
  "balance": "1000000000",
  "formatted": "1000.00",
  "symbol": "USDC"
}
```

---

### get_native_balance

Get native token balance (ETH, BNB, etc.).

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| address | string | Yes | Wallet address |
| network | string | No | Network name |

---

### create_erc20_token

Deploy a new ERC20 token.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| name | string | Yes | Token name |
| symbol | string | Yes | Token symbol |
| network | string | No | Network name |
| privateKey | string | Yes | Deployer private key |

⚠️ **Requires private key for transaction signing.**

---

## NFT

ERC721/ERC1155 NFT operations.

### get_nft_info

Get NFT collection info.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| contractAddress | string | Yes | NFT contract |
| network | string | No | Network name |

**Returns:**
```json
{
  "name": "Bored Ape Yacht Club",
  "symbol": "BAYC",
  "totalSupply": 10000,
  "type": "ERC721"
}
```

---

### get_nft_owner

Get owner of a specific NFT.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| contractAddress | string | Yes | NFT contract |
| tokenId | string | Yes | Token ID |
| network | string | No | Network name |

---

### get_nft_metadata

Get NFT metadata (name, image, attributes).

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| contractAddress | string | Yes | NFT contract |
| tokenId | string | Yes | Token ID |
| network | string | No | Network name |

---

### get_nfts_by_owner

Get all NFTs owned by an address.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| ownerAddress | string | Yes | Owner wallet |
| contractAddress | string | No | Filter by collection |
| network | string | No | Network name |

---

## Wallet

Wallet and balance operations.

### get_wallet_balance

Get all balances for a wallet.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| address | string | Yes | Wallet address |
| network | string | No | Network name |

---

### get_wallet_transactions

Get recent transactions for a wallet.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| address | string | Yes | Wallet address |
| limit | number | No | Max transactions |
| network | string | No | Network name |

---

## Transactions

Transaction operations.

### get_transaction

Get transaction details by hash.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| txHash | string | Yes | Transaction hash |
| network | string | No | Network name |

**Returns:**
```json
{
  "hash": "0x...",
  "from": "0x...",
  "to": "0x...",
  "value": "1000000000000000000",
  "gasUsed": "21000",
  "status": "success",
  "blockNumber": 12345678
}
```

---

### get_transaction_receipt

Get transaction receipt with logs.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| txHash | string | Yes | Transaction hash |
| network | string | No | Network name |

---

### estimate_gas

Estimate gas for a transaction.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| to | string | Yes | Recipient address |
| data | string | No | Transaction data |
| value | string | No | ETH value |
| network | string | No | Network name |

---

## Network

Network information.

### get_network_info

Get current network details.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| network | string | No | Network name |

**Returns:**
```json
{
  "name": "Arbitrum One",
  "chainId": 42161,
  "blockNumber": 12345678,
  "gasPrice": "0.1"
}
```

---

### get_gas_price

Get current gas price.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| network | string | No | Network name |

---

## Supported Networks

| Network | Chain ID | Native Token |
|---------|----------|--------------|
| ethereum | 1 | ETH |
| bsc | 56 | BNB |
| polygon | 137 | MATIC |
| arbitrum | 42161 | ETH |
| optimism | 10 | ETH |
| base | 8453 | ETH |
| avalanche | 43114 | AVAX |
| opbnb | 204 | BNB |
| iotex | 4689 | IOTX |

### Testnets

| Network | Chain ID | Native Token |
|---------|----------|--------------|
| sepolia | 11155111 | ETH |
| bsc_testnet | 97 | tBNB |
| polygon_mumbai | 80001 | MATIC |
| opbnb_testnet | 5611 | tBNB |

---

## Additional Module Reference

### Security Module

| Tool | Description |
|------|-------------|
| `analyze_token_security` | Comprehensive token analysis |
| `detect_rug_pull_risk` | Rug pull indicators detection |
| `detect_honeypot` | Honeypot token detection |
| `check_contract_ownership` | Ownership verification (renounced/multisig/timelock) |
| `get_holder_distribution` | Holder concentration & whale analysis |
| `analyze_contract_permissions` | Dangerous permissions detection |
| `verify_contract_source` | Verify source on block explorer |

### Staking Module

| Tool | Description |
|------|-------------|
| `stake_eth_lido` | Stake ETH for stETH |
| `wrap_steth` | Wrap stETH to wstETH |
| `unwrap_wsteth` | Unwrap wstETH |
| `get_lido_stats` | Lido statistics |
| `stake_lp_tokens` | LP farming |
| `get_farming_position` | Farm position info |

### Governance Module

| Tool | Description |
|------|-------------|
| `get_proposal_details` | Proposal info |
| `cast_vote` | Vote on proposal |
| `delegate_votes` | Delegate voting power |
| `queue_proposal` | Queue for execution |
| `execute_proposal` | Execute proposal |
| `cancel_proposal` | Cancel proposal |

### ENS/Domains Module

| Tool | Description |
|------|-------------|
| `resolve_ens_name` | Resolve ENS to address |
| `reverse_resolve_address` | Get ENS for address |
| `check_ens_availability` | Check name availability |
| `get_ens_name_details` | Get comprehensive ENS info |
| `register_ens_name` | Register new ENS domain |
| `set_ens_records` | Set address, text, contenthash records |
| `transfer_ens` | Transfer ENS ownership |
| `renew_ens` | Extend registration |
| `create_subdomain` | Create ENS subdomain |

### Deployment Module

| Tool | Description |
|------|-------------|
| `deploy_contract` | Deploy from bytecode |
| `deploy_create2` | Deterministic CREATE2 deployment |
| `deploy_proxy` | Deploy upgradeable proxy |
| `upgrade_proxy` | Upgrade proxy implementation |
| `verify_contract` | Verify on block explorer |
| `predict_create2_address` | Predict CREATE2 address |

### MEV Protection Module

| Tool | Description |
|------|-------------|
| `send_private_transaction` | Send via Flashbots Protect |
| `simulate_bundle` | Simulate transaction bundle |
| `check_mev_exposure` | Analyze MEV risk for swaps |
| `get_mev_protection_info` | Get protection options |

---

## Environment Variables

| Variable | Description |
|----------|-------------|
| `PRIVATE_KEY` | Default private key for write operations |
| `RPC_URL_ARBITRUM` | Custom Arbitrum RPC |
| `RPC_URL_ETHEREUM` | Custom Ethereum RPC |
| `RPC_URL_BSC` | Custom BSC RPC |
| `RPC_URL_POLYGON` | Custom Polygon RPC |
