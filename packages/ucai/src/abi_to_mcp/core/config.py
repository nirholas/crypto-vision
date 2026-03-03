"""Configuration management for abi-to-mcp."""

from dataclasses import dataclass, field
from typing import Optional, Dict, Any
from pathlib import Path
import os


@dataclass
class NetworkConfig:
    """Configuration for a specific network."""

    chain_id: int
    name: str
    rpc: str
    explorer: str
    etherscan_api: str
    currency_symbol: str = "ETH"
    is_testnet: bool = False


@dataclass
class GeneratorConfig:
    """Configuration for MCP server generation."""

    # Output settings
    output_dir: Path = field(default_factory=lambda: Path("./mcp-server"))
    overwrite: bool = False

    # Feature flags
    read_only: bool = False
    include_events: bool = True
    include_utilities: bool = True
    simulation_default: bool = True

    # Code generation settings
    include_docstrings: bool = True
    include_type_hints: bool = True
    generate_tests: bool = False

    # Server settings
    server_name: Optional[str] = None
    server_version: str = "1.0.0"

    def __post_init__(self):
        """Convert output_dir to Path if string."""
        if isinstance(self.output_dir, str):
            self.output_dir = Path(self.output_dir)


@dataclass
class FetcherConfig:
    """Configuration for ABI fetching."""

    # API keys (loaded from environment if not provided)
    etherscan_api_key: Optional[str] = None
    polygonscan_api_key: Optional[str] = None
    arbiscan_api_key: Optional[str] = None
    optimism_api_key: Optional[str] = None
    basescan_api_key: Optional[str] = None
    bscscan_api_key: Optional[str] = None

    # Fetcher behavior
    timeout: float = 30.0
    max_retries: int = 3
    retry_delay: float = 1.0

    # Proxy detection
    detect_proxy: bool = True
    fetch_implementation: bool = True

    def __post_init__(self):
        """Load API keys from environment if not provided."""
        env_mappings = {
            "etherscan_api_key": "ETHERSCAN_API_KEY",
            "polygonscan_api_key": "POLYGONSCAN_API_KEY",
            "arbiscan_api_key": "ARBISCAN_API_KEY",
            "optimism_api_key": "OPTIMISM_API_KEY",
            "basescan_api_key": "BASESCAN_API_KEY",
            "bscscan_api_key": "BSCSCAN_API_KEY",
        }

        for attr, env_var in env_mappings.items():
            if getattr(self, attr) is None:
                setattr(self, attr, os.environ.get(env_var))

    def get_api_key(self, network: str) -> Optional[str]:
        """Get the appropriate API key for a network."""
        key_mapping = {
            "mainnet": self.etherscan_api_key,
            "sepolia": self.etherscan_api_key,
            "goerli": self.etherscan_api_key,
            "polygon": self.polygonscan_api_key,
            "arbitrum": self.arbiscan_api_key,
            "optimism": self.optimism_api_key,
            "base": self.basescan_api_key,
            "bsc": self.bscscan_api_key,
        }
        return key_mapping.get(network)


@dataclass
class RuntimeConfig:
    """Configuration for runtime execution."""

    # Web3 settings
    rpc_url: Optional[str] = None
    network: str = "mainnet"
    private_key: Optional[str] = None

    # Transaction settings
    gas_limit_multiplier: float = 1.2
    gas_price_multiplier: float = 1.1
    max_priority_fee_gwei: float = 2.0
    transaction_timeout: int = 120

    # Safety settings
    confirm_writes: bool = True
    simulation_required: bool = True

    def __post_init__(self):
        """Load sensitive values from environment."""
        if self.rpc_url is None:
            self.rpc_url = os.environ.get("RPC_URL")
        if self.private_key is None:
            self.private_key = os.environ.get("PRIVATE_KEY")


@dataclass
class AppConfig:
    """Top-level application configuration."""

    generator: GeneratorConfig = field(default_factory=GeneratorConfig)
    fetcher: FetcherConfig = field(default_factory=FetcherConfig)
    runtime: RuntimeConfig = field(default_factory=RuntimeConfig)

    # Logging
    log_level: str = "INFO"
    log_format: str = "%(asctime)s - %(name)s - %(levelname)s - %(message)s"

    # Paths
    cache_dir: Path = field(default_factory=lambda: Path.home() / ".cache" / "abi-to-mcp")

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "AppConfig":
        """Create config from dictionary."""
        generator_data = data.get("generator", {})
        fetcher_data = data.get("fetcher", {})
        runtime_data = data.get("runtime", {})

        return cls(
            generator=GeneratorConfig(**generator_data),
            fetcher=FetcherConfig(**fetcher_data),
            runtime=RuntimeConfig(**runtime_data),
            log_level=data.get("log_level", "INFO"),
        )

    @classmethod
    def load_from_file(cls, path: Path) -> "AppConfig":
        """Load configuration from a TOML or JSON file."""
        import json

        if not path.exists():
            return cls()

        content = path.read_text()

        if path.suffix == ".json":
            data = json.loads(content)
        elif path.suffix == ".toml":
            try:
                import tomllib
            except ImportError:
                import tomli as tomllib
            data = tomllib.loads(content)
        else:
            raise ValueError(f"Unsupported config file format: {path.suffix}")

        return cls.from_dict(data)


def get_default_config() -> AppConfig:
    """Get default application configuration."""
    config_paths = [
        Path("abi-to-mcp.toml"),
        Path("abi-to-mcp.json"),
        Path.home() / ".config" / "abi-to-mcp" / "config.toml",
        Path.home() / ".config" / "abi-to-mcp" / "config.json",
    ]

    for path in config_paths:
        if path.exists():
            return AppConfig.load_from_file(path)

    return AppConfig()
