---
title: Fetchers API
description: ABI fetching module documentation
---

# Fetchers API

The fetchers module retrieves ABIs from various sources.

## Module: `abi_to_mcp.fetchers`

### FetcherRegistry

Registry that selects appropriate fetcher for a source.

```python
from abi_to_mcp.fetchers import create_default_registry

registry = create_default_registry()
result = await registry.fetch("0x...")
```

#### Functions

##### `create_default_registry(api_keys=None) -> FetcherRegistry`

Create registry with all default fetchers.

```python
# Without API keys (uses environment variables)
registry = create_default_registry()

# With explicit API keys
registry = create_default_registry({
    "etherscan": "YOUR-ETHERSCAN-KEY",
    "polygonscan": "YOUR-POLYGONSCAN-KEY"
})
```

#### Methods

##### `register(fetcher: ABIFetcher) -> None`

Register a custom fetcher.

```python
registry = create_default_registry()
registry.register(MyCustomFetcher())
```

##### `get_fetcher(source: str) -> Optional[ABIFetcher]`

Get first fetcher that can handle the source.

```python
fetcher = registry.get_fetcher("./abi.json")
# Returns: FileFetcher

fetcher = registry.get_fetcher("0xA0b8...")
# Returns: EtherscanFetcher
```

##### `async fetch(source: str, **kwargs) -> FetchResult`

Fetch from appropriate source with auto-detection.

```python
# From file
result = await registry.fetch("./abi.json")

# From Etherscan
result = await registry.fetch(
    "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    network="mainnet"
)

# From Sourcify
result = await registry.fetch(
    "0x...",
    chain_id=137,
    prefer_sourcify=True
)
```

---

### FileFetcher

Fetch ABI from local JSON files.

```python
from abi_to_mcp.fetchers import FileFetcher

fetcher = FileFetcher()
result = await fetcher.fetch("./abi.json")
```

#### Methods

##### `async fetch(source: str, **kwargs) -> FetchResult`

Load ABI from local file.

Supports multiple formats:

```python
# Plain ABI array
# [{"type": "function", ...}]
result = await fetcher.fetch("./plain-abi.json")

# Hardhat/Truffle artifact
# {"abi": [...], "contractName": "..."}
result = await fetcher.fetch("./artifact.json")

# Foundry output
# {"abi": [...], "bytecode": {...}}
result = await fetcher.fetch("./out/Contract.json")
```

##### `can_handle(source: str) -> bool`

Check if source is a local file path.

```python
fetcher.can_handle("./abi.json")  # True
fetcher.can_handle("/path/to/abi.json")  # True
fetcher.can_handle("0x...")  # False
```

---

### EtherscanFetcher

Fetch ABI from Etherscan-compatible APIs.

```python
from abi_to_mcp.fetchers import EtherscanFetcher

fetcher = EtherscanFetcher(api_key="YOUR-KEY")
result = await fetcher.fetch("0x...", network="mainnet")
```

#### Constructor

```python
EtherscanFetcher(api_key: Optional[str] = None)
```

If no key provided, checks environment variables:
- `ETHERSCAN_API_KEY` for mainnet
- `POLYGONSCAN_API_KEY` for Polygon
- etc.

#### Methods

##### `async fetch(source: str, network: str = "mainnet", **kwargs) -> FetchResult`

Fetch ABI from Etherscan API.

```python
# Mainnet
result = await fetcher.fetch(
    "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    network="mainnet"
)

# Polygon
result = await fetcher.fetch(
    "0x...",
    network="polygon"
)

# With proxy detection
result = await fetcher.fetch(
    "0x...",
    network="mainnet",
    resolve_proxy=True  # Default
)
```

**Supported Networks:**

| Network | API Domain |
|---------|------------|
| `mainnet` | api.etherscan.io |
| `goerli` | api-goerli.etherscan.io |
| `sepolia` | api-sepolia.etherscan.io |
| `polygon` | api.polygonscan.com |
| `arbitrum` | api.arbiscan.io |
| `optimism` | api-optimistic.etherscan.io |
| `base` | api.basescan.org |
| `bsc` | api.bscscan.com |

##### `async _detect_proxy(address: str, network: str) -> Optional[str]`

Detect if address is a proxy and return implementation.

```python
impl = await fetcher._detect_proxy(
    "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    "mainnet"
)
if impl:
    print(f"Proxy implementation: {impl}")
```

Detects:
- EIP-1967 storage slots
- EIP-1822 (UUPS)
- OpenZeppelin TransparentProxy
- Minimal proxy (EIP-1167)

---

### SourcifyFetcher

Fetch ABI from Sourcify.

```python
from abi_to_mcp.fetchers import SourcifyFetcher

fetcher = SourcifyFetcher()
result = await fetcher.fetch("0x...", chain_id=1)
```

#### Methods

##### `async fetch(source: str, chain_id: int = 1, **kwargs) -> FetchResult`

Fetch ABI from Sourcify.

```python
result = await fetcher.fetch(
    "0x1234...",
    chain_id=1  # Ethereum mainnet
)

# Result includes source code if available
if result.source_code:
    print(result.source_code)
```

Tries in order:
1. Full match (source code verified)
2. Partial match (bytecode verified)

---

## Data Classes

### FetchResult

Result from fetching an ABI.

```python
@dataclass
class FetchResult:
    abi: List[Dict[str, Any]]
    source: str  # "file", "etherscan", "sourcify"
    contract_name: Optional[str] = None
    compiler_version: Optional[str] = None
    source_code: Optional[str] = None
    is_proxy: bool = False
    implementation_address: Optional[str] = None
```

---

## Examples

### Fetch with Fallback

```python
from abi_to_mcp.fetchers import (
    EtherscanFetcher,
    SourcifyFetcher,
    ABINotFoundError
)

async def fetch_with_fallback(address: str, network: str):
    # Try Etherscan first
    try:
        fetcher = EtherscanFetcher()
        return await fetcher.fetch(address, network=network)
    except ABINotFoundError:
        pass
    
    # Fall back to Sourcify
    chain_id = get_chain_id(network)
    fetcher = SourcifyFetcher()
    return await fetcher.fetch(address, chain_id=chain_id)
```

### Custom Fetcher

```python
from abi_to_mcp.fetchers import ABIFetcher, FetchResult

class IPFSFetcher(ABIFetcher):
    """Fetch ABI from IPFS."""
    
    async def fetch(self, source: str, **kwargs) -> FetchResult:
        # source is IPFS CID
        url = f"https://ipfs.io/ipfs/{source}"
        async with httpx.AsyncClient() as client:
            response = await client.get(url)
            abi = response.json()
        
        return FetchResult(
            abi=abi,
            source="ipfs"
        )
    
    def can_handle(self, source: str) -> bool:
        return source.startswith("Qm") or source.startswith("bafy")

# Register
registry = create_default_registry()
registry.register(IPFSFetcher())
```
