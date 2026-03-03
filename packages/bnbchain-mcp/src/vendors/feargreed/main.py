"""
@author Nich
@website x.com/nichxbt
@github github.com/nirholas
@license MIT
"""
from mcp.server.fastmcp import FastMCP, Context
import httpx
import asyncio
from typing import Dict, List
from datetime import datetime

# Initialize the MCP server
mcp = FastMCP("CryptoFearGreed", dependencies=["httpx"])

# API endpoint for Crypto Fear & Greed Index
API_URL = "https://api.alternative.me/fng/"

# Resource to get current Fear & Greed Index
@mcp.resource("fng://current")
async def get_current_fng() -> str:
    """Get the current Crypto Fear & Greed Index"""
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(API_URL, params={"limit": 1})
            response.raise_for_status()
            data = response.json()["data"][0]
            timestamp = datetime.fromtimestamp(int(data["timestamp"]))
            return (
                f"Crypto Fear & Greed Index (as of {timestamp} UTC):\n"
                f"Value: {data['value']}\n"
                f"Classification: {data['value_classification']}"
            )
    except httpx.HTTPStatusError as e:
        return f"Error fetching current FNG: {str(e)}"
    except Exception as e:
        return f"Unexpected error: {str(e)}"

# Resource to get historical Fear & Greed Index
@mcp.resource("fng://history/{days}")
async def get_historical_fng(days: str) -> str:
    """Get historical Crypto Fear & Greed Index for specified number of days"""
    try:
        days_int = int(days)
        if days_int <= 0:
            raise ValueError("Days must be a positive integer")
        
        async with httpx.AsyncClient() as client:
            response = await client.get(API_URL, params={"limit": days_int})
            response.raise_for_status()
            data = response.json()["data"]
            
            result = ["Historical Crypto Fear & Greed Index:"]
            for entry in reversed(data):  # Latest first
                timestamp = datetime.fromtimestamp(int(entry["timestamp"]))
                result.append(
                    f"{timestamp} UTC: {entry['value']} ({entry['value_classification']})"
                )
            return "\n".join(result)
    except ValueError as e:
        return f"Error: {str(e)}"
    except httpx.HTTPStatusError as e:
        return f"Error fetching historical FNG: {str(e)}"
    except Exception as e:
        return f"Unexpected error: {str(e)}"

# Tool version of get_current_fng
@mcp.tool()
async def get_current_fng_tool(ctx: Context) -> str:
    """Get the current Crypto Fear & Greed Index as a tool."""
    ctx.info("Fetching current Fear & Greed Index")
    return await get_current_fng()

# Tool version of get_historical_fng
@mcp.tool()
async def get_historical_fng_tool(days: int, ctx: Context) -> str:
    """
    Get historical Fear & Greed Index for specified number of days as a tool.

    Parameters:
        days (int): Number of days to retrieve (must be a positive integer).

    Returns:
        str: Historical Fear & Greed Index values for the specified period.
    """
    ctx.info(f"Fetching historical Fear & Greed Index for {days} days")
    return await get_historical_fng(str(days))

# Tool to analyze trends in the Fear & Greed Index
@mcp.tool()
async def analyze_fng_trend(days: int, ctx: Context) -> str:
    """
    Analyze trends in Crypto Fear & Greed Index over specified days.

    Parameters:
        days (int): Number of days to analyze (must be a positive integer).

    Returns:
        str: A string containing the analysis results, including latest value,
             average value, trend direction, and number of data points analyzed.
    """
    if days <= 0:
        return "Error: Days must be a positive integer"
    
    ctx.info(f"Fetching {days} days of FNG data")
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(API_URL, params={"limit": days})
            response.raise_for_status()
            data = response.json()["data"]
            
            if not data:
                return "Error: No data available"
                
            values = [int(entry["value"]) for entry in data]
            total_entries = len(values)
            
            # Calculate statistics
            avg = sum(values) / total_entries
            trend = "rising" if values[0] > values[-1] else "falling" if values[0] < values[-1] else "stable"
            latest = data[0]  # Most recent entry            
            
            result = [
                f"Fear & Greed Index Analysis ({days} days):",
                f"Latest Value: {latest['value']} ({latest['value_classification']}) "
                f"at {datetime.fromtimestamp(int(latest['timestamp']))} UTC",
                f"Average Value: {avg:.1f}",
                f"Trend: {trend}",
                f"Data points analyzed: {total_entries}"
            ]
            return "\n".join(result)
    except httpx.HTTPStatusError as e:
        return f"Error fetching data: {str(e)}"
    except Exception as e:
        return f"Unexpected error: {str(e)}"

# Prompt for interpreting the index
@mcp.prompt()
def interpret_fng(value: str) -> str:
    """Generate an interpretation of a Fear & Greed Index value"""
    return (
        f"Please interpret this Crypto Fear & Greed Index value and explain what it means "
        f"for cryptocurrency markets (specifically Bitcoin):\n\n{value}"
    )

# Run the server
if __name__ == "__main__":
    mcp.run()