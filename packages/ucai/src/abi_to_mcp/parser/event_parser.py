"""Event parser module.

This module provides the EventParser class that parses individual
event entries from an ABI.

AGENT 1: This file needs full implementation. See AGENTS.md for requirements.
"""

from typing import Any

from abi_to_mcp.core.exceptions import ABIParseError
from abi_to_mcp.core.models import ABIEvent, ABIParameter


class EventParser:
    """
    Parser for event entries in an ABI.

    Handles:
    - Regular events with indexed and non-indexed parameters
    - Anonymous events
    - Events with tuple parameters

    Example:
        parser = EventParser()
        event = parser.parse({
            "type": "event",
            "name": "Transfer",
            "inputs": [
                {"indexed": true, "name": "from", "type": "address"},
                {"indexed": true, "name": "to", "type": "address"},
                {"indexed": false, "name": "value", "type": "uint256"}
            ],
            "anonymous": false
        })
    """

    def parse(self, entry: dict[str, Any]) -> ABIEvent:
        """
        Parse a single event entry from the ABI.

        Args:
            entry: Event entry dictionary from ABI JSON

        Returns:
            ABIEvent object

        Raises:
            ABIParseError: If entry cannot be parsed
        """
        try:
            name = entry.get("name", "")
            anonymous = entry.get("anonymous", False)

            inputs = [self._parse_parameter(p) for p in entry.get("inputs", [])]

            return ABIEvent(
                name=name,
                inputs=inputs,
                anonymous=anonymous,
            )

        except Exception as e:
            raise ABIParseError(f"Failed to parse event: {e}") from e

    def _parse_parameter(self, param: dict[str, Any]) -> ABIParameter:
        """Parse an event parameter."""
        name = param.get("name", "")
        param_type = param.get("type", "uint256")
        indexed = param.get("indexed", False)
        internal_type = param.get("internalType")

        components = None
        if "components" in param:
            components = [self._parse_parameter(c) for c in param["components"]]

        return ABIParameter(
            name=name,
            type=param_type,
            indexed=indexed,
            components=components,
            internal_type=internal_type,
        )
