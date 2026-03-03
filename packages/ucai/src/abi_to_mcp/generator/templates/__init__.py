"""Jinja2 templates for MCP server generation.

This module contains helper functions for working with templates
and provides access to the template directory path.
"""

from pathlib import Path

from jinja2 import Environment, PackageLoader, select_autoescape


def get_templates_dir() -> Path:
    """Get the path to the templates directory."""
    return Path(__file__).parent


def create_jinja_env() -> Environment:
    """Create a configured Jinja2 environment for template rendering.

    Returns:
        Configured Jinja2 Environment
    """
    env = Environment(
        loader=PackageLoader("abi_to_mcp.generator", "templates"),
        autoescape=select_autoescape(default=False),
        trim_blocks=True,
        lstrip_blocks=True,
        keep_trailing_newline=True,
    )

    # Add custom filters
    env.filters["to_snake_case"] = to_snake_case
    env.filters["to_package_name"] = to_package_name
    env.filters["escape_python_string"] = escape_python_string

    return env


def to_snake_case(name: str) -> str:
    """Convert a name to snake_case.

    Args:
        name: The name to convert

    Returns:
        The name in snake_case format

    Example:
        >>> to_snake_case("transferFrom")
        'transfer_from'
    """
    import re

    s1 = re.sub("(.)([A-Z][a-z]+)", r"\1_\2", name)
    return re.sub("([a-z0-9])([A-Z])", r"\1_\2", s1).lower()


def to_package_name(name: str) -> str:
    """Convert a name to a valid Python package name.

    Args:
        name: The name to convert

    Returns:
        A valid Python package name

    Example:
        >>> to_package_name("USDC Token MCP Server")
        'usdc_token'
    """
    import re

    # Remove "MCP Server" suffix if present
    name = re.sub(r"\s*MCP\s*Server\s*$", "", name, flags=re.IGNORECASE)
    # Convert to lowercase and replace spaces/special chars with underscores
    name = re.sub(r"[^a-zA-Z0-9]+", "_", name.lower())
    # Remove leading/trailing underscores
    name = name.strip("_")
    # Ensure it doesn't start with a digit
    if name and name[0].isdigit():
        name = "contract_" + name
    return name or "mcp_server"


def escape_python_string(value: str) -> str:
    """Escape a string for use in Python source code.

    Args:
        value: The string to escape

    Returns:
        The escaped string
    """
    return value.replace("\\", "\\\\").replace('"', '\\"').replace("'", "\\'")


# Template file names
TEMPLATES = {
    "server": "server.py.jinja2",
    "config": "config.py.jinja2",
    "readme": "readme.md.jinja2",
    "pyproject": "pyproject.toml.jinja2",
    "tool": "tool.py.jinja2",
    "resource": "resource.py.jinja2",
}


__all__ = [
    "get_templates_dir",
    "create_jinja_env",
    "to_snake_case",
    "to_package_name",
    "escape_python_string",
    "TEMPLATES",
]
