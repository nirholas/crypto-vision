# Token Tools

Tools for ERC-20 token operations including transfers, approvals, and token information.

---

## Overview

Token tools enable interaction with ERC-20 tokens across supported EVM networks.

| Tool | Description |
|------|-------------|
| `tokens_get_token_info` | Get token metadata (name, symbol, decimals) |
| `tokens_get_token_balance` | Get token balance for an address |
| `tokens_get_token_allowance` | Check spending allowance |
| `tokens_approve` | Approve token spending |
| `tokens_transfer` | Transfer tokens to address |
| `tokens_get_top_holders` | Get top token holders |
| `tokens_get_token_price` | Get token price in USD |

---

## tokens_get_token_info

Get metadata for an ERC-20 token.

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `tokenAddress` | string | Yes | Token contract address |
| `network` | string | No | Network name (default: ethereum) |

### Response

```json
{
  "address": "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
  "name": "USD Coin",
  "symbol": "USDC",
  "decimals": 6,
  "totalSupply": "26000000000000000",
  "network": "ethereum"
}
```

### Example

```
Get info for USDC token on Ethereum
```

---

## tokens_get_token_balance

Get token balance for a specific address.

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `tokenAddress` | string | Yes | Token contract address |
| `walletAddress` | string | Yes | Wallet address to check |
| `network` | string | No | Network name (default: ethereum) |

### Response

```json
{
  "token": {
    "address": "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    "symbol": "USDC",
    "decimals": 6
  },
  "wallet": "0x742d35Cc6634C0532925a3b844Bc9e7595f8fEb3",
  "balance": "5000.00",
  "balanceRaw": "5000000000",
  "network": "ethereum"
}
```

### Example

```
Check USDC balance for 0x742d35... on Arbitrum
```

---

## tokens_get_token_allowance

Check how much of a token a spender is allowed to use.

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `tokenAddress` | string | Yes | Token contract address |
| `ownerAddress` | string | Yes | Token owner address |
| `spenderAddress` | string | Yes | Spender address (e.g., DEX router) |
| `network` | string | No | Network name (default: ethereum) |

### Response

```json
{
  "token": "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
  "owner": "0x742d35Cc6634C0532925a3b844Bc9e7595f8fEb3",
  "spender": "0x1111111254EEB25477B68fb85Ed929f73A960582",
  "allowance": "115792089237316195423570985008687907853269984665640564039457584007913129639935",
  "allowanceFormatted": "unlimited",
  "network": "ethereum"
}
```

### Example

```
Check my USDC allowance for 1inch router
```

---

## tokens_approve

Approve a spender to use tokens on your behalf.

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `tokenAddress` | string | Yes | Token contract address |
| `spenderAddress` | string | Yes | Address to approve |
| `amount` | string | Yes | Amount to approve (or "unlimited") |
| `network` | string | No | Network name (default: ethereum) |

### Response

```json
{
  "success": true,
  "transactionHash": "0xabc123...",
  "token": "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
  "spender": "0x1111111254EEB25477B68fb85Ed929f73A960582",
  "amount": "1000000000",
  "network": "ethereum"
}
```

### Example

```
Approve 1000 USDC for the 1inch router on Arbitrum
```

### Security Note

⚠️ Requires wallet configuration with private key. Use `"unlimited"` only for trusted protocols.

---

## tokens_transfer

Transfer tokens to another address.

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `tokenAddress` | string | Yes | Token contract address |
| `toAddress` | string | Yes | Recipient address |
| `amount` | string | Yes | Amount to transfer |
| `network` | string | No | Network name (default: ethereum) |

### Response

```json
{
  "success": true,
  "transactionHash": "0xdef456...",
  "from": "0x742d35Cc6634C0532925a3b844Bc9e7595f8fEb3",
  "to": "0x1234567890123456789012345678901234567890",
  "token": "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
  "amount": "100.00",
  "network": "ethereum"
}
```

### Example

```
Send 100 USDC to 0x1234... on Polygon
```

### Security Note

⚠️ Requires wallet configuration with private key. Double-check recipient address before confirming.

---

## tokens_get_top_holders

Get the largest holders of a token.

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `tokenAddress` | string | Yes | Token contract address |
| `network` | string | No | Network name (default: ethereum) |
| `limit` | number | No | Number of holders to return (default: 10) |

### Response

```json
{
  "token": {
    "address": "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    "symbol": "USDC"
  },
  "holders": [
    {
      "rank": 1,
      "address": "0x47ac0Fb4F2D84898e4D9E7b4DaB3C24507a6D503",
      "balance": "3500000000.00",
      "percentage": 13.46
    },
    {
      "rank": 2,
      "address": "0x0A59649758aa4d66E25f08Dd01271e891fe52199",
      "balance": "2100000000.00",
      "percentage": 8.08
    }
  ],
  "totalHolders": 1543289,
  "network": "ethereum"
}
```

### Example

```
Show top 10 USDC holders on Ethereum
```

---

## tokens_get_token_price

Get the current USD price of a token.

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `tokenAddress` | string | Yes | Token contract address |
| `network` | string | No | Network name (default: ethereum) |

### Response

```json
{
  "token": {
    "address": "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599",
    "symbol": "WBTC",
    "name": "Wrapped BTC"
  },
  "price": 43500.50,
  "priceChange24h": 2.35,
  "volume24h": 125000000,
  "marketCap": 6525075000,
  "network": "ethereum"
}
```

### Example

```
What's the price of WBTC?
```

---

## Common Token Addresses

### Ethereum Mainnet

| Token | Address |
|-------|---------|
| USDC | `0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48` |
| USDT | `0xdAC17F958D2ee523a2206206994597C13D831ec7` |
| WETH | `0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2` |
| WBTC | `0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599` |
| DAI | `0x6B175474E89094C44Da98b954EeszdKAD3eF4cDD` |

### BNB Smart Chain

| Token | Address |
|-------|---------|
| USDC | `0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d` |
| USDT | `0x55d398326f99059fF775485246999027B3197955` |
| WBNB | `0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c` |
| BUSD | `0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56` |

### Arbitrum

| Token | Address |
|-------|---------|
| USDC | `0xaf88d065e77c8cC2239327C5EDb3A432268e5831` |
| USDT | `0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9` |
| WETH | `0x82aF49447D8a07e3bd95BD0d56f35241523fBab1` |
| ARB | `0x912CE59144191C1204E64559FE8253a0e49E6548` |

---

## Batch Operations

### Check Multiple Token Balances

```
Show my balances for USDC, USDT, and DAI on Ethereum
```

### Compare Token Prices

```
Compare prices of USDC, USDT, and DAI
```

---

## Error Handling

| Error Code | Description |
|------------|-------------|
| `INVALID_ADDRESS` | Token or wallet address is invalid |
| `TOKEN_NOT_FOUND` | Token contract doesn't exist at address |
| `INSUFFICIENT_BALANCE` | Not enough tokens for transfer |
| `INSUFFICIENT_ALLOWANCE` | Spender not approved for amount |
| `TRANSACTION_FAILED` | Transfer or approval transaction failed |

---

## Related Tools

- [Wallet Tools](wallet-tools.md) - Wallet management
- [Swap Tools](swap-tools.md) - Token swaps
- [Security Tools](security-tools.md) - Token security checks
- [Market Data Tools](market-data-tools.md) - Price data
