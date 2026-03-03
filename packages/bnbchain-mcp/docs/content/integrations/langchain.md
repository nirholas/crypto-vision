# LangChain Integration

Guide for integrating BNB-Chain-MCP with LangChain for building AI-powered DeFi applications.

---

## Overview

LangChain is a popular framework for building applications with large language models. BNB-Chain-MCP can be integrated as a toolkit, enabling LangChain agents to interact with blockchain networks.

---

## Installation

```bash
pip install langchain langchain-openai mcp-langchain-tools
```

---

## Quick Start

### Basic Setup

```python
from langchain_openai import ChatOpenAI
from langchain.agents import create_tool_calling_agent, AgentExecutor
from langchain_core.prompts import ChatPromptTemplate
from mcp_langchain_tools import MCPToolkit

# Initialize MCP connection
toolkit = MCPToolkit(
    server_command="npx",
    server_args=["-y", "@nirholas/bnb-chain-mcp@latest"],
    env={
        "PRIVATE_KEY": "0x...",  # Optional for write operations
    }
)

# Get tools from MCP server
tools = toolkit.get_tools()

# Initialize LLM
llm = ChatOpenAI(model="gpt-4o", temperature=0)

# Create prompt
prompt = ChatPromptTemplate.from_messages([
    ("system", "You are a helpful DeFi assistant that can interact with blockchain networks."),
    ("human", "{input}"),
    ("placeholder", "{agent_scratchpad}"),
])

# Create agent
agent = create_tool_calling_agent(llm, tools, prompt)
executor = AgentExecutor(agent=agent, tools=tools, verbose=True)

# Run
result = executor.invoke({
    "input": "What's the current price of Ethereum?"
})
print(result["output"])
```

---

## Advanced Configuration

### Custom Tool Selection

```python
from mcp_langchain_tools import MCPToolkit

toolkit = MCPToolkit(
    server_command="npx",
    server_args=["-y", "@nirholas/bnb-chain-mcp@latest"],
)

# Get all tools
all_tools = toolkit.get_tools()

# Filter for specific categories
defi_tools = [t for t in all_tools if t.name.startswith(('swap_', 'lending_', 'staking_'))]
market_tools = [t for t in all_tools if t.name.startswith('market_')]
security_tools = [t for t in all_tools if t.name.startswith('security_')]

# Create specialized agents
defi_agent = create_tool_calling_agent(llm, defi_tools, prompt)
market_agent = create_tool_calling_agent(llm, market_tools, prompt)
```

### HTTP Mode Connection

```python
from mcp_langchain_tools import MCPToolkit

# Connect to HTTP server
toolkit = MCPToolkit(
    server_url="http://localhost:3001/mcp",
    # Or remote server
    # server_url="https://your-server.com/mcp",
)

tools = toolkit.get_tools()
```

---

## Building a DeFi Agent

### Portfolio Manager Agent

```python
from langchain_openai import ChatOpenAI
from langchain.agents import create_tool_calling_agent, AgentExecutor
from langchain_core.prompts import ChatPromptTemplate
from langchain.memory import ConversationBufferMemory
from mcp_langchain_tools import MCPToolkit

# Setup
toolkit = MCPToolkit(
    server_command="npx",
    server_args=["-y", "@nirholas/bnb-chain-mcp@latest"],
    env={"PRIVATE_KEY": "0x..."}
)

tools = toolkit.get_tools()
llm = ChatOpenAI(model="gpt-4o", temperature=0)
memory = ConversationBufferMemory(memory_key="chat_history", return_messages=True)

# Portfolio-focused prompt
prompt = ChatPromptTemplate.from_messages([
    ("system", """You are a DeFi portfolio manager assistant. You help users:
    - Track their portfolio across multiple chains
    - Analyze yield opportunities
    - Execute swaps and liquidity operations
    - Assess security risks
    
    Always check token security before recommending any interactions.
    Consider gas costs and slippage in your recommendations.
    """),
    ("placeholder", "{chat_history}"),
    ("human", "{input}"),
    ("placeholder", "{agent_scratchpad}"),
])

# Create agent with memory
agent = create_tool_calling_agent(llm, tools, prompt)
executor = AgentExecutor(
    agent=agent,
    tools=tools,
    memory=memory,
    verbose=True,
    max_iterations=10
)

# Example conversation
responses = []
queries = [
    "What's my portfolio value on Arbitrum?",
    "Find me the best yield opportunities for USDC",
    "Is it safe to invest in this token: 0x...",
    "Swap 100 USDC for ETH with minimal slippage"
]

for query in queries:
    result = executor.invoke({"input": query})
    responses.append(result["output"])
    print(f"Q: {query}")
    print(f"A: {result['output']}\n")
```

