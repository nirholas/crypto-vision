#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "Generating USDC Token MCP Server..."

abi-to-mcp generate "$SCRIPT_DIR/usdc_abi.json" \
  --address 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48 \
  --network mainnet \
  --name "USDC Token" \
  --output "$SCRIPT_DIR/output"

echo ""
echo "✓ Server generated in $SCRIPT_DIR/output"
echo ""
echo "Next steps:"
echo "  cd $SCRIPT_DIR/output"
echo "  pip install -r requirements.txt"
echo "  echo 'RPC_URL=https://eth.llamarpc.com' > .env"
echo "  python server.py"
