# AutoGen Integration

Guide for integrating BNB-Chain-MCP with Microsoft AutoGen for building multi-agent DeFi systems.

---

## Overview

AutoGen is a framework for building multi-agent conversational AI systems. BNB-Chain-MCP can be integrated as tools, enabling teams of specialized AI agents to collaborate on complex DeFi tasks.

---

## Installation

```bash
pip install pyautogen mcp-autogen-tools
```

---

## Quick Start

### Basic Setup

```python
import autogen
from mcp_autogen_tools import MCPToolkit

# Configuration
config_list = [
    {
        "model": "gpt-4o",
        "api_key": "your-openai-key"
    }
]

llm_config = {
    "config_list": config_list,
    "temperature": 0
}

# Initialize MCP toolkit
toolkit = MCPToolkit(
    server_command="npx",
    server_args=["-y", "@nirholas/bnb-chain-mcp@latest"],
)

# Get tools as AutoGen functions
functions = toolkit.get_autogen_functions()

# Create assistant with MCP tools
assistant = autogen.AssistantAgent(
    name="DeFi_Assistant",
    llm_config={
        **llm_config,
        "functions": functions
    },
    system_message="You are a DeFi assistant that helps users interact with blockchain networks."
)

# Create user proxy
user_proxy = autogen.UserProxyAgent(
    name="User",
    human_input_mode="NEVER",
    max_consecutive_auto_reply=10,
    is_termination_msg=lambda x: x.get("content", "").rstrip().endswith("TERMINATE"),
    code_execution_config=False,
    function_map=toolkit.get_function_map()
)

# Start conversation
user_proxy.initiate_chat(
    assistant,
    message="What's the current price of Ethereum and the total DeFi TVL?"
)
```

---

## Multi-Agent Architecture

### Specialized Agent Team

```python
import autogen
from mcp_autogen_tools import MCPToolkit

# Initialize toolkit
toolkit = MCPToolkit(
    server_command="npx",
    server_args=["-y", "@nirholas/bnb-chain-mcp@latest"],
    env={"PRIVATE_KEY": "0x..."}  # For write operations
)

# Get categorized functions
all_functions = toolkit.get_autogen_functions()

# Categorize functions by domain
market_functions = [f for f in all_functions if 'market' in f["name"] or 'price' in f["name"]]
security_functions = [f for f in all_functions if 'security' in f["name"]]
trading_functions = [f for f in all_functions if 'swap' in f["name"] or 'quote' in f["name"]]
defi_functions = [f for f in all_functions if 'defi' in f["name"] or 'lending' in f["name"] or 'staking' in f["name"]]

config_list = [{"model": "gpt-4o", "api_key": "your-key"}]
llm_config = {"config_list": config_list, "temperature": 0}

# Market Analyst Agent
market_analyst = autogen.AssistantAgent(
    name="Market_Analyst",
    llm_config={
        **llm_config,
        "functions": market_functions
    },
    system_message="""You are a cryptocurrency market analyst.
    Your role is to:
    - Analyze price trends and market conditions
    - Monitor social sentiment and news
    - Provide market insights and forecasts
    - Track DeFi metrics and TVL
    
    Be data-driven and cite your sources."""
)

# Security Auditor Agent
security_auditor = autogen.AssistantAgent(
    name="Security_Auditor",
    llm_config={
        **llm_config,
        "functions": security_functions
    },
    system_message="""You are a smart contract security auditor.
    Your role is to:
    - Analyze token contracts for vulnerabilities
    - Check for honeypots and scams
    - Assess protocol risks
    - Provide security recommendations
    
    Always prioritize user safety. Flag any concerns immediately."""
)

# Trading Specialist Agent
trading_specialist = autogen.AssistantAgent(
    name="Trading_Specialist",
    llm_config={
        **llm_config,
        "functions": trading_functions
    },
    system_message="""You are a DeFi trading specialist.
    Your role is to:
    - Find optimal swap routes
    - Minimize slippage and gas costs
    - Execute trades efficiently
    - Monitor for MEV protection
    
    Always get quotes before executing. Never trade without security clearance."""
)

# DeFi Strategist Agent
defi_strategist = autogen.AssistantAgent(
    name="DeFi_Strategist",
    llm_config={
        **llm_config,
        "functions": defi_functions
    },
    system_message="""You are a DeFi yield strategist.
    Your role is to:
    - Find yield opportunities
    - Analyze lending/borrowing rates
    - Evaluate staking options
    - Optimize portfolio allocation
    
    Consider risks and gas costs in all recommendations."""
)

# Manager Agent (coordinates the team)
manager = autogen.AssistantAgent(
    name="Manager",
    llm_config=llm_config,
    system_message="""You are the team manager coordinating DeFi operations.
    
    Your team:
    - Market_Analyst: Market data and trends
    - Security_Auditor: Contract security checks
    - Trading_Specialist: Trade execution
    - DeFi_Strategist: Yield and protocol strategies
    
    Coordinate the team to complete user requests safely and efficiently.
    Always have Security_Auditor check tokens before Trading_Specialist executes.
    Say TERMINATE when the task is complete."""
)

# User proxy with all function maps
user_proxy = autogen.UserProxyAgent(
    name="User",
    human_input_mode="NEVER",
    max_consecutive_auto_reply=20,
    is_termination_msg=lambda x: x.get("content", "").rstrip().endswith("TERMINATE"),
    code_execution_config=False,
    function_map=toolkit.get_function_map()
)
```

