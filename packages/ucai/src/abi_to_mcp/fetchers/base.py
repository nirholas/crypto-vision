"""Base fetcher module.

This module defines the abstract base class for all ABI fetchers.
"""

from abc import ABC, abstractmethod
from typing import Optional, Dict, Any

from abi_to_mcp.core.models import FetchResult


class ABIFetcher(ABC):
    """
    Abstract base class for ABI fetchers.

    All fetchers must implement:
    - fetch(): Retrieve ABI from the source
    - can_handle(): Check if fetcher can handle given source

    Fetchers may optionally implement:
    - validate_source(): Validate source format before fetching
    """

    @abstractmethod
    async def fetch(self, source: str, **kwargs) -> FetchResult:
        """
        Fetch ABI from the source.

        Args:
            source: Source identifier (path, address, URL, etc.)
            **kwargs: Additional options (network, api_key, etc.)

        Returns:
            FetchResult with ABI and metadata

        Raises:
            ABINotFoundError: If ABI cannot be found
            NetworkError: If network request fails
        """
        raise NotImplementedError("Subclasses must implement fetch()")

    @abstractmethod
    def can_handle(self, source: str) -> bool:
        """
        Check if this fetcher can handle the given source.

        Args:
            source: Source identifier to check

        Returns:
            True if this fetcher can handle the source
        """
        raise NotImplementedError("Subclasses must implement can_handle()")

    def validate_source(self, source: str) -> Optional[str]:
        """
        Validate source format before fetching.

        Args:
            source: Source identifier to validate

        Returns:
            Error message if invalid, None if valid
        """
        return None
