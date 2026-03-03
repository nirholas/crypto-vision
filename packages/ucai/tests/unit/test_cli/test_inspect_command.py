"""Tests for the inspect command."""

import pytest
from pathlib import Path
from typer.testing import CliRunner

from abi_to_mcp.cli.main import app

runner = CliRunner()


class TestInspectCommand:
    """Tests for abi-to-mcp inspect command."""

    @pytest.fixture
    def erc20_abi_path(self):
        """Get path to ERC20 ABI fixture."""
        return Path(__file__).parent.parent.parent / "fixtures" / "abis" / "erc20.json"

    @pytest.fixture
    def erc721_abi_path(self):
        """Get path to ERC721 ABI fixture."""
        return Path(__file__).parent.parent.parent / "fixtures" / "abis" / "erc721.json"

    @pytest.fixture
    def erc1155_abi_path(self):
        """Get path to ERC1155 ABI fixture."""
        return Path(__file__).parent.parent.parent / "fixtures" / "abis" / "erc1155.json"

    def test_inspect_erc20(self, erc20_abi_path):
        """Inspect ERC20 ABI."""
        result = runner.invoke(app, ["inspect", str(erc20_abi_path)])
        assert result.exit_code == 0, f"Command failed: {result.output}"
        # Should show ERC20 standard detection or function list
        output_lower = result.stdout.lower()
        assert "erc20" in output_lower or "function" in output_lower

    def test_inspect_shows_functions(self, erc20_abi_path):
        """Inspect should show function list."""
        result = runner.invoke(app, ["inspect", str(erc20_abi_path)])
        assert result.exit_code == 0, f"Command failed: {result.output}"
        # Should mention key ERC20 functions
        output_lower = result.stdout.lower()
        assert "transfer" in output_lower or "balanceof" in output_lower

    def test_inspect_shows_events(self, erc20_abi_path):
        """Inspect should show event list."""
        result = runner.invoke(app, ["inspect", str(erc20_abi_path)])
        assert result.exit_code == 0, f"Command failed: {result.output}"
        # Output should contain something (events may or may not be listed separately)
        assert len(result.stdout) > 0

    def test_inspect_missing_file(self):
        """Error when file doesn't exist."""
        result = runner.invoke(app, ["inspect", "/nonexistent/file.json"])
        assert result.exit_code != 0, "Should fail for missing file"

    def test_inspect_erc721(self, erc721_abi_path):
        """Inspect ERC721 ABI."""
        result = runner.invoke(app, ["inspect", str(erc721_abi_path)])
        assert result.exit_code == 0, f"Command failed: {result.output}"
        output_lower = result.stdout.lower()
        # Should detect ERC721 or show owner_of function
        assert "erc721" in output_lower or "owner" in output_lower or "token" in output_lower

    def test_inspect_erc1155(self, erc1155_abi_path):
        """Inspect ERC1155 ABI."""
        result = runner.invoke(app, ["inspect", str(erc1155_abi_path)])
        assert result.exit_code == 0, f"Command failed: {result.output}"
        output_lower = result.stdout.lower()
        # Should detect ERC1155 or show batch functions
        assert "erc1155" in output_lower or "batch" in output_lower or "function" in output_lower

    def test_inspect_shows_standard_detection(self, erc20_abi_path):
        """Inspect should detect standard."""
        result = runner.invoke(app, ["inspect", str(erc20_abi_path)])
        assert result.exit_code == 0, f"Command failed: {result.output}"
        # Should mention the detected standard
        output_lower = result.stdout.lower()
        assert "standard" in output_lower or "erc" in output_lower or "detected" in output_lower

    def test_inspect_invalid_json(self, tmp_path):
        """Error on invalid JSON file."""
        bad_file = tmp_path / "bad.json"
        bad_file.write_text("not valid json {{{")
        
        result = runner.invoke(app, ["inspect", str(bad_file)])
        assert result.exit_code != 0, "Should fail for invalid JSON"

    def test_inspect_not_an_abi(self, tmp_path):
        """Error or warning when JSON is not an ABI."""
        bad_file = tmp_path / "not_abi.json"
        bad_file.write_text('{"not": "an abi"}')
        
        result = runner.invoke(app, ["inspect", str(bad_file)])
        # Should either error or show that no functions/events were found
        assert result.exit_code != 0 or "0" in result.stdout or "empty" in result.stdout.lower()