### Group Chat Setup

```python
# Create group chat
group_chat = autogen.GroupChat(
    agents=[user_proxy, manager, market_analyst, security_auditor, trading_specialist, defi_strategist],
    messages=[],
    max_round=30,
    speaker_selection_method="auto"  # Let the LLM decide who speaks
)

# Create group chat manager
chat_manager = autogen.GroupChatManager(
    groupchat=group_chat,
    llm_config=llm_config
)

# Start multi-agent conversation
user_proxy.initiate_chat(
    chat_manager,
    message="""I have 5000 USDC on Arbitrum. I want to:
    1. Find the best yield opportunity
    2. Verify it's safe
    3. Execute the strategy
    
    Consider risk-adjusted returns."""
)
```

---

## Agent Workflows

### Security-First Trading Workflow

```python
def security_first_trade(token_address: str, amount: str, network: str = "ethereum"):
    """Execute a trade only after security verification."""
    
    # Step 1: Security check
    security_result = user_proxy.initiate_chat(
        security_auditor,
        message=f"Perform a comprehensive security analysis of token {token_address} on {network}",
        max_turns=3
    )
    
    # Check if safe
    if "high risk" in str(security_result).lower() or "scam" in str(security_result).lower():
        return {"status": "rejected", "reason": "Security concerns detected"}
    
    # Step 2: Get quote
    quote_result = user_proxy.initiate_chat(
        trading_specialist,
        message=f"Get the best swap quote for {amount} ETH to {token_address} on {network}",
        max_turns=3
    )
    
    # Step 3: Execute if approved
    trade_result = user_proxy.initiate_chat(
        trading_specialist,
        message=f"Execute the swap: {amount} ETH to {token_address} on {network}",
        max_turns=3
    )
    
    return trade_result
```

### Portfolio Rebalancing Workflow

```python
def rebalance_portfolio(wallet_address: str, target_allocation: dict, network: str = "arbitrum"):
    """Multi-agent portfolio rebalancing."""
    
    # Create task message
    task = f"""
    Rebalance portfolio at {wallet_address} on {network}.
    
    Target allocation: {target_allocation}
    
    Steps:
    1. Market_Analyst: Get current prices for all tokens
    2. DeFi_Strategist: Analyze current portfolio and calculate required trades
    3. Security_Auditor: Verify all tokens in target allocation are safe
    4. Trading_Specialist: Execute rebalancing trades optimally
    
    Minimize gas costs and slippage.
    """
    
    result = user_proxy.initiate_chat(
        chat_manager,
        message=task
    )
    
    return result
```

---

## Advanced Patterns

### Autonomous Research Agent

