# Binance.US OTC Trading Guide

This guide covers Over-The-Counter (OTC) trading functionality in the Binance.US MCP Server.

## Overview

OTC trading allows institutional clients to execute large block trades at negotiated prices, avoiding the slippage that would occur from placing large orders on the order book.

## Benefits of OTC Trading

| Feature | Order Book | OTC |
|---------|------------|-----|
| Slippage | Yes, on large orders | No, fixed quote |
| Price Impact | Moves market | No market impact |
| Visibility | Public | Private |
| Min Size | No minimum | Large minimums |
| Execution | Partial fills possible | All-or-nothing |

## Available Tools

| Tool | Description |
|------|-------------|
| `binance_us_otc_coin_pairs` | Get available OTC trading pairs |
| `binance_us_otc_quote` | Request a price quote |
| `binance_us_otc_place_order` | Execute a quoted trade |
| `binance_us_otc_get_order` | Get order details |
| `binance_us_otc_all_orders` | List all OTC orders |
| `binance_us_ocbs_orders` | Get OCBS (block settlement) orders |

## Trading Workflow

### Step 1: Check Available Pairs

```
Tool: binance_us_otc_coin_pairs
Parameters: none
```

Response:
```json
{
  "data": [
    {
      "fromCoin": "BTC",
      "toCoin": "USD",
      "fromCoinMinAmount": "0.5",
      "fromCoinMaxAmount": "500",
      "toCoinMinAmount": "25000",
      "toCoinMaxAmount": "25000000"
    },
    {
      "fromCoin": "USD",
      "toCoin": "BTC",
      "fromCoinMinAmount": "25000",
      "fromCoinMaxAmount": "25000000",
      "toCoinMinAmount": "0.5",
      "toCoinMaxAmount": "500"
    },
    {
      "fromCoin": "ETH",
      "toCoin": "USD",
      "fromCoinMinAmount": "5",
      "fromCoinMaxAmount": "5000",
      "toCoinMinAmount": "10000",
      "toCoinMaxAmount": "15000000"
    }
  ]
}
```

### Step 2: Request a Quote

```
Tool: binance_us_otc_quote
Parameters:
{
  "fromCoin": "BTC",
  "toCoin": "USD",
  "requestCoin": "BTC",
  "requestAmount": "10"
}
```

Response:
```json
{
  "quoteId": "quote_abc123xyz",
  "fromCoin": "BTC",
  "toCoin": "USD",
  "fromAmount": "10.00000000",
  "toAmount": "450000.00",
  "ratio": "45000.00000000",
  "inverseRatio": "0.00002222",
  "validTimestamp": 1706000010000
}
```

**Understanding the Quote:**
- `quoteId`: Unique ID to execute this trade (valid for ~10 seconds)
- `fromCoin`: Asset you're selling
- `toCoin`: Asset you're receiving
- `fromAmount`: Amount you'll sell
- `toAmount`: Amount you'll receive
- `ratio`: Price (1 BTC = 45,000 USD)
- `validTimestamp`: Quote expiration (typically 10 seconds)

### Step 3: Execute the Trade

```
Tool: binance_us_otc_place_order
Parameters:
{
  "quoteId": "quote_abc123xyz"
}
```

Response:
```json
{
  "orderId": "otc_order_789",
  "quoteId": "quote_abc123xyz",
  "fromCoin": "BTC",
  "toCoin": "USD",
  "fromAmount": "10.00000000",
  "toAmount": "450000.00",
  "ratio": "45000.00000000",
  "status": "FILLED",
  "createTime": 1706000005000,
  "fillTime": 1706000005500
}
```

### Step 4: Verify Order

```
Tool: binance_us_otc_get_order
Parameters:
{
  "orderId": "otc_order_789"
}
```

## Quote Flow Diagram

```
┌─────────────┐     Request Quote     ┌─────────────┐
│   Client    │ ──────────────────▶   │  Binance.US │
│             │                       │    OTC      │
│             │   ◀──────────────────  │             │
│             │   Quote (10s valid)   │             │
│             │                       │             │
│             │   Execute Quote       │             │
│             │ ──────────────────▶   │             │
│             │                       │             │
│             │   ◀──────────────────  │             │
│             │   Confirmation        │             │
└─────────────┘                       └─────────────┘
```

## Request Coin Parameter

The `requestCoin` parameter determines which side of the trade you're specifying:

