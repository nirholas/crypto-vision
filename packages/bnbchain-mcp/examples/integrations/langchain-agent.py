#!/usr/bin/env python3
"""
LangChain Agent Integration - Integration Example

This example demonstrates how to:
- Integrate Universal Crypto MCP with LangChain
- Create a custom MCP tool wrapper
- Build an AI agent for crypto queries
- Handle conversation memory and context

Difficulty: ⭐⭐ Intermediate
Prerequisites: Python 3.9+, pip
Estimated Time: 20 minutes

Author: Nich
License: MIT
"""

import os
import json
import asyncio
import subprocess
from typing import Any, Dict, List, Optional
from dataclasses import dataclass

# LangChain imports
try:
    from langchain.agents import AgentExecutor, create_openai_functions_agent
    from langchain.memory import ConversationBufferWindowMemory
    from langchain.prompts import ChatPromptTemplate, MessagesPlaceholder
    from langchain.tools import BaseTool, StructuredTool
    from langchain_openai import ChatOpenAI
    from pydantic import BaseModel, Field
except ImportError:
    print("Please install required packages:")
    print("  pip install langchain langchain-openai pydantic")
    exit(1)

# ============================================================================
# Configuration
# ============================================================================

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-4")

# MCP Server command
MCP_COMMAND = ["npx", "-y", "@nirholas/universal-crypto-mcp@latest"]

# ============================================================================
# MCP Client Wrapper
# ============================================================================

class MCPClient:
    """Wrapper for MCP server communication via stdio."""
    
    def __init__(self):
        self.process: Optional[subprocess.Popen] = None
        self.request_id = 0
    
    async def connect(self) -> None:
        """Start the MCP server process."""
        self.process = subprocess.Popen(
            MCP_COMMAND,
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            bufsize=1
        )
        
        # Send initialization
        await self._send_request("initialize", {
            "protocolVersion": "1.0",
            "capabilities": {},
            "clientInfo": {
                "name": "langchain-agent",
                "version": "1.0.0"
            }
        })
    
    async def disconnect(self) -> None:
        """Stop the MCP server process."""
        if self.process:
            self.process.terminate()
            self.process = None
    
    async def _send_request(self, method: str, params: Dict[str, Any]) -> Dict[str, Any]:
        """Send a JSON-RPC request to the MCP server."""
        if not self.process:
            raise RuntimeError("MCP client not connected")
        
        self.request_id += 1
        request = {
            "jsonrpc": "2.0",
            "id": self.request_id,
            "method": method,
            "params": params
        }
        
        self.process.stdin.write(json.dumps(request) + "\n")
        self.process.stdin.flush()
        
        # Read response
        response_line = self.process.stdout.readline()
        if not response_line:
            raise RuntimeError("No response from MCP server")
        
        response = json.loads(response_line)
        
        if "error" in response:
            raise RuntimeError(f"MCP error: {response['error']}")
        
        return response.get("result", {})
    
    async def call_tool(self, tool_name: str, arguments: Dict[str, Any]) -> Any:
        """Call an MCP tool."""
        result = await self._send_request("tools/call", {
            "name": tool_name,
            "arguments": arguments
        })
        
        # Parse the content
        content = result.get("content", [])
        if content and content[0].get("type") == "text":
            try:
                return json.loads(content[0]["text"])
            except json.JSONDecodeError:
                return content[0]["text"]
        
        return result
    
    async def list_tools(self) -> List[Dict[str, Any]]:
        """List available MCP tools."""
        result = await self._send_request("tools/list", {})
        return result.get("tools", [])


# Global MCP client instance
mcp_client = MCPClient()


# ============================================================================
# LangChain Tool Definitions
# ============================================================================

class GetBalanceInput(BaseModel):
    """Input for get_balance tool."""
    address: str = Field(description="Ethereum address to check balance for")
    network: str = Field(default="ethereum", description="Network name (ethereum, bsc, arbitrum, etc.)")


class GetGasPriceInput(BaseModel):
    """Input for get_gas_price tool."""
    network: str = Field(default="ethereum", description="Network name")


class GetTokenInfoInput(BaseModel):
    """Input for get_token_info tool."""
    token_address: str = Field(description="Token contract address")
    network: str = Field(default="ethereum", description="Network name")


class GetMarketDataInput(BaseModel):
    """Input for get_market_data tool."""
    coin_id: str = Field(description="CoinGecko coin ID (e.g., 'bitcoin', 'ethereum')")


class SecurityCheckInput(BaseModel):
    """Input for security_check tool."""
    token_address: str = Field(description="Token contract address to check")
    network: str = Field(default="ethereum", description="Network name")


