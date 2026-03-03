---
title: Events & Resources
description: How contract events become MCP resources
---

# Events & Resources

Smart contract events provide a historical record of what happened on the blockchain. abi-to-mcp exposes these as MCP resources that AI assistants can query.

## Overview

```mermaid
graph LR
    A[Contract Event] --> B[Event Parser]
    B --> C[MCP Resource]
    C --> D[Historical Data]
    
    style A fill:#627EEA,color:#fff
    style C fill:#4CAF50,color:#fff
    style D fill:#9C27B0,color:#fff
```

## What Are Events?

Events are logs emitted by smart contracts during transactions:

```solidity
event Transfer(
    address indexed from,
    address indexed to,
    uint256 value
);

function transfer(address to, uint256 amount) external returns (bool) {
    // ... transfer logic ...
    emit Transfer(msg.sender, to, amount);
    return true;
}
```

Key properties:
- **Immutable** - Once emitted, cannot be changed
- **Indexed Parameters** - Up to 3 parameters can be indexed for efficient filtering
- **Gas Efficient** - Cheaper than storage for historical data
- **Off-Chain Access** - Can be queried without calling the contract

## Events as MCP Resources

Each event becomes a queryable MCP resource:

### Resource URI Format

```
events://{event_name_snake_case}
```

Examples:
- `Transfer` → `events://transfer`
- `Approval` → `events://approval`
- `OwnershipTransferred` → `events://ownership_transferred`

### Generated Resource

**Solidity Event:**
```solidity
event Transfer(
    address indexed from,
    address indexed to,
    uint256 value
);
```

**MCP Resource:**
```python
@mcp.resource("events://transfer")
async def get_transfer_events(
    from_address: str = None,
    to_address: str = None,
    from_block: int = None,
    to_block: int = None,
    limit: int = 100
) -> list[dict]:
    """
    Query Transfer events from the contract.
    
    Args:
        from_address: Filter by sender address (optional)
        to_address: Filter by recipient address (optional)
        from_block: Starting block number (optional)
        to_block: Ending block number (optional)
        limit: Maximum number of events to return
    
    Returns:
        List of Transfer events with block info
    """
    ...
```

## Indexed vs Non-Indexed Parameters

### Indexed Parameters

- Can be used for filtering
- Up to 3 per event
- Stored as topics in the log

```solidity
event Transfer(
    address indexed from,    // Can filter by this
    address indexed to,      // Can filter by this
    uint256 value           // Cannot filter by this
);
```

### Non-Indexed Parameters

- Cannot be used for filtering
- Stored in log data
- Still returned in results

## Query Examples

### Get All Transfers

```python
# AI can query: "Show me all transfers"
events = await get_transfer_events()
```

### Filter by Sender

```python
# AI can query: "Show transfers from 0x123..."
events = await get_transfer_events(
    from_address="0x123..."
)
```

### Filter by Block Range

```python
# AI can query: "Show transfers in the last 1000 blocks"
current_block = await w3.eth.block_number
events = await get_transfer_events(
    from_block=current_block - 1000,
    to_block=current_block
)
```

### Combined Filters

```python
# AI can query: "Show transfers to 0x456... in last 100 blocks"
events = await get_transfer_events(
    to_address="0x456...",
    from_block=current_block - 100
)
```

## Event Data Structure

Each returned event includes:

```python
{
    "event": "Transfer",
    "block_number": 18500000,
    "block_hash": "0x...",
    "transaction_hash": "0x...",
    "transaction_index": 42,
    "log_index": 7,
    "args": {
        "from": "0x123...",
        "to": "0x456...",
        "value": "1000000000000000000"
    }
}
```

## Common Event Patterns

### ERC20 Events

| Event | Purpose | Indexed Args |
|-------|---------|--------------|
| `Transfer(from, to, value)` | Token transfers | from, to |
| `Approval(owner, spender, value)` | Spending approvals | owner, spender |

### ERC721 Events

| Event | Purpose | Indexed Args |
|-------|---------|--------------|
| `Transfer(from, to, tokenId)` | NFT transfers | from, to, tokenId |
| `Approval(owner, approved, tokenId)` | Single approval | owner, approved, tokenId |
| `ApprovalForAll(owner, operator, approved)` | Operator approval | owner, operator |

### Governance Events

| Event | Purpose | Indexed Args |
|-------|---------|--------------|
| `ProposalCreated(proposalId, ...)` | New proposals | proposalId |
| `VoteCast(voter, proposalId, ...)` | Votes | voter, proposalId |
| `ProposalExecuted(proposalId)` | Execution | proposalId |

## Performance Considerations

### Block Range Limits

Most RPC providers limit how many blocks you can query:

| Provider | Typical Limit |
|----------|---------------|
| Alchemy | 2,000 blocks |
| Infura | 10,000 blocks |
| QuickNode | 10,000 blocks |
| Public RPCs | 1,000 blocks |

!!! warning "Large Queries"
    Querying all events from block 0 will likely fail or timeout. Always use reasonable block ranges.

### Pagination

For large result sets, events are paginated:

```python
# Get first 100 events
events = await get_transfer_events(limit=100)

# Get next 100 events (using last block as starting point)
last_block = events[-1]["block_number"]
more_events = await get_transfer_events(
    from_block=last_block,
    limit=100
)
```

## Excluding Events

If you don't need events, you can exclude them:

```bash
abi-to-mcp generate ./abi.json --no-events
```

This:
- Reduces generated code size
- Simplifies the server
- Still includes all tools

## Anonymous Events

Anonymous events don't have a topic signature:

```solidity
event AnonymousEvent(uint256 value) anonymous;
```

These are currently not supported by abi-to-mcp because they cannot be reliably filtered.

## Use Cases

### Transaction History

> "Show me the last 10 transfers from this wallet"

```python
events = await get_transfer_events(
    from_address="0x...",
    limit=10
)
```

### Balance Verification

> "Verify this wallet received 100 tokens"

```python
events = await get_transfer_events(
    to_address="0x...",
    from_block=expected_block - 10,
    to_block=expected_block + 10
)
# Check if expected transfer exists
```

### Activity Monitoring

> "Has there been any activity on this contract today?"

```python
blocks_per_day = 7200  # ~12 second blocks
events = await get_transfer_events(
    from_block=current_block - blocks_per_day,
    limit=10
)
```

## Related

- [Tool Types](tool-types.md) - How write operations emit events
- [API Reference](../api/generator.md) - ResourceGenerator API
- [Guides](../guides/erc20-token.md) - Working with token events
