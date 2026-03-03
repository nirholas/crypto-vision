"""Schema builder module.

AGENT 1: This file needs full implementation. See AGENTS.md for requirements.
"""

from typing import Any


class SchemaBuilder:
    """Builder for JSON Schema objects."""

    def __init__(self):
        self._properties: dict[str, dict[str, Any]] = {}
        self._required: list[str] = []
        self._title: str | None = None
        self._description: str | None = None

    def title(self, title: str) -> "SchemaBuilder":
        """Set schema title."""
        self._title = title
        return self

    def description(self, desc: str) -> "SchemaBuilder":
        """Set schema description."""
        self._description = desc
        return self

    def add_property(
        self,
        name: str,
        schema: dict[str, Any],
        required: bool = True,
    ) -> "SchemaBuilder":
        """Add a property to the schema."""
        self._properties[name] = schema
        if required and name not in self._required:
            self._required.append(name)
        return self

    def build(self) -> dict[str, Any]:
        """Build the final JSON Schema."""
        schema: dict[str, Any] = {"type": "object"}

        if self._title:
            schema["title"] = self._title
        if self._description:
            schema["description"] = self._description
        if self._properties:
            schema["properties"] = self._properties
        if self._required:
            schema["required"] = self._required

        schema["additionalProperties"] = False
        return schema


def build_tool_schema(
    name: str,
    description: str,
    parameters: list[dict[str, Any]],
    required: list[str],
) -> dict[str, Any]:
    """Build a complete MCP tool schema."""
    return {
        "name": name,
        "description": description,
        "inputSchema": {
            "type": "object",
            "properties": {p["name"]: p["schema"] for p in parameters},
            "required": required,
            "additionalProperties": False,
        },
    }
