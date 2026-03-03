# Wallet Tools

Tools for wallet management, balance queries, and account operations across EVM networks.

---

## Overview

Wallet tools provide functionality for creating and managing wallets, checking balances, and performing account-related operations.

| Tool | Description |
|------|-------------|
| `wallet_create_wallet` | Create a new wallet with mnemonic |
| `wallet_import_from_mnemonic` | Import wallet from mnemonic phrase |
| `wallet_import_from_private_key` | Import wallet from private key |
| `wallet_get_address` | Get wallet address |
| `wallet_get_balance` | Get native token balance |
| `wallet_get_token_balances` | Get all ERC-20 token balances |
| `wallet_sign_message` | Sign a message with wallet |
| `wallet_verify_signature` | Verify a signed message |

---

## wallet_create_wallet

Create a new wallet with a randomly generated mnemonic phrase.

### Parameters

None required.

### Response

```json
{
  "address": "0x742d35Cc6634C0532925a3b844Bc9e7595f8fEb3",
  "mnemonic": "abandon ability able about above absent absorb abstract absurd abuse access accident",
  "privateKey": "0x..."
}
```

### Example

```
Create a new wallet for me
```

### Security Warning

⚠️ **CRITICAL**: Store the mnemonic phrase securely. Anyone with the mnemonic has full control of the wallet.

---

## wallet_import_from_mnemonic

Import a wallet from an existing mnemonic phrase.

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `mnemonic` | string | Yes | 12 or 24-word mnemonic phrase |
| `index` | number | No | Derivation path index (default: 0) |

### Response

```json
{
  "address": "0x742d35Cc6634C0532925a3b844Bc9e7595f8fEb3",
  "path": "m/44'/60'/0'/0/0"
}
```

### Example

```
Import wallet from mnemonic: abandon ability able about above absent absorb abstract absurd abuse access accident
```

---

## wallet_import_from_private_key

Import a wallet from a private key.

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `privateKey` | string | Yes | Private key (with or without 0x prefix) |

### Response

```json
{
  "address": "0x742d35Cc6634C0532925a3b844Bc9e7595f8fEb3"
}
```

### Example

```
Import wallet from private key 0xabc123...
```

---

## wallet_get_address

Get the address of the configured wallet.

### Parameters

None required.

### Response

```json
{
  "address": "0x742d35Cc6634C0532925a3b844Bc9e7595f8fEb3"
}
```

### Example

```
What's my wallet address?
```

---

## wallet_get_balance

Get the native token balance (ETH, BNB, MATIC, etc.) for an address.

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `address` | string | Yes | Wallet address to check |
| `network` | string | No | Network name (default: ethereum) |

### Response

```json
{
  "address": "0x742d35Cc6634C0532925a3b844Bc9e7595f8fEb3",
  "balance": "1.5",
  "balanceWei": "1500000000000000000",
  "symbol": "ETH",
  "network": "ethereum"
}
```

### Example

```
Check the ETH balance for 0x742d35Cc6634C0532925a3b844Bc9e7595f8fEb3
```

```
What's my BNB balance on BSC?
```

---

## wallet_get_token_balances

Get all ERC-20 token balances for an address.

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `address` | string | Yes | Wallet address to check |
| `network` | string | No | Network name (default: ethereum) |

### Response

```json
{
  "address": "0x742d35Cc6634C0532925a3b844Bc9e7595f8fEb3",
  "network": "ethereum",
  "tokens": [
    {
      "address": "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
      "symbol": "USDC",
      "name": "USD Coin",
      "balance": "5000.00",
      "decimals": 6,
      "valueUsd": 5000.00
    },
    {
      "address": "0xdAC17F958D2ee523a2206206994597C13D831ec7",
      "symbol": "USDT",
      "name": "Tether USD",
      "balance": "2500.00",
      "decimals": 6,
      "valueUsd": 2500.00
    }
  ],
  "totalValueUsd": 7500.00
}
```

### Example

```
Show all my tokens on Arbitrum
```

```
What tokens does 0x742d35... hold on BSC?
```

---

## wallet_sign_message

Sign a message with the configured wallet's private key.

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `message` | string | Yes | Message to sign |

### Response

```json
{
  "message": "Hello, World!",
  "signature": "0x1234...abcd",
  "address": "0x742d35Cc6634C0532925a3b844Bc9e7595f8fEb3"
}
```

### Example

```
Sign this message: "I authorize this transaction at timestamp 1234567890"
```

---

## wallet_verify_signature

Verify that a message was signed by a specific address.

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `message` | string | Yes | Original message |
| `signature` | string | Yes | Signature to verify |
| `address` | string | Yes | Expected signer address |

### Response

```json
{
  "valid": true,
  "recoveredAddress": "0x742d35Cc6634C0532925a3b844Bc9e7595f8fEb3",
  "expectedAddress": "0x742d35Cc6634C0532925a3b844Bc9e7595f8fEb3"
}
```

### Example

```
Verify this signature 0x1234...abcd for message "Hello" from address 0x742d35...
```

---

## Multi-Chain Balance Check

Check balances across multiple networks efficiently:

```
Check my balances on Ethereum, Arbitrum, and Polygon
```

The response will aggregate results from all networks:

```json
{
  "address": "0x742d35Cc6634C0532925a3b844Bc9e7595f8fEb3",
  "balances": {
    "ethereum": {
      "native": "1.5 ETH",
      "valueUsd": 3750.00
    },
    "arbitrum": {
      "native": "0.8 ETH",
      "valueUsd": 2000.00
    },
    "polygon": {
      "native": "500 MATIC",
      "valueUsd": 450.00
    }
  },
  "totalValueUsd": 6200.00
}
```

---

## Supported Networks

| Network | Native Token | Chain ID |
|---------|--------------|----------|
| ethereum | ETH | 1 |
| bsc | BNB | 56 |
| polygon | MATIC | 137 |
| arbitrum | ETH | 42161 |
| optimism | ETH | 10 |
| base | ETH | 8453 |
| opbnb | BNB | 204 |

---

## Related Tools

- [Token Tools](tokens-tools.md) - ERC-20 token operations
- [Transaction Tools](transactions-tools.md) - Send transactions
- [Portfolio Tools](portfolio-tools.md) - Portfolio tracking
- [Security Tools](security-tools.md) - Address security checks