```python
class AutonomousResearcher:
    """Agent that autonomously researches DeFi opportunities."""
    
    def __init__(self, toolkit: MCPToolkit):
        self.toolkit = toolkit
        self.llm_config = {
            "config_list": [{"model": "gpt-4o", "api_key": "your-key"}],
            "temperature": 0
        }
        
        # Research agent
        self.researcher = autogen.AssistantAgent(
            name="Researcher",
            llm_config={
                **self.llm_config,
                "functions": toolkit.get_autogen_functions()
            },
            system_message="""You are an autonomous DeFi researcher.
            
            Research methodology:
            1. Gather comprehensive data
            2. Analyze trends and patterns
            3. Identify opportunities and risks
            4. Provide actionable insights
            
            Be thorough and objective. Cite data sources."""
        )
        
        self.user_proxy = autogen.UserProxyAgent(
            name="Proxy",
            human_input_mode="NEVER",
            max_consecutive_auto_reply=20,
            function_map=toolkit.get_function_map()
        )
    
    def research_protocol(self, protocol: str, network: str = "ethereum"):
        """Deep dive research on a DeFi protocol."""
        return self.user_proxy.initiate_chat(
            self.researcher,
            message=f"""Perform comprehensive research on {protocol} on {network}:
            
            1. Protocol Overview
               - TVL and trend
               - Supported assets
               - Key features
            
            2. Yield Analysis
               - Current APYs
               - Historical rates
               - Comparison to competitors
            
            3. Security Assessment
               - Audit status
               - Historical incidents
               - Smart contract risks
            
            4. Market Position
               - Market share
               - User growth
               - Social sentiment
            
            5. Investment Thesis
               - Bull case
               - Bear case
               - Key risks
            
            Provide a final recommendation with confidence level."""
        )
    
    def find_alpha(self, network: str = "arbitrum", min_tvl: int = 1000000):
        """Find undervalued opportunities."""
        return self.user_proxy.initiate_chat(
            self.researcher,
            message=f"""Find alpha opportunities on {network}:
            
            Criteria:
            - Min TVL: ${min_tvl:,}
            - High APY relative to risk
            - Growing TVL trend
            - Good security score
            
            For each opportunity:
            1. Protocol and pool details
            2. Current yield
            3. Risk assessment
            4. Entry strategy
            
            Rank by risk-adjusted returns."""
        )
```

### Event-Driven Agent

```python
import asyncio
from datetime import datetime

class EventDrivenAgent:
    """Agent that reacts to market events."""
    
    def __init__(self, toolkit: MCPToolkit):
        self.toolkit = toolkit
        self.alerts = []
        self.setup_agents()
    
    def setup_agents(self):
        llm_config = {
            "config_list": [{"model": "gpt-4o", "api_key": "your-key"}],
            "temperature": 0
        }
        
        self.monitor = autogen.AssistantAgent(
            name="Monitor",
            llm_config={
                **llm_config,
                "functions": self.toolkit.get_autogen_functions()
            },
            system_message="You monitor markets and detect significant events."
        )
        
        self.responder = autogen.AssistantAgent(
            name="Responder",
            llm_config={
                **llm_config,
                "functions": self.toolkit.get_autogen_functions()
            },
            system_message="You respond to market events with appropriate actions."
        )
        
        self.user_proxy = autogen.UserProxyAgent(
            name="System",
            human_input_mode="NEVER",
            function_map=self.toolkit.get_function_map()
        )
    
    async def monitor_price(self, token: str, threshold_change: float = 5.0):
        """Monitor token price and alert on significant changes."""
        last_price = None
        
        while True:
            result = self.user_proxy.initiate_chat(
                self.monitor,
                message=f"Get current price of {token}",
                max_turns=2
            )
            
            # Parse price from result
            current_price = self.parse_price(result)
            
            if last_price:
                change = abs((current_price - last_price) / last_price * 100)
                if change >= threshold_change:
                    self.trigger_alert({
                        "type": "price_change",
                        "token": token,
                        "change": change,
                        "price": current_price,
                        "time": datetime.now()
                    })
            
            last_price = current_price
            await asyncio.sleep(60)  # Check every minute
    
    def trigger_alert(self, alert: dict):
        """Handle alert and potentially take action."""
        self.alerts.append(alert)
        
        # Auto-respond to certain alerts
        if alert["type"] == "price_change" and alert["change"] > 10:
            self.user_proxy.initiate_chat(
                self.responder,
                message=f"""ALERT: {alert['token']} price changed {alert['change']:.1f}%
                
                Analyze the situation and recommend:
                1. Is this a buying/selling opportunity?
                2. What caused the movement?
                3. Should we take any protective action?"""
            )
```

