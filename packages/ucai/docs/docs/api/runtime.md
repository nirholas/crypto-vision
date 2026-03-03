---
title: Runtime API
description: Runtime utilities documentation
---

# Runtime API

The runtime module provides Web3 client and transaction utilities for generated servers.

## Module: `abi_to_mcp.runtime`

### Web3Client

Managed Web3 connection.

```python
from abi_to_mcp.runtime import Web3Client

client = Web3Client(
    rpc_url="https://eth-mainnet.g.alchemy.com/v2/YOUR-KEY",
    network="mainnet"
)
```

#### Constructor

```python
Web3Client(
    rpc_url: Optional[str] = None,
    network: str = "mainnet"
)
```

RPC URL priority:
1. Explicit `rpc_url` parameter
2. `RPC_URL` environment variable
3. Default from `NETWORKS[network]`

#### Properties

##### `w3: Web3`

Get Web3 instance (lazy initialization).

```python
w3 = client.w3
block = await w3.eth.block_number
```

#### Methods

##### `get_contract(address: str, abi: List) -> Contract`

Create contract instance with checksum address.

```python
contract = client.get_contract(
    "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    abi
)

# Use contract
balance = await contract.functions.balanceOf(address).call()
```

##### `is_connected() -> bool`

Check if connected to network.

```python
if client.is_connected():
    print("Connected!")
else:
    print("Connection failed")
```

##### `get_chain_id() -> int`

Get current chain ID.

```python
chain_id = client.get_chain_id()
if chain_id != 1:
    raise ValueError("Expected mainnet")
```

---

### TransactionBuilder

Build transactions for contract calls.

```python
from abi_to_mcp.runtime import TransactionBuilder

builder = TransactionBuilder(web3_client)
tx = builder.build_transaction(
    contract_function,
    from_address="0x..."
)
```

#### Methods

##### `build_transaction(...) -> Dict[str, Any]`

Build a transaction dictionary.

```python
tx = builder.build_transaction(
    contract.functions.transfer(to, amount),
    from_address="0x...",
    value=0,
    gas_limit=None,      # Auto-estimate
    gas_price=None,      # Use network default
    max_fee_per_gas=None,  # For EIP-1559
    max_priority_fee_per_gas=None
)
```

**Parameters:**

| Name | Type | Description |
|------|------|-------------|
| `contract_function` | `ContractFunction` | Web3 contract function |
| `from_address` | `str` | Sender address |
| `value` | `int` | ETH to send (wei) |
| `gas_limit` | `Optional[int]` | Gas limit |
| `gas_price` | `Optional[int]` | Legacy gas price |
| `max_fee_per_gas` | `Optional[int]` | EIP-1559 max fee |
| `max_priority_fee_per_gas` | `Optional[int]` | EIP-1559 priority fee |

**Returns:** Transaction dictionary ready for signing

##### `estimate_gas(tx: Dict[str, Any]) -> int`

Estimate gas for transaction.

```python
gas = builder.estimate_gas(tx)
print(f"Estimated gas: {gas}")
```

---

### TransactionSimulator

Simulate transactions without executing.

```python
from abi_to_mcp.runtime import TransactionSimulator

simulator = TransactionSimulator(web3_client)
result = simulator.simulate(
    contract_function,
    from_address="0x..."
)
```

#### Methods

##### `simulate(...) -> Dict[str, Any]`

Simulate a transaction.

```python
result = await simulator.simulate(
    contract.functions.transfer(to, amount),
    from_address="0x...",
    value=0
)

print(result)
# {
#   "success": True,
#   "would_succeed": True,
#   "result": True,  # Return value
#   "gas_estimate": 65000,
#   "gas_price": 25000000000,
#   "estimated_cost_eth": "0.001625",
#   "error": None
# }
```

**Simulation Failure:**

```python
result = await simulator.simulate(...)
# {
#   "success": True,
#   "would_succeed": False,
#   "result": None,
#   "error": "execution reverted: ERC20: transfer amount exceeds balance",
#   "gas_estimate": None,
#   ...
# }
```

---

### Signer

Transaction signing utilities.

```python
from abi_to_mcp.runtime import Signer

signer = Signer(private_key="0x...")
signed_tx = signer.sign_transaction(tx)
```

