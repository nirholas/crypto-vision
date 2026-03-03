"""Server generator module.

Orchestrates all generators to produce a complete MCP server package.
"""

import json
from pathlib import Path
from typing import Any

from jinja2 import Environment, PackageLoader, select_autoescape

from abi_to_mcp.core.config import GeneratorConfig
from abi_to_mcp.core.constants import NETWORKS
from abi_to_mcp.core.models import (
    GeneratedFile,
    GeneratedServer,
    MappedResource,
    MappedTool,
    ParsedABI,
)
from abi_to_mcp.generator.resource_generator import ResourceGenerator
from abi_to_mcp.generator.tool_generator import ToolGenerator


class ServerGenerator:
    """Generate complete MCP server package.

    This class orchestrates ToolGenerator and ResourceGenerator to produce
    all files needed for a complete, runnable MCP server.

    Example:
        >>> config = GeneratorConfig(output_dir=Path("./my-server"))
        >>> generator = ServerGenerator(config)
        >>> server = generator.generate(
        ...     parsed=parsed_abi,
        ...     tools=mapped_tools,
        ...     resources=mapped_resources,
        ...     contract_address="0x...",
        ...     network="mainnet",
        ... )
        >>> for f in server.files:
        ...     print(f.path)
        server.py
        config.py
        README.md
        pyproject.toml
        requirements.txt
        .env.example
    """

    def __init__(self, config: GeneratorConfig | None = None):
        """Initialize the ServerGenerator.

        Args:
            config: Generator configuration (uses defaults if not provided)
        """
        self.config = config or GeneratorConfig()
        self.jinja_env = self._create_jinja_env()
        self.tool_gen = ToolGenerator(self.jinja_env)
        self.resource_gen = ResourceGenerator(self.jinja_env)

    def _create_jinja_env(self) -> Environment:
        """Create and configure the Jinja2 environment."""
        env = Environment(
            loader=PackageLoader("abi_to_mcp.generator", "templates"),
            autoescape=select_autoescape(default=False),
            trim_blocks=True,
            lstrip_blocks=True,
            keep_trailing_newline=True,
        )

        # Add custom filters
        env.filters["to_snake_case"] = self._to_snake_case
        env.filters["to_package_name"] = self._to_package_name

        return env

    def generate(
        self,
        parsed: ParsedABI,
        tools: list[MappedTool],
        resources: list[MappedResource],
        contract_address: str,
        network: str,
        contract_name: str | None = None,
    ) -> GeneratedServer:
        """Generate a complete MCP server package.

        Args:
            parsed: The parsed ABI
            tools: List of mapped tools
            resources: List of mapped resources
            contract_address: Target contract address
            network: Target network name
            contract_name: Optional contract name

        Returns:
            GeneratedServer with all generated files
        """
        # Determine server name
        server_name = self._determine_server_name(
            contract_name, parsed.detected_standard, contract_address
        )

        # Get network configuration
        network_config = NETWORKS.get(network, NETWORKS["mainnet"])

        # Separate read/write tools
        read_tools = [t for t in tools if t.tool_type == "read"]
        write_tools = [t for t in tools if t.tool_type in ("write", "write_payable")]

        # Filter write tools if read_only mode
        if self.config.read_only:
            tools = read_tools
            write_tools = []

        # Prepare template context
        context = self._build_context(
            parsed=parsed,
            tools=tools,
            resources=resources,
            read_tools=read_tools,
            write_tools=write_tools,
            contract_address=contract_address,
            network=network,
            network_config=network_config,
            server_name=server_name,
        )

        # Generate all files
        files = []

        # Main server file
        files.append(self._generate_server_file(context))

        # Configuration file
        files.append(self._generate_config_file(context))

        # README
        files.append(self._generate_readme(context))

        # pyproject.toml
        files.append(self._generate_pyproject(context))

        # requirements.txt
        files.append(self._generate_requirements())

        # .env.example
        files.append(self._generate_env_example(context))

        return GeneratedServer(
            files=files,
            tool_count=len(tools),
            resource_count=len(resources),
            read_tools=[t.name for t in read_tools],
            write_tools=[t.name for t in write_tools] if not self.config.read_only else [],
            events=[r.name for r in resources],
            server_name=server_name,
            contract_address=contract_address,
            network=network,
        )

    def _build_context(
        self,
        parsed: ParsedABI,
        tools: list[MappedTool],
        resources: list[MappedResource],
        read_tools: list[MappedTool],
        write_tools: list[MappedTool],
        contract_address: str,
        network: str,
        network_config: dict[str, Any],
        server_name: str,
    ) -> dict[str, Any]:
        """Build the template rendering context."""
        # Serialize ABI to JSON for embedding
        abi_json = json.dumps(parsed.raw_abi, indent=2)

        # Create package name from server name
        package_name = self._to_package_name(server_name)

        return {
            # Server identification
            "server_name": server_name,
            "server_version": self.config.server_version,
            "package_name": package_name,
            # Contract info
            "contract_address": contract_address,
            "detected_standard": parsed.detected_standard,
            "abi_json": abi_json,
            # Network info
            "network": network,
            "chain_id": network_config.get("chain_id", 1),
            "default_rpc": network_config.get("rpc", "https://eth.llamarpc.com"),
            "currency": network_config.get("currency", "ETH"),
            # Tools and resources
            "tools": tools,
            "resources": resources if self.config.include_events else [],
            "read_tools": read_tools,
            "write_tools": write_tools if not self.config.read_only else [],
            # Settings
            "simulation_default": self.config.simulation_default,
            "read_only": self.config.read_only,
            "include_utilities": self.config.include_utilities,
            "include_events": self.config.include_events,
            # Output path for documentation
            "output_path": str(self.config.output_dir),
        }

    def _generate_server_file(self, context: dict[str, Any]) -> GeneratedFile:
        """Generate the main server.py file."""
        template = self.jinja_env.get_template("server.py.jinja2")
        content = template.render(**context)

        return GeneratedFile(
            path="server.py",
            content=content,
            is_executable=True,
        )

    def _generate_config_file(self, context: dict[str, Any]) -> GeneratedFile:
        """Generate the config.py file."""
        template = self.jinja_env.get_template("config.py.jinja2")
        content = template.render(**context)

        return GeneratedFile(
            path="config.py",
            content=content,
        )

    def _generate_readme(self, context: dict[str, Any]) -> GeneratedFile:
        """Generate the README.md file."""
        template = self.jinja_env.get_template("readme.md.jinja2")
        content = template.render(**context)

        return GeneratedFile(
            path="README.md",
            content=content,
        )

    def _generate_pyproject(self, context: dict[str, Any]) -> GeneratedFile:
        """Generate the pyproject.toml file."""
        template = self.jinja_env.get_template("pyproject.toml.jinja2")
        content = template.render(**context)

        return GeneratedFile(
            path="pyproject.toml",
            content=content,
        )

    def _generate_requirements(self) -> GeneratedFile:
        """Generate the requirements.txt file."""
        requirements = [
            "mcp>=1.0.0",
            "web3>=6.0.0",
            "pydantic>=2.0.0",
            "python-dotenv>=1.0.0",
        ]

        return GeneratedFile(
            path="requirements.txt",
            content="\n".join(requirements) + "\n",
        )

    def _generate_env_example(self, context: dict[str, Any]) -> GeneratedFile:
        """Generate the .env.example file."""
        lines = [
            "# RPC endpoint for blockchain connection",
            f"RPC_URL={context['default_rpc']}",
            "",
            "# Contract address (optional, can override default)",
            f"# CONTRACT_ADDRESS={context['contract_address']}",
            "",
            "# Private key for write operations (NEVER commit this!)",
            "# Only needed if you want to execute transactions",
            "# PRIVATE_KEY=your-private-key-here",
            "",
            "# Optional settings",
            "# GAS_LIMIT_MULTIPLIER=1.2",
            "# MAX_GAS_PRICE_GWEI=500",
            "# TX_TIMEOUT=120",
            "# LOG_LEVEL=INFO",
            "",
        ]

        return GeneratedFile(
            path=".env.example",
            content="\n".join(lines),
        )

    def _determine_server_name(
        self,
        contract_name: str | None,
        detected_standard: str | None,
        contract_address: str,
    ) -> str:
        """Determine the server name from available information."""
        if self.config.server_name:
            return self.config.server_name

        if contract_name:
            return f"{contract_name} MCP Server"

        if detected_standard:
            return f"{detected_standard} Contract MCP Server"

        # Use abbreviated address
        short_addr = f"{contract_address[:6]}...{contract_address[-4:]}"
        return f"Contract {short_addr} MCP Server"

    @staticmethod
    def _to_snake_case(name: str) -> str:
        """Convert a name to snake_case."""
        import re

        s1 = re.sub("(.)([A-Z][a-z]+)", r"\1_\2", name)
        return re.sub("([a-z0-9])([A-Z])", r"\1_\2", s1).lower()

    @staticmethod
    def _to_package_name(name: str) -> str:
        """Convert a name to a valid Python package name."""
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

    def write_to_disk(self, server: GeneratedServer, output_dir: Path | None = None) -> Path:
        """Write all generated files to disk.

        Args:
            server: The generated server package
            output_dir: Output directory (uses config if not provided)

        Returns:
            Path to the output directory
        """
        output = output_dir or self.config.output_dir
        output = Path(output)

        # Create output directory
        output.mkdir(parents=True, exist_ok=True)

        # Write each file
        for file in server.files:
            file_path = output / file.path
            file_path.parent.mkdir(parents=True, exist_ok=True)
            file_path.write_text(file.content)

            # Make executable if needed
            if file.is_executable:
                import os

                os.chmod(file_path, os.stat(file_path).st_mode | 0o111)

        return output
