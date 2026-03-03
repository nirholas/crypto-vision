"""
Universal Crypto MCP Plugin for AutoGPT

This plugin enables AutoGPT to interact with blockchain networks
through the Universal Crypto MCP server.

Features:
- Multi-chain balance checking
- Token security analysis
- Market data retrieval
- Gas price monitoring
- Portfolio tracking

Author: Nich
License: MIT
"""

from .plugin import CryptoMCPPlugin

__all__ = ["CryptoMCPPlugin"]
__version__ = "1.0.0"
__plugin_name__ = "Universal Crypto MCP"
