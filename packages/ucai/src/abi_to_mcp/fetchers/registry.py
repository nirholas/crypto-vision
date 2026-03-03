"""Fetcher registry module.

AGENT 2: This file needs full implementation. See AGENTS.md for requirements.
"""

from typing import List, Optional, Dict, Any
from abi_to_mcp.fetchers.base import ABIFetcher
from abi_to_mcp.core.models import FetchResult
from abi_to_mcp.core.exceptions import ABINotFoundError


class FetcherRegistry:
    """Registry that selects appropriate fetcher for a source."""

    def __init__(self):
        self.fetchers: List[ABIFetcher] = []

    def register(self, fetcher: ABIFetcher) -> None:
        """Register a fetcher."""
        self.fetchers.append(fetcher)

    def get_fetcher(self, source: str) -> Optional[ABIFetcher]:
        """Get first fetcher that can handle the source."""
        for fetcher in self.fetchers:
            if fetcher.can_handle(source):
                return fetcher
        return None

    async def fetch(self, source: str, **kwargs) -> FetchResult:
        """
        Fetch from appropriate source with fallback.

        Args:
            source: Source identifier
            **kwargs: Additional fetch options

        Returns:
            FetchResult from successful fetcher

        Raises:
            ABINotFoundError: If no fetcher can retrieve the ABI
        """
        # Try fetcher that can handle the source
        fetcher = self.get_fetcher(source)
        if fetcher:
            try:
                return await fetcher.fetch(source, **kwargs)
            except ABINotFoundError:
                # For addresses, try fallback fetchers
                if source.startswith("0x") and len(source) == 42:
                    pass  # Continue to fallback
                else:
                    raise

        # For Ethereum addresses, try all address-based fetchers as fallback
        if source.startswith("0x") and len(source) == 42:
            errors = []
            for fetcher in self.fetchers:
                if fetcher.can_handle(source):
                    try:
                        return await fetcher.fetch(source, **kwargs)
                    except ABINotFoundError as e:
                        errors.append(f"{fetcher.__class__.__name__}: {e.reason}")
                    except Exception as e:
                        errors.append(f"{fetcher.__class__.__name__}: {str(e)}")

            if errors:
                raise ABINotFoundError(source, f"All fetchers failed. Errors: {'; '.join(errors)}")

        raise ABINotFoundError(source, "No fetcher can handle this source")


def create_default_registry(api_keys: Optional[Dict[str, str]] = None) -> FetcherRegistry:
    """Create registry with all default fetchers."""
    from abi_to_mcp.fetchers.file import FileFetcher
    from abi_to_mcp.fetchers.etherscan import EtherscanFetcher
    from abi_to_mcp.fetchers.sourcify import SourcifyFetcher

    registry = FetcherRegistry()

    # Order matters - file first, then etherscan, then sourcify
    registry.register(FileFetcher())

    etherscan_key = (api_keys or {}).get("etherscan")
    registry.register(EtherscanFetcher(api_key=etherscan_key))

    registry.register(SourcifyFetcher())

    return registry
