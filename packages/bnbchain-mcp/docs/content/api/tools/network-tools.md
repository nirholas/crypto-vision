# Network Tools

Tools for interacting with blockchain networks, chain information, and RPC endpoints.

---

## network_get_info

Get comprehensive information about the current network.

### Parameters

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `network` | string | No | `ethereum` | Target network |

### Response Schema

```typescript
{
  chainId: number;           // Chain ID (e.g., 1 for Ethereum)
  name: string;              // Network name
  nativeCurrency: {
    name: string;            // "Ether"
    symbol: string;          // "ETH"
    decimals: number;        // 18
  };
  blockNumber: number;       // Current block number
  gasPrice: string;          // Current gas price in Gwei
  rpcUrl: string;            // Active RPC endpoint
  explorerUrl: string;       // Block explorer URL
}
```

### Example Usage

```typescript
// Using MCP client
const result = await client.callTool('network_get_info', {
  network: 'arbitrum'
});

// Response
{
  "chainId": 42161,
  "name": "Arbitrum One",
  "nativeCurrency": {
    "name": "Ether",
    "symbol": "ETH",
    "decimals": 18
  },
  "blockNumber": 175234567,
  "gasPrice": "0.1",
  "rpcUrl": "https://arb1.arbitrum.io/rpc",
  "explorerUrl": "https://arbiscan.io"
}
```

### Related Tools

