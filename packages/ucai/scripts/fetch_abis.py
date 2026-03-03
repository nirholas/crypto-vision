#!/usr/bin/env python3
"""Fetch real-world ABIs for testing.

Usage:
    python scripts/fetch_abis.py
"""

import asyncio
import json
from pathlib import Path

# Try to import httpx, provide helpful error if not installed
try:
    import httpx
except ImportError:
    print("httpx required: pip install httpx")
    exit(1)


CONTRACTS = {
    "uniswap_v3_router": {
        "address": "0xE592427A0AEce92De3Edee1F18E0157C05861564",
        "network": "mainnet",
    },
    "aave_v3_pool": {
        "address": "0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2",
        "network": "mainnet",
    },
}

ETHERSCAN_API = "https://api.etherscan.io/api"
OUTPUT_DIR = Path(__file__).parent.parent / "tests" / "fixtures" / "abis"


async def fetch_abi(name: str, address: str, network: str) -> dict | None:
    """Fetch ABI from Etherscan."""
    print(f"Fetching {name} ({address})...")
    
    async with httpx.AsyncClient() as client:
        response = await client.get(
            ETHERSCAN_API,
            params={
                "module": "contract",
                "action": "getabi",
                "address": address,
            },
        )
        
        data = response.json()
        
        if data["status"] == "1":
            return json.loads(data["result"])
        else:
            print(f"  Error: {data.get('message', 'Unknown error')}")
            return None


async def main():
    """Fetch all ABIs."""
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    
    for name, info in CONTRACTS.items():
        abi = await fetch_abi(name, info["address"], info["network"])
        
        if abi:
            output_path = OUTPUT_DIR / f"{name}.json"
            with open(output_path, "w") as f:
                json.dump(abi, f, indent=2)
            print(f"  ✓ Saved to {output_path}")
        
        # Rate limiting
        await asyncio.sleep(0.5)
    
    print("")
    print("Done!")


if __name__ == "__main__":
    asyncio.run(main())
