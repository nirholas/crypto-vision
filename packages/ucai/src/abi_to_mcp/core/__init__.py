"""Core module for abi-to-mcp.

This module contains shared configuration, constants, models, and exceptions
used throughout the package.
"""

from abi_to_mcp.core.config import (
    GeneratorConfig,
    FetcherConfig,
    RuntimeConfig,
    AppConfig,
    NetworkConfig,
    get_default_config,
)

from abi_to_mcp.core.constants import (
    NETWORKS,
    SOLIDITY_TO_JSON_SCHEMA,
    STATE_MUTABILITY_MAP,
    ERC_STANDARDS,
    DEFAULT_GAS_LIMITS,
)

from abi_to_mcp.core.exceptions import (
    ABIToMCPError,
    FetcherError,
    ABINotFoundError,
    ContractNotVerifiedError,
    NetworkError,
    RateLimitError,
    InvalidAddressError,
    ParserError,
    ABIParseError,
    ABIValidationError,
    UnsupportedTypeError,
    GeneratorError,
    TemplateError,
    CodeGenerationError,
    OutputDirectoryError,
    Web3ConnectionError,
    TransactionError,
    SimulationError,
    SignerNotConfiguredError,
    InsufficientFundsError,
    CLIError,
    InvalidInputError,
    ConfigurationError,
)

from abi_to_mcp.core.models import (
    StateMutability,
    ToolType,
    ABIParameter,
    ABIFunction,
    ABIEvent,
    ABIError,
    ParsedABI,
    ToolParameter,
    MappedTool,
    ResourceField,
    MappedResource,
    GeneratedFile,
    GeneratedServer,
    FetchResult,
)

__all__ = [
    # Config
    "GeneratorConfig",
    "FetcherConfig",
    "RuntimeConfig",
    "AppConfig",
    "NetworkConfig",
    "get_default_config",
    # Constants
    "NETWORKS",
    "SOLIDITY_TO_JSON_SCHEMA",
    "STATE_MUTABILITY_MAP",
    "ERC_STANDARDS",
    "DEFAULT_GAS_LIMITS",
    # Exceptions
    "ABIToMCPError",
    "FetcherError",
    "ABINotFoundError",
    "ContractNotVerifiedError",
    "NetworkError",
    "RateLimitError",
    "InvalidAddressError",
    "ParserError",
    "ABIParseError",
    "ABIValidationError",
    "UnsupportedTypeError",
    "GeneratorError",
    "TemplateError",
    "CodeGenerationError",
    "OutputDirectoryError",
    "Web3ConnectionError",
    "TransactionError",
    "SimulationError",
    "SignerNotConfiguredError",
    "InsufficientFundsError",
    "CLIError",
    "InvalidInputError",
    "ConfigurationError",
    # Models
    "StateMutability",
    "ToolType",
    "ABIParameter",
    "ABIFunction",
    "ABIEvent",
    "ABIError",
    "ParsedABI",
    "ToolParameter",
    "MappedTool",
    "ResourceField",
    "MappedResource",
    "GeneratedFile",
    "GeneratedServer",
    "FetchResult",
]
