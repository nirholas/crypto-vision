"""Map Solidity types to JSON Schema.

This module provides the TypeMapper class which converts Solidity types
to JSON Schema definitions for use in MCP tool parameter validation.
"""

import re
from dataclasses import dataclass
from typing import Any

from ..core.constants import SOLIDITY_TO_JSON_SCHEMA, SOLIDITY_TO_PYTHON_TYPE


@dataclass
class SolidityType:
    """Parsed Solidity type representation.

    Attributes:
        base_type: The base Solidity type (e.g., "address", "uint256")
        is_array: Whether this is an array type
        array_length: Fixed array length (None for dynamic arrays)
        is_tuple: Whether this is a tuple/struct type
        tuple_components: List of component types for tuples
        tuple_names: List of component names for tuples
    """

    base_type: str
    is_array: bool = False
    array_length: int | None = None
    is_tuple: bool = False
    tuple_components: list["SolidityType"] | None = None
    tuple_names: list[str] | None = None


class TypeMapper:
    """Maps Solidity types to JSON Schema.

    This class handles the conversion of Solidity type strings to
    JSON Schema definitions, including complex types like arrays
    and tuples (structs).

    Example:
        >>> mapper = TypeMapper()
        >>> schema = mapper.to_json_schema(mapper.parse_type("address"))
        >>> print(schema)
        {'type': 'string', 'pattern': '^0x[a-fA-F0-9]{40}$', ...}
    """

    # Regex patterns for type parsing
    ARRAY_PATTERN = re.compile(r"^(.+?)(\[(\d*)\])+$")
    UINT_PATTERN = re.compile(r"^uint(\d+)?$")
    INT_PATTERN = re.compile(r"^int(\d+)?$")
    BYTES_PATTERN = re.compile(r"^bytes(\d+)?$")

    def __init__(self):
        """Initialize the TypeMapper."""
        self.custom_types: dict[str, dict[str, Any]] = {}

    def parse_type(self, type_str: str, components: list[dict] | None = None) -> SolidityType:
        """Parse a Solidity type string into structured form.

        Args:
            type_str: Solidity type string (e.g., "uint256", "address[]")
            components: Tuple components for struct types

        Returns:
            SolidityType representing the parsed type
        """
        # Handle arrays first
        array_match = self.ARRAY_PATTERN.match(type_str)
        if array_match:
            base = array_match.group(1)
            # Extract all array dimensions
            dimensions = re.findall(r"\[(\d*)\]", type_str)

            # For multi-dimensional arrays, we need to build from inside out
            # For address[][], the base_type of outer array should be "address[]"
            if len(dimensions) > 1:
                # Build the inner array type string
                inner_array_str = base + "".join(f"[{d}]" for d in dimensions[:-1])
                return SolidityType(
                    base_type=inner_array_str,  # This will be recursively parsed by to_json_schema
                    is_array=True,
                    array_length=int(dimensions[-1]) if dimensions[-1] else None,
                )
            else:
                # Single-dimensional array
                inner_type = self.parse_type(base, components)
                return SolidityType(
                    base_type=inner_type.base_type,
                    is_array=True,
                    array_length=int(dimensions[0]) if dimensions[0] else None,
                    is_tuple=inner_type.is_tuple,
                    tuple_components=inner_type.tuple_components,
                    tuple_names=inner_type.tuple_names,
                )

        # Handle tuple types (structs)
        if type_str == "tuple" and components:
            return SolidityType(
                base_type="tuple",
                is_tuple=True,
                tuple_components=[
                    self.parse_type(c["type"], c.get("components")) for c in components
                ],
                tuple_names=[c.get("name", f"field_{i}") for i, c in enumerate(components)],
            )

        # Handle unsigned integers with size normalization
        uint_match = self.UINT_PATTERN.match(type_str)
        if uint_match:
            size = uint_match.group(1)
            return SolidityType(base_type=f"uint{size or '256'}")

        # Handle signed integers with size normalization
        int_match = self.INT_PATTERN.match(type_str)
        if int_match:
            size = int_match.group(1)
            return SolidityType(base_type=f"int{size or '256'}")

        # Handle bytes with size normalization
        bytes_match = self.BYTES_PATTERN.match(type_str)
        if bytes_match:
            size = bytes_match.group(1)
            return SolidityType(base_type=f"bytes{size or ''}")

        # Default: return as-is
        return SolidityType(base_type=type_str)

    def to_json_schema(
        self,
        solidity_type: SolidityType,
        param_name: str | None = None,
        param_description: str | None = None,
    ) -> dict[str, Any]:
        """Convert a SolidityType to JSON Schema.

        Args:
            solidity_type: Parsed Solidity type
            param_name: Optional parameter name for description generation
            param_description: Optional explicit description

        Returns:
            JSON Schema dictionary
        """
        # Handle arrays
        if solidity_type.is_array:
            # Check if base_type itself is an array (nested arrays)
            if self.ARRAY_PATTERN.match(solidity_type.base_type):
                # Recursively parse the inner array type
                inner_type = self.parse_type(solidity_type.base_type)
            else:
                # Create inner type without the array flag
                inner_type = SolidityType(
                    base_type=solidity_type.base_type,
                    is_tuple=solidity_type.is_tuple,
                    tuple_components=solidity_type.tuple_components,
                    tuple_names=solidity_type.tuple_names,
                )
            schema: dict[str, Any] = {
                "type": "array",
                "items": self.to_json_schema(inner_type),
            }
            # Add length constraints for fixed arrays
            if solidity_type.array_length is not None:
                schema["minItems"] = solidity_type.array_length
                schema["maxItems"] = solidity_type.array_length
            return schema

        # Handle tuples (structs)
        if solidity_type.is_tuple:
            properties = {}
            required = []

            for i, (comp, name) in enumerate(
                zip(
                    solidity_type.tuple_components or [],
                    solidity_type.tuple_names or [],
                    strict=False,
                )
            ):
                prop_name = name or f"field_{i}"
                properties[prop_name] = self.to_json_schema(comp, prop_name)
                required.append(prop_name)

            return {
                "type": "object",
                "properties": properties,
                "required": required,
                "additionalProperties": False,
            }

        # Handle basic types
        base_type = solidity_type.base_type

        if base_type in SOLIDITY_TO_JSON_SCHEMA:
            schema = SOLIDITY_TO_JSON_SCHEMA[base_type].copy()
        else:
            # Unknown type - default to string with warning
            schema = {
                "type": "string",
                "description": f"Unknown Solidity type: {base_type}",
            }

        # Add custom description if provided
        if param_description:
            schema["description"] = param_description
        elif param_name:
            # Generate description from parameter name
            readable_name = self._camel_to_readable(param_name)
            if "description" not in schema:
                schema["description"] = readable_name

        return schema

    def to_python_type(self, solidity_type: SolidityType) -> str:
        """Convert SolidityType to Python type hint string.

        Args:
            solidity_type: Parsed Solidity type

        Returns:
            Python type hint string (e.g., "str", "int", "List[str]")
        """
        if solidity_type.is_array:
            inner_type = SolidityType(
                base_type=solidity_type.base_type,
                is_tuple=solidity_type.is_tuple,
                tuple_components=solidity_type.tuple_components,
                tuple_names=solidity_type.tuple_names,
            )
            inner_python = self.to_python_type(inner_type)
            return f"List[{inner_python}]"

        if solidity_type.is_tuple:
            return "Dict[str, Any]"

        base = solidity_type.base_type
        return SOLIDITY_TO_PYTHON_TYPE.get(base, "str")

    def _camel_to_readable(self, name: str) -> str:
        """Convert camelCase to readable string.

        Args:
            name: camelCase identifier

        Returns:
            Human-readable string with spaces
        """
        # Insert spaces before capitals
        result = re.sub(r"([A-Z])", r" \1", name)
        # Clean up and capitalize first letter
        return result.strip().capitalize()

    def map_function_params(self, params: list[dict[str, Any]]) -> tuple[dict[str, Any], list[str]]:
        """Map function parameters to JSON Schema properties.

        Args:
            params: List of ABI parameter dictionaries

        Returns:
            Tuple of (properties dict, required list)
        """
        properties = {}
        required = []

        for i, param in enumerate(params):
            param_name = param.get("name") or f"arg{i}"
            param_type = param.get("type", "uint256")
            components = param.get("components")

            solidity_type = self.parse_type(param_type, components)
            properties[param_name] = self.to_json_schema(solidity_type, param_name=param_name)
            required.append(param_name)

        return properties, required

    def map_function_outputs(self, outputs: list[dict[str, Any]]) -> dict[str, Any]:
        """Map function outputs to JSON Schema.

        Args:
            outputs: List of ABI output dictionaries

        Returns:
            JSON Schema for the return value
        """
        if not outputs:
            return {"type": "null"}

        if len(outputs) == 1:
            output = outputs[0]
            solidity_type = self.parse_type(output.get("type", "uint256"), output.get("components"))
            return self.to_json_schema(solidity_type, output.get("name"))

        # Multiple outputs → object
        properties = {}
        for i, output in enumerate(outputs):
            name = output.get("name") or f"output{i}"
            solidity_type = self.parse_type(output.get("type", "uint256"), output.get("components"))
            properties[name] = self.to_json_schema(solidity_type, name)

        return {
            "type": "object",
            "properties": properties,
        }
