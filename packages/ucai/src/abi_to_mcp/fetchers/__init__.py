"""Fetchers module for abi-to-mcp."""

from abi_to_mcp.fetchers.base import ABIFetcher
from abi_to_mcp.fetchers.file import FileFetcher
from abi_to_mcp.fetchers.etherscan import EtherscanFetcher
from abi_to_mcp.fetchers.sourcify import SourcifyFetcher
from abi_to_mcp.fetchers.registry import FetcherRegistry, create_default_registry

__all__ = [
    "ABIFetcher",
    "FileFetcher",
    "EtherscanFetcher",
    "SourcifyFetcher",
    "FetcherRegistry",
    "create_default_registry",
]