---

## Configuration Options

### Agent Configuration

```python
# Customize agent behavior
assistant = autogen.AssistantAgent(
    name="Custom_Agent",
    llm_config={
        "config_list": config_list,
        "temperature": 0,           # Deterministic for trading
        "timeout": 120,             # Longer timeout for complex operations
        "cache_seed": None,         # Disable caching for real-time data
    },
    system_message="...",
    max_consecutive_auto_reply=10   # Limit iterations
)
```

### Group Chat Configuration

```python
# Customize group chat
group_chat = autogen.GroupChat(
    agents=[...],
    messages=[],
    max_round=30,                           # Max conversation turns
    speaker_selection_method="auto",        # auto, round_robin, random
    allow_repeat_speaker=False,             # Prevent same agent twice in a row
    admin_name="Manager"                    # Designated coordinator
)
```

---

## Error Handling

```python
from autogen import Agent

class SafeUserProxy(autogen.UserProxyAgent):
    """User proxy with enhanced error handling."""
    
    def execute_function(self, func_call):
        try:
            result = super().execute_function(func_call)
            return result
        except Exception as e:
            error_msg = f"Function {func_call['name']} failed: {str(e)}"
            
            # Log error
            print(f"ERROR: {error_msg}")
            
            # Return error to agent
            return {"error": error_msg, "success": False}
    
    def _process_message(self, message, sender):
        try:
            return super()._process_message(message, sender)
        except Exception as e:
            print(f"Message processing error: {e}")
            return None

# Use safe proxy
safe_proxy = SafeUserProxy(
    name="SafeUser",
    human_input_mode="NEVER",
    function_map=toolkit.get_function_map()
)
```

---

## Complete Example: Autonomous DeFi Fund

