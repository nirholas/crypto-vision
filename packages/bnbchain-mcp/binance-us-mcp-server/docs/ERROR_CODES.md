# Binance.US API Error Codes Reference

Complete reference of Binance.US API error codes with solutions and troubleshooting tips.

## Error Response Format

All API errors return a JSON response:

```json
{
  "code": -1121,
  "msg": "Invalid symbol."
}
```

The MCP server enhances error messages with helpful hints based on the error code.

## General Server Errors (-1000 to -1099)

| Code | Message | Solution |
|------|---------|----------|
| -1000 | Unknown error | Retry the request. If persistent, check Binance.US status page. |
| -1001 | Disconnected | Internal error. Retry with exponential backoff. |
| -1002 | Unauthorized | API key doesn't have permission for this endpoint. Check API settings. |
| -1003 | Too many requests | Rate limit exceeded. Wait and retry. |
| -1006 | Unexpected response | Check Binance.US status. May be maintenance. |
| -1007 | Timeout | Request timed out. Retry with smaller payload if applicable. |
| -1010 | Error message received | Check the specific error message for details. |
| -1013 | Invalid quantity | Check the symbol's LOT_SIZE filter. |
| -1014 | Unknown order composition | Check order parameters against symbol filters. |
| -1015 | Too many orders | Reduce order frequency. Max 10/second, 100k/day. |
| -1016 | Service shutting down | Maintenance in progress. Wait and retry. |
| -1020 | Unsupported operation | This operation is not supported on Binance.US. |
| -1021 | Timestamp outside recvWindow | Sync your system clock. Increase recvWindow (max 60000). |
| -1022 | Invalid signature | Check API secret. Ensure proper HMAC-SHA256 signing. |

## Request Parameter Errors (-1100 to -1199)

| Code | Message | Solution |
|------|---------|----------|
| -1100 | Illegal characters | Remove special characters from parameters. |
| -1101 | Too many parameters | Reduce the number of parameters sent. |
| -1102 | Mandatory parameter missing | Include all required parameters for the endpoint. |
| -1103 | Unknown parameter | Remove unrecognized parameters. |
| -1104 | Unread parameters | Check parameter format and types. |
| -1105 | Empty parameter | Provide a value for the parameter. |
| -1106 | Parameter not required | Remove the unnecessary parameter. |
| -1111 | Precision too high | Reduce decimal places. Check symbol's tick/step size. |
| -1112 | No depth in order book | Try again later when liquidity is available. |
| -1114 | TimeInForce not required | Remove timeInForce for MARKET orders. |
| -1115 | Invalid timeInForce | Use GTC, IOC, or FOK. |
| -1116 | Invalid orderType | Use LIMIT, MARKET, STOP_LOSS, etc. |
| -1117 | Invalid side | Use BUY or SELL. |
| -1118 | Empty newClientOrderId | Provide a valid client order ID or remove the parameter. |
| -1119 | Empty originalClientOrderId | Provide the original client order ID. |
| -1120 | Invalid interval | Use valid kline intervals: 1m, 5m, 15m, 1h, etc. |
| -1121 | Invalid symbol | Check symbol format (e.g., BTCUSDT). Must be uppercase. |
| -1125 | Invalid listenKey | Get a new listen key for user data stream. |
| -1127 | Listen key interval too long | Reduce the listen key lifetime. |
| -1128 | Invalid combination of params | Check mutually exclusive parameters. |
| -1130 | Invalid data sent | Check parameter types and values. |
| -1131 | recvWindow must be < 60000 | Reduce recvWindow value. Maximum is 60000ms. |
| -1136 | Invalid newOrderRespType | Use ACK, RESULT, or FULL. |

## Order Errors (-2000 to -2099)

| Code | Message | Solution |
|------|---------|----------|
| -2010 | New order rejected | Check balance, symbol filters, and order parameters. |
| -2011 | Cancel rejected | Order may already be filled or doesn't exist. |
| -2013 | Order does not exist | Verify the orderId or clientOrderId. |
| -2014 | Invalid API key format | Check API key format. Should not have extra spaces. |
| -2015 | Invalid API key or permissions | Enable required permissions (e.g., Spot Trading). |
| -2016 | No trading window | Trading is paused. Wait for market to reopen. |
| -2018 | Balance not sufficient | Add funds or reduce order size. |
| -2019 | Margin not sufficient | For margin accounts (not available on Binance.US). |
| -2020 | Unable to fill | Order cannot be filled at current market conditions. |
| -2021 | Order would trigger immediately | Adjust stop price for stop orders. |
| -2022 | ReduceOnly rejected | Remove reduceOnly flag (for futures, not US). |
| -2024 | Position side not match | Check position mode settings. |
| -2025 | Reduce only | Not applicable to Binance.US spot trading. |
| -2026 | Margin account error | Margin not available on Binance.US. |

## Filter Errors (-9000 to -9999)

