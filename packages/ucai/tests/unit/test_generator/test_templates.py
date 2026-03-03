"""Unit tests for Jinja2 templates."""

import pytest
from jinja2 import TemplateError

from abi_to_mcp.generator.templates import (
    create_jinja_env,
    to_snake_case,
    to_package_name,
    escape_python_string,
    get_templates_dir,
    TEMPLATES,
)


class TestTemplateHelpers:
    """Tests for template helper functions."""

    def test_to_snake_case_simple(self):
        """Test simple camelCase conversion."""
        assert to_snake_case("balanceOf") == "balance_of"
        assert to_snake_case("transfer") == "transfer"
        assert to_snake_case("getBalance") == "get_balance"

    def test_to_snake_case_complex(self):
        """Test complex camelCase conversions."""
        assert to_snake_case("transferFrom") == "transfer_from"
        assert to_snake_case("ERC20Token") == "erc20_token"
        assert to_snake_case("HTTPResponse") == "http_response"
        assert to_snake_case("getHTTPStatus") == "get_http_status"

    def test_to_snake_case_already_snake(self):
        """Test strings already in snake_case."""
        assert to_snake_case("balance_of") == "balance_of"
        assert to_snake_case("get_balance") == "get_balance"

    def test_to_package_name_simple(self):
        """Test simple package name conversion."""
        assert to_package_name("My Token") == "my_token"
        assert to_package_name("USDC") == "usdc"

    def test_to_package_name_removes_mcp_server(self):
        """Test MCP Server suffix is removed."""
        assert to_package_name("USDC MCP Server") == "usdc"
        assert to_package_name("Token MCP server") == "token"
        assert to_package_name("Contract mcp Server") == "contract"

    def test_to_package_name_handles_special_chars(self):
        """Test special characters are handled."""
        assert to_package_name("My-Token!") == "my_token"
        assert to_package_name("Token@#$%") == "token"
        assert to_package_name("Contract 123") == "contract_123"

    def test_to_package_name_numeric_prefix(self):
        """Test package names starting with digits."""
        assert to_package_name("123Token") == "contract_123token"
        assert to_package_name("42") == "contract_42"

    def test_to_package_name_empty(self):
        """Test empty string handling."""
        assert to_package_name("") == "mcp_server"
        assert to_package_name("MCP Server") == "mcp_server"

    def test_escape_python_string(self):
        """Test Python string escaping."""
        assert escape_python_string('hello') == 'hello'
        assert escape_python_string('hello"world') == 'hello\\"world'
        assert escape_python_string("hello'world") == "hello\\'world"
        assert escape_python_string('hello\\world') == 'hello\\\\world'


class TestJinjaEnvironment:
    """Tests for Jinja2 environment configuration."""

    def test_create_jinja_env(self):
        """Test environment creation."""
        env = create_jinja_env()
        
        assert env is not None
        assert env.trim_blocks
        assert env.lstrip_blocks

    def test_env_has_custom_filters(self):
        """Test custom filters are registered."""
        env = create_jinja_env()
        
        assert "to_snake_case" in env.filters
        assert "to_package_name" in env.filters
        assert "escape_python_string" in env.filters

    def test_env_can_load_templates(self):
        """Test templates can be loaded."""
        env = create_jinja_env()
        
        # Should not raise
        server_template = env.get_template("server.py.jinja2")
        assert server_template is not None

    def test_env_loads_all_templates(self):
        """Test all declared templates exist."""
        env = create_jinja_env()
        
        for _name, filename in TEMPLATES.items():
            try:
                template = env.get_template(filename)
                assert template is not None, f"Template {filename} should exist"
            except TemplateError:
                pytest.fail(f"Failed to load template: {filename}")


class TestTemplatesDirectory:
    """Tests for templates directory utilities."""

    def test_get_templates_dir(self):
        """Test getting templates directory path."""
        templates_dir = get_templates_dir()
        
        assert templates_dir.exists()
        assert templates_dir.is_dir()

    def test_templates_constants(self):
        """Test TEMPLATES constant contains expected templates."""
        assert "server" in TEMPLATES
        assert "config" in TEMPLATES
        assert "readme" in TEMPLATES
        assert "pyproject" in TEMPLATES
        assert "tool" in TEMPLATES
        assert "resource" in TEMPLATES


