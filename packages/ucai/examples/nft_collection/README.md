# NFT Collection Example

Generate an MCP server for an ERC721 NFT collection.

## Quick Start

```bash
./generate.sh
```

## Available Tools

| Tool | Type | Description |
|------|------|-------------|
| `name` | Read | Collection name |
| `symbol` | Read | Collection symbol |
| `balance_of` | Read | NFTs owned by address |
| `owner_of` | Read | Owner of specific token |
| `token_uri` | Read | Metadata URI for token |
| `get_approved` | Read | Approved operator for token |
| `is_approved_for_all` | Read | Check operator approval |
| `approve` | Write | Approve operator for token |
| `set_approval_for_all` | Write | Approve operator for all |
| `transfer_from` | Write | Transfer NFT |
| `safe_transfer_from` | Write | Safe transfer with data |

## Events

| Event | Description |
|-------|-------------|
| `Transfer` | NFT transferred |
| `Approval` | Single token approval |
| `ApprovalForAll` | Operator approval |
