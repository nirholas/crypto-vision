# Error Codes Reference

Comprehensive reference for error codes and error handling in BNB-Chain-MCP.

---

## Overview

BNB-Chain-MCP uses standard MCP error codes plus custom domain-specific errors. All errors follow JSON-RPC 2.0 format.

---

## Error Response Format

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "error": {
    "code": -32000,
    "message": "Insufficient balance",
    "data": {
      "required": "1.5",
      "available": "0.5",
      "token": "ETH"
    }
  }
}
```

---

## Standard MCP Errors

| Code | Name | Description |
|------|------|-------------|
| -32700 | Parse Error | Invalid JSON received |
| -32600 | Invalid Request | Request is not valid JSON-RPC |
| -32601 | Method Not Found | Method does not exist |
| -32602 | Invalid Params | Invalid method parameters |
| -32603 | Internal Error | Internal server error |

### Examples

**Parse Error (-32700)**
```json
{
  "error": {
    "code": -32700,
    "message": "Parse error: Unexpected token"
  }
}
```

**Invalid Params (-32602)**
```json
{
  "error": {
    "code": -32602,
    "message": "Invalid params: 'network' must be a string",
    "data": {
      "param": "network",
      "received": 123,
      "expected": "string"
    }
  }
}
```

---

## Network Errors (-32000 to -32099)

| Code | Name | Description |
|------|------|-------------|
| -32000 | Network Error | Network communication failed |
| -32001 | Network Not Supported | Unknown network ID |
| -32002 | RPC Error | RPC provider error |
| -32003 | Chain ID Mismatch | Wrong chain ID |
| -32004 | Block Not Found | Block does not exist |

### Examples

**Network Not Supported (-32001)**
```json
{
  "error": {
    "code": -32001,
    "message": "Network not supported: solana",
    "data": {
      "network": "solana",
      "supported": ["ethereum", "arbitrum", "bsc", "polygon", "base", "optimism", "opbnb"]
    }
  }
}
```

**RPC Error (-32002)**
```json
{
  "error": {
    "code": -32002,
    "message": "RPC request failed",
    "data": {
      "network": "ethereum",
      "rpcError": "rate limit exceeded",
      "retryAfter": 60
    }
  }
}
```

---

## Wallet Errors (-32100 to -32199)

| Code | Name | Description |
|------|------|-------------|
| -32100 | Wallet Not Configured | No wallet/private key set |
| -32101 | Invalid Address | Malformed address |
| -32102 | Insufficient Balance | Not enough funds |
| -32103 | Nonce Too Low | Transaction nonce issue |
| -32104 | Signature Failed | Message signing failed |

### Examples

**Wallet Not Configured (-32100)**
```json
{
  "error": {
    "code": -32100,
    "message": "Wallet not configured. Set PRIVATE_KEY environment variable for write operations."
  }
}
```

**Insufficient Balance (-32102)**
```json
{
  "error": {
    "code": -32102,
    "message": "Insufficient balance for transaction",
    "data": {
      "required": "1.5",
      "available": "0.5",
      "token": "ETH",
      "includesGas": true
    }
  }
}
```

---

## Token Errors (-32200 to -32299)

| Code | Name | Description |
|------|------|-------------|
| -32200 | Token Not Found | Token doesn't exist |
| -32201 | Invalid Token | Not a valid ERC-20 |
| -32202 | Insufficient Allowance | Need approval first |
| -32203 | Transfer Failed | Token transfer failed |

### Examples

**Insufficient Allowance (-32202)**
```json
{
  "error": {
    "code": -32202,
    "message": "Insufficient token allowance",
    "data": {
      "token": "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
      "symbol": "USDC",
      "spender": "0x1111111254EEB25477B68fb85Ed929f73A960582",
      "required": "1000000000",
      "current": "0"
    }
  }
}
```

---

## Swap Errors (-32300 to -32399)

| Code | Name | Description |
|------|------|-------------|
| -32300 | No Route Found | No swap path available |
| -32301 | Slippage Too High | Price moved beyond tolerance |
| -32302 | Insufficient Liquidity | Not enough pool liquidity |
| -32303 | Swap Failed | Swap transaction reverted |
| -32304 | Quote Expired | Quote timeout |

### Examples

**No Route Found (-32300)**
```json
{
  "error": {
    "code": -32300,
    "message": "No swap route found",
    "data": {
      "tokenIn": "0x...",
      "tokenOut": "0x...",
      "network": "arbitrum",
      "reason": "No liquidity pools available for this pair"
    }
  }
}
```

**Slippage Too High (-32301)**
```json
{
  "error": {
    "code": -32301,
    "message": "Price impact exceeds slippage tolerance",
    "data": {
      "expectedPriceImpact": "5.2",
      "maxSlippage": "1.0",
      "recommendation": "Reduce trade size or increase slippage tolerance"
    }
  }
}
```

---

## DeFi Errors (-32400 to -32499)

| Code | Name | Description |
|------|------|-------------|
| -32400 | Protocol Error | DeFi protocol error |
| -32401 | Position Not Found | No active position |
| -32402 | Health Factor Low | Risk of liquidation |
| -32403 | Pool Not Found | Pool doesn't exist |
| -32404 | Stake Failed | Staking operation failed |
| -32405 | Borrow Limit Exceeded | Exceeds borrowing capacity |

### Examples

**Health Factor Low (-32402)**
```json
{
  "error": {
    "code": -32402,
    "message": "Operation would reduce health factor below safe level",
    "data": {
      "currentHealthFactor": "1.5",
      "projectedHealthFactor": "0.95",
      "minimumRequired": "1.0",
      "action": "withdraw"
    }
  }
}
```

**Borrow Limit Exceeded (-32405)**
```json
{
  "error": {
    "code": -32405,
    "message": "Borrow amount exceeds available capacity",
    "data": {
      "requested": "10000",
      "available": "5000",
      "collateralValue": "8000",
      "ltv": "80"
    }
  }
}
```

---

## Security Errors (-32500 to -32599)

| Code | Name | Description |
|------|------|-------------|
| -32500 | Security Check Failed | Token failed security check |
| -32501 | Honeypot Detected | Token is a honeypot |
| -32502 | High Risk Token | Token has critical risks |
| -32503 | Blacklisted Address | Address is blacklisted |

### Examples

**Honeypot Detected (-32501)**
```json
{
  "error": {
    "code": -32501,
    "message": "Token identified as honeypot - cannot be sold",
    "data": {
      "token": "0x...",
      "sellTax": "100",
      "reason": "Sell function disabled"
    }
  }
}
```

---

## Rate Limit Errors (-32600 to -32699)

| Code | Name | Description |
|------|------|-------------|
| -32600 | Rate Limited | Too many requests |
| -32601 | API Limit Reached | External API limit |

### Examples

**Rate Limited (-32600)**
```json
{
  "error": {
    "code": -32600,
    "message": "Rate limit exceeded",
    "data": {
      "limit": 100,
      "window": "60s",
      "retryAfter": 45
    }
  }
}
```

---

## Transaction Errors (-32700 to -32799)

| Code | Name | Description |
|------|------|-------------|
| -32700 | Transaction Failed | TX reverted |
| -32701 | Gas Estimation Failed | Cannot estimate gas |
| -32702 | Gas Price Too Low | TX will likely fail |
| -32703 | Timeout | TX confirmation timeout |
| -32704 | Replaced | TX was replaced |

### Examples

**Transaction Failed (-32700)**
```json
{
  "error": {
    "code": -32700,
    "message": "Transaction reverted",
    "data": {
      "hash": "0x...",
      "reason": "ERC20: transfer amount exceeds balance",
      "gasUsed": "45000"
    }
  }
}
```

---

## Error Handling Best Practices

### TypeScript Example

```typescript
interface MCPError {
  code: number;
  message: string;
  data?: Record<string, any>;
}

