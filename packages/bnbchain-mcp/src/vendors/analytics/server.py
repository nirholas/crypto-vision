"""
@author Nich
@website x.com/nichxbt
@github github.com/nirholas
@license MIT
"""
import asyncio
import logging
import os
from typing import Any
from urllib.parse import urljoin

import httpx
from dotenv import load_dotenv
from mcp.server import FastMCP

load_dotenv()

logger = logging.getLogger("universal-crypto-mcp")
logger.setLevel(logging.INFO)

# add console handler
console_handler = logging.StreamHandler()
formatter = logging.Formatter(
    "%(asctime)s - %(name)s:%(lineno)s - %(levelname)s - %(message)s"
)
console_handler.setFormatter(formatter)
logger.addHandler(console_handler)

# add file handler
# file_handler = logging.FileHandler("./data/universal-crypto-mcp.log")
# file_handler.setFormatter(formatter)
# logger.addHandler(file_handler)

# Add more detailed logging
logger.info("FastMCP server initialized with name: Universal Crypto")

# Initialize FastMCP server
mcp = FastMCP("Universal Crypto")

# Constants
BICSCAN_API_BASE = "https://api.universal-crypto.io"
BICSCAN_API_KEY = os.getenv("BICSCAN_API_KEY")


async def post_request(
    endpoint: str, data: dict[str, Any] | None = None
) -> dict[str, Any] | None:
    """Make a request to Universal Crypto API with proper error handling."""
    headers = {
        "User-Agent": "universal-crypto-mcp/1.0",
        "Accept": "application/json",
        "X-Api-Key": BICSCAN_API_KEY,
    }
    url = urljoin(BICSCAN_API_BASE, endpoint)

    async with httpx.AsyncClient() as client:
        try:
            logger.info(f"Making request to {url}")
            logger.debug(f"{headers=} {data=}")
            response = await client.post(url, headers=headers, json=data, timeout=30)
            response.raise_for_status()
            logger.info(f"Received response: {response.status_code}")
            return response.json()
        except httpx.HTTPStatusError as http_err:
            logger.error(f"Received response: {http_err}, {response.text}")
            return response.json()
        except Exception as e:
            logger.exception(f"Received response: {e}, {response.text}")
            return {}


@mcp.tool()
async def get_risk_score(address: str) -> dict:
    """Get Risk Score for Crypto, Domain Name, ENS, CNS, KNS or even Hostname Address

    Args:
        address: EOA, CA, ENS, CNS, KNS or even HostName
    Returns:
        Dict: where summary.universal-crypto_score is from 0 to 100. 100 is high risk.
    """

    logger.info(f"Getting risk score for address: {address}")
    endpoint = "/v1/scan"
    data = {
        "query": address,
        "sync": True,
        "assets": False,
    }

    return await post_request(endpoint, data=data)


@mcp.tool()
async def get_assets(address: str) -> dict:
    """Get Assets holdings by CryptoAddress

    Args:
        address: EOA, CA, ENS, CNS, KNS.
    Returns:
        Dict: where assets is a list of assets
    """

    logger.info(f"Getting assets for address: {address}")
    endpoint = "/v1/scan"
    data = {
        "query": address,
        "sync": True,
        "assets": True,
        "engines": ["ofac"],
    }

    return await post_request(endpoint, data=data)


async def main() -> None:
    """Run the MCP Universal Crypto server."""
    # Import here to avoid issues with event loops
    await mcp.run_stdio_async()


if __name__ == "__main__":
    asyncio.run(main())
