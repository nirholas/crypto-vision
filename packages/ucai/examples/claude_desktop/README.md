# Claude Desktop Integration

Configure Claude Desktop to use your generated MCP servers.

## Configuration File Location

| OS | Path |
|----|------|
| macOS | `~/Library/Application Support/Claude/claude_desktop_config.json` |
| Windows | `%APPDATA%\Claude\claude_desktop_config.json` |
| Linux | `~/.config/Claude/claude_desktop_config.json` |

## Example Configuration

See `config_example.json` for a complete example with multiple servers.

## Setup Steps

1. Generate your MCP server:
   ```bash
   abi-to-mcp generate 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48 \
     --network mainnet \
     --output ~/mcp-servers/usdc
   ```

2. Install dependencies:
   ```bash
   cd ~/mcp-servers/usdc
   pip install -r requirements.txt
   ```

3. Create `.env` file:
   ```bash
   echo "RPC_URL=https://eth.llamarpc.com" > .env
   ```

4. Add to Claude Desktop config (see `config_example.json`)

5. Restart Claude Desktop

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `RPC_URL` | Yes | Ethereum RPC endpoint |
| `PRIVATE_KEY` | No | For write operations only |
| `ETHERSCAN_API_KEY` | No | For fetching ABIs |
