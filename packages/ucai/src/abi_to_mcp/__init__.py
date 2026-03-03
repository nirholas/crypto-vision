"""
UCAI — The ABI-to-MCP Server Generator.

This package provides tools to generate complete MCP (Model Context Protocol)
servers from Ethereum smart contract ABIs, enabling AI assistants to interact
with any smart contract.

Basic usage:

    # CLI
    $ abi-to-mcp generate ./token.json --output ./my-mcp-server

    # Python API
    from abi_to_mcp import generate_from_abi

    server = generate_from_abi(
        abi_source="./token.json",
        contract_address="0x...",
        network="mainnet",
    )
    server.write_to_directory("./my-mcp-server")
"""

from abi_to_mcp.version import __version__

# Core models
from abi_to_mcp.core.models import (
    ABIParameter,
    ABIFunction,
    ABIEvent,
    ABIError,
    ParsedABI,
    MappedTool,
    MappedResource,
    GeneratedFile,
    GeneratedServer,
    FetchResult,
    StateMutability,
    ToolType,
)

# Configuration
from abi_to_mcp.core.config import (
    GeneratorConfig,
    FetcherConfig,
    RuntimeConfig,
    AppConfig,
)

# Exceptions
from abi_to_mcp.core.exceptions import (
    ABIToMCPError,
    ABINotFoundError,
    ABIParseError,
    ABIValidationError,
    NetworkError,
    GeneratorError,
)

__all__ = [
    # Version
    "__version__",
    # Models
    "ABIParameter",
    "ABIFunction",
    "ABIEvent",
    "ABIError",
    "ParsedABI",
    "MappedTool",
    "MappedResource",
    "GeneratedFile",
    "GeneratedServer",
    "FetchResult",
    "StateMutability",
    "ToolType",
    # Config
    "GeneratorConfig",
    "FetcherConfig",
    "RuntimeConfig",
    "AppConfig",
    # Exceptions
    "ABIToMCPError",
    "ABINotFoundError",
    "ABIParseError",
    "ABIValidationError",
    "NetworkError",
    "GeneratorError",
]


def generate_from_abi(
    abi_source: str,
    contract_address: str,
    network: str = "mainnet",
    output_dir: str = "./mcp-server",
    **kwargs,
) -> GeneratedServer:
    """
    Generate an MCP server from an ABI source.

    This is the main entry point for programmatic usage.

    Args:
        abi_source: Path to ABI file or contract address
        contract_address: Target contract address
        network: Network name (mainnet, polygon, etc.)
        output_dir: Where to write generated files
        **kwargs: Additional options passed to GeneratorConfig

    Returns:
        GeneratedServer with all generated files

    Example:
        >>> server = generate_from_abi(
        ...     abi_source="./token.json",
        ...     contract_address="0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
        ...     network="mainnet",
        ...     read_only=True,
        ... )
        >>> server.write_to_directory("./my-mcp-server")
    """
    # Lazy imports to avoid circular dependencies
    from abi_to_mcp.fetchers.registry import create_default_registry
    from abi_to_mcp.parser.abi_parser import ABIParser
    from abi_to_mcp.mapper.type_mapper import TypeMapper
    from abi_to_mcp.mapper.function_mapper import FunctionMapper
    from abi_to_mcp.mapper.event_mapper import EventMapper
    from abi_to_mcp.generator import MCPGenerator
    from pathlib import Path
    import asyncio

    # Create config
    config = GeneratorConfig(output_dir=Path(output_dir), **kwargs)

    # Fetch ABI
    registry = create_default_registry()
    fetch_result = asyncio.run(registry.fetch(abi_source, network=network))

    # Parse ABI
    parser = ABIParser()
    parsed = parser.parse(fetch_result.abi)

    # Map to MCP
    type_mapper = TypeMapper()
    func_mapper = FunctionMapper(type_mapper)
    event_mapper = EventMapper(type_mapper)

    tools = [func_mapper.map_function(f) for f in parsed.functions]
    resources = [event_mapper.map_event(e) for e in parsed.events] if config.include_events else []

    # Generate
    generator = MCPGenerator(config)
    server = generator.generate(
        parsed=parsed,
        tools=tools,
        resources=resources,
        contract_address=contract_address,
        network=network,
        contract_name=fetch_result.contract_name,
    )

    return server