**Selling BTC for USD (request by BTC amount):**
```json
{
  "fromCoin": "BTC",
  "toCoin": "USD", 
  "requestCoin": "BTC",
  "requestAmount": "10"
}
```
Result: "I want to sell exactly 10 BTC, how much USD will I get?"

**Selling BTC for USD (request by USD amount):**
```json
{
  "fromCoin": "BTC",
  "toCoin": "USD",
  "requestCoin": "USD",
  "requestAmount": "500000"
}
```
Result: "I want to receive exactly 500,000 USD, how much BTC will I sell?"

## Order History

### Get All Orders

```
Tool: binance_us_otc_all_orders
Parameters:
{
  "startTime": 1705900000000,
  "endTime": 1706000000000,
  "limit": 50
}
```

Response:
```json
{
  "data": [
    {
      "orderId": "otc_order_789",
      "fromCoin": "BTC",
      "toCoin": "USD",
      "fromAmount": "10.00000000",
      "toAmount": "450000.00",
      "ratio": "45000.00000000",
      "status": "FILLED",
      "createTime": 1706000005000
    },
    {
      "orderId": "otc_order_788",
      "fromCoin": "ETH",
      "toCoin": "USD",
      "fromAmount": "100.00000000",
      "toAmount": "220000.00",
      "ratio": "2200.00000000",
      "status": "FILLED",
      "createTime": 1705950000000
    }
  ]
}
```

### Get Specific Order

```
Tool: binance_us_otc_get_order
Parameters:
{
  "orderId": "otc_order_789"
}
```

## OCBS Orders (Block Settlement)

OCBS (OTC Block Settlement) is for large pre-negotiated trades:

```
Tool: binance_us_ocbs_orders
Parameters:
{
  "startTime": 1705900000000,
  "endTime": 1706000000000,
  "limit": 20
}
```

Response:
```json
{
  "data": [
    {
      "orderId": "ocbs_001",
      "quoteId": "block_quote_xyz",
      "fromCoin": "BTC",
      "toCoin": "USD",
      "fromAmount": "100.00000000",
      "toAmount": "4500000.00",
      "ratio": "45000.00000000",
      "status": "FILLED",
      "createTime": 1706000000000
    }
  ]
}
```

## Order Statuses

| Status | Description |
|--------|-------------|
| `PENDING` | Order submitted, awaiting execution |
| `FILLED` | Order fully executed |
| `EXPIRED` | Quote expired before execution |
| `FAILED` | Execution failed (insufficient balance, etc.) |
| `REJECTED` | Order rejected by system |

## Best Practices

### 1. Pre-check Balances
Ensure you have sufficient balance before requesting a quote:
```
Tool: binance_us_custodian_balance
   or
Tool: binance_us_account
```

### 2. Act Quickly on Quotes
Quotes are typically valid for only 10 seconds. Have your execution logic ready.

### 3. Handle Quote Expiration
```python
# Pseudocode
quote = get_quote()
if current_time < quote.validTimestamp:
    execute_order(quote.quoteId)
else:
    # Request new quote
    quote = get_quote()
```

### 4. Verify Execution
Always confirm the order was filled:
```
Tool: binance_us_otc_get_order
```

### 5. Log Everything
OTC trades are large - maintain detailed logs for reconciliation:
- Quote ID and timestamp
- Order ID and status
- Expected vs actual amounts
- Any errors or retry attempts

## Error Handling

### Common Errors

| Error Code | Message | Solution |
|------------|---------|----------|
| -5001 | Quote expired | Request a new quote |
| -5002 | Insufficient balance | Check and fund your account |
| -5003 | Invalid quote ID | Ensure quote ID is correct and not expired |
| -5004 | Amount out of range | Check min/max amounts for the pair |
| -5005 | Pair not available | Verify pair is in available list |

### Retry Strategy

```
1. Request quote
2. If quote expired on execution:
   - Wait 1 second
   - Request new quote
   - Retry execution
3. If still failing after 3 attempts:
   - Log error
   - Alert operations team
```

## Size Limits

OTC is designed for large trades. Typical minimums:

| Pair | Minimum |
|------|---------|
| BTC/USD | 0.5 BTC or $25,000 |
| ETH/USD | 5 ETH or $10,000 |
| Other | Varies by liquidity |

For smaller trades, use the regular order book via trading tools.

## OTC vs Regular Trading

Use OTC when:
- Trade size > 1% of average daily volume
- You need price certainty
- You want to avoid market impact
- Trade is time-sensitive

Use regular trading when:
- Smaller position sizes
- You want to capture favorable price movements
- You're comfortable with partial fills
