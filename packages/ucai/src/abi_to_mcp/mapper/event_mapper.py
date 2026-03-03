"""Event to MCP resource mapper module.

AGENT 1: This file needs full implementation. See AGENTS.md for requirements.
"""

import re

from abi_to_mcp.core.models import ABIEvent, MappedResource, ResourceField
from abi_to_mcp.mapper.type_mapper import TypeMapper


class EventMapper:
    """Map ABIEvent to MCP resource definitions."""

    def __init__(self, type_mapper: TypeMapper):
        self.type_mapper = type_mapper

    def map_event(self, event: ABIEvent) -> MappedResource:
        """Convert ABIEvent to MappedResource."""
        name = self._to_snake_case(event.name)

        fields = []
        for param in event.inputs:
            # Convert ABIParameter components to dicts for type_mapper
            components_as_dicts = (
                self._components_to_dicts(param.components) if param.components else None
            )
            solidity_type = self.type_mapper.parse_type(param.type, components_as_dicts)
            json_schema = self.type_mapper.to_json_schema(solidity_type, param.name)

            fields.append(
                ResourceField(
                    name=self._to_snake_case(param.name) if param.name else "value",
                    original_name=param.name,
                    solidity_type=param.type,
                    json_schema=json_schema,
                    description=json_schema.get("description", param.name),
                    indexed=param.indexed,
                )
            )

        return MappedResource(
            name=name,
            original_name=event.name,
            description=f"Query {event.name} events from the contract.",
            uri_template=f"events://{name}",
            fields=fields,
            function_name=f"get_{name}_events",
        )

    def _to_snake_case(self, name: str) -> str:
        """Convert camelCase to snake_case."""
        s1 = re.sub("(.)([A-Z][a-z]+)", r"\1_\2", name)
        return re.sub("([a-z0-9])([A-Z])", r"\1_\2", s1).lower()

    def _components_to_dicts(self, components: list) -> list[dict]:
        """Convert ABIParameter components to dicts for type_mapper."""
        result = []
        for c in components:
            # Handle both dict and ABIParameter objects
            if isinstance(c, dict):
                result.append(c)
            else:
                # ABIParameter object
                comp_dict = {
                    "name": c.name,
                    "type": c.type,
                }
                if c.components:
                    comp_dict["components"] = self._components_to_dicts(c.components)
                result.append(comp_dict)
        return result
