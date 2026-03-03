"""Generator module for abi-to-mcp.

This module provides code generation capabilities for converting parsed ABIs
and mapped tools/resources into complete, runnable MCP server packages.
"""

from abi_to_mcp.generator.resource_generator import ResourceGenerator
from abi_to_mcp.generator.server_generator import ServerGenerator
from abi_to_mcp.generator.tool_generator import ToolGenerator

# Alias for API compatibility (documentation uses MCPGenerator)
MCPGenerator = ServerGenerator

__all__ = [
    "ToolGenerator",
    "ResourceGenerator",
    "ServerGenerator",
    "MCPGenerator",
]
