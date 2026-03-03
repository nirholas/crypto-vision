"""
Universal Crypto MCP Plugin for AutoGPT

This plugin provides AutoGPT with cryptocurrency capabilities through
the Universal Crypto MCP server.

Author: Nich
License: MIT
"""

import os
import json
import asyncio
import subprocess
from typing import Any, Dict, List, Optional, Tuple
from dataclasses import dataclass


# ============================================================================
# Configuration
# ============================================================================

@dataclass
class PluginConfig:
    """Plugin configuration."""
    transport: str = "stdio"  # stdio or http
    server_url: str = "http://localhost:3000"
    timeout: int = 30000
    mcp_command: List[str] = None
    
    def __post_init__(self):
        if self.mcp_command is None:
            self.mcp_command = ["npx", "-y", "@nirholas/universal-crypto-mcp@latest"]


# Load config from environment
config = PluginConfig(
    transport=os.getenv("MCP_TRANSPORT", "stdio"),
    server_url=os.getenv("MCP_SERVER_URL", "http://localhost:3000"),
    timeout=int(os.getenv("MCP_TIMEOUT", "30000"))
)


# ============================================================================
# MCP Client
# ============================================================================

class MCPClient:
    """Client for communicating with the MCP server."""
    
    def __init__(self, config: PluginConfig):
        self.config = config
        self.process: Optional[subprocess.Popen] = None
        self.request_id = 0
        self._connected = False
    
    async def connect(self) -> bool:
        """Connect to the MCP server."""
        if self._connected:
            return True
        
        try:
            if self.config.transport == "stdio":
                self.process = subprocess.Popen(
                    self.config.mcp_command,
                    stdin=subprocess.PIPE,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE,
                    text=True,
                    bufsize=1
                )
                
                # Initialize connection
                await self._send_request("initialize", {
                    "protocolVersion": "1.0",
                    "capabilities": {},
                    "clientInfo": {
                        "name": "autogpt-plugin",
                        "version": "1.0.0"
                    }
                })
            
            self._connected = True
            return True
            
        except Exception as e:
            print(f"[CryptoMCP] Connection failed: {e}")
            return False
    
    async def disconnect(self) -> None:
        """Disconnect from the MCP server."""
        if self.process:
            self.process.terminate()
            self.process = None
        self._connected = False
    
    async def _send_request(self, method: str, params: Dict[str, Any]) -> Dict[str, Any]:
        """Send a JSON-RPC request."""
        if not self.process:
            raise RuntimeError("Not connected to MCP server")
        
        self.request_id += 1
        request = {
            "jsonrpc": "2.0",
            "id": self.request_id,
            "method": method,
            "params": params
        }
        
        self.process.stdin.write(json.dumps(request) + "\n")
        self.process.stdin.flush()
        
        response_line = self.process.stdout.readline()
        if not response_line:
            raise RuntimeError("No response from MCP server")
        
        response = json.loads(response_line)
        
        if "error" in response:
            raise RuntimeError(f"MCP error: {response['error']}")
        
        return response.get("result", {})
    
    async def call_tool(self, name: str, arguments: Dict[str, Any]) -> Any:
        """Call an MCP tool."""
        if not self._connected:
            await self.connect()
        
        result = await self._send_request("tools/call", {
            "name": name,
            "arguments": arguments
        })
        
        content = result.get("content", [])
        if content and content[0].get("type") == "text":
            try:
                return json.loads(content[0]["text"])
            except json.JSONDecodeError:
                return content[0]["text"]
        
        return result


# Global client instance
_mcp_client: Optional[MCPClient] = None


def get_client() -> MCPClient:
    """Get or create the MCP client."""
    global _mcp_client
    if _mcp_client is None:
        _mcp_client = MCPClient(config)
    return _mcp_client


# ============================================================================
# Plugin Class
# ============================================================================