async def get_balance(address: str, network: str = "ethereum") -> str:
    """Get native token balance for an address."""
    try:
        result = await mcp_client.call_tool("get_native_balance", {
            "address": address,
            "network": network
        })
        
        if isinstance(result, dict):
            formatted = result.get("formatted", "0")
            symbol = result.get("symbol", "ETH")
            return f"Balance: {formatted} {symbol} on {network}"
        
        return str(result)
    except Exception as e:
        return f"Error getting balance: {str(e)}"


async def get_gas_price(network: str = "ethereum") -> str:
    """Get current gas prices for a network."""
    try:
        result = await mcp_client.call_tool("get_gas_price", {
            "network": network
        })
        
        if isinstance(result, dict) and "gasPrice" in result:
            gas = result["gasPrice"]
            return (
                f"Gas prices on {network}:\n"
                f"  Slow: {gas.get('slow', 'N/A')} Gwei\n"
                f"  Standard: {gas.get('standard', 'N/A')} Gwei\n"
                f"  Fast: {gas.get('fast', 'N/A')} Gwei"
            )
        
        return str(result)
    except Exception as e:
        return f"Error getting gas price: {str(e)}"


async def get_token_info(token_address: str, network: str = "ethereum") -> str:
    """Get ERC20 token information."""
    try:
        result = await mcp_client.call_tool("get_erc20_token_info", {
            "tokenAddress": token_address,
            "network": network
        })
        
        if isinstance(result, dict):
            return (
                f"Token: {result.get('name', 'Unknown')} ({result.get('symbol', '???')})\n"
                f"Decimals: {result.get('decimals', 18)}\n"
                f"Total Supply: {result.get('totalSupply', 'N/A')}\n"
                f"Address: {token_address}"
            )
        
        return str(result)
    except Exception as e:
        return f"Error getting token info: {str(e)}"


async def get_market_data(coin_id: str) -> str:
    """Get market data for a cryptocurrency."""
    try:
        result = await mcp_client.call_tool("market_get_coin_by_id", {
            "coinId": coin_id,
            "currency": "USD"
        })
        
        if isinstance(result, dict) and "coin" in result:
            coin = result["coin"]
            return (
                f"{coin.get('name', coin_id)} ({coin.get('symbol', '').upper()})\n"
                f"Price: ${coin.get('current_price', 'N/A'):,.2f}\n"
                f"24h Change: {coin.get('price_change_percentage_24h', 0):.2f}%\n"
                f"Market Cap: ${coin.get('market_cap', 0):,.0f}\n"
                f"24h Volume: ${coin.get('total_volume', 0):,.0f}"
            )
        
        return str(result)
    except Exception as e:
        return f"Error getting market data: {str(e)}"


async def security_check(token_address: str, network: str = "ethereum") -> str:
    """Check token security (honeypot, rug pull risks)."""
    try:
        result = await mcp_client.call_tool("security_check_token", {
            "tokenAddress": token_address,
            "network": network
        })
        
        if isinstance(result, dict):
            score = result.get("score", "N/A")
            risks = result.get("risks", [])
            flags = result.get("flags", {})
            
            risk_summary = "No major risks" if not risks else "\n".join([
                f"  - [{r.get('severity', 'unknown').upper()}] {r.get('type', 'Unknown')}"
                for r in risks[:5]
            ])
            
            return (
                f"Security Score: {score}/100\n"
                f"Is Honeypot: {'Yes' if flags.get('isHoneypot') else 'No'}\n"
                f"Can Mint: {'Yes' if flags.get('canMint') else 'No'}\n"
                f"Has Tax: {'Yes' if flags.get('hasTax') else 'No'}\n"
                f"Risks:\n{risk_summary}"
            )
        
        return str(result)
    except Exception as e:
        return f"Error checking security: {str(e)}"


# Create LangChain tools
def create_crypto_tools() -> List[BaseTool]:
    """Create LangChain tools for crypto operations."""
    
    return [
        StructuredTool.from_function(
            coroutine=get_balance,
            name="get_balance",
            description="Get native token balance (ETH, BNB, MATIC, etc.) for a wallet address on a specific network",
            args_schema=GetBalanceInput
        ),
        StructuredTool.from_function(
            coroutine=get_gas_price,
            name="get_gas_price",
            description="Get current gas prices (slow, standard, fast) for a blockchain network",
            args_schema=GetGasPriceInput
        ),
        StructuredTool.from_function(
            coroutine=get_token_info,
            name="get_token_info",
            description="Get information about an ERC20 token (name, symbol, decimals, supply)",
            args_schema=GetTokenInfoInput
        ),
        StructuredTool.from_function(
            coroutine=get_market_data,
            name="get_market_data",
            description="Get market data for a cryptocurrency including price, market cap, and 24h change. Use CoinGecko IDs like 'bitcoin', 'ethereum', 'binancecoin'",
            args_schema=GetMarketDataInput
        ),
        StructuredTool.from_function(
            coroutine=security_check,
            name="security_check",
            description="Check a token for security risks like honeypots, rug pulls, and malicious code",
            args_schema=SecurityCheckInput
        )
    ]


