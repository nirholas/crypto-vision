"""Function to MCP tool mapper module.

AGENT 1: This file needs full implementation. See AGENTS.md for requirements.
"""

import re
import keyword

from abi_to_mcp.core.models import (
    ABIFunction,
    MappedTool,
    ToolParameter,
)
from abi_to_mcp.mapper.type_mapper import TypeMapper


# Python reserved keywords that need to be escaped
PYTHON_KEYWORDS = set(keyword.kwlist)


class FunctionMapper:
    """Map ABIFunction to MCP tool definitions."""

    def __init__(self, type_mapper: TypeMapper):
        self.type_mapper = type_mapper

    def map_function(self, func: ABIFunction) -> MappedTool:
        """Convert ABIFunction to MappedTool."""
        name = self._to_snake_case(func.name)
        tool_type = self._get_tool_type(func)

        parameters = []
        for i, param in enumerate(func.inputs):
            param_name = param.name or f"arg{i}"
            # Convert ABIParameter components to dicts for type_mapper
            components_as_dicts = (
                self._components_to_dicts(param.components) if param.components else None
            )
            solidity_type = self.type_mapper.parse_type(param.type, components_as_dicts)
            json_schema = self.type_mapper.to_json_schema(solidity_type, param_name)

            # Convert to snake_case and escape Python keywords
            snake_name = self._to_snake_case(param_name)
            safe_name = self._escape_python_keyword(snake_name)

            parameters.append(
                ToolParameter(
                    name=safe_name,
                    original_name=param_name,
                    solidity_type=param.type,
                    json_schema=json_schema,
                    python_type=self._to_python_type(param.type),
                    description=json_schema.get("description", param_name),
                )
            )

        return_schema = self.type_mapper.map_function_outputs(
            [{"name": o.name, "type": o.type, "components": o.components} for o in func.outputs]
        )

        description = self.generate_description(func)

        return MappedTool(
            name=name,
            original_name=func.name,
            description=description,
            tool_type=tool_type,
            parameters=parameters,
            return_schema=return_schema,
            return_description=self._describe_return(func),
            python_signature=self._build_signature(name, parameters, tool_type),
        )

    def generate_description(self, func: ABIFunction) -> str:
        """Generate LLM-friendly description."""
        desc = f"{self._humanize_name(func.name)}."

        if func.is_read_only:
            desc += " This is a read-only function (no gas required)."
        elif func.is_payable:
            desc += " ⚠️ This function requires ETH to be sent with the transaction."
        else:
            desc += " ⚠️ This function modifies blockchain state and requires gas."

        return desc

    def _get_tool_type(self, func: ABIFunction) -> str:
        """Get tool type from function."""
        if func.is_read_only:
            return "read"
        elif func.is_payable:
            return "write_payable"
        else:
            return "write"

    def _to_snake_case(self, name: str) -> str:
        """Convert camelCase to snake_case."""
        s1 = re.sub("(.)([A-Z][a-z]+)", r"\1_\2", name)
        return re.sub("([a-z0-9])([A-Z])", r"\1_\2", s1).lower()

    def _escape_python_keyword(self, name: str) -> str:
        """Escape Python keywords by adding underscore suffix."""
        if name in PYTHON_KEYWORDS:
            return f"{name}_"
        return name

    def _humanize_name(self, name: str) -> str:
        """Convert function name to human-readable."""
        snake = self._to_snake_case(name)
        return snake.replace("_", " ").capitalize()

    def _to_python_type(self, solidity_type: str) -> str:
        """Convert Solidity type to Python type hint."""
        if solidity_type.startswith("uint") or solidity_type.startswith("int"):
            if any(solidity_type.endswith(s) for s in ["8", "16", "32"]):
                return "int"
            return "str"  # Large ints as strings
        if solidity_type == "bool":
            return "bool"
        if solidity_type == "address":
            return "str"
        if solidity_type.endswith("[]"):
            return "List"
        if solidity_type == "tuple":
            return "Dict"
        return "str"

    def _describe_return(self, func: ABIFunction) -> str:
        """Generate return value description."""
        if not func.outputs:
            return "None"
        if len(func.outputs) == 1:
            return func.outputs[0].type
        return f"Tuple of {len(func.outputs)} values"

    def _build_signature(self, name: str, params: list[ToolParameter], tool_type: str) -> str:
        """Build Python function signature."""
        parts = [f"{p.name}: {p.python_type}" for p in params]
        if tool_type != "read":
            parts.append("simulate: bool = True")
        return f"def {name}({', '.join(parts)}):"

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
