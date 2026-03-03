"""CLI integration tests."""

import pytest
from pathlib import Path
from typer.testing import CliRunner

from abi_to_mcp.cli.main import app

runner = CliRunner()


@pytest.mark.integration
def test_cli_help():
    """Test CLI shows help."""
    result = runner.invoke(app, ["--help"])
    assert result.exit_code == 0
    assert "UCAI" in result.output


@pytest.mark.integration
def test_generate_command_help():
    """Test generate command shows help."""
    result = runner.invoke(app, ["generate", "--help"])
    assert result.exit_code == 0
    assert "Generate an MCP server" in result.output


@pytest.mark.integration
def test_inspect_command_help():
    """Test inspect command shows help."""
    result = runner.invoke(app, ["inspect", "--help"])
    assert result.exit_code == 0
    assert "Inspect an ABI" in result.output


@pytest.mark.integration
def test_validate_command_help():
    """Test validate command shows help."""
    result = runner.invoke(app, ["validate", "--help"])
    assert result.exit_code == 0
    assert "Validate an ABI" in result.output


@pytest.mark.integration
def test_serve_command_help():
    """Test serve command shows help."""
    result = runner.invoke(app, ["serve", "--help"])
    assert result.exit_code == 0
    assert "Run a generated MCP server" in result.output


@pytest.mark.integration
def test_networks_command():
    """Test networks command lists supported networks."""
    result = runner.invoke(app, ["networks"])
    assert result.exit_code == 0
    assert "mainnet" in result.output.lower()
    assert "polygon" in result.output.lower()


# More comprehensive integration tests will be added as other agents complete their modules
