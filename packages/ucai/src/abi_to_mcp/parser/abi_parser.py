"""Main ABI parser module.

This module provides the ABIParser class that orchestrates parsing of
complete ABI JSON into structured Python objects.

AGENT 1: This file needs full implementation. See AGENTS.md for requirements.
"""

from typing import Any

from abi_to_mcp.core.constants import ERC_STANDARDS
from abi_to_mcp.core.exceptions import ABIParseError
from abi_to_mcp.core.models import (
    ABIError,
    ABIEvent,
    ABIFunction,
    ParsedABI,
)
from abi_to_mcp.parser.error_parser import ErrorParser
from abi_to_mcp.parser.event_parser import EventParser
from abi_to_mcp.parser.function_parser import FunctionParser


class ABIParser:
    """
    Main ABI parser that orchestrates all sub-parsers.

    This class is responsible for:
    1. Separating ABI entries by type (function, event, error, etc.)
    2. Delegating to specialized parsers
    3. Detecting ERC standards
    4. Validating overall ABI structure

    Example:
        parser = ABIParser()
        parsed = parser.parse(abi_json)

        print(f"Functions: {len(parsed.functions)}")
        print(f"Detected: {parsed.detected_standard}")
    """

    def __init__(self):
        """Initialize parser with sub-parsers."""
        self.function_parser = FunctionParser()
        self.event_parser = EventParser()
        self.error_parser = ErrorParser()

    def parse(self, abi: list[dict[str, Any]]) -> ParsedABI:
        """
        Parse a complete ABI JSON into structured form.

        Args:
            abi: List of ABI entry dictionaries

        Returns:
            ParsedABI object with all parsed components

        Raises:
            ABIParseError: If ABI cannot be parsed
            ABIValidationError: If ABI structure is invalid

        Example:
            >>> parser = ABIParser()
            >>> parsed = parser.parse([
            ...     {"type": "function", "name": "transfer", ...},
            ...     {"type": "event", "name": "Transfer", ...},
            ... ])
        """
        if not isinstance(abi, list):
            raise ABIParseError("ABI must be a list")

        functions: list[ABIFunction] = []
        events: list[ABIEvent] = []
        errors: list[ABIError] = []
        has_constructor = False
        has_fallback = False
        has_receive = False

        for i, entry in enumerate(abi):
            try:
                # Validate entry is a dictionary
                if not isinstance(entry, dict):
                    raise ABIParseError(
                        f"Entry {i}: must be an object, got {type(entry).__name__}",
                        entry_index=i,
                        entry_type=str(type(entry).__name__),
                    )

                entry_type = entry.get("type", "function")

                if entry_type == "function":
                    func = self.function_parser.parse(entry)
                    functions.append(func)

                elif entry_type == "event":
                    event = self.event_parser.parse(entry)
                    events.append(event)

                elif entry_type == "error":
                    error = self.error_parser.parse(entry)
                    errors.append(error)

                elif entry_type == "constructor":
                    has_constructor = True

                elif entry_type == "fallback":
                    has_fallback = True

                elif entry_type == "receive":
                    has_receive = True

                # Ignore unknown types

            except ABIParseError:
                # Re-raise ABIParseError as-is
                raise
            except Exception as e:
                entry_type_str = (
                    entry.get("type") if isinstance(entry, dict) else str(type(entry).__name__)
                )
                raise ABIParseError(
                    f"Failed to parse entry {i}: {e}",
                    entry_index=i,
                    entry_type=entry_type_str,
                ) from e

        # Detect standard
        detected_standard = self.detect_standard(functions, events)

        return ParsedABI(
            functions=functions,
            events=events,
            errors=errors,
            raw_abi=abi,
            detected_standard=detected_standard,
            has_constructor=has_constructor,
            has_fallback=has_fallback,
            has_receive=has_receive,
        )

    def validate(self, abi: list[dict[str, Any]]) -> list[str]:
        """
        Validate ABI structure and return list of errors.

        Args:
            abi: List of ABI entry dictionaries

        Returns:
            List of validation error messages (empty if valid)

        Example:
            >>> parser = ABIParser()
            >>> errors = parser.validate(abi_json)
            >>> if errors:
            ...     print("Validation failed:", errors)
        """
        errors = []

        if not isinstance(abi, list):
            errors.append("ABI must be a list")
            return errors

        valid_types = {"function", "event", "error", "constructor", "fallback", "receive"}

        for i, entry in enumerate(abi):
            if not isinstance(entry, dict):
                errors.append(f"Entry {i}: must be an object")
                continue

            entry_type = entry.get("type")
            if entry_type is None:
                # Default to function for backwards compatibility
                entry_type = "function"

            if entry_type not in valid_types:
                errors.append(f"Entry {i}: unknown type '{entry_type}'")

            if entry_type in ("function", "event", "error"):
                name = entry.get("name")
                if not name:
                    errors.append(f"Entry {i}: missing 'name'")
                elif not self._is_valid_identifier(name):
                    errors.append(f"Entry {i}: invalid name '{name}'")

            if entry_type == "function":
                if "stateMutability" in entry:
                    sm = entry["stateMutability"]
                    if sm not in ("pure", "view", "nonpayable", "payable"):
                        errors.append(f"Entry {i}: invalid stateMutability '{sm}'")

        return errors

    def detect_standard(
        self,
        functions: list[ABIFunction],
        events: list[ABIEvent],
    ) -> str | None:
        """
        Detect if this ABI implements a known ERC standard.

        Checks function and event signatures against known standards
        defined in ERC_STANDARDS constant.

        Args:
            functions: List of parsed functions
            events: List of parsed events

        Returns:
            Standard name ("ERC20", "ERC721", "ERC1155") or None

        Example:
            >>> standard = parser.detect_standard(functions, events)
            >>> if standard:
            ...     print(f"This is an {standard} token")
        """
        func_names = {f.name for f in functions}
        event_names = {e.name for e in events}

        for standard, signatures in ERC_STANDARDS.items():
            required_funcs = set(signatures.get("functions", []))
            required_events = set(signatures.get("events", []))

            # Check if all required functions exist
            if required_funcs.issubset(func_names):
                # Check if all required events exist
                if required_events.issubset(event_names):
                    return standard

        return None

    def _is_valid_identifier(self, name: str) -> bool:
        """Check if name is a valid Solidity identifier."""
        if not name:
            return False
        if not (name[0].isalpha() or name[0] == "_"):
            return False
        return all(c.isalnum() or c == "_" for c in name)
