#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "Generating NFT Collection MCP Server..."

abi-to-mcp generate "$SCRIPT_DIR/erc721_abi.json" \
  --address 0xBC4CA0EdA7647A8aB7C2061c2E118A18a936f13D \
  --network mainnet \
  --name "NFT Collection" \
  --output "$SCRIPT_DIR/output"

echo ""
echo "✓ Server generated in $SCRIPT_DIR/output"
echo ""
echo "Next steps:"
echo "  cd $SCRIPT_DIR/output"
echo "  pip install -r requirements.txt"
echo "  echo 'RPC_URL=https://eth.llamarpc.com' > .env"
echo "  python server.py"
