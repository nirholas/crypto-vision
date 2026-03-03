# Extended Tools

Advanced tools for DeFi, security, cross-chain operations, and enterprise features.

---

## Swap/DEX Tools

| Tool | Description |
|------|-------------|
| `get_swap_quote` | Get swap quote from DEX aggregators |
| `execute_swap` | Execute a token swap |
| `get_best_route` | Find optimal swap route |
| `get_dex_liquidity` | Get liquidity for a pair |
| `add_liquidity` | Add liquidity to a pool |
| `add_liquidity_native` | Add liquidity with native token |
| `remove_liquidity` | Remove liquidity from pool |
| `get_lp_balance` | Get LP token balance |
| `get_pool_reserves` | Get pool reserves |
| `calculate_arbitrage` | Find arbitrage opportunities |

---

## Bridge Tools

| Tool | Description |
|------|-------------|
| `get_bridge_quote` | Get cross-chain bridge quote |
| `execute_bridge` | Execute cross-chain transfer |
| `get_bridge_status` | Track bridge transaction |
| `get_supported_bridges` | List supported bridges |
| `estimate_bridge_time` | Get estimated transfer time |
| `get_bridge_fees` | Get detailed fee breakdown |

---

## Gas Tools

| Tool | Description |
|------|-------------|
| `get_gas_price` | Current gas price for a chain |
| `get_gas_prices_all_chains` | Gas prices across all chains |
| `get_eip1559_fees` | Base fee + priority fee suggestions |
| `estimate_transaction_cost` | Estimate total tx cost in USD |
| `get_gas_history` | Historical gas prices |

---

## Security Tools

| Tool | Description |
|------|-------------|
| `analyze_token_security` | Comprehensive token security analysis |
| `detect_rug_pull_risk` | Analyze contract for rug pull indicators (mint functions, ownership, liquidity locks) |
| `detect_honeypot` | Check if token is a honeypot (simulates buy/sell to detect trading restrictions) |
| `check_contract_ownership` | Verify ownership status (renounced, multisig, EOA, timelocked) |
| `get_holder_distribution` | Token holder concentration analysis with whale detection |
| `analyze_contract_permissions` | Detect dangerous admin functions (blacklist, pause, mint, fee changes) |
| `verify_contract_source` | Verify source code on block explorer (Etherscan, etc.) |
| `get_token_allowances` | List all token approvals |
| `revoke_approval` | Revoke token spending approval |
| `simulate_transaction` | Simulate tx before execution |

### Security Tool Details

#### detect_rug_pull_risk

Analyzes a token contract for common rug pull indicators.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| tokenAddress | string | Yes | Token contract address |
| network | string | No | Network (default: ethereum) |

**Risk Indicators Checked:**
- Hidden mint functions
- Ownership not renounced
- Liquidity not locked
- High holder concentration
- Honeypot characteristics
- Blacklist/whitelist functions

---

#### detect_honeypot

Simulates buy and sell transactions to detect honeypot tokens.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| tokenAddress | string | Yes | Token contract address |
| network | string | No | Network (default: ethereum) |

**Returns:**
- `isHoneypot`: Whether the token appears to be a honeypot
- `buyTax`: Estimated buy tax percentage
- `sellTax`: Estimated sell tax percentage
- `canSell`: Whether selling is possible
- `maxTxAmount`: Maximum transaction amount if limited

---

#### check_contract_ownership

Verifies the ownership status of a contract.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| contractAddress | string | Yes | Contract address |
| network | string | No | Network (default: ethereum) |

**Returns:**
- `owner`: Current owner address
- `isRenounced`: Whether ownership is renounced
- `isMultisig`: Whether owner is a multisig
- `isTimelock`: Whether owner is behind a timelock

---

## Staking Tools

| Tool | Description |
|------|-------------|
| `get_staking_position` | Get staking position and rewards |
| `stake_tokens` | Stake tokens |
| `unstake_tokens` | Unstake/withdraw tokens |
| `claim_staking_rewards` | Claim pending rewards |
| `get_staking_apr` | Calculate staking APR |
| `get_staking_protocols` | List available protocols |

### Liquid Staking (Lido)

| Tool | Description |
|------|-------------|
| `stake_eth_lido` | Stake ETH to receive stETH |
| `wrap_steth` | Wrap stETH to wstETH |
| `unwrap_wsteth` | Unwrap wstETH to stETH |
| `get_lido_stats` | Get Lido staking statistics |
| `get_liquid_staking_info` | Get liquid staking token info |

### LP Farming

| Tool | Description |
|------|-------------|
| `stake_lp_tokens` | Stake LP tokens in farms |
| `withdraw_lp_tokens` | Withdraw LP from farms |
| `get_farming_position` | Get farming position and rewards |

---

## Lending Tools

