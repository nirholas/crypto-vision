"""CLI entry point for abi-to-mcp.

This module allows running the package as a module:
    python -m abi_to_mcp [command] [options]
"""

from abi_to_mcp.cli.main import main

if __name__ == "__main__":
    main()