| Code | Message | Solution |
|------|---------|----------|
| -9000 | Filter failure: PRICE_FILTER | Price outside allowed range. Check minPrice/maxPrice. |
| -9001 | Filter failure: PERCENT_PRICE | Price too far from mark price. |
| -9002 | Filter failure: LOT_SIZE | Quantity invalid. Check minQty/maxQty/stepSize. |
| -9003 | Filter failure: MIN_NOTIONAL | Order value too low. Increase quantity × price. |
| -9004 | Filter failure: ICEBERG_PARTS | Check iceberg order parts limit. |
| -9005 | Filter failure: MARKET_LOT_SIZE | Market order quantity invalid. |
| -9006 | Filter failure: MAX_NUM_ORDERS | Too many open orders. Cancel some first. |
| -9007 | Filter failure: MAX_NUM_ALGO_ORDERS | Too many algo orders. Cancel some first. |
| -9008 | Filter failure: MAX_NUM_ICEBERG_ORDERS | Too many iceberg orders. |
| -9009 | Filter failure: TRAILING_DELTA | Invalid trailing delta value. |
| -9010 | Filter failure: EXCHANGE_MAX_NUM_ORDERS | Exchange-wide order limit reached. |
| -9011 | Filter failure: EXCHANGE_MAX_NUM_ALGO_ORDERS | Exchange-wide algo order limit reached. |

## OCO-Specific Errors

| Code | Message | Solution |
|------|---------|----------|
| -2010 | OCO rejected | Check price relationships for OCO. SELL: limit > stop. BUY: limit < stop. |
| -2011 | OCO cancel rejected | One or both orders may already be filled. |

### OCO Price Rules

**For SELL OCO:**
```
Limit Price > Last Market Price > Stop Price
```
- Limit order is above market (take profit)
- Stop order is below market (stop loss)

**For BUY OCO:**
```
Limit Price < Last Market Price < Stop Price
```
- Limit order is below market (buy the dip)
- Stop order is above market (breakout buy)

## Common Error Scenarios

### Scenario 1: Order Rejected Due to Quantity
```
Error: -9002 LOT_SIZE
```

**Cause:** Quantity doesn't match symbol's lot size filter.

**Solution:**
1. Get exchange info for the symbol
2. Find LOT_SIZE filter: `minQty`, `maxQty`, `stepSize`
3. Adjust quantity: `minQty <= quantity <= maxQty`
4. Round to stepSize: `quantity % stepSize == 0`

### Scenario 2: Order Rejected Due to Price
```
Error: -9000 PRICE_FILTER
```

**Cause:** Price outside allowed range or wrong tick size.

**Solution:**
1. Get exchange info for the symbol
2. Find PRICE_FILTER: `minPrice`, `maxPrice`, `tickSize`
3. Adjust price: `minPrice <= price <= maxPrice`
4. Round to tickSize

### Scenario 3: Minimum Notional Not Met
```
Error: -9003 MIN_NOTIONAL
```

**Cause:** Order value (price × quantity) too small.

**Solution:**
1. Get exchange info for the symbol
2. Find MIN_NOTIONAL filter: `minNotional`
3. Ensure: `price × quantity >= minNotional`
4. Typically $10 minimum on Binance.US

### Scenario 4: Invalid Signature
```
Error: -1022 Signature for this request is not valid
```

**Causes:**
- Wrong API secret
- System clock not synchronized
- Parameters changed after signing

**Solutions:**
1. Verify API secret is correct
2. Sync system time with NTP server
3. Don't modify parameters after signing
4. Ensure proper URL encoding

### Scenario 5: Timestamp Error
```
Error: -1021 Timestamp for this request is outside of the recvWindow
```

**Causes:**
- System clock ahead/behind server time
- Network latency

**Solutions:**
1. Sync system clock: `sudo ntpdate pool.ntp.org`
2. Increase recvWindow (up to 60000ms)
3. Use server time endpoint to check offset

## Debugging Tips

### 1. Use Test Orders First
```
binance_us_test_order
```
Tests order validity without placing it.

### 2. Check Symbol Info
Get exchange info to see all filters and requirements for a symbol.

### 3. Verify API Permissions
- Go to Binance.US API Management
- Check which permissions are enabled
- Ensure IP whitelist includes your server

### 4. Check Timestamps
```bash
# Compare your time with server time
curl https://api.binance.us/api/v3/time
```

### 5. Log Full Error Responses
The MCP server includes the full error message with code and hint.

## Rate Limit Errors

When you hit rate limits:

| HTTP Status | Meaning |
|-------------|---------|
| 429 | Rate limit exceeded |
| 418 | IP banned (usually 5 min) |

**Prevention:**
- Implement request queuing
- Use WebSocket for real-time data
- Cache responses when appropriate
- Respect weight limits per minute

## Getting Help

1. Check this error reference
2. Review [Binance.US API Docs](https://docs.binance.us/)
3. Test with smaller requests
4. Check Binance.US status page for outages