| Tool | Description |
|------|-------------|
| `get_lending_position` | Get user's lending position |
| `get_lending_markets` | Get Aave/Compound market data |
| `supply_to_lending` | Supply assets to protocol |
| `withdraw_from_lending` | Withdraw supplied assets |
| `borrow_from_lending` | Borrow from protocol |
| `repay_to_lending` | Repay borrowed assets |
| `get_health_factor` | Get position health factor |
| `get_flash_loan_info` | Get flash loan parameters |
| `get_liquidatable_positions` | Find liquidatable positions |

---

## Price/Oracle Tools

| Tool | Description |
|------|-------------|
| `get_token_price` | Get current token price (USD) |
| `get_token_price_history` | Historical price data |
| `get_price_from_oracle` | Get price from Chainlink |
| `get_twap` | Get time-weighted average price |

---

## Governance Tools

| Tool | Description |
|------|-------------|
| `get_proposal_details` | Get governance proposal info |
| `cast_vote` | Cast vote on proposal |
| `get_voting_power` | Get address voting power |
| `get_governance_params` | Get governance parameters |
| `check_vote_eligibility` | Check if can vote |
| `queue_proposal` | Queue proposal for execution |
| `execute_proposal` | Execute queued proposal |
| `cancel_proposal` | Cancel a proposal |
| `delegate_votes` | Delegate voting power |
| `get_delegation_info` | Get delegation status |
| `get_proposal_proposer` | Get proposal creator |

---

## ENS/Domain Tools

| Tool | Description |
|------|-------------|
| `resolve_ens_name` | Resolve ENS to address |
| `reverse_resolve_address` | Get ENS for address |
| `get_ens_text_records` | Get ENS text records |
| `get_ens_avatar` | Get ENS avatar URL |
| `check_ens_availability` | Check name availability |
| `get_ens_name_details` | Get comprehensive ENS info |
| `register_ens_name` | Register new ENS domain (commit-reveal process) |
| `set_ens_records` | Set address, text records, and contenthash |
| `transfer_ens` | Transfer ENS ownership |
| `renew_ens` | Renew ENS registration |
| `create_subdomain` | Create ENS subdomain |

### ENS Tool Details

#### register_ens_name

Register a new ENS name using the commit-reveal process.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| name | string | Yes | ENS name to register (without .eth suffix) |
| duration | number | Yes | Registration duration in seconds (1 year = 31536000) |
| ownerAddress | string | No | Address to set as owner (defaults to sender) |
| setReverseRecord | boolean | No | Set as primary name for owner (default: true) |
| privateKey | string | Yes | Private key for registration |

**Process:**
1. Checks name availability
2. Generates commitment with random secret
3. Submits commitment transaction
4. Waits for minimum commitment age (~60 seconds)
5. Registers the name

---

#### set_ens_records

Set multiple records for an ENS name.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| name | string | Yes | ENS name |
| records.address | string | No | ETH address to resolve to |
| records.textRecords | object | No | Text records (e.g., `{"com.twitter": "@username"}`) |
| records.contenthash | string | No | Content hash (IPFS, Swarm, etc.) |
| privateKey | string | Yes | Private key of name owner |

---

#### create_subdomain

Create a subdomain under an ENS name you own.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| parentName | string | Yes | Parent ENS name (e.g., 'example.eth') |
| subdomain | string | Yes | Subdomain label (e.g., 'blog' for 'blog.example.eth') |
| ownerAddress | string | No | Owner of subdomain (defaults to sender) |
| resolverAddress | string | No | Resolver address for subdomain |
| privateKey | string | Yes | Private key of parent name owner |

---

## MEV Protection Tools

| Tool | Description |
|------|-------------|
| `send_private_transaction` | Send via Flashbots Protect (bypasses public mempool) |
| `simulate_bundle` | Simulate transaction bundle before submission |
| `check_mev_exposure` | Analyze MEV risk for swap transactions |
| `get_mev_protection_info` | Get available MEV protection methods per network |

### MEV Tool Details

#### send_private_transaction

Send a transaction through Flashbots Protect to avoid MEV attacks.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| to | string | Yes | Recipient address |
| data | string | No | Transaction calldata |
| value | string | No | ETH value to send |
| maxFeePerGas | string | No | Max fee per gas (wei) |
| maxPriorityFeePerGas | string | No | Max priority fee (wei) |
| maxBlockNumber | number | No | Max block for inclusion (default: +25) |
| privateKey | string | Yes | Sender private key |

**Benefits:**
- Transaction not visible in public mempool
- Protection from frontrunning and sandwich attacks
- Failed transactions don't cost gas

---

#### check_mev_exposure

Analyze a potential swap for MEV exposure risk.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| tokenIn | string | Yes | Input token address |
| tokenOut | string | Yes | Output token address |
| amountIn | string | Yes | Amount of input token |
| network | string | No | Network (default: ethereum) |

**Returns:**
- `riskLevel`: low/medium/high/critical
- `estimatedSlippage`: Expected slippage
- `sandwichRisk`: Likelihood of sandwich attack
- `recommendations`: Protection suggestions

---

#### get_mev_protection_info

Get MEV protection options for a network.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| network | string | No | Network (default: ethereum) |

