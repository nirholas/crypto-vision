#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "Generating Custom Contract MCP Server..."

abi-to-mcp generate "$SCRIPT_DIR/my_contract.json" \
  --address 0x0000000000000000000000000000000000000001 \
  --network mainnet \
  --name "My Custom Contract" \
  --output "$SCRIPT_DIR/output"

echo ""
echo "✓ Server generated in $SCRIPT_DIR/output"
echo ""
echo "NOTE: Update the address in generate.sh with your actual contract address"
