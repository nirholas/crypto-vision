"""Shared data models for abi-to-mcp.

These models are the contracts between different modules. All agents must use
these exact classes to ensure seamless integration.
"""

from dataclasses import dataclass, field
from typing import List, Dict, Any, Optional
from enum import Enum


# =============================================================================
# Enums
# =============================================================================


class StateMutability(Enum):
    """Solidity function state mutability."""

    PURE = "pure"
    VIEW = "view"
    NONPAYABLE = "nonpayable"
    PAYABLE = "payable"

    @property
    def is_read_only(self) -> bool:
        """Check if this mutability allows state modification."""
        return self in (StateMutability.PURE, StateMutability.VIEW)

    @property
    def requires_gas(self) -> bool:
        """Check if this mutability requires gas."""
        return self in (StateMutability.NONPAYABLE, StateMutability.PAYABLE)


class ToolType(Enum):
    """MCP tool type based on function behavior."""

    READ = "read"  # Pure/view functions - no gas
    WRITE = "write"  # Nonpayable functions - requires gas
    WRITE_PAYABLE = "write_payable"  # Payable functions - requires gas + ETH


# =============================================================================
# ABI Models (Parser Output)
# =============================================================================


@dataclass
class ABIParameter:
    """A function or event parameter from the ABI.

    Attributes:
        name: Parameter name (may be empty string in ABI)
        type: Solidity type string (e.g., "address", "uint256", "tuple")
        indexed: Whether this is an indexed event parameter
        components: Nested parameters for tuple types
        internal_type: Internal type hint from compiler (optional)
    """

    name: str
    type: str
    indexed: bool = False
    components: Optional[List["ABIParameter"]] = None
    internal_type: Optional[str] = None

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "ABIParameter":
        """Create from ABI JSON dictionary."""
        components = None
        if "components" in data:
            components = [cls.from_dict(c) for c in data["components"]]

        return cls(
            name=data.get("name", ""),
            type=data["type"],
            indexed=data.get("indexed", False),
            components=components,
            internal_type=data.get("internalType"),
        )


@dataclass
class ABIFunction:
    """A parsed contract function.

    Attributes:
        name: Function name
        inputs: List of input parameters
        outputs: List of output parameters
        state_mutability: Function's state mutability
        selector: 4-byte function selector (optional)
    """

    name: str
    inputs: List[ABIParameter]
    outputs: List[ABIParameter]
    state_mutability: StateMutability
    selector: Optional[str] = None

    @property
    def is_read_only(self) -> bool:
        """Check if function is read-only (view/pure)."""
        return self.state_mutability.is_read_only

    @property
    def is_payable(self) -> bool:
        """Check if function accepts ETH."""
        return self.state_mutability == StateMutability.PAYABLE

    @property
    def requires_gas(self) -> bool:
        """Check if function requires gas."""
        return self.state_mutability.requires_gas

    @property
    def tool_type(self) -> ToolType:
        """Get the MCP tool type for this function."""
        if self.is_read_only:
            return ToolType.READ
        elif self.is_payable:
            return ToolType.WRITE_PAYABLE
        else:
            return ToolType.WRITE

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "ABIFunction":
        """Create from ABI JSON dictionary."""
        return cls(
            name=data.get("name", ""),
            inputs=[ABIParameter.from_dict(p) for p in data.get("inputs", [])],
            outputs=[ABIParameter.from_dict(p) for p in data.get("outputs", [])],
            state_mutability=StateMutability(data.get("stateMutability", "nonpayable")),
        )


@dataclass
class ABIEvent:
    """A parsed contract event.

    Attributes:
        name: Event name
        inputs: List of event parameters
        anonymous: Whether this is an anonymous event
    """

    name: str
    inputs: List[ABIParameter]
    anonymous: bool = False

    @property
    def indexed_inputs(self) -> List[ABIParameter]:
        """Get only indexed parameters (topics)."""
        return [p for p in self.inputs if p.indexed]

    @property
    def data_inputs(self) -> List[ABIParameter]:
        """Get only non-indexed parameters (data)."""
        return [p for p in self.inputs if not p.indexed]

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "ABIEvent":
        """Create from ABI JSON dictionary."""
        return cls(
            name=data.get("name", ""),
            inputs=[ABIParameter.from_dict(p) for p in data.get("inputs", [])],
            anonymous=data.get("anonymous", False),
        )


@dataclass
class ABIError:
    """A parsed custom error.

    Attributes:
        name: Error name
        inputs: List of error parameters
    """

    name: str
    inputs: List[ABIParameter]

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "ABIError":
        """Create from ABI JSON dictionary."""
        return cls(
            name=data.get("name", ""),
            inputs=[ABIParameter.from_dict(p) for p in data.get("inputs", [])],
        )