- [network_get_chain_id](#network_get_chain_id)
- [network_get_gas_price](#network_get_gas_price)
- [network_list_supported](#network_list_supported)

---

## network_get_chain_id

Get the chain ID for the current network.

### Parameters

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `network` | string | No | `ethereum` | Target network |

### Response Schema

```typescript
{
  chainId: number;
  networkName: string;
}
```

### Example Usage

```typescript
const result = await client.callTool('network_get_chain_id', {
  network: 'bsc'
});

// Response
{
  "chainId": 56,
  "networkName": "BNB Smart Chain"
}
```

---

## network_get_block_number

Get the latest block number.

### Parameters

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `network` | string | No | `ethereum` | Target network |

### Response Schema

```typescript
{
  blockNumber: number;
  timestamp: number;
  network: string;
}
```

### Example Usage

```typescript
const result = await client.callTool('network_get_block_number', {
  network: 'polygon'
});

// Response
{
  "blockNumber": 52345678,
  "timestamp": 1706284800,
  "network": "polygon"
}
```

---

## network_get_gas_price

Get current gas prices with EIP-1559 support.

### Parameters

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `network` | string | No | `ethereum` | Target network |

### Response Schema

```typescript
{
  legacy: {
    gasPrice: string;        // Gas price in Gwei
  };
  eip1559: {
    baseFee: string;         // Base fee in Gwei
    maxPriorityFee: string;  // Priority fee in Gwei
    maxFee: string;          // Max fee in Gwei
  };
  suggestions: {
    slow: string;            // Low priority gas price
    standard: string;        // Standard gas price
    fast: string;            // Fast gas price
    instant: string;         // Instant gas price
  };
}
```

### Example Usage

```typescript
const result = await client.callTool('network_get_gas_price', {
  network: 'ethereum'
});

// Response
{
  "legacy": {
    "gasPrice": "25.5"
  },
  "eip1559": {
    "baseFee": "20.0",
    "maxPriorityFee": "2.0",
    "maxFee": "42.0"
  },
  "suggestions": {
    "slow": "22.0",
    "standard": "25.0",
    "fast": "30.0",
    "instant": "40.0"
  }
}
```

### Related Tools

- [gas_estimate](#gas_estimate)
- [gas_get_history](#gas_get_history)

---

## network_list_supported

List all supported networks and their configurations.

### Parameters

None

### Response Schema

```typescript
{
  networks: Array<{
    id: string;              // Network identifier
    name: string;            // Display name
    chainId: number;         // Chain ID
    nativeCurrency: string;  // Native token symbol
    rpcUrl: string;          // Default RPC URL
    explorerUrl: string;     // Block explorer URL
    testnet: boolean;        // Is testnet
  }>;
  total: number;
}
```

### Example Usage

```typescript
const result = await client.callTool('network_list_supported', {});

// Response
{
  "networks": [
    {
      "id": "ethereum",
      "name": "Ethereum Mainnet",
      "chainId": 1,
      "nativeCurrency": "ETH",
      "rpcUrl": "https://eth.llamarpc.com",
      "explorerUrl": "https://etherscan.io",
      "testnet": false
    },
    {
      "id": "bsc",
      "name": "BNB Smart Chain",
      "chainId": 56,
      "nativeCurrency": "BNB",
      "rpcUrl": "https://bsc-dataseed.binance.org",
      "explorerUrl": "https://bscscan.com",
      "testnet": false
    },
    // ... more networks
  ],
  "total": 12
}
```

---

## network_get_rpc_endpoints

Get available RPC endpoints for a network.

### Parameters

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `network` | string | No | `ethereum` | Target network |
| `includePrivate` | boolean | No | `false` | Include private RPCs |

### Response Schema

```typescript
{
  network: string;
  endpoints: Array<{
    url: string;
    provider: string;
    type: 'public' | 'private';
    latency?: number;
    status: 'healthy' | 'degraded' | 'down';
  }>;
}
```

### Example Usage

```typescript
const result = await client.callTool('network_get_rpc_endpoints', {
  network: 'arbitrum'
});

// Response
{
  "network": "arbitrum",
  "endpoints": [
    {
      "url": "https://arb1.arbitrum.io/rpc",
      "provider": "Arbitrum Foundation",
      "type": "public",
      "latency": 45,
      "status": "healthy"
    },
    {
      "url": "https://arbitrum.llamarpc.com",
      "provider": "LlamaNodes",
      "type": "public",
      "latency": 62,
      "status": "healthy"
    }
  ]
}
```

---

## network_get_status

Check network health and status.

### Parameters

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `network` | string | No | `ethereum` | Target network |

### Response Schema

```typescript
{
  network: string;
  status: 'healthy' | 'degraded' | 'down';
  blockTime: number;         // Average block time in seconds
  peerCount: number;         // Number of connected peers
  isSyncing: boolean;        // Is node syncing
  latestBlock: number;
  finalizedBlock: number;
  pendingTransactions: number;
}
```

### Example Usage

```typescript
const result = await client.callTool('network_get_status', {
  network: 'ethereum'
});

// Response
{
  "network": "ethereum",
  "status": "healthy",
  "blockTime": 12.1,
  "peerCount": 125,
  "isSyncing": false,
  "latestBlock": 19234567,
  "finalizedBlock": 19234535,
  "pendingTransactions": 45678
}
```

---

## network_estimate_block_time

Estimate time for a future block.

### Parameters

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `network` | string | No | `ethereum` | Target network |
| `targetBlock` | number | Yes | - | Target block number |

### Response Schema

```typescript
{
  currentBlock: number;
  targetBlock: number;
  blocksRemaining: number;
  estimatedSeconds: number;
  estimatedTime: string;     // ISO timestamp
  averageBlockTime: number;
}
```

### Example Usage

```typescript
const result = await client.callTool('network_estimate_block_time', {
  network: 'ethereum',
  targetBlock: 19300000
});

// Response
{
  "currentBlock": 19234567,
  "targetBlock": 19300000,
  "blocksRemaining": 65433,
  "estimatedSeconds": 791919,
  "estimatedTime": "2024-02-05T10:30:00Z",
  "averageBlockTime": 12.1
}
```

---

## network_get_mempool

Get pending transactions in the mempool.

### Parameters

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `network` | string | No | `ethereum` | Target network |
| `limit` | number | No | `20` | Max transactions to return |

### Response Schema

```typescript
{
  network: string;
  pendingCount: number;
  transactions: Array<{
    hash: string;
    from: string;
    to: string;
    value: string;
    gasPrice: string;
    nonce: number;
  }>;
}
```

### Example Usage

```typescript
const result = await client.callTool('network_get_mempool', {
  network: 'ethereum',
  limit: 10
});

// Response
{
  "network": "ethereum",
  "pendingCount": 45678,
  "transactions": [
    {
      "hash": "0x1234...",
      "from": "0xabc...",
      "to": "0xdef...",
      "value": "1.5",
      "gasPrice": "30.0",
      "nonce": 42
    }
    // ... more transactions
  ]
}
```

---

## network_switch

Switch the active network for subsequent operations.

### Parameters

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `network` | string | Yes | - | Network to switch to |

### Response Schema

```typescript
{
  success: boolean;
  previousNetwork: string;
  currentNetwork: string;
  chainId: number;
}
```

### Example Usage

```typescript
const result = await client.callTool('network_switch', {
  network: 'polygon'
});

// Response
{
  "success": true,
  "previousNetwork": "ethereum",
  "currentNetwork": "polygon",
  "chainId": 137
}
```

---

## Error Handling

### Common Errors

| Error Code | Description | Solution |
|------------|-------------|----------|
| `NETWORK_NOT_FOUND` | Unsupported network | Use `network_list_supported` to see available networks |
| `RPC_ERROR` | RPC endpoint failure | Try different endpoint or network |
| `RATE_LIMIT` | Too many requests | Implement request throttling |

### Example Error Response

```json
{
  "content": [{
    "type": "text",
    "text": "Error: Network 'invalid_network' not supported. Use network_list_supported to see available networks."
  }],
  "isError": true
}
```

---

## Best Practices

1. **Cache network info** - Network configuration rarely changes
2. **Use appropriate network** - Choose based on use case (testnet for development)
3. **Monitor gas prices** - Query before transactions to optimize costs
4. **Handle RPC failures** - Implement fallback endpoints
5. **Check finality** - For critical operations, wait for block finalization
