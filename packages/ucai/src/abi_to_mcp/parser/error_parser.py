"""Error parser module.

AGENT 1: This file needs full implementation. See AGENTS.md for requirements.
"""

from typing import Any

from abi_to_mcp.core.exceptions import ABIParseError
from abi_to_mcp.core.models import ABIError, ABIParameter


class ErrorParser:
    """Parser for custom error entries in an ABI."""

    def parse(self, entry: dict[str, Any]) -> ABIError:
        """Parse a single error entry from the ABI."""
        try:
            name = entry.get("name", "")
            inputs = [
                ABIParameter(
                    name=p.get("name", ""),
                    type=p.get("type", "uint256"),
                    components=[
                        ABIParameter(name=c.get("name", ""), type=c.get("type", ""))
                        for c in p.get("components", [])
                    ]
                    if "components" in p
                    else None,
                )
                for p in entry.get("inputs", [])
            ]
            return ABIError(name=name, inputs=inputs)
        except Exception as e:
            raise ABIParseError(f"Failed to parse error: {e}") from e
