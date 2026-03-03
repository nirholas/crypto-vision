#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "Generating DeFi Router MCP Server..."

abi-to-mcp generate "$SCRIPT_DIR/router_abi.json" \
  --address 0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D \
  --network mainnet \
  --name "DEX Router" \
  --output "$SCRIPT_DIR/output"

echo ""
echo "✓ Server generated in $SCRIPT_DIR/output"
echo ""
echo "Next steps:"
echo "  cd $SCRIPT_DIR/output"
echo "  pip install -r requirements.txt"
echo "  echo 'RPC_URL=https://eth.llamarpc.com' > .env"
echo "  python server.py"
echo ""
echo "⚠️  WARNING: DeFi operations involve financial risk!"
echo "    Always test on testnets first."