class CryptoMCPPlugin:
    """
    Universal Crypto MCP Plugin for AutoGPT.
    
    Provides cryptocurrency capabilities including:
    - Balance checking across networks
    - Token security analysis
    - Market data retrieval
    - Gas price monitoring
    """
    
    def __init__(self):
        self._name = "Universal Crypto MCP"
        self._version = "1.0.0"
        self._description = "Interact with 50+ blockchain networks"
    
    # ========================================================================
    # Plugin Metadata
    # ========================================================================
    
    @staticmethod
    def get_name() -> str:
        return "Universal Crypto MCP"
    
    @staticmethod
    def get_version() -> str:
        return "1.0.0"
    
    @staticmethod
    def get_commands() -> List[Dict[str, Any]]:
        """Return available commands for AutoGPT."""
        return [
            {
                "name": "crypto_get_balance",
                "description": "Get native token balance for a wallet address",
                "parameters": {
                    "address": {"type": "string", "required": True},
                    "network": {"type": "string", "default": "ethereum"}
                }
            },
            {
                "name": "crypto_get_token_balance",
                "description": "Get ERC20 token balance for a wallet",
                "parameters": {
                    "token_address": {"type": "string", "required": True},
                    "wallet_address": {"type": "string", "required": True},
                    "network": {"type": "string", "default": "ethereum"}
                }
            },
            {
                "name": "crypto_get_portfolio",
                "description": "Get multi-chain portfolio for a wallet",
                "parameters": {
                    "address": {"type": "string", "required": True}
                }
            },
            {
                "name": "crypto_security_check",
                "description": "Check a token for security risks",
                "parameters": {
                    "token_address": {"type": "string", "required": True},
                    "network": {"type": "string", "default": "ethereum"}
                }
            },
            {
                "name": "crypto_honeypot_check",
                "description": "Check if a token is a honeypot",
                "parameters": {
                    "token_address": {"type": "string", "required": True},
                    "network": {"type": "string", "default": "ethereum"}
                }
            },
            {
                "name": "crypto_get_price",
                "description": "Get current price for a cryptocurrency",
                "parameters": {
                    "coin_id": {"type": "string", "required": True}
                }
            },
            {
                "name": "crypto_get_market_data",
                "description": "Get full market data for a cryptocurrency",
                "parameters": {
                    "coin_id": {"type": "string", "required": True}
                }
            },
            {
                "name": "crypto_get_trending",
                "description": "Get trending cryptocurrencies",
                "parameters": {}
            },
            {
                "name": "crypto_get_gas",
                "description": "Get current gas prices for a network",
                "parameters": {
                    "network": {"type": "string", "default": "ethereum"}
                }
            },
            {
                "name": "crypto_compare_gas",
                "description": "Compare gas prices across networks",
                "parameters": {}
            }
        ]
    
    # ========================================================================
    # Balance Commands
    # ========================================================================
    
    @staticmethod
    async def crypto_get_balance(address: str, network: str = "ethereum") -> str:
        """Get native token balance for a wallet address."""
        try:
            client = get_client()
            result = await client.call_tool("get_native_balance", {
                "address": address,
                "network": network
            })
            
            if isinstance(result, dict):
                formatted = result.get("formatted", "0")
                symbol = result.get("symbol", "ETH")
                return f"Balance: {formatted} {symbol}"
            
            return str(result)
        except Exception as e:
            return f"Error: {str(e)}"
    
    @staticmethod
    async def crypto_get_token_balance(
        token_address: str,
        wallet_address: str,
        network: str = "ethereum"
    ) -> str:
        """Get ERC20 token balance for a wallet."""
        try:
            client = get_client()
            result = await client.call_tool("get_erc20_balance", {
                "tokenAddress": token_address,
                "address": wallet_address,
                "network": network
            })
            
            if isinstance(result, dict):
                formatted = result.get("formatted", "0")
                symbol = result.get("symbol", "TOKEN")
                return f"Balance: {formatted} {symbol}"
            
            return str(result)
        except Exception as e:
            return f"Error: {str(e)}"
    
    @staticmethod
    async def crypto_get_portfolio(address: str) -> str:
        """Get multi-chain portfolio for a wallet."""
        try:
            client = get_client()
            networks = ["ethereum", "bsc", "arbitrum", "polygon", "optimism", "base"]
            portfolio = []
            
            for network in networks:
                try:
                    result = await client.call_tool("get_native_balance", {
                        "address": address,
                        "network": network
                    })
                    if isinstance(result, dict):
                        formatted = result.get("formatted", "0")
                        symbol = result.get("symbol", "???")
                        if float(formatted) > 0:
                            portfolio.append(f"{network}: {formatted} {symbol}")
                except:
                    pass
            
            if not portfolio:
                return "No balances found across supported networks"
            
            return "Portfolio:\n" + "\n".join(portfolio)
        except Exception as e:
            return f"Error: {str(e)}"
    
    # ========================================================================
    # Security Commands
    # ========================================================================
    
    @staticmethod
    async def crypto_security_check(token_address: str, network: str = "ethereum") -> str:
        """Check a token for security risks."""
        try:
            client = get_client()
            result = await client.call_tool("security_check_token", {
                "tokenAddress": token_address,
                "network": network
            })
            
            if isinstance(result, dict):
                score = result.get("score", "N/A")
                risks = result.get("risks", [])
                flags = result.get("flags", {})
                
                output = [f"Security Score: {score}/100"]
                
                # Add flags
                if flags:
                    if flags.get("isHoneypot"):
                        output.append("⚠️ HONEYPOT DETECTED")
                    if flags.get("canMint"):
                        output.append("⚠️ Owner can mint tokens")
                    if flags.get("hasTax") and flags.get("taxPercent"):
                        output.append(f"⚠️ Trading tax: {flags['taxPercent']}%")
                
                # Add top risks
                if risks:
                    output.append("\nRisks:")
                    for risk in risks[:5]:
                        severity = risk.get("severity", "unknown").upper()
                        msg = risk.get("message", risk.get("type", "Unknown"))
                        output.append(f"  [{severity}] {msg}")
                
                return "\n".join(output)
            
            return str(result)
        except Exception as e:
            return f"Error: {str(e)}"
    
    @staticmethod
    async def crypto_honeypot_check(token_address: str, network: str = "ethereum") -> str:
        """Check if a token is a honeypot."""
        try:
            client = get_client()
            result = await client.call_tool("security_honeypot_check", {
                "tokenAddress": token_address,
                "network": network
            })
            
            if isinstance(result, dict):
                is_honeypot = result.get("isHoneypot", False)
                reason = result.get("reason", "")
                
                if is_honeypot:
                    return f"⚠️ HONEYPOT: Yes\nReason: {reason}"
                else:
                    return "✅ Not a honeypot"
            
            return str(result)
        except Exception as e:
            return f"Error: {str(e)}"
    
    # ========================================================================
    # Market Commands
    # ========================================================================
    
    @staticmethod
    async def crypto_get_price(coin_id: str) -> str:
        """Get current price for a cryptocurrency."""
        try:
            client = get_client()
            result = await client.call_tool("market_get_coin_by_id", {
                "coinId": coin_id,
                "currency": "USD"
            })
            
            if isinstance(result, dict) and "coin" in result:
                coin = result["coin"]
                price = coin.get("current_price", 0)
                change = coin.get("price_change_percentage_24h", 0)
                
                arrow = "📈" if change >= 0 else "📉"
                return f"{coin.get('name', coin_id)}: ${price:,.2f} {arrow} {change:+.2f}%"
            
            return str(result)
        except Exception as e:
            return f"Error: {str(e)}"
    
    @staticmethod
    async def crypto_get_market_data(coin_id: str) -> str:
        """Get full market data for a cryptocurrency."""
        try:
            client = get_client()
            result = await client.call_tool("market_get_coin_by_id", {
                "coinId": coin_id,
                "currency": "USD"
            })
            
            if isinstance(result, dict) and "coin" in result:
                c = result["coin"]
                return (
                    f"{c.get('name', coin_id)} ({c.get('symbol', '').upper()})\n"
                    f"Price: ${c.get('current_price', 0):,.2f}\n"
                    f"24h Change: {c.get('price_change_percentage_24h', 0):+.2f}%\n"
                    f"Market Cap: ${c.get('market_cap', 0):,.0f}\n"
                    f"24h Volume: ${c.get('total_volume', 0):,.0f}\n"
                    f"Market Cap Rank: #{c.get('market_cap_rank', 'N/A')}"
                )
            
            return str(result)
        except Exception as e:
            return f"Error: {str(e)}"
    
    @staticmethod
    async def crypto_get_trending() -> str:
        """Get trending cryptocurrencies."""
        try:
            client = get_client()
            result = await client.call_tool("market_get_trending", {})
            
            if isinstance(result, dict) and "coins" in result:
                coins = result["coins"][:10]
                lines = ["Trending Coins:"]
                
                for i, coin in enumerate(coins, 1):
                    item = coin.get("item", coin)
                    name = item.get("name", "Unknown")
                    symbol = item.get("symbol", "???")
                    rank = item.get("market_cap_rank", "N/A")
                    lines.append(f"{i}. {name} ({symbol}) - Rank #{rank}")
                
                return "\n".join(lines)
            
            return str(result)
        except Exception as e:
            return f"Error: {str(e)}"
    
    # ========================================================================
    # Gas Commands
    # ========================================================================
    
    @staticmethod
    async def crypto_get_gas(network: str = "ethereum") -> str:
        """Get current gas prices for a network."""
        try:
            client = get_client()
            result = await client.call_tool("get_gas_price", {
                "network": network
            })
            
            if isinstance(result, dict) and "gasPrice" in result:
                gas = result["gasPrice"]
                return (
                    f"Gas on {network}:\n"
                    f"  Slow: {gas.get('slow', 'N/A')} Gwei\n"
                    f"  Standard: {gas.get('standard', 'N/A')} Gwei\n"
                    f"  Fast: {gas.get('fast', 'N/A')} Gwei"
                )
            
            return str(result)
        except Exception as e:
            return f"Error: {str(e)}"
    
    @staticmethod
    async def crypto_compare_gas() -> str:
        """Compare gas prices across networks."""
        try:
            client = get_client()
            networks = ["ethereum", "bsc", "arbitrum", "polygon", "optimism", "base"]
            results = []
            
            for network in networks:
                try:
                    result = await client.call_tool("get_gas_price", {
                        "network": network
                    })
                    if isinstance(result, dict) and "gasPrice" in result:
                        gas = result["gasPrice"]
                        std = gas.get("standard", "N/A")
                        results.append(f"{network}: {std} Gwei")
                except:
                    pass
            
            if not results:
                return "Could not fetch gas prices"
            
            return "Gas Comparison:\n" + "\n".join(results)
        except Exception as e:
            return f"Error: {str(e)}"
    
    # ========================================================================
    # Lifecycle
    # ========================================================================
    
    @staticmethod
    async def on_load() -> None:
        """Called when the plugin is loaded."""
        print("[CryptoMCP] Plugin loaded")
        client = get_client()
        await client.connect()
        print("[CryptoMCP] Connected to MCP server")
    
    @staticmethod
    async def on_unload() -> None:
        """Called when the plugin is unloaded."""
        client = get_client()
        await client.disconnect()
        print("[CryptoMCP] Plugin unloaded")