# ============================================================================
# Agent Setup
# ============================================================================

SYSTEM_PROMPT = """You are a helpful cryptocurrency assistant powered by the Universal Crypto MCP server. 
You can help users with:
- Checking wallet balances across multiple blockchains
- Getting current gas prices
- Looking up token information
- Fetching market data and prices
- Checking token security (honeypots, rug pulls)

When users ask about crypto-related topics, use the available tools to get real-time data.
Always be helpful, accurate, and warn users about potential risks.

Supported networks: Ethereum, BNB Smart Chain (BSC), Arbitrum, Polygon, Optimism, Base, Avalanche.

For market data, use CoinGecko IDs like:
- 'bitcoin' for BTC
- 'ethereum' for ETH
- 'binancecoin' for BNB
- 'matic-network' for MATIC
- 'arbitrum' for ARB
"""


async def create_agent() -> AgentExecutor:
    """Create the LangChain agent with crypto tools."""
    
    if not OPENAI_API_KEY:
        raise ValueError("OPENAI_API_KEY environment variable is required")
    
    # Initialize LLM
    llm = ChatOpenAI(
        model=OPENAI_MODEL,
        temperature=0,
        openai_api_key=OPENAI_API_KEY
    )
    
    # Create tools
    tools = create_crypto_tools()
    
    # Create prompt
    prompt = ChatPromptTemplate.from_messages([
        ("system", SYSTEM_PROMPT),
        MessagesPlaceholder(variable_name="chat_history", optional=True),
        ("human", "{input}"),
        MessagesPlaceholder(variable_name="agent_scratchpad")
    ])
    
    # Create agent
    agent = create_openai_functions_agent(llm, tools, prompt)
    
    # Create memory
    memory = ConversationBufferWindowMemory(
        memory_key="chat_history",
        return_messages=True,
        k=10  # Keep last 10 exchanges
    )
    
    # Create executor
    return AgentExecutor(
        agent=agent,
        tools=tools,
        memory=memory,
        verbose=True,
        handle_parsing_errors=True
    )


# ============================================================================
# Main Execution
# ============================================================================

async def main():
    """Main entry point."""
    
    print("=" * 60)
    print("🤖 LangChain Crypto Agent")
    print("=" * 60)
    print()
    
    # Check for API key
    if not OPENAI_API_KEY:
        print("❌ Error: OPENAI_API_KEY environment variable is required")
        print("   Set it with: export OPENAI_API_KEY=your-key-here")
        return
    
    print("Connecting to MCP server...")
    await mcp_client.connect()
    print("✓ Connected to Universal Crypto MCP")
    print()
    
    print("Creating LangChain agent...")
    agent = await create_agent()
    print("✓ Agent ready")
    print()
    
    print("Example queries:")
    print("  - What's the ETH price?")
    print("  - Check balance of 0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045")
    print("  - What are the gas prices on Arbitrum?")
    print("  - Is this token safe: 0x... on BSC")
    print()
    print("Type 'quit' or 'exit' to stop")
    print("-" * 60)
    
    try:
        while True:
            user_input = input("\n👤 You: ").strip()
            
            if not user_input:
                continue
            
            if user_input.lower() in ["quit", "exit", "q"]:
                print("\nGoodbye! 👋")
                break
            
            try:
                result = await agent.ainvoke({"input": user_input})
                print(f"\n🤖 Agent: {result['output']}")
            except Exception as e:
                print(f"\n❌ Error: {str(e)}")
    
    finally:
        await mcp_client.disconnect()
        print("Disconnected from MCP server")


if __name__ == "__main__":
    asyncio.run(main())


# ============================================================================
# Usage Examples
# ============================================================================

"""
Usage:

1. Install dependencies:
   pip install langchain langchain-openai pydantic

2. Set environment variables:
   export OPENAI_API_KEY=your-openai-api-key
   export OPENAI_MODEL=gpt-4  # optional, defaults to gpt-4

3. Run the agent:
   python langchain-agent.py

Example conversations:

User: What's the current ETH price?
Agent: *uses get_market_data tool*
       Ethereum (ETH)
       Price: $3,245.67
       24h Change: +2.45%
       Market Cap: $390,123,456,789

User: Check if this token is safe: 0x1234...abcd on BSC
Agent: *uses security_check tool*
       Security Score: 85/100
       Is Honeypot: No
       Can Mint: No
       Has Tax: Yes (2%)
       Risks:
       - [MEDIUM] Pausable contract
       
       This token appears relatively safe but has some minor concerns...

User: What are gas prices on Arbitrum right now?
Agent: *uses get_gas_price tool*
       Gas prices on arbitrum:
       Slow: 0.01 Gwei
       Standard: 0.02 Gwei
       Fast: 0.05 Gwei
       
       Gas is very cheap on Arbitrum right now!
"""
