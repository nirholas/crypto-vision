"""Etherscan fetcher module.

This module provides the EtherscanFetcher class for fetching ABIs from
Etherscan-compatible block explorers.
"""

import os
import re
import json
from typing import Optional, Dict, Any

import httpx

from abi_to_mcp.fetchers.base import ABIFetcher
from abi_to_mcp.core.models import FetchResult
from abi_to_mcp.core.constants import NETWORKS
from abi_to_mcp.core.exceptions import (
    ABINotFoundError,
    ContractNotVerifiedError,
    NetworkError,
    RateLimitError,
    InvalidAddressError,
)


class EtherscanFetcher(ABIFetcher):
    """
    Fetcher for ABIs from Etherscan-compatible APIs.

    Supports:
    - Ethereum Mainnet & testnets (Etherscan)
    - Polygon (Polygonscan)
    - Arbitrum (Arbiscan)
    - Optimism (Optimistic Etherscan)
    - Base (Basescan)
    - BSC (BscScan)
    - Avalanche (Snowtrace)

    Features:
    - Automatic proxy detection
    - Rate limit handling
    - API key management
    """

    ADDRESS_PATTERN = re.compile(r"^0x[a-fA-F0-9]{40}$")

    # EIP-1967 implementation slot
    IMPLEMENTATION_SLOT = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc"

    def __init__(self, api_key: Optional[str] = None):
        """
        Initialize with optional API key.

        If no key provided, will check environment variables:
        - ETHERSCAN_API_KEY
        - Network-specific: POLYGONSCAN_API_KEY, etc.
        """
        self._api_key = api_key
        self._client: Optional[httpx.AsyncClient] = None

    async def fetch(
        self,
        source: str,
        network: str = "mainnet",
        **kwargs,
    ) -> FetchResult:
        """
        Fetch ABI from Etherscan API.

        Args:
            source: Contract address (0x...)
            network: Network name from NETWORKS

        Returns:
            FetchResult with ABI data

        Raises:
            ABINotFoundError: If contract not found
            ContractNotVerifiedError: If source code not verified
            NetworkError: If API request fails
            RateLimitError: If rate limit exceeded
        """
        # Validate address
        if not self.ADDRESS_PATTERN.match(source):
            raise InvalidAddressError(source)

        address = source.lower()

        # Get network config
        if network not in NETWORKS:
            raise ValueError(f"Unknown network: {network}. Supported: {list(NETWORKS.keys())}")

        net_config = NETWORKS[network]
        api_url = net_config["etherscan_api"]
        api_key = self._get_api_key(network)

        # Fetch ABI
        abi_data = await self._fetch_abi(api_url, address, api_key, network)

        if abi_data is None:
            raise ContractNotVerifiedError(address, network)

        # Check for proxy
        is_proxy = False
        implementation_address = None

        if kwargs.get("detect_proxy", True):
            impl = await self._detect_proxy(address, network, api_url, api_key)
            if impl:
                is_proxy = True
                implementation_address = impl
                # Fetch implementation ABI instead
                impl_abi = await self._fetch_abi(api_url, impl, api_key, network)
                if impl_abi:
                    abi_data = impl_abi

        return FetchResult(
            abi=json.loads(abi_data),
            source="etherscan",
            source_location=address,
            is_proxy=is_proxy,
            implementation_address=implementation_address,
        )

    def can_handle(self, source: str) -> bool:
        """Check if source is an Ethereum address."""
        return bool(self.ADDRESS_PATTERN.match(source))

    def _get_api_key(self, network: str) -> Optional[str]:
        """Get API key for network."""
        if self._api_key:
            return self._api_key

        # Network-specific env vars
        env_map = {
            "mainnet": "ETHERSCAN_API_KEY",
            "sepolia": "ETHERSCAN_API_KEY",
            "goerli": "ETHERSCAN_API_KEY",
            "polygon": "POLYGONSCAN_API_KEY",
            "arbitrum": "ARBISCAN_API_KEY",
            "optimism": "OPTIMISM_API_KEY",
            "base": "BASESCAN_API_KEY",
            "bsc": "BSCSCAN_API_KEY",
            "avalanche": "SNOWTRACE_API_KEY",
        }

        env_var = env_map.get(network, "ETHERSCAN_API_KEY")
        return os.environ.get(env_var)

    async def _fetch_abi(
        self,
        api_url: str,
        address: str,
        api_key: Optional[str],
        network: str = "mainnet",
    ) -> Optional[str]:
        """
        Fetch ABI from Etherscan API.

        Args:
            api_url: Etherscan API base URL
            address: Contract address
            api_key: API key (optional)
            network: Network name for error messages

        Returns:
            ABI as JSON string, or None if not verified

        Raises:
            RateLimitError: If rate limited
            NetworkError: If request fails
        """
        params = {
            "module": "contract",
            "action": "getabi",
            "address": address,
        }
        if api_key:
            params["apikey"] = api_key

        async with httpx.AsyncClient() as client:
            try:
                response = await client.get(api_url, params=params, timeout=30.0)
                response.raise_for_status()
            except httpx.HTTPStatusError as e:
                if e.response.status_code == 429:
                    raise RateLimitError("Etherscan", retry_after=60) from e
                raise NetworkError(
                    f"HTTP error fetching ABI: {e}", url=api_url, status_code=e.response.status_code
                ) from e
            except httpx.TimeoutException as e:
                raise NetworkError(f"Timeout fetching ABI from {network}", url=api_url) from e
            except httpx.RequestError as e:
                raise NetworkError(f"Request failed: {e}", url=api_url) from e

            data = response.json()

            if data.get("status") == "1":
                return data.get("result")

            # Check for specific errors
            result = data.get("result", "")

            if "not verified" in result.lower() or "source code not verified" in result.lower():
                return None

            # Other error
            return None

    async def _detect_proxy(
        self,
        address: str,
        network: str,
        api_url: str,
        api_key: Optional[str],
    ) -> Optional[str]:
        """
        Detect if address is a proxy and return implementation.

        Checks for common proxy patterns:
        - EIP-1967 storage slots
        - EIP-1822 (UUPS)
        - OpenZeppelin TransparentProxy
        - Minimal proxy (EIP-1167)

        Args:
            address: Proxy contract address
            network: Network name
            api_url: Etherscan API base URL
            api_key: API key

        Returns:
            Implementation address if proxy, None otherwise
        """
        # Try EIP-1967 implementation slot using Etherscan proxy API
        impl = await self._get_storage_at(api_url, address, self.IMPLEMENTATION_SLOT, api_key)
        if impl and impl != "0x" + "0" * 64 and len(impl) >= 42:
            # Extract address from bytes32 (last 20 bytes = 40 hex chars)
            impl_addr = "0x" + impl[-40:]
            if self._is_valid_address(impl_addr) and impl_addr != "0x" + "0" * 40:
                return impl_addr

        # Try calling implementation() function
        impl = await self._call_implementation_function(api_url, address, api_key)
        if impl:
            return impl

        # Try detecting EIP-1167 minimal proxy from bytecode
        impl = await self._detect_minimal_proxy(api_url, address, api_key)
        if impl:
            return impl

        return None

    async def _get_storage_at(
        self, api_url: str, address: str, slot: str, api_key: Optional[str]
    ) -> Optional[str]:
        """Get storage value at specific slot using Etherscan proxy API."""
        params = {
            "module": "proxy",
            "action": "eth_getStorageAt",
            "address": address,
            "position": slot,
            "tag": "latest",
        }
        if api_key:
            params["apikey"] = api_key

        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(api_url, params=params, timeout=10.0)
                data = response.json()
                if data.get("result"):
                    return data["result"]
        except Exception:
            pass

        return None

    async def _call_implementation_function(
        self, api_url: str, address: str, api_key: Optional[str]
    ) -> Optional[str]:
        """Call implementation() function to get implementation address."""
        # Function selector for implementation(): 0x5c60da1b
        params = {
            "module": "proxy",
            "action": "eth_call",
            "to": address,
            "data": "0x5c60da1b",
            "tag": "latest",
        }
        if api_key:
            params["apikey"] = api_key

        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(api_url, params=params, timeout=10.0)
                result = response.json().get("result")

                if result and result != "0x" and len(result) >= 42:
                    impl_addr = "0x" + result[-40:]
                    if self._is_valid_address(impl_addr) and impl_addr != "0x" + "0" * 40:
                        return impl_addr
        except Exception:
            pass

        return None

    async def _detect_minimal_proxy(
        self, api_url: str, address: str, api_key: Optional[str]
    ) -> Optional[str]:
        """Detect EIP-1167 minimal proxy and extract implementation."""
        params = {
            "module": "proxy",
            "action": "eth_getCode",
            "address": address,
            "tag": "latest",
        }
        if api_key:
            params["apikey"] = api_key

        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(api_url, params=params, timeout=10.0)
                code = response.json().get("result", "")

                # EIP-1167 pattern: 0x363d3d373d3d3d363d73[20-byte-address]5af43d82803e903d91602b57fd5bf3
                if len(code) >= 44 and code.startswith("0x363d3d373d3d3d363d73"):
                    impl_addr = "0x" + code[22:62]
                    if self._is_valid_address(impl_addr):
                        return impl_addr
        except Exception:
            pass

        return None

    def _is_valid_address(self, address: str) -> bool:
        """Check if address is valid format."""
        return bool(self.ADDRESS_PATTERN.match(address))

    def _validate_address(self, address: str) -> str:
        """
        Validate and normalize Ethereum address.

        Args:
            address: Address to validate

        Returns:
            Normalized lowercase address

        Raises:
            InvalidAddressError: If address is invalid
        """
        if not self._is_valid_address(address):
            raise InvalidAddressError(address)
        return address.lower()
