---
title: Installation
description: Install UCAI (abi-to-mcp) on your system
---

# Installation

This guide covers all methods of installing UCAI on your system.

## Requirements

- **Python 3.10+** - Required
- **pip** or **pipx** - Python package installer

### Checking Python Version

```bash
python --version
# or
python3 --version
```

You should see `Python 3.10.x` or higher.

## Installation Methods

### Using pip (Recommended)

The simplest way to install abi-to-mcp:

```bash
pip install abi-to-mcp
```

This installs the package and the `abi-to-mcp` command globally.

### Using pipx (Isolated)

If you want to keep abi-to-mcp isolated from other Python packages:

```bash
# Install pipx first if you don't have it
pip install pipx
pipx ensurepath

# Install abi-to-mcp
pipx install abi-to-mcp
```

This creates an isolated environment specifically for abi-to-mcp.

### From Source (Development)

For contributors or those who want the latest unreleased features:

```bash
# Clone the repository
git clone https://github.com/nirholas/UCAI.git
cd UCAI

# Create a virtual environment (recommended)
python -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate

# Install in editable mode with development dependencies
pip install -e ".[dev]"
```

## Verifying Installation

After installation, verify that abi-to-mcp is working:

```bash
abi-to-mcp --version
```

You should see output like:

```
abi-to-mcp version 1.0.0
```

Try the help command to see all available options:

```bash
abi-to-mcp --help
```

## API Keys (Optional but Recommended)

### Etherscan API Key

When fetching ABIs from block explorers, having an API key gives you:

- Higher rate limits (5 requests/second vs 1 request/5 seconds)
- More reliable fetching
- Access to additional contract metadata

Get free API keys from:

| Explorer | Get Key |
|----------|---------|
| Etherscan | [etherscan.io/apis](https://etherscan.io/apis) |
| Polygonscan | [polygonscan.com/apis](https://polygonscan.com/apis) |
| Arbiscan | [arbiscan.io/apis](https://arbiscan.io/apis) |
| Basescan | [basescan.org/apis](https://basescan.org/apis) |

Set the key as an environment variable:

=== "Linux/macOS"

    ```bash
    export ETHERSCAN_API_KEY=your-key-here
    
    # Add to ~/.bashrc or ~/.zshrc for persistence
    echo 'export ETHERSCAN_API_KEY=your-key-here' >> ~/.bashrc
    ```

=== "Windows (PowerShell)"

    ```powershell
    $env:ETHERSCAN_API_KEY = "your-key-here"
    
    # For persistence, add to your PowerShell profile
    ```

=== "Windows (CMD)"

    ```cmd
    set ETHERSCAN_API_KEY=your-key-here
    
    # For persistence, use System Properties > Environment Variables
    ```

### RPC Endpoints

Generated servers need an RPC endpoint to connect to the blockchain. Free options include:

| Provider | Networks | Limits |
|----------|----------|--------|
| [LlamaNodes](https://llamanodes.com) | Many | Generous free tier |
| [Alchemy](https://alchemy.com) | Many | 300M compute units/month |
| [Infura](https://infura.io) | Many | 100K requests/day |
| [QuickNode](https://quicknode.com) | Many | Limited free tier |

Public RPC endpoints (rate-limited but no signup required):

| Network | Public RPC |
|---------|------------|
| Ethereum | `https://eth.llamarpc.com` |
| Polygon | `https://polygon-rpc.com` |
| Arbitrum | `https://arb1.arbitrum.io/rpc` |
| Optimism | `https://mainnet.optimism.io` |
| Base | `https://mainnet.base.org` |

## Troubleshooting

### Command Not Found

If `abi-to-mcp` is not found after installation:

1. **Check your PATH**: Ensure Python's bin directory is in your PATH
   ```bash
   python -m abi_to_mcp --version
   ```

2. **Restart your terminal**: Some shells need to be restarted to pick up new commands

3. **Check installation location**:
   ```bash
   pip show abi-to-mcp
   ```

### Permission Errors

If you get permission errors during installation:

```bash
# Use --user flag
pip install --user abi-to-mcp

# Or use a virtual environment (recommended)
python -m venv .venv
source .venv/bin/activate
pip install abi-to-mcp
```

### SSL Certificate Errors

If you encounter SSL errors:

```bash
pip install --trusted-host pypi.org --trusted-host files.pythonhosted.org abi-to-mcp
```

## Updating

To update to the latest version:

```bash
pip install --upgrade abi-to-mcp
```

## Uninstalling

To remove abi-to-mcp:

```bash
pip uninstall abi-to-mcp
```

## Next Steps

Now that you have abi-to-mcp installed, continue to the [Quickstart](quickstart.md) to generate your first MCP server.
