---
title: NFT Collection Guide
description: Create an MCP server for ERC721 NFT collections
---

# NFT Collection Guide

This guide shows you how to create an MCP server for any ERC721 NFT collection. You'll be able to:

- ✅ Check NFT ownership
- ✅ View collection metadata
- ✅ Look up token URIs
- ✅ Track transfers
- ✅ Transfer NFTs (optional)

## Prerequisites

- abi-to-mcp installed
- RPC endpoint
- NFT contract address

## Step 1: Choose Your Collection

For this guide, we'll use Bored Ape Yacht Club:

| Property | Value |
|----------|-------|
| Collection | Bored Ape Yacht Club (BAYC) |
| Address | `0xBC4CA0EdA7647A8aB7C2061c2E118A18a936f13D` |
| Network | Ethereum Mainnet |
| Standard | ERC721 |

!!! tip "Find NFT Collections"
    Popular places to find NFT contract addresses:
    
    - [OpenSea](https://opensea.io/)
    - [Etherscan NFT Tracker](https://etherscan.io/tokens-nft)
    - [NFTScan](https://www.nftscan.com/)

## Step 2: Generate the Server

```bash
abi-to-mcp generate 0xBC4CA0EdA7647A8aB7C2061c2E118A18a936f13D \
    --network mainnet \
    --output ./bayc-mcp-server \
    --name "BAYC NFT"
```

Output:
```
🔍 Fetching ABI from Etherscan (mainnet)...
✅ Found verified contract: BoredApeYachtClub
📊 Detected standard: ERC721

📁 Generated files:
   ./bayc-mcp-server/
   ├── server.py
   ├── config.py
   ├── README.md
   ├── pyproject.toml
   └── requirements.txt
```

## Step 3: Configure and Run

```bash
cd bayc-mcp-server

# Create .env
echo "RPC_URL=https://eth-mainnet.g.alchemy.com/v2/YOUR-KEY" > .env

# Install and run
pip install -r requirements.txt
python server.py
```

## Available Tools

### Collection Info

| Tool | Description | Example Return |
|------|-------------|----------------|
| `name` | Collection name | "BoredApeYachtClub" |
| `symbol` | Collection symbol | "BAYC" |
| `total_supply` | Total minted | "10000" |

### Ownership

| Tool | Description | Parameters |
|------|-------------|------------|
| `owner_of` | Get token owner | `token_id` |
| `balance_of` | Count owned tokens | `owner` |
| `token_of_owner_by_index` | Get token at index | `owner`, `index` |

### Metadata

| Tool | Description | Parameters |
|------|-------------|------------|
| `token_uri` | Get metadata URI | `token_id` |

### Approvals

| Tool | Description | Parameters |
|------|-------------|------------|
| `get_approved` | Get approved address | `token_id` |
| `is_approved_for_all` | Check operator approval | `owner`, `operator` |

### Transfers (Write)

| Tool | Description | Parameters |
|------|-------------|------------|
| `transfer_from` | Transfer NFT | `from_`, `to`, `token_id` |
| `safe_transfer_from` | Safe transfer | `from_`, `to`, `token_id` |
| `approve` | Approve transfer | `to`, `token_id` |
| `set_approval_for_all` | Approve operator | `operator`, `approved` |

## Common Queries

### Who owns a specific NFT?

```python
owner = await owner_of(token_id="1234")
# Returns: "0x123..."
```

### How many NFTs does an address own?

```python
count = await balance_of(owner="0x...")
# Returns: "5"
```

### Get NFT metadata

```python
uri = await token_uri(token_id="1234")
# Returns: "ipfs://Qm.../1234"
```

The URI typically points to JSON metadata:
```json
{
  "name": "Bored Ape #1234",
  "description": "...",
  "image": "ipfs://Qm.../1234.png",
  "attributes": [
    {"trait_type": "Background", "value": "Blue"},
    {"trait_type": "Fur", "value": "Golden Brown"}
  ]
}
```

### List all NFTs owned by an address

```python
# Get count
count = int(await balance_of(owner="0x..."))

# Get each token ID
tokens = []
for i in range(count):
    token_id = await token_of_owner_by_index(
        owner="0x...",
        index=str(i)
    )
    tokens.append(token_id)
```

## Tracking Transfers

The server exposes Transfer events:

```python
# Recent transfers
transfers = await get_transfer_events(
    from_block=current_block - 1000,
    limit=20
)

# Transfers to a specific address
incoming = await get_transfer_events(
    to_address="0x...",
    limit=10
)

# Transfers from a specific address
outgoing = await get_transfer_events(
    from_address="0x...",
    limit=10
)
```

Each transfer includes:
```python
{
    "from": "0x123...",
    "to": "0x456...",
    "tokenId": "1234",
    "block_number": 18500000,
    "transaction_hash": "0x..."
}
```

## Transferring NFTs

!!! danger "Irreversible"
    NFT transfers cannot be undone. Always verify addresses carefully.

### Simulate First

```python
result = await transfer_from(
    from_="0x...",  # Current owner (must be you or approved)
    to="0x...",     # Recipient
    token_id="1234",
    simulate=True   # Default - just simulate
)
```

### Execute Transfer

```python
result = await transfer_from(
    from_="0x...",
    to="0x...",
    token_id="1234",
    simulate=False  # Actually transfer
)
```

### Safe vs Regular Transfer

- `transfer_from` - Basic transfer
- `safe_transfer_from` - Checks if recipient can receive NFTs

!!! tip "Use Safe Transfers"
    `safe_transfer_from` prevents sending NFTs to contracts that can't handle them, avoiding permanent loss.

## ERC1155 Multi-Token

For ERC1155 collections (like OpenSea Shared Storefront):

```bash
abi-to-mcp generate 0x495f947276749Ce646f68AC8c248420045cb7b5e \
    --network mainnet \
    --output ./opensea-shared
```

ERC1155 has different functions:
- `balance_of(account, id)` - Balance of specific token ID
- `balance_of_batch(accounts, ids)` - Multiple balances at once
- `uri(id)` - Metadata URI

## Working with IPFS

Many NFT URIs use IPFS. To resolve them:

```python
# Replace ipfs:// with gateway
uri = "ipfs://QmeSjSinHpPnmXmspMjwiXyN6zS4E9zccariGR3jxcaWtq/1234"
http_uri = uri.replace("ipfs://", "https://ipfs.io/ipfs/")
```

Popular IPFS gateways:
- `https://ipfs.io/ipfs/`
- `https://gateway.pinata.cloud/ipfs/`
- `https://cloudflare-ipfs.com/ipfs/`

## Common Issues

### "ERC721: owner query for nonexistent token"

The token ID doesn't exist. Check:
- Token ID is within valid range (0 to totalSupply-1 or 1 to totalSupply)
- Token hasn't been burned

### "ERC721: operator query for nonexistent token"

Same as above - invalid token ID.

### Metadata returns empty

The contract might use:
- A different metadata function
- Off-chain metadata that requires API calls
- Reveal mechanism (pre-reveal placeholder)

### Can't enumerate tokens

Not all ERC721 contracts implement enumeration (`tokenOfOwnerByIndex`). You may need to:
- Use Transfer events to track ownership
- Use an indexing service

## Next Steps

- [DeFi Protocol](defi-protocol.md) - Complex multi-contract systems
- [Claude Desktop](claude-desktop.md) - Use with Claude
- [Custom Networks](custom-network.md) - NFTs on L2s

!!! example "Quick Start Example"
    A ready-to-use NFT example with ERC721 ABI is available in [`examples/nft_collection/`](https://github.com/nirholas/UCAI/tree/main/examples/nft_collection).
