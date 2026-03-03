"""Type parser module.

This module provides utilities for parsing Solidity type strings.

AGENT 1: This file needs full implementation. See AGENTS.md for requirements.
"""

import re
from dataclasses import dataclass


@dataclass
class ParsedType:
    """Parsed Solidity type information."""

    base_type: str
    is_array: bool = False
    array_dimensions: list[int | None] = None  # None = dynamic, int = fixed
    is_tuple: bool = False


class TypeParser:
    """
    Parser for Solidity type strings.

    Handles:
    - Basic types: address, uint256, bool, string, bytes
    - Sized types: uint8, uint16, bytes32, etc.
    - Array types: address[], uint256[10], bytes32[][]
    - Tuple marker (actual tuple parsing is in TypeMapper)
    """

    ARRAY_PATTERN = re.compile(r"^(.+?)(\[(\d*)\])+$")
    UINT_PATTERN = re.compile(r"^uint(\d*)$")
    INT_PATTERN = re.compile(r"^int(\d*)$")
    BYTES_PATTERN = re.compile(r"^bytes(\d*)$")

    def parse(self, type_str: str) -> ParsedType:
        """
        Parse a Solidity type string.

        Args:
            type_str: Solidity type string (e.g., "address", "uint256[]")

        Returns:
            ParsedType with parsed information
        """
        # Check for array
        array_match = self.ARRAY_PATTERN.match(type_str)
        if array_match:
            base = array_match.group(1)
            dimensions = re.findall(r"\[(\d*)\]", type_str)
            return ParsedType(
                base_type=self._normalize_base_type(base),
                is_array=True,
                array_dimensions=[int(d) if d else None for d in dimensions],
            )

        # Check for tuple
        if type_str == "tuple":
            return ParsedType(base_type="tuple", is_tuple=True)

        # Basic type
        return ParsedType(base_type=self._normalize_base_type(type_str))

    def _normalize_base_type(self, type_str: str) -> str:
        """Normalize type to canonical form (e.g., 'uint' -> 'uint256')."""
        if self.UINT_PATTERN.match(type_str):
            size = self.UINT_PATTERN.match(type_str).group(1)
            return f"uint{size or '256'}"

        if self.INT_PATTERN.match(type_str):
            size = self.INT_PATTERN.match(type_str).group(1)
            return f"int{size or '256'}"

        if type_str == "bytes":
            return "bytes"  # Dynamic bytes

        if self.BYTES_PATTERN.match(type_str):
            return type_str  # Already normalized

        return type_str

    def is_dynamic_type(self, type_str: str) -> bool:
        """Check if a type is dynamically sized."""
        parsed = self.parse(type_str)

        # Dynamic arrays
        if parsed.is_array:
            if any(d is None for d in (parsed.array_dimensions or [])):
                return True

        # Dynamic base types
        if parsed.base_type in ("string", "bytes"):
            return True

        return False