```python
"""
Autonomous DeFi Fund Manager
Multi-agent system that manages a DeFi portfolio
"""

import autogen
from mcp_autogen_tools import MCPToolkit
from datetime import datetime
import json

class DeFiFundManager:
    """Multi-agent DeFi fund management system."""
    
    def __init__(self, private_key: str, config: dict):
        self.config = config
        self.toolkit = MCPToolkit(
            server_command="npx",
            server_args=["-y", "@nirholas/bnb-chain-mcp@latest"],
            env={"PRIVATE_KEY": private_key}
        )
        
        self.llm_config = {
            "config_list": [{"model": "gpt-4o", "api_key": config["openai_key"]}],
            "temperature": 0
        }
        
        self.setup_agents()
        self.setup_group_chat()
    
    def setup_agents(self):
        functions = self.toolkit.get_autogen_functions()
        
        # Chief Investment Officer
        self.cio = autogen.AssistantAgent(
            name="CIO",
            llm_config=self.llm_config,
            system_message="""You are the Chief Investment Officer.
            
            Responsibilities:
            - Set investment strategy
            - Approve major allocations
            - Manage risk limits
            - Coordinate team decisions
            
            Risk parameters:
            - Max single position: 20% of portfolio
            - Min diversification: 5 assets
            - Max drawdown tolerance: 15%
            """
        )
        
        # Quantitative Analyst
        self.quant = autogen.AssistantAgent(
            name="Quant_Analyst",
            llm_config={
                **self.llm_config,
                "functions": [f for f in functions if 'market' in f["name"] or 'defi' in f["name"]]
            },
            system_message="""You are a quantitative analyst.
            
            Your role:
            - Analyze market data
            - Build financial models
            - Calculate risk metrics
            - Identify statistical opportunities
            """
        )
        
        # Risk Manager
        self.risk_manager = autogen.AssistantAgent(
            name="Risk_Manager",
            llm_config={
                **self.llm_config,
                "functions": [f for f in functions if 'security' in f["name"]]
            },
            system_message="""You are the Risk Manager.
            
            Your role:
            - Assess smart contract risks
            - Monitor protocol health
            - Enforce risk limits
            - Veto dangerous operations
            
            You have VETO power. Say "VETO" if any operation is too risky.
            """
        )
        
        # Trader
        self.trader = autogen.AssistantAgent(
            name="Trader",
            llm_config={
                **self.llm_config,
                "functions": [f for f in functions if 'swap' in f["name"] or 'quote' in f["name"]]
            },
            system_message="""You are the execution trader.
            
            Your role:
            - Execute approved trades
            - Optimize for best prices
            - Minimize slippage and gas
            - Report execution quality
            
            NEVER execute without Risk_Manager approval.
            """
        )
        
        # User proxy
        self.proxy = autogen.UserProxyAgent(
            name="System",
            human_input_mode="NEVER",
            max_consecutive_auto_reply=30,
            is_termination_msg=lambda x: "TERMINATE" in x.get("content", "") or "VETO" in x.get("content", ""),
            function_map=self.toolkit.get_function_map()
        )
    
    def setup_group_chat(self):
        self.group_chat = autogen.GroupChat(
            agents=[self.proxy, self.cio, self.quant, self.risk_manager, self.trader],
            messages=[],
            max_round=40,
            speaker_selection_method="auto"
        )
        
        self.manager = autogen.GroupChatManager(
            groupchat=self.group_chat,
            llm_config=self.llm_config
        )
    
    def rebalance(self, target_allocation: dict):
        """Rebalance portfolio to target allocation."""
        task = f"""
        Execute portfolio rebalance to target allocation: {json.dumps(target_allocation)}
        
        Process:
        1. Quant_Analyst: Analyze current portfolio and calculate required trades
        2. Risk_Manager: Assess each trade for security concerns
        3. CIO: Approve the rebalancing plan
        4. Trader: Execute trades optimally
        
        Report final portfolio state when complete. Say TERMINATE when done.
        """
        
        return self.proxy.initiate_chat(self.manager, message=task)
    
    def research_opportunity(self, protocol: str):
        """Research an investment opportunity."""
        task = f"""
        Conduct due diligence on {protocol} for potential investment.
        
        Process:
        1. Quant_Analyst: Gather and analyze protocol metrics
        2. Risk_Manager: Perform security assessment
        3. CIO: Make investment decision
        
        Provide final recommendation with position size. Say TERMINATE when done.
        """
        
        return self.proxy.initiate_chat(self.manager, message=task)
    
    def emergency_exit(self, reason: str):
        """Emergency exit all positions."""
        task = f"""
        EMERGENCY: Exit all positions due to: {reason}
        
        Process:
        1. Trader: Immediately exit all positions to stablecoins
        2. Risk_Manager: Monitor execution and ensure safety
        3. CIO: Report final status
        
        Speed is priority. Say TERMINATE when complete.
        """
        
        return self.proxy.initiate_chat(self.manager, message=task)

# Usage
fund = DeFiFundManager(
    private_key="0x...",
    config={"openai_key": "..."}
)

# Rebalance portfolio
fund.rebalance({
    "ETH": 0.4,
    "WBTC": 0.3,
    "USDC": 0.2,
    "ARB": 0.1
})

# Research new opportunity
fund.research_opportunity("gmx")
```

---

## Best Practices

1. **Implement veto power** - Give security agent ability to stop operations
2. **Use specialized agents** - Each agent should have focused expertise
3. **Coordinate with manager** - Use a coordinator agent for complex workflows
4. **Handle errors gracefully** - Implement retry logic and fallbacks
5. **Log everything** - Track all agent decisions for auditing
6. **Test on testnets** - Validate workflows before mainnet

---

## Next Steps

- [Custom Clients](custom-clients.md) - Build your own MCP client
- [Building DeFi Agent Guide](../guides/building-defi-agent.md) - Complete tutorial
- [Monitoring Protocol Guide](../guides/monitoring-protocol.md) - Track protocol health
