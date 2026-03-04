#!/usr/bin/env python3
"""
x402 Payment Example for Crypto Data Aggregator API

This example shows how to make authenticated requests using the x402 protocol.
x402 enables pay-per-request access using USDC on Base network.

Requirements:
    pip install requests eth-account

Learn more: https://x402.org
"""

import json
import base64
import time
import requests
from typing import Optional, Dict, Any

# API configuration
API_BASE = "https://free-crypto-news.vercel.app"

# For demo purposes - in production, use environment variables
# from eth_account import Account
# wallet = Account.from_key(os.environ['PRIVATE_KEY'])


def get_payment_requirements(endpoint: str) -> Optional[Dict[str, Any]]:
    """
    Get x402 payment requirements for an endpoint.
    
    Args:
        endpoint: API endpoint path
    
    Returns:
        Payment requirements dict or None if no payment required
    """
    response = requests.get(f"{API_BASE}{endpoint}")
    
    if response.status_code == 402:
        # Parse payment requirements from header
        payment_header = response.headers.get('X-PAYMENT-REQUIRED')
        if payment_header:
            decoded = base64.b64decode(payment_header).decode('utf-8')
            return json.loads(decoded)
    
    return None


def create_payment_signature(requirements: Dict[str, Any], wallet_address: str) -> str:
    """
    Create a signed payment authorization.
    
    This is a simplified example - in production, use the x402 SDK
    or implement proper EIP-712 signing.
    
    Args:
        requirements: Payment requirements from 402 response
        wallet_address: Your wallet address
    
    Returns:
        Base64-encoded payment header
    """
    # Get the first accepted payment method
    accept = requirements['accepts'][0]
    
    payment_payload = {
        "x402Version": 2,
        "scheme": accept['scheme'],
        "network": accept['network'],
        "payload": {
            "signature": "0x...",  # EIP-712 signature
            "authorization": {
                "from": wallet_address,
                "to": accept['payTo'],
                "asset": accept['asset'],
                "amount": accept['amount'],
                "nonce": str(int(time.time() * 1000)),
                "validAfter": int(time.time()) - 60,
                "validBefore": int(time.time()) + 300,  # 5 minutes
            }
        }
    }
    
    # In production, sign the authorization with eth_account:
    # from eth_account.messages import encode_structured_data
    # signature = wallet.sign_message(encode_structured_data(domain, types, message))
    
    return base64.b64encode(json.dumps(payment_payload).encode()).decode()


def make_paid_request(endpoint: str, wallet_address: str) -> Dict[str, Any]:
    """
    Make a paid request using x402.
    
    Args:
        endpoint: API endpoint path
        wallet_address: Your wallet address
    
    Returns:
        API response data
    """
    # Step 1: Get payment requirements
    requirements = get_payment_requirements(endpoint)
    
    if not requirements:
        # No payment required - just fetch
        response = requests.get(f"{API_BASE}{endpoint}")
        return response.json()
    
    print(f"Payment required:")
    print(f"  Amount: {requirements['accepts'][0]['amount']} (smallest unit)")
    print(f"  Network: {requirements['accepts'][0]['network']}")
    print(f"  Asset: {requirements['accepts'][0]['asset']}")
    
    # Step 2: Create payment signature
    payment_header = create_payment_signature(requirements, wallet_address)
    
    # Step 3: Make request with payment
    response = requests.get(
        f"{API_BASE}{endpoint}",
        headers={"X-PAYMENT": payment_header}
    )
    
    if response.status_code == 200:
        return response.json()
    else:
        raise Exception(f"Payment failed: {response.status_code} - {response.text}")


def demo_with_api_key():
    """
    Demo using API key authentication (simpler alternative to x402).
    """
    import os
    
    api_key = os.environ.get('CRYPTO_NEWS_API_KEY')
    if not api_key:
        print("Set CRYPTO_NEWS_API_KEY environment variable")
        print("Get your free key at: https://free-crypto-news.vercel.app/developers")
        return
    
    # Make authenticated request
    response = requests.get(
        f"{API_BASE}/api/v1/coins",
        headers={"X-API-Key": api_key},
        params={"per_page": 5}
    )
    
    if response.status_code == 200:
        data = response.json()
        print("\nTop 5 coins:")
        for coin in data['data'][:5]:
            print(f"  {coin['name']}: ${coin['current_price']:,.2f}")
        
        # Check rate limits
        remaining = response.headers.get('X-RateLimit-Remaining')
        limit = response.headers.get('X-RateLimit-Limit')
        print(f"\nRate limit: {remaining}/{limit} requests remaining")
    else:
        print(f"Error: {response.status_code}")
        print(response.json())


if __name__ == "__main__":
    print("=" * 60)
    print("Crypto Data Aggregator - x402 Payment Demo")
    print("=" * 60)
    
    # Demo 1: Check payment requirements
    print("\n1. Checking payment requirements for /api/v1/coins...")
    requirements = get_payment_requirements("/api/v1/coins")
    
    if requirements:
        print("   Payment required:")
        accept = requirements['accepts'][0]
        # Amount is in smallest unit (USDC has 6 decimals)
        amount_usd = int(accept['amount']) / 1_000_000
        print(f"   - Amount: ${amount_usd}")
        print(f"   - Network: {accept['network']}")
        print(f"   - Pay to: {accept['payTo']}")
    else:
        print("   No payment required (you may have a valid API key)")
    
    # Demo 2: Use API key (simpler)
    print("\n2. Demo with API key (if available)...")
    demo_with_api_key()
    
    print("\n" + "=" * 60)
    print("For full x402 implementation, see:")
    print("  - https://x402.org")
    print("  - https://github.com/coinbase/x402")
    print("=" * 60)