**Returns:**
- Available private transaction relays
- Supported protection methods
- RPC endpoints for private submission

---

## Contract Deployment Tools

| Tool | Description |
|------|-------------|
| `deploy_contract` | Deploy contract from bytecode |
| `deploy_create2` | Deterministic deployment with CREATE2 |
| `deploy_proxy` | Deploy upgradeable proxy (Transparent or UUPS) |
| `upgrade_proxy` | Upgrade proxy implementation |
| `verify_contract` | Submit source for verification on explorer |
| `predict_create2_address` | Predict CREATE2 deployment address |

### Deployment Tool Details

#### deploy_contract

Deploy a smart contract from compiled bytecode.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| bytecode | string | Yes | Contract bytecode (hex) |
| abi | array | No | Contract ABI for constructor encoding |
| constructorArgs | array | No | Constructor arguments |
| network | string | No | Network (default: ethereum) |
| privateKey | string | Yes | Deployer private key |

**Returns:**
- `contractAddress`: Deployed contract address
- `transactionHash`: Deployment transaction hash
- `gasUsed`: Gas consumed
- `blockNumber`: Deployment block

---

#### deploy_create2

Deploy with deterministic address using CREATE2.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| bytecode | string | Yes | Contract bytecode |
| salt | string | Yes | 32-byte salt for address derivation |
| abi | array | No | Contract ABI |
| constructorArgs | array | No | Constructor arguments |
| network | string | No | Network (default: ethereum) |
| privateKey | string | Yes | Deployer private key |

**Benefits:**
- Same address across all EVM chains
- Predictable deployment addresses
- Can deploy to same address after selfdestruct

---

#### deploy_proxy

Deploy an upgradeable proxy contract.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| implementationAddress | string | Yes | Implementation contract address |
| proxyType | string | Yes | "transparent" or "uups" |
| adminAddress | string | No | Admin address (transparent proxy) |
| initData | string | No | Initialization calldata |
| abi | array | No | Implementation ABI |
| initFunction | string | No | Initializer function name |
| initArgs | array | No | Initializer arguments |
| network | string | No | Network (default: ethereum) |
| privateKey | string | Yes | Deployer private key |

---

#### upgrade_proxy

Upgrade an existing proxy to new implementation.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| proxyAddress | string | Yes | Proxy contract address |
| newImplementationAddress | string | Yes | New implementation address |
| proxyType | string | Yes | "transparent" or "uups" |
| proxyAdminAddress | string | No | ProxyAdmin address (transparent) |
| callAfterUpgrade | boolean | No | Call function after upgrade |
| upgradeCalldata | string | No | Calldata for post-upgrade call |
| network | string | No | Network (default: ethereum) |
| privateKey | string | Yes | Admin/owner private key |

---

#### predict_create2_address

Calculate the address where a CREATE2 deployment will land.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| deployerAddress | string | Yes | Factory/deployer address |
| bytecode | string | Yes | Contract bytecode |
| salt | string | Yes | 32-byte salt |
| abi | array | No | Contract ABI |
| constructorArgs | array | No | Constructor arguments |

**Returns:**
- `predictedAddress`: The address where contract will deploy

---

## Utility Tools

| Tool | Description |
|------|-------------|
| `keccak256_hash` | Compute keccak256 hash |
| `get_storage_at` | Read contract storage slot |
| `get_contract_bytecode` | Get deployed bytecode |
| `generate_mnemonic` | Generate BIP-39 mnemonic |
| `derive_address_from_mnemonic` | Derive address from mnemonic |
| `validate_address` | Validate and checksum address |
| `encode_packed` | ABI encode packed |
| `abi_encode` | Standard ABI encode |
| `abi_decode` | ABI decode data |
| `sign_message` | Sign message (EIP-191) |
| `verify_signature` | Verify signature |
| `compute_contract_address` | Predict CREATE address |
| `compute_create2_address` | Predict CREATE2 address |
| `hash_typed_data` | Hash EIP-712 typed data |
| `parse_units` | Convert to smallest unit |
| `format_units` | Convert to human-readable |
| `get_chain_id` | Get network chain ID |

---

## Multicall Tools

| Tool | Description |
|------|-------------|
| `multicall_read` | Batch read operations |
| `get_multi_token_balances` | Get multiple token balances |
| `get_multi_token_info` | Get info for multiple tokens |
| `get_multi_native_balances` | Get native balances for addresses |
| `batch_check_allowances` | Check multiple allowances |
| `encode_call_data` | Encode function call data |

---

## News Tools

| Tool | Description |
|------|-------------|
| `get_crypto_news` | Get latest crypto news |
| `search_crypto_news` | Search news by keyword |
| `get_defi_news` | Get DeFi-specific news |
| `get_bitcoin_news` | Get Bitcoin news |
| `get_breaking_news` | Get breaking crypto news |

---

## Credits

Built by **[nich](https://x.com/nichxbt)** ([github.com/nirholas](https://github.com/nirholas))
