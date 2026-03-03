# Examples

This directory contains example configurations and ABIs for using UCAI (`abi-to-mcp`).

## Quick Start Examples

| Example | Description |
|---------|-------------|
| [erc20_token](./erc20_token/) | Generate MCP server for USDC token |
| [nft_collection](./nft_collection/) | Generate MCP server for an NFT collection |
| [defi_protocol](./defi_protocol/) | Generate MCP server for a DEX router |
| [custom_contract](./custom_contract/) | Use your own contract ABI |
| [claude_desktop](./claude_desktop/) | Configure Claude Desktop integration |

## Running Examples

Each example directory contains:
- `README.md` - Detailed instructions
- `*.json` - ABI file(s)
- `generate.sh` - Script to generate the MCP server

### Prerequisites

```bash
pip install abi-to-mcp
```

### Generate an Example Server

```bash
cd examples/erc20_token
./generate.sh
```

This creates an MCP server in `./output/` that you can run with:

```bash
cd output
pip install -r requirements.txt
echo "RPC_URL=https://eth.llamarpc.com" > .env
python server.py
```
