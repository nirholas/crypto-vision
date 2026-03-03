# Custom Contract Example

Use your own contract ABI with abi-to-mcp.

## Getting Your ABI

### From Etherscan

If your contract is verified on Etherscan:

```bash
# Replace with your contract address
abi-to-mcp generate 0xYourContractAddress \
  --network mainnet \
  --output ./my-server
```

### From Compilation

If you have the ABI from compilation (Hardhat, Foundry, etc.):

1. Save the ABI array to `my_contract.json`
2. Run:

```bash
abi-to-mcp generate my_contract.json \
  --address 0xYourContractAddress \
  --network mainnet \
  --output ./my-server
```

## Example Custom ABI

See `my_contract.json` for an example custom contract ABI with:
- View and write functions
- Multiple return types
- Events with indexed fields