class TestTemplateRendering:
    """Tests for actual template rendering."""

    def test_render_server_template(self):
        """Test rendering the server template."""
        env = create_jinja_env()
        template = env.get_template("server.py.jinja2")
        
        # Minimal context for rendering
        context = {
            "server_name": "Test Server",
            "contract_address": "0x1234567890123456789012345678901234567890",
            "network": "mainnet",
            "default_rpc": "https://eth.llamarpc.com",
            "simulation_default": True,
            "read_only": False,
            "include_utilities": True,
            "abi_json": "[]",
            "tools": [],
            "resources": [],
            "currency": "ETH",
        }
        
        content = template.render(**context)
        
        assert "Test Server" in content
        assert "0x1234567890123456789012345678901234567890" in content
        assert "mcp.run()" in content

    def test_render_config_template(self):
        """Test rendering the config template."""
        env = create_jinja_env()
        template = env.get_template("config.py.jinja2")
        
        context = {
            "server_name": "Test Server",
            "server_version": "1.0.0",
            "contract_address": "0x1234567890123456789012345678901234567890",
            "network": "mainnet",
            "chain_id": 1,
            "default_rpc": "https://eth.llamarpc.com",
            "simulation_default": True,
            "read_only": False,
        }
        
        content = template.render(**context)
        
        assert "NETWORK" in content
        assert "CHAIN_ID" in content
        assert "RPC_URL" in content

    def test_render_readme_template(self):
        """Test rendering the README template."""
        env = create_jinja_env()
        template = env.get_template("readme.md.jinja2")
        
        context = {
            "server_name": "Test Server",
            "contract_address": "0x1234567890123456789012345678901234567890",
            "network": "mainnet",
            "default_rpc": "https://eth.llamarpc.com",
            "tools": [],
            "read_tools": [],
            "write_tools": [],
            "resources": [],
            "detected_standard": "ERC20",
            "output_path": "/path/to/server",
        }
        
        content = template.render(**context)
        
        assert "# Test Server" in content
        assert "ERC20" in content

    def test_render_pyproject_template(self):
        """Test rendering the pyproject.toml template."""
        env = create_jinja_env()
        template = env.get_template("pyproject.toml.jinja2")
        
        context = {
            "package_name": "test_server",
            "server_name": "Test Server",
        }
        
        content = template.render(**context)
        
        assert "[project]" in content
        assert "test_server" in content

    def test_render_tool_template(self):
        """Test rendering the tool template."""
        env = create_jinja_env()
        template = env.get_template("tool.py.jinja2")
        
        # Create a mock tool object
        class MockParam:
            name = "account"
            python_type = "str"
            description = "Account address"
        
        class MockTool:
            name = "balance_of"
            original_name = "balanceOf"
            description = "Get balance"
            tool_type = "read"
            parameters = [MockParam()]
            return_schema = {"python_type": "str"}
            return_description = "Token balance"
        
        context = {
            "tool": MockTool(),
            "is_read": True,
            "is_write": False,
            "is_payable": False,
        }
        
        content = template.render(**context)
        
        assert "@mcp.tool" in content
        assert "def balance_of" in content
        assert "account: str" in content

    def test_render_resource_template(self):
        """Test rendering the resource template."""
        env = create_jinja_env()
        template = env.get_template("resource.py.jinja2")
        
        # Create a mock resource object
        class MockField:
            name = "from_address"
            original_name = "from"
            description = "Sender"
            indexed = True
        
        class MockResource:
            name = "transfer"
            original_name = "Transfer"
            description = "Query Transfer events"
            uri_template = "events://transfer"
            function_name = "get_transfer_events"
            fields = [MockField()]
        
        context = {
            "resource": MockResource(),
            "indexed_fields": [MockField()],
            "data_fields": [],
        }
        
        content = template.render(**context)
        
        assert "@mcp.tool" in content
        assert "get_transfer_events" in content