@dataclass
class ParsedABI:
    """Complete parsed ABI.

    This is the main output of the parser module and input to the mapper.

    Attributes:
        functions: All parsed functions
        events: All parsed events
        errors: All parsed custom errors
        raw_abi: Original ABI JSON for reference
        detected_standard: Detected ERC standard (if any)
        has_constructor: Whether ABI includes constructor
        has_fallback: Whether ABI includes fallback function
        has_receive: Whether ABI includes receive function
    """

    functions: List[ABIFunction]
    events: List[ABIEvent]
    errors: List[ABIError]
    raw_abi: List[Dict[str, Any]]
    detected_standard: Optional[str] = None
    has_constructor: bool = False
    has_fallback: bool = False
    has_receive: bool = False

    @property
    def read_functions(self) -> List[ABIFunction]:
        """Get all read-only functions."""
        return [f for f in self.functions if f.is_read_only]

    @property
    def write_functions(self) -> List[ABIFunction]:
        """Get all state-modifying functions."""
        return [f for f in self.functions if not f.is_read_only]


# =============================================================================
# Mapper Models (Mapper Output)
# =============================================================================


@dataclass
class ToolParameter:
    """A parameter in an MCP tool definition.

    Attributes:
        name: Parameter name (snake_case)
        original_name: Original Solidity parameter name
        solidity_type: Original Solidity type
        json_schema: JSON Schema for this parameter
        python_type: Python type hint string
        description: Human-readable description
        required: Whether this parameter is required
    """

    name: str
    original_name: str
    solidity_type: str
    json_schema: Dict[str, Any]
    python_type: str
    description: str
    required: bool = True


@dataclass
class MappedTool:
    """A function mapped to an MCP tool definition.

    This is the output of FunctionMapper and input to ToolGenerator.

    Attributes:
        name: Tool name (snake_case)
        original_name: Original Solidity function name
        description: LLM-friendly description
        tool_type: Type of tool (read/write/write_payable)
        parameters: List of tool parameters
        return_schema: JSON Schema for return value
        return_description: Description of return value
        python_signature: Complete Python function signature
    """

    name: str
    original_name: str
    description: str
    tool_type: str  # "read", "write", "write_payable"
    parameters: List[ToolParameter]
    return_schema: Dict[str, Any]
    return_description: str
    python_signature: str

    @property
    def required_params(self) -> List[str]:
        """Get names of required parameters."""
        return [p.name for p in self.parameters if p.required]

    @property
    def is_read_only(self) -> bool:
        """Check if this is a read-only tool."""
        return self.tool_type == "read"

    @property
    def is_payable(self) -> bool:
        """Check if this tool accepts ETH."""
        return self.tool_type == "write_payable"


@dataclass
class ResourceField:
    """A field in an MCP resource (event parameter).

    Attributes:
        name: Field name (snake_case)
        original_name: Original Solidity parameter name
        solidity_type: Original Solidity type
        json_schema: JSON Schema for this field
        description: Human-readable description
        indexed: Whether this is an indexed parameter
    """

    name: str
    original_name: str
    solidity_type: str
    json_schema: Dict[str, Any]
    description: str
    indexed: bool = False


@dataclass
class MappedResource:
    """An event mapped to an MCP resource definition.

    This is the output of EventMapper and input to ResourceGenerator.

    Attributes:
        name: Resource name (snake_case)
        original_name: Original Solidity event name
        description: Human-readable description
        uri_template: MCP resource URI template
        fields: List of resource fields
        function_name: Python function name for the handler
    """

    name: str
    original_name: str
    description: str
    uri_template: str
    fields: List[ResourceField]
    function_name: str

    @property
    def indexed_fields(self) -> List[ResourceField]:
        """Get indexed fields (can be used for filtering)."""
        return [f for f in self.fields if f.indexed]

    @property
    def data_fields(self) -> List[ResourceField]:
        """Get non-indexed fields."""
        return [f for f in self.fields if not f.indexed]


# =============================================================================
# Generator Models (Generator Output)
# =============================================================================


@dataclass
class GeneratedFile:
    """A generated file.

    Attributes:
        path: Relative path within output directory
        content: File content as string
        is_executable: Whether file should be executable
    """

    path: str
    content: str
    is_executable: bool = False


@dataclass
class GeneratedServer:
    """Complete generated MCP server package.

    This is the final output of the generator module.

    Attributes:
        files: List of generated files
        tool_count: Number of generated tools
        resource_count: Number of generated resources
        read_tools: Names of read-only tools
        write_tools: Names of write tools
        events: Names of event resources
        server_name: Name of the generated server
        contract_address: Target contract address
        network: Target network
    """

    files: List[GeneratedFile]
    tool_count: int
    resource_count: int
    read_tools: List[str]
    write_tools: List[str]
    events: List[str]
    server_name: str
    contract_address: str
    network: str

    def get_file(self, path: str) -> Optional[GeneratedFile]:
        """Get a specific file by path."""
        for f in self.files:
            if f.path == path:
                return f
        return None


# =============================================================================
# Fetcher Models
# =============================================================================


@dataclass
class FetchResult:
    """Result from fetching an ABI.

    Attributes:
        abi: The fetched ABI JSON
        source: Source type ("file", "etherscan", "sourcify")
        source_location: Specific location (path or address)
        contract_name: Contract name if available
        compiler_version: Compiler version if available
        source_code: Contract source code if available
        is_proxy: Whether this is a proxy contract
        implementation_address: Implementation address if proxy
    """

    abi: List[Dict[str, Any]]
    source: str
    source_location: str
    contract_name: Optional[str] = None
    compiler_version: Optional[str] = None
    source_code: Optional[str] = None
    is_proxy: bool = False
    implementation_address: Optional[str] = None
