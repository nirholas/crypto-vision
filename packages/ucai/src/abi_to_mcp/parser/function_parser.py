"""Function parser module.

This module provides the FunctionParser class that parses individual
function entries from an ABI.

AGENT 1: This file needs full implementation. See AGENTS.md for requirements.
"""

from typing import Any

from abi_to_mcp.core.exceptions import ABIParseError
from abi_to_mcp.core.models import ABIFunction, ABIParameter, StateMutability


class FunctionParser:
    """
    Parser for function entries in an ABI.

    Handles all function-related parsing including:
    - Regular functions
    - Functions with tuple parameters
    - Functions with array parameters
    - Overloaded functions

    Example:
        parser = FunctionParser()
        func = parser.parse({
            "type": "function",
            "name": "transfer",
            "inputs": [...],
            "outputs": [...],
            "stateMutability": "nonpayable"
        })
    """

    def parse(self, entry: dict[str, Any]) -> ABIFunction:
        """
        Parse a single function entry from the ABI.

        Args:
            entry: Function entry dictionary from ABI JSON

        Returns:
            ABIFunction object

        Raises:
            ABIParseError: If entry cannot be parsed

        Handles:
        - Missing 'name' field (constructor, fallback, receive)
        - Default stateMutability to 'nonpayable'
        - Empty inputs/outputs arrays
        - Tuple types with components
        """
        try:
            name = entry.get("name", "")

            # Parse inputs
            inputs = [self.parse_parameter(p) for p in entry.get("inputs", [])]

            # Parse outputs
            outputs = [self.parse_parameter(p) for p in entry.get("outputs", [])]

            # Parse state mutability
            state_mutability_str = entry.get("stateMutability", "nonpayable")

            # Handle legacy constant/payable fields
            if "constant" in entry and entry["constant"]:
                state_mutability_str = "view"
            if "payable" in entry and entry["payable"]:
                state_mutability_str = "payable"

            state_mutability = StateMutability(state_mutability_str)

            return ABIFunction(
                name=name,
                inputs=inputs,
                outputs=outputs,
                state_mutability=state_mutability,
            )

        except Exception as e:
            raise ABIParseError(f"Failed to parse function: {e}") from e

    def parse_parameter(self, param: dict[str, Any]) -> ABIParameter:
        """
        Parse a single parameter from a function.

        Args:
            param: Parameter dictionary from ABI

        Returns:
            ABIParameter object

        Handles:
        - Basic types (address, uint256, etc.)
        - Array types (address[], uint256[10])
        - Tuple types with nested components
        - Missing names (will use empty string)
        """
        name = param.get("name", "")
        param_type = param.get("type", "uint256")
        indexed = param.get("indexed", False)
        internal_type = param.get("internalType")

        # Parse components for tuple types
        components = None
        if "components" in param:
            components = [self.parse_parameter(c) for c in param["components"]]

        return ABIParameter(
            name=name,
            type=param_type,
            indexed=indexed,
            components=components,
            internal_type=internal_type,
        )