#### Constructor

```python
Signer(private_key: Optional[str] = None)
```

If not provided, reads from `PRIVATE_KEY` environment variable.

#### Properties

##### `address: str`

Get signer's address.

```python
print(f"Signing from: {signer.address}")
```

#### Methods

##### `sign_transaction(tx: Dict) -> SignedTransaction`

Sign a transaction.

```python
signed = signer.sign_transaction(tx)
tx_hash = await w3.eth.send_raw_transaction(signed.rawTransaction)
```

##### `sign_message(message: str) -> SignedMessage`

Sign a message (EIP-191).

```python
signed = signer.sign_message("Hello, World!")
```

---

### GasEstimator

Gas price estimation utilities.

```python
from abi_to_mcp.runtime import GasEstimator

estimator = GasEstimator(web3_client)
prices = await estimator.get_gas_prices()
```

#### Methods

##### `get_gas_prices() -> GasPrices`

Get current gas prices.

```python
prices = await estimator.get_gas_prices()

print(f"Base fee: {prices.base_fee} gwei")
print(f"Priority fee: {prices.priority_fee} gwei")
print(f"Max fee: {prices.max_fee} gwei")
```

##### `estimate_cost(gas_units: int) -> GasCost`

Estimate transaction cost.

```python
cost = await estimator.estimate_cost(65000)

print(f"ETH: {cost.eth}")
print(f"USD: ${cost.usd}")  # If price feed available
```

---

## Data Classes

### GasPrices

Current gas prices.

```python
@dataclass
class GasPrices:
    base_fee: int        # Wei
    priority_fee: int    # Wei
    max_fee: int         # Wei
    legacy_price: int    # Wei (for non-EIP-1559)
```

### GasCost

Estimated transaction cost.

```python
@dataclass
class GasCost:
    gas_units: int
    gas_price: int       # Wei
    eth: float           # Total cost in ETH
    usd: Optional[float] # USD if price available
```

---

## Examples

### Complete Transaction Flow

```python
from abi_to_mcp.runtime import (
    Web3Client,
    TransactionBuilder,
    TransactionSimulator,
    Signer
)

# Setup
client = Web3Client(network="mainnet")
contract = client.get_contract(address, abi)
builder = TransactionBuilder(client)
simulator = TransactionSimulator(client)
signer = Signer()

# Build function call
func = contract.functions.transfer(to_address, amount)

# Simulate first
sim_result = await simulator.simulate(func, signer.address)
if not sim_result["would_succeed"]:
    raise ValueError(f"Would fail: {sim_result['error']}")

print(f"Gas estimate: {sim_result['gas_estimate']}")
print(f"Cost: {sim_result['estimated_cost_eth']} ETH")

# Build and sign
tx = builder.build_transaction(func, signer.address)
signed = signer.sign_transaction(tx)

# Send
tx_hash = await client.w3.eth.send_raw_transaction(signed.rawTransaction)
print(f"Sent: {tx_hash.hex()}")

# Wait for receipt
receipt = await client.w3.eth.wait_for_transaction_receipt(tx_hash)
print(f"Confirmed in block {receipt['blockNumber']}")
```

### Read-Only Usage

```python
from abi_to_mcp.runtime import Web3Client

client = Web3Client(
    rpc_url="https://eth-mainnet.g.alchemy.com/v2/KEY"
)

contract = client.get_contract(
    "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    usdc_abi
)

# Read operations - no signer needed
name = await contract.functions.name().call()
symbol = await contract.functions.symbol().call()
balance = await contract.functions.balanceOf(address).call()

print(f"{name} ({symbol}): {balance}")
```

### Error Handling

```python
from abi_to_mcp.runtime import TransactionSimulator
from abi_to_mcp.core.exceptions import (
    SimulationError,
    InsufficientFundsError,
    ContractRevertError
)

try:
    result = await simulator.simulate(func, address)
    if not result["would_succeed"]:
        raise SimulationError(result["error"])
except InsufficientFundsError:
    print("Not enough ETH for gas")
except ContractRevertError as e:
    print(f"Contract reverted: {e}")
except Exception as e:
    print(f"Unexpected error: {e}")
```
