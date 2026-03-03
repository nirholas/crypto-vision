"""Validation utilities for abi-to-mcp."""

import re
import json
from typing import List, Dict, Any, Optional
from pathlib import Path

from abi_to_mcp.core.constants import NETWORKS
from abi_to_mcp.core.exceptions import ABIValidationError, NetworkError


# Ethereum address pattern (0x followed by 40 hex characters)
ADDRESS_PATTERN = re.compile(r"^0x[a-fA-F0-9]{40}$")


def is_valid_address(address: str) -> bool:
    """
    Check if a string is a valid Ethereum address format.

    Args:
        address: String to validate

    Returns:
        True if valid address format
    """
    if not isinstance(address, str):
        return False
    return bool(ADDRESS_PATTERN.match(address))


def is_checksum_address(address: str) -> bool:
    """
    Check if an address passes EIP-55 checksum validation.

    Args:
        address: Ethereum address

    Returns:
        True if checksum is valid
    """
    if not is_valid_address(address):
        return False

    try:
        from web3 import Web3

        return Web3.is_checksum_address(address)
    except ImportError:
        # If web3 not available, just check format
        return is_valid_address(address)


def to_checksum_address(address: str) -> str:
    """
    Convert an address to EIP-55 checksum format.

    Args:
        address: Ethereum address

    Returns:
        Checksummed address

    Raises:
        ValueError: If address is invalid
    """
    if not is_valid_address(address):
        raise ValueError(f"Invalid Ethereum address: {address}")

    try:
        from web3 import Web3

        return Web3.to_checksum_address(address)
    except ImportError:
        # If web3 not available, return as-is
        return address


def validate_network(network: str) -> str:
    """
    Validate that a network name is supported.

    Args:
        network: Network name

    Returns:
        Validated network name (lowercase)

    Raises:
        NetworkError: If network is not supported
    """
    network_lower = network.lower()
    if network_lower not in NETWORKS:
        supported = ", ".join(NETWORKS.keys())
        raise NetworkError(f"Unsupported network: {network}. Supported: {supported}")
    return network_lower


def is_valid_abi(data: Any) -> bool:
    """
    Check if data is a valid ABI structure.

    Args:
        data: Data to validate

    Returns:
        True if valid ABI format
    """
    # Must be a list
    if not isinstance(data, list):
        return False

    # Empty list is technically valid
    if len(data) == 0:
        return True

    # Check that all items are dicts with a 'type' field
    for item in data:
        if not isinstance(item, dict):
            return False
        if "type" not in item:
            return False
        if item["type"] not in ("function", "event", "error", "constructor", "fallback", "receive"):
            return False

    return True


def validate_abi(data: Any) -> List[Dict[str, Any]]:
    """
    Validate and normalize ABI data.

    Args:
        data: ABI data to validate

    Returns:
        Validated ABI list

    Raises:
        ABIValidationError: If ABI is invalid
    """
    if not is_valid_abi(data):
        raise ABIValidationError(
            "Invalid ABI format: ABI must be a list of objects with 'type' field"
        )

    return data


def validate_abi_file(file_path: Path) -> List[Dict[str, Any]]:
    """
    Load and validate an ABI from a JSON file.

    Args:
        file_path: Path to JSON file

    Returns:
        Validated ABI list

    Raises:
        ABIValidationError: If file cannot be read or ABI is invalid
    """
    if not file_path.exists():
        raise ABIValidationError(f"ABI file not found: {file_path}")

    try:
        with open(file_path, "r") as f:
            data = json.load(f)
    except json.JSONDecodeError as e:
        raise ABIValidationError(f"Invalid JSON in ABI file: {e}") from e
    except Exception as e:
        raise ABIValidationError(f"Failed to read ABI file: {e}") from e

    # Handle different artifact formats
    if isinstance(data, dict):
        # Hardhat/Truffle artifact format
        if "abi" in data:
            data = data["abi"]
        else:
            raise ABIValidationError(
                f"Invalid artifact format: expected 'abi' field in {file_path}"
            )

    return validate_abi(data)


def is_file_path(source: str) -> bool:
    """
    Check if a source string looks like a file path.

    Args:
        source: Source string

    Returns:
        True if looks like a file path
    """
    # Check for common file indicators
    if any(source.endswith(ext) for ext in [".json", ".abi"]):
        return True
    if "/" in source or "\\" in source:
        return True
    if source.startswith("."):
        return True

    # Check if file exists
    return Path(source).exists()


def normalize_hex_string(value: str) -> str:
    """
    Normalize a hex string to lowercase with 0x prefix.

    Args:
        value: Hex string (with or without 0x prefix)

    Returns:
        Normalized hex string
    """
    value = value.strip()
    if not value.startswith("0x"):
        value = "0x" + value
    return value.lower()