async function callToolSafely(
  mcp: MCPClient,
  tool: string,
  args: Record<string, any>
): Promise<any> {
  try {
    return await mcp.callTool(tool, args);
  } catch (error: any) {
    const mcpError: MCPError = error;
    
    switch (mcpError.code) {
      case -32100:
        throw new Error('Please configure wallet with PRIVATE_KEY');
      
      case -32102:
        throw new Error(`Insufficient balance: need ${mcpError.data?.required}`);
      
      case -32301:
        // Retry with higher slippage
        return await mcp.callTool(tool, {
          ...args,
          slippage: parseFloat(args.slippage || '1') * 2
        });
      
      case -32600:
        // Wait and retry
        await sleep(mcpError.data?.retryAfter * 1000 || 60000);
        return await mcp.callTool(tool, args);
      
      default:
        throw error;
    }
  }
}
```

### Python Example

```python
class MCPError(Exception):
    def __init__(self, code: int, message: str, data: dict = None):
        self.code = code
        self.message = message
        self.data = data or {}
        super().__init__(f"MCP Error {code}: {message}")

def handle_mcp_error(error: MCPError):
    """Handle MCP errors with appropriate actions."""
    
    if error.code == -32100:
        raise ValueError("Wallet not configured")
    
    elif error.code == -32102:
        balance = error.data.get('available', '0')
        required = error.data.get('required', 'unknown')
        raise ValueError(f"Insufficient balance: have {balance}, need {required}")
    
    elif error.code == -32300:
        # No route - suggest alternatives
        return {
            "success": False,
            "suggestion": "Try a different token pair or network"
        }
    
    elif error.code == -32501:
        # Honeypot - critical warning
        return {
            "success": False,
            "warning": "HONEYPOT DETECTED - DO NOT BUY",
            "risk": "critical"
        }
    
    elif error.code == -32600:
        # Rate limited - wait and retry
        retry_after = error.data.get('retryAfter', 60)
        time.sleep(retry_after)
        return {"retry": True}
    
    else:
        raise error
```

---

## Related Documentation

- [API Overview](README.md) - API documentation
- [Tools Reference](tools/README.md) - Tool documentation
- [Rate Limits](rate-limits.md) - Rate limiting details
