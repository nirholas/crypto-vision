"""Sourcify fetcher module.

This module handles fetching ABIs from Sourcify.
"""

import json
import re
from typing import Optional, Dict, Any, List

try:
    import httpx
except ImportError:
    httpx = None

from abi_to_mcp.fetchers.base import ABIFetcher
from abi_to_mcp.core.models import FetchResult
from abi_to_mcp.core.constants import NETWORKS
from abi_to_mcp.core.exceptions import ABINotFoundError, NetworkError, InvalidAddressError


class SourcifyFetcher(ABIFetcher):
    """
    Fetch ABI from Sourcify.

    Sourcify is a decentralized source code verification service.
    """

    SOURCIFY_API = "https://sourcify.dev/server"
    ADDRESS_PATTERN = re.compile(r"^0x[a-fA-F0-9]{40}$")

    def __init__(self):
        """Initialize Sourcify fetcher."""
        if httpx is None:
            raise ImportError(
                "httpx is required for Sourcify fetcher. Install with: pip install httpx"
            )

        self.client = httpx.AsyncClient(timeout=30.0)

    async def fetch(
        self, source: str, chain_id: int = 1, network: Optional[str] = None, **kwargs
    ) -> FetchResult:
        """
        Fetch ABI from Sourcify.

        Args:
            source: Contract address
            chain_id: Chain ID (default: 1)
            network: Network name (optional)

        Returns:
            FetchResult with ABI and metadata
        """
        if not self.ADDRESS_PATTERN.match(source):
            raise InvalidAddressError(source)

        address = source.lower()

        # Convert network name to chain_id
        if network and network in NETWORKS:
            chain_id = NETWORKS[network]["chain_id"]

        # Try full match first
        try:
            result = await self._fetch_match(address, chain_id, "full_match")
            if result:
                return result
        except ABINotFoundError:
            pass

        # Try partial match
        try:
            result = await self._fetch_match(address, chain_id, "partial_match")
            if result:
                return result
        except ABINotFoundError:
            pass

        raise ABINotFoundError(
            source=address,
            reason=f"Contract not found on Sourcify (chain_id: {chain_id})",
            network=network,
        )

    async def _fetch_match(
        self, address: str, chain_id: int, match_type: str
    ) -> Optional[FetchResult]:
        """Fetch contract files from Sourcify."""
        url = f"{self.SOURCIFY_API}/files/{match_type}/{chain_id}/{address}"

        try:
            response = await self.client.get(url)

            if response.status_code == 404:
                raise ABINotFoundError(source=address, reason=f"No {match_type} found")

            response.raise_for_status()
            files = response.json()

        except httpx.HTTPStatusError as e:
            if e.response.status_code == 404:
                raise ABINotFoundError(source=address, reason=f"No {match_type} found") from e
            raise NetworkError(
                f"HTTP error: {e}", url=url, status_code=e.response.status_code
            ) from e
        except httpx.RequestError as e:
            raise NetworkError(f"Request failed: {e}", url=url) from e

        return self._parse_files(files, address)

    def _parse_files(self, files: List[Dict[str, Any]], address: str) -> FetchResult:
        """Parse Sourcify files to extract ABI."""
        abi = None
        contract_name = None
        compiler_version = None
        source_code = {}

        for file in files:
            name = file.get("name", "")
            content = file.get("content", "")

            if name == "metadata.json":
                try:
                    if isinstance(content, str):
                        metadata = json.loads(content)
                    else:
                        metadata = content

                    if "output" in metadata and "abi" in metadata["output"]:
                        abi = metadata["output"]["abi"]

                    if "compiler" in metadata:
                        compiler_version = metadata["compiler"].get("version")

                    if "settings" in metadata and "compilationTarget" in metadata["settings"]:
                        targets = metadata["settings"]["compilationTarget"]
                        if targets:
                            contract_name = list(targets.values())[0]

                except json.JSONDecodeError:
                    pass

            elif name.endswith(".sol"):
                source_code[name] = content

        if not abi:
            raise ABINotFoundError(source=address, reason="No ABI found in Sourcify files")

        full_source = None
        if source_code:
            full_source = "\n\n".join([f"// {name}\n{code}" for name, code in source_code.items()])

        return FetchResult(
            abi=abi,
            source="sourcify",
            source_location=address,
            contract_name=contract_name,
            compiler_version=compiler_version,
            source_code=full_source,
        )

    def can_handle(self, source: str) -> bool:
        """Check if source is an Ethereum address."""
        return bool(self.ADDRESS_PATTERN.match(source))

    async def __aenter__(self):
        """Async context manager entry."""
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async context manager exit."""
        await self.client.aclose()