### Market Analysis Agent

```python
from langchain.agents import create_tool_calling_agent, AgentExecutor
from langchain_core.prompts import ChatPromptTemplate

# Market analysis prompt
market_prompt = ChatPromptTemplate.from_messages([
    ("system", """You are a cryptocurrency market analyst. Your role is to:
    - Provide market insights and trends
    - Analyze price movements and correlations
    - Monitor social sentiment
    - Track DeFi TVL and protocol metrics
    
    Always cite your data sources and timestamps.
    Be objective and avoid financial advice.
    """),
    ("human", "{input}"),
    ("placeholder", "{agent_scratchpad}"),
])

# Filter market-related tools
market_tools = [t for t in tools if any(prefix in t.name for prefix in [
    'market_', 'defi_', 'social_', 'news_'
])]

market_agent = create_tool_calling_agent(llm, market_tools, market_prompt)
market_executor = AgentExecutor(agent=market_agent, tools=market_tools, verbose=True)

# Analyze market
result = market_executor.invoke({
    "input": "Give me a comprehensive market overview including BTC/ETH prices, DeFi TVL trends, and current market sentiment"
})
```

---

## Tool Wrapping

### Custom Tool Wrapper

```python
from langchain.tools import BaseTool
from typing import Type, Optional
from pydantic import BaseModel, Field
import json

class SwapQuoteInput(BaseModel):
    """Input for swap quote tool."""
    token_in: str = Field(description="Input token symbol or address")
    token_out: str = Field(description="Output token symbol or address")
    amount_in: str = Field(description="Amount to swap")
    network: str = Field(default="ethereum", description="Network to use")

class EnhancedSwapQuoteTool(BaseTool):
    """Enhanced swap quote tool with validation and formatting."""
    name: str = "get_swap_quote"
    description: str = "Get a quote for swapping tokens with price impact analysis"
    args_schema: Type[BaseModel] = SwapQuoteInput
    
    mcp_tool: any  # Original MCP tool
    
    def _run(self, token_in: str, token_out: str, amount_in: str, network: str = "ethereum") -> str:
        # Validate inputs
        if float(amount_in) <= 0:
            return "Error: Amount must be positive"
        
        # Call MCP tool
        result = self.mcp_tool.invoke({
            "tokenIn": token_in,
            "tokenOut": token_out,
            "amountIn": amount_in,
            "network": network
        })
        
        # Parse and enhance response
        data = json.loads(result)
        
        # Add recommendations
        price_impact = float(data.get("priceImpact", "0").replace("%", ""))
        if price_impact > 5:
            data["warning"] = "High price impact! Consider splitting into smaller trades."
        
        return json.dumps(data, indent=2)

# Use enhanced tool
original_swap_tool = next(t for t in tools if t.name == "swap_get_quote")
enhanced_tool = EnhancedSwapQuoteTool(mcp_tool=original_swap_tool)
```

---

## Chains and Pipelines

### Sequential Analysis Chain

```python
from langchain_core.runnables import RunnableSequence
from langchain_core.output_parsers import StrOutputParser

# Define analysis steps
security_check = ChatPromptTemplate.from_template(
    "Check if this token is safe: {token_address}"
) | llm.bind_tools([security_tool]) | StrOutputParser()

price_analysis = ChatPromptTemplate.from_template(
    "Analyze the price and market data for: {token_address}"
) | llm.bind_tools([market_tool]) | StrOutputParser()

recommendation = ChatPromptTemplate.from_template(
    """Based on:
    Security: {security_result}
    Market: {market_result}
    
    Provide an investment recommendation."""
) | llm | StrOutputParser()

# Chain together
def analyze_token(token_address: str):
    security_result = security_check.invoke({"token_address": token_address})
    market_result = price_analysis.invoke({"token_address": token_address})
    final = recommendation.invoke({
        "security_result": security_result,
        "market_result": market_result
    })
    return final
```

### Parallel Execution

```python
from langchain_core.runnables import RunnableParallel

# Execute multiple analyses in parallel
parallel_analysis = RunnableParallel(
    eth_price=market_tool.bind(coinId="ethereum"),
    btc_price=market_tool.bind(coinId="bitcoin"),
    fear_greed=fear_greed_tool,
    defi_tvl=defi_tvl_tool
)

# Get all data at once
results = parallel_analysis.invoke({})
```

---

## Error Handling

