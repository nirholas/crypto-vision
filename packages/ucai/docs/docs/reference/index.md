---
title: Reference
description: Reference tables and lookup information
---

# Reference

Quick reference tables and lookup information.

## Reference Materials

<div class="grid cards" markdown>

-   :material-web:{ .lg .middle } __Networks__

    ---

    Supported networks, chain IDs, RPC endpoints, and explorer APIs.

    [:octicons-arrow-right-24: Networks](networks.md)

-   :material-table:{ .lg .middle } __Type Table__

    ---

    Complete Solidity to JSON Schema type mapping reference.

    [:octicons-arrow-right-24: Type Table](type-table.md)

-   :material-certificate:{ .lg .middle } __ERC Standards__

    ---

    Detected ERC standards and their required functions.

    [:octicons-arrow-right-24: ERC Standards](erc-standards.md)

-   :material-alert-circle:{ .lg .middle } __Errors__

    ---

    Error codes, messages, and troubleshooting.

    [:octicons-arrow-right-24: Errors](errors.md)

</div>

## Quick Lookup

### Common Type Mappings

| Solidity | JSON Schema Type | Pattern |
|----------|-----------------|---------|
| `address` | `string` | `^0x[a-fA-F0-9]{40}$` |
| `uint256` | `string` | `^[0-9]+$` |
| `bool` | `boolean` | - |
| `bytes32` | `string` | `^0x[a-fA-F0-9]{64}$` |
| `string` | `string` | - |

### Common Networks

| Network | Chain ID | CLI Flag |
|---------|----------|----------|
| Ethereum | 1 | `--network mainnet` |
| Polygon | 137 | `--network polygon` |
| Arbitrum | 42161 | `--network arbitrum` |
| Base | 8453 | `--network base` |

### ERC Detection

| Standard | Key Functions |
|----------|---------------|
| ERC20 | `transfer`, `balanceOf`, `totalSupply` |
| ERC721 | `ownerOf`, `safeTransferFrom` |
| ERC1155 | `balanceOfBatch`, `safeBatchTransferFrom` |
