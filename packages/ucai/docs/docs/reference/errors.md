---
title: Errors & Troubleshooting
description: Error codes, messages, and troubleshooting guide
---

# Errors & Troubleshooting

Common errors and how to resolve them.

## Error Categories

| Category | Description |
|----------|-------------|
| `ABIError` | Base error for all ABI-related issues |
| `ABINotFoundError` | ABI could not be retrieved |
| `ABIParseError` | ABI JSON structure is invalid |
| `ABIValidationError` | ABI content is invalid |
| `NetworkError` | Network/RPC related issues |
| `GenerationError` | Code generation failed |

---

## Fetching Errors

### Contract source code not verified

```
ABINotFoundError: Contract source code not verified
```

**Cause:** The contract is not verified on the block explorer.

**Solutions:**

1. **Use a local ABI file** if you have one:
   ```bash
   abi-to-mcp generate ./abi.json -a 0x...
   ```

2. **Try Sourcify** which may have the contract:
   ```bash
   abi-to-mcp generate 0x... --prefer-sourcify
   ```

3. **Verify the contract** on Etherscan if you're the owner

---

### API rate limit exceeded

```
NetworkError: API rate limit exceeded. Please try again later.
```

**Cause:** Too many API requests to the block explorer.

**Solutions:**

1. **Use an API key**:
   ```bash
   export ETHERSCAN_API_KEY=your-key-here
   ```

2. **Wait and retry** - rate limits usually reset quickly

3. **Use a paid API plan** for higher limits

---

### Invalid address format

```
ABIValidationError: Invalid address format: 0x123
```

**Cause:** The address is not a valid Ethereum address.

**Solutions:**

1. **Check address length** - must be 42 characters (0x + 40 hex)
2. **Check for typos** in the address
3. **Include 0x prefix**

---

### Network not found

```
NetworkError: Unknown network: mynetwork
```

**Cause:** The specified network is not configured.

**Solutions:**

1. **Check network name** - use `--network mainnet`, not `--network ethereum`

2. **See available networks**:
   ```bash
   abi-to-mcp networks list
   ```

3. **Add custom network** - see [Custom Networks Guide](../guides/custom-network.md)

---

## Parsing Errors

### Invalid ABI structure

```
ABIParseError: Invalid ABI: expected array, got object
```

**Cause:** The ABI is not a valid JSON array.

**Solutions:**

1. **Check file format** - ABI should be a JSON array:
   ```json
   [{"type": "function", ...}, ...]
   ```

2. **Extract from artifact** - Hardhat/Truffle artifacts wrap ABI:
   ```python
   abi = artifact["abi"]  # Extract ABI array
   ```

---

### Unknown type

```
ABIParseError: Unknown Solidity type: myCustomType
```

**Cause:** A custom or non-standard type was found.

**Solutions:**

1. **Check ABI source** - may be corrupted or modified

2. **User-defined types** are typically tuples in the ABI:
   ```json
   {"name": "param", "type": "tuple", "components": [...]}
   ```

---

### Missing required field

```
ABIValidationError: Missing required field 'type' in ABI entry
```

**Cause:** An ABI entry is missing required fields.

**Solutions:**

1. **Validate ABI format** using:
   ```bash
   abi-to-mcp validate ./abi.json
   ```

2. **Check ABI source** - may be truncated or corrupted

---

## Generation Errors

### Output directory exists

```
GenerationError: Output directory already exists: ./my-server
```

**Cause:** The output directory is not empty.

**Solutions:**

1. **Use --force** to overwrite:
   ```bash
   abi-to-mcp generate 0x... -o ./my-server --force
   ```

2. **Choose different directory**:
   ```bash
   abi-to-mcp generate 0x... -o ./my-server-v2
   ```

---

### Template error

```
GenerationError: Template rendering failed: undefined variable 'xyz'
```

**Cause:** Custom template has an error.

**Solutions:**

1. **Check custom templates** for syntax errors
2. **Use default templates** by removing custom template config
3. **Check variable names** match available context

---

## Runtime Errors

### Could not connect to RPC

```
NetworkError: Could not connect to RPC: https://...
```

**Cause:** The RPC endpoint is unreachable.

**Solutions:**

1. **Check RPC URL** is correct
2. **Check network connectivity**
3. **Try a different RPC provider**
4. **Check API key** if using authenticated endpoint

---

### execution reverted

```
ContractRevertError: execution reverted: ERC20: transfer amount exceeds balance
```

**Cause:** The contract function reverted.

**Common Causes:**

| Message | Meaning |
|---------|---------|
| `transfer amount exceeds balance` | Not enough tokens |
| `insufficient allowance` | Need to approve first |
| `Ownable: caller is not the owner` | Only owner can call |
| `Pausable: paused` | Contract is paused |

**Solutions:**

1. **Check balances** before transferring
2. **Check allowances** before transferFrom
3. **Verify permissions** for restricted functions
4. **Check contract state** (paused, etc.)

---

### Insufficient funds for gas

```
InsufficientFundsError: Insufficient funds for gas * price + value
```

**Cause:** Not enough ETH for transaction gas.

**Solutions:**

1. **Add ETH** to your wallet
2. **Reduce gas price** (may take longer)
3. **Use simulation** to estimate cost first

---

### Nonce too low

```
TransactionError: nonce too low
```

**Cause:** Transaction with this nonce already mined.

**Solutions:**

1. **Wait for pending transactions** to confirm
2. **Get current nonce** from chain:
   ```python
   nonce = await w3.eth.get_transaction_count(address)
   ```

---

### Chain ID mismatch

```
NetworkError: Chain ID mismatch: expected 1, got 137
```

**Cause:** Connected to wrong network.

**Solutions:**

1. **Check RPC URL** matches intended network
2. **Check chain ID** in configuration
3. **Use correct network flag**:
   ```bash
   abi-to-mcp generate 0x... -n polygon  # Not mainnet
   ```

---

## Troubleshooting Checklist

### Generation Issues

- [ ] Is the ABI source valid? (`abi-to-mcp validate`)
- [ ] Is the address correct format?
- [ ] Is the network specified correctly?
- [ ] Do you have an API key set?
- [ ] Is the output directory writable?

### Runtime Issues

- [ ] Is RPC_URL set correctly?
- [ ] Is the RPC endpoint accessible?
- [ ] Is PRIVATE_KEY set (for writes)?
- [ ] Do you have sufficient balance?
- [ ] Are you on the correct network?

### Contract Issues

- [ ] Is the contract verified?
- [ ] Is the contract address correct?
- [ ] Is the contract on this network?
- [ ] Is the ABI up to date?

---

## Getting Help

If you can't resolve an issue:

1. **Check existing issues**: [GitHub Issues](https://github.com/nirholas/UCAI/issues)

2. **Open a new issue** with:
   - Full error message
   - Command or code used
   - ABI file (if not from verified contract)
   - Network and address

3. **Enable debug logging**:
   ```bash
   export ABI_TO_MCP_LOG_LEVEL=DEBUG
   abi-to-mcp generate 0x...
   ```
