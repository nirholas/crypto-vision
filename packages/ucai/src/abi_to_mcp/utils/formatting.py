"""Formatting utilities for abi-to-mcp."""

import re
from typing import Union
from decimal import Decimal


def format_address(address: str, short: bool = False) -> str:
    """
    Format an Ethereum address for display.

    Args:
        address: Ethereum address
        short: If True, truncate to 0x1234...5678 format

    Returns:
        Formatted address
    """
    if not address:
        return ""

    if short:
        return f"{address[:6]}...{address[-4:]}"

    return address


def format_wei(wei: Union[int, str], decimals: int = 18, symbol: str = "ETH") -> str:
    """
    Format wei amount to human-readable string.

    Args:
        wei: Amount in wei
        decimals: Token decimals (default 18 for ETH)
        symbol: Token symbol

    Returns:
        Formatted string like "1.5 ETH"
    """
    if isinstance(wei, str):
        wei = int(wei)

    value = Decimal(wei) / Decimal(10**decimals)

    # Format with appropriate precision
    if value == 0:
        return f"0 {symbol}"
    elif value < Decimal("0.000001"):
        return f"{value:.8f} {symbol}".rstrip("0").rstrip(".")
    elif value < Decimal("1"):
        return f"{value:.6f} {symbol}".rstrip("0").rstrip(".")
    else:
        return f"{value:.4f} {symbol}".rstrip("0").rstrip(".")


def format_gas_price(gwei: Union[int, float]) -> str:
    """
    Format gas price in gwei.

    Args:
        gwei: Gas price in gwei

    Returns:
        Formatted string like "50.5 gwei"
    """
    if isinstance(gwei, int):
        gwei = float(gwei)

    if gwei < 1:
        return f"{gwei:.2f} gwei"
    else:
        return f"{gwei:.1f} gwei"


def truncate_middle(text: str, max_length: int = 50) -> str:
    """
    Truncate text in the middle if too long.

    Args:
        text: Text to truncate
        max_length: Maximum length

    Returns:
        Truncated text with ... in the middle
    """
    if len(text) <= max_length:
        return text

    # Calculate how many characters to keep on each side
    side_length = (max_length - 3) // 2

    return f"{text[:side_length]}...{text[-side_length:]}"


def snake_to_camel(snake_str: str) -> str:
    """
    Convert snake_case to camelCase.

    Args:
        snake_str: String in snake_case

    Returns:
        String in camelCase
    """
    components = snake_str.split("_")
    return components[0] + "".join(x.title() for x in components[1:])


def camel_to_snake(camel_str: str) -> str:
    """
    Convert camelCase to snake_case.

    Args:
        camel_str: String in camelCase

    Returns:
        String in snake_case
    """
    # Insert underscore before uppercase letters
    snake_str = re.sub(r"(?<!^)(?=[A-Z])", "_", camel_str)
    return snake_str.lower()


def format_function_signature(name: str, inputs: list) -> str:
    """
    Format a function signature for display.

    Args:
        name: Function name
        inputs: List of input parameters

    Returns:
        Formatted signature like "transfer(address,uint256)"
    """
    param_types = [param.get("type", "unknown") for param in inputs]
    return f"{name}({','.join(param_types)})"


def format_bytes_size(size_bytes: int) -> str:
    """
    Format byte size to human-readable string.

    Args:
        size_bytes: Size in bytes

    Returns:
        Formatted string like "1.5 KB"
    """
    if size_bytes < 1024:
        return f"{size_bytes} B"
    elif size_bytes < 1024 * 1024:
        return f"{size_bytes / 1024:.1f} KB"
    elif size_bytes < 1024 * 1024 * 1024:
        return f"{size_bytes / (1024 * 1024):.1f} MB"
    else:
        return f"{size_bytes / (1024 * 1024 * 1024):.1f} GB"


def format_table_row(columns: list, widths: list) -> str:
    """
    Format a table row with fixed column widths.

    Args:
        columns: List of column values
        widths: List of column widths

    Returns:
        Formatted row string
    """
    parts = []
    for col, width in zip(columns, widths, strict=False):
        col_str = str(col)
        if len(col_str) > width:
            col_str = col_str[: width - 3] + "..."
        parts.append(col_str.ljust(width))

    return " | ".join(parts)
