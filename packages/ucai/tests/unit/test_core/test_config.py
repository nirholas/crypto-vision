"""Tests for config module."""

import pytest
import os
import json
from pathlib import Path
from unittest.mock import patch

from abi_to_mcp.core.config import (
    NetworkConfig,
    GeneratorConfig,
    FetcherConfig,
    RuntimeConfig,
    AppConfig,
    get_default_config,
)


class TestNetworkConfig:
    """Tests for NetworkConfig dataclass."""

    def test_create_network_config(self):
        """Create a network configuration."""
        config = NetworkConfig(
            chain_id=1,
            name="mainnet",
            rpc="https://mainnet.infura.io",
            explorer="https://etherscan.io",
            etherscan_api="https://api.etherscan.io",
        )

        assert config.chain_id == 1
        assert config.name == "mainnet"
        assert config.currency_symbol == "ETH"
        assert config.is_testnet is False

    def test_testnet_config(self):
        """Create a testnet configuration."""
        config = NetworkConfig(
            chain_id=11155111,
            name="sepolia",
            rpc="https://sepolia.infura.io",
            explorer="https://sepolia.etherscan.io",
            etherscan_api="https://api-sepolia.etherscan.io",
            is_testnet=True,
        )

        assert config.is_testnet is True


class TestGeneratorConfig:
    """Tests for GeneratorConfig dataclass."""

    def test_default_values(self):
        """Default values are set correctly."""
        config = GeneratorConfig()

        assert config.output_dir == Path("./mcp-server")
        assert config.overwrite is False
        assert config.read_only is False
        assert config.include_events is True
        assert config.simulation_default is True

    def test_custom_output_dir(self):
        """Custom output directory."""
        config = GeneratorConfig(output_dir=Path("/tmp/my-server"))

        assert config.output_dir == Path("/tmp/my-server")

    def test_string_output_dir_converted(self):
        """String output_dir is converted to Path."""
        config = GeneratorConfig(output_dir="/tmp/server")

        assert isinstance(config.output_dir, Path)
        assert config.output_dir == Path("/tmp/server")

    def test_read_only_mode(self):
        """Read-only mode configuration."""
        config = GeneratorConfig(read_only=True)

        assert config.read_only is True

    def test_server_name(self):
        """Custom server name."""
        config = GeneratorConfig(server_name="my-token-server")

        assert config.server_name == "my-token-server"


class TestFetcherConfig:
    """Tests for FetcherConfig dataclass."""

    def test_default_values(self):
        """Default values are set correctly."""
        config = FetcherConfig()

        assert config.timeout == 30.0
        assert config.max_retries == 3
        assert config.detect_proxy is True

    def test_loads_api_keys_from_env(self):
        """API keys are loaded from environment."""
        with patch.dict(os.environ, {"ETHERSCAN_API_KEY": "test-key-123"}):
            config = FetcherConfig()

            assert config.etherscan_api_key == "test-key-123"

    def test_explicit_key_overrides_env(self):
        """Explicit API key overrides environment."""
        with patch.dict(os.environ, {"ETHERSCAN_API_KEY": "env-key"}):
            config = FetcherConfig(etherscan_api_key="explicit-key")

            assert config.etherscan_api_key == "explicit-key"

    def test_get_api_key_mainnet(self):
        """Get API key for mainnet."""
        config = FetcherConfig(etherscan_api_key="mainnet-key")

        assert config.get_api_key("mainnet") == "mainnet-key"

    def test_get_api_key_polygon(self):
        """Get API key for polygon."""
        config = FetcherConfig(polygonscan_api_key="polygon-key")

        assert config.get_api_key("polygon") == "polygon-key"

    def test_get_api_key_unknown_network(self):
        """Get API key for unknown network returns None."""
        config = FetcherConfig()

        assert config.get_api_key("unknown-network") is None


class TestRuntimeConfig:
    """Tests for RuntimeConfig dataclass."""

    def test_default_values(self):
        """Default values are set correctly."""
        config = RuntimeConfig()

        assert config.network == "mainnet"
        assert config.gas_limit_multiplier == 1.2
        assert config.transaction_timeout == 120
        assert config.confirm_writes is True

    def test_loads_rpc_from_env(self):
        """RPC URL is loaded from environment."""
        with patch.dict(os.environ, {"RPC_URL": "https://my-rpc.com"}, clear=False):
            config = RuntimeConfig()

            assert config.rpc_url == "https://my-rpc.com"

    def test_loads_private_key_from_env(self):
        """Private key is loaded from environment."""
        with patch.dict(os.environ, {"PRIVATE_KEY": "0x" + "1" * 64}, clear=False):
            config = RuntimeConfig()

            assert config.private_key == "0x" + "1" * 64


class TestAppConfig:
    """Tests for AppConfig dataclass."""

    def test_default_config(self):
        """Default configuration has nested configs."""
        config = AppConfig()

        assert isinstance(config.generator, GeneratorConfig)
        assert isinstance(config.fetcher, FetcherConfig)
        assert isinstance(config.runtime, RuntimeConfig)
        assert config.log_level == "INFO"

    def test_from_dict(self):
        """Create config from dictionary."""
        data = {
            "generator": {"read_only": True},
            "fetcher": {"timeout": 60.0},
            "runtime": {"network": "polygon"},
            "log_level": "DEBUG",
        }

        config = AppConfig.from_dict(data)

        assert config.generator.read_only is True
        assert config.fetcher.timeout == 60.0
        assert config.runtime.network == "polygon"
        assert config.log_level == "DEBUG"

    def test_from_dict_empty(self):
        """Create config from empty dictionary uses defaults."""
        config = AppConfig.from_dict({})

        assert config.generator.read_only is False
        assert config.log_level == "INFO"

    def test_load_from_json_file(self, tmp_path):
        """Load configuration from JSON file."""
        config_file = tmp_path / "config.json"
        config_file.write_text(json.dumps({
            "generator": {"read_only": True},
            "log_level": "WARNING",
        }))

        config = AppConfig.load_from_file(config_file)

        assert config.generator.read_only is True
        assert config.log_level == "WARNING"

    def test_load_from_nonexistent_file(self, tmp_path):
        """Loading from nonexistent file returns default config."""
        config_file = tmp_path / "nonexistent.json"

        config = AppConfig.load_from_file(config_file)

        assert isinstance(config, AppConfig)
        assert config.log_level == "INFO"

    def test_load_from_unsupported_format(self, tmp_path):
        """Loading from unsupported format raises error."""
        config_file = tmp_path / "config.yaml"
        config_file.write_text("key: value")

        with pytest.raises(ValueError) as exc_info:
            AppConfig.load_from_file(config_file)

        assert "Unsupported" in str(exc_info.value)


class TestGetDefaultConfig:
    """Tests for get_default_config function."""

    def test_returns_default_when_no_config_files(self, tmp_path, monkeypatch):
        """Returns default config when no config files exist."""
        # Change to empty temp directory
        monkeypatch.chdir(tmp_path)

        # Mock home directory to avoid finding real config
        with patch.object(Path, 'home', return_value=tmp_path):
            config = get_default_config()

        assert isinstance(config, AppConfig)

    def test_loads_from_local_config(self, tmp_path, monkeypatch):
        """Loads from local abi-to-mcp.json if present."""
        monkeypatch.chdir(tmp_path)

        # Create local config file
        config_file = tmp_path / "abi-to-mcp.json"
        config_file.write_text(json.dumps({
            "log_level": "DEBUG",
        }))

        with patch.object(Path, 'home', return_value=tmp_path / "fake-home"):
            config = get_default_config()

        assert config.log_level == "DEBUG"