# ============================================================================
# Synchronous Wrappers (for AutoGPT compatibility)
# ============================================================================

def _run_async(coro):
    """Run an async coroutine synchronously."""
    try:
        loop = asyncio.get_event_loop()
    except RuntimeError:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
    
    return loop.run_until_complete(coro)


# Create sync versions of all commands
crypto_get_balance = lambda *args, **kwargs: _run_async(
    CryptoMCPPlugin.crypto_get_balance(*args, **kwargs)
)
crypto_get_token_balance = lambda *args, **kwargs: _run_async(
    CryptoMCPPlugin.crypto_get_token_balance(*args, **kwargs)
)
crypto_get_portfolio = lambda *args, **kwargs: _run_async(
    CryptoMCPPlugin.crypto_get_portfolio(*args, **kwargs)
)
crypto_security_check = lambda *args, **kwargs: _run_async(
    CryptoMCPPlugin.crypto_security_check(*args, **kwargs)
)
crypto_honeypot_check = lambda *args, **kwargs: _run_async(
    CryptoMCPPlugin.crypto_honeypot_check(*args, **kwargs)
)
crypto_get_price = lambda *args, **kwargs: _run_async(
    CryptoMCPPlugin.crypto_get_price(*args, **kwargs)
)
crypto_get_market_data = lambda *args, **kwargs: _run_async(
    CryptoMCPPlugin.crypto_get_market_data(*args, **kwargs)
)
crypto_get_trending = lambda *args, **kwargs: _run_async(
    CryptoMCPPlugin.crypto_get_trending(*args, **kwargs)
)
crypto_get_gas = lambda *args, **kwargs: _run_async(
    CryptoMCPPlugin.crypto_get_gas(*args, **kwargs)
)
crypto_compare_gas = lambda *args, **kwargs: _run_async(
    CryptoMCPPlugin.crypto_compare_gas(*args, **kwargs)
)