```python
from langchain.callbacks.base import BaseCallbackHandler
from typing import Any, Dict

class ErrorHandlingCallback(BaseCallbackHandler):
    """Callback for handling tool errors."""
    
    def on_tool_error(self, error: Exception, **kwargs: Any) -> None:
        tool_name = kwargs.get("tool_name", "unknown")
        print(f"Tool error in {tool_name}: {error}")
        
        # Implement retry logic or fallback
        if "rate limit" in str(error).lower():
            print("Rate limited - waiting 60s...")
            import time
            time.sleep(60)

# Use callback
executor = AgentExecutor(
    agent=agent,
    tools=tools,
    callbacks=[ErrorHandlingCallback()],
    handle_parsing_errors=True,
    max_iterations=5
)
```

---

## Streaming Responses

```python
from langchain.callbacks.streaming_stdout import StreamingStdOutCallbackHandler

# Create streaming executor
streaming_executor = AgentExecutor(
    agent=agent,
    tools=tools,
    callbacks=[StreamingStdOutCallbackHandler()],
    verbose=True
)

# Stream response
for chunk in streaming_executor.stream({"input": "Analyze the DeFi market"}):
    if "output" in chunk:
        print(chunk["output"], end="", flush=True)
```

---

## Complete Example: DeFi Yield Optimizer

```python
"""
DeFi Yield Optimizer Agent
Finds and executes optimal yield strategies
"""

from langchain_openai import ChatOpenAI
from langchain.agents import create_tool_calling_agent, AgentExecutor
from langchain_core.prompts import ChatPromptTemplate
from langchain.memory import ConversationBufferWindowMemory
from mcp_langchain_tools import MCPToolkit
import json

class YieldOptimizer:
    def __init__(self, private_key: str = None):
        # Initialize MCP
        env = {"PRIVATE_KEY": private_key} if private_key else {}
        self.toolkit = MCPToolkit(
            server_command="npx",
            server_args=["-y", "@nirholas/bnb-chain-mcp@latest"],
            env=env
        )
        
        self.tools = self.toolkit.get_tools()
        self.llm = ChatOpenAI(model="gpt-4o", temperature=0)
        self.memory = ConversationBufferWindowMemory(
            memory_key="chat_history",
            return_messages=True,
            k=10
        )
        
        self.prompt = ChatPromptTemplate.from_messages([
            ("system", """You are a DeFi yield optimization specialist.
            
            Your goals:
            1. Find the highest sustainable yields
            2. Assess and minimize risks
            3. Optimize for gas efficiency
            4. Diversify across protocols
            
            Always:
            - Check protocol security before recommending
            - Consider impermanent loss for LP positions
            - Factor in gas costs vs returns
            - Warn about smart contract risks
            """),
            ("placeholder", "{chat_history}"),
            ("human", "{input}"),
            ("placeholder", "{agent_scratchpad}"),
        ])
        
        agent = create_tool_calling_agent(self.llm, self.tools, self.prompt)
        self.executor = AgentExecutor(
            agent=agent,
            tools=self.tools,
            memory=self.memory,
            verbose=True,
            max_iterations=15
        )
    
    def find_opportunities(self, token: str, amount: str, network: str = "arbitrum"):
        """Find yield opportunities for a specific token."""
        return self.executor.invoke({
            "input": f"""Find the best yield opportunities for {amount} {token} on {network}.
            
            Consider:
            1. Lending protocols (Aave, Compound)
            2. Liquidity pools
            3. Staking options
            4. Yield aggregators
            
            For each option, provide:
            - Expected APY
            - Risk level
            - Lock-up period
            - Gas cost to enter
            """
        })
    
    def analyze_risk(self, protocol: str, network: str = "ethereum"):
        """Analyze risks of a DeFi protocol."""
        return self.executor.invoke({
            "input": f"""Perform a comprehensive risk analysis of {protocol} on {network}.
            
            Check:
            1. Smart contract security
            2. TVL and trend
            3. Historical incidents
            4. Audit status
            5. Team/governance
            """
        })
    
    def execute_strategy(self, strategy: str):
        """Execute a yield strategy."""
        return self.executor.invoke({
            "input": f"Execute this yield strategy: {strategy}"
        })

# Usage
optimizer = YieldOptimizer(private_key="0x...")

# Find opportunities
result = optimizer.find_opportunities("USDC", "10000", "arbitrum")
print(result["output"])

# Analyze risk
risk = optimizer.analyze_risk("aave", "arbitrum")
print(risk["output"])
```

---

## Best Practices

1. **Filter tools** - Only include tools your agent needs
2. **Use memory** - Maintain conversation context
3. **Handle errors** - Implement retries and fallbacks
4. **Validate inputs** - Check parameters before tool calls
5. **Monitor costs** - Track LLM token usage
6. **Test thoroughly** - Use testnets for transaction tests

---

## Next Steps

- [AutoGen Integration](autogen.md) - Multi-agent systems
- [Custom Clients](custom-clients.md) - Build your own MCP client
- [Building DeFi Agent Guide](../guides/building-defi-agent.md) - Complete tutorial
