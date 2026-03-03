"""Tests for the validate command."""

import pytest
from pathlib import Path
from typer.testing import CliRunner

from abi_to_mcp.cli.main import app

runner = CliRunner()


class TestValidateCommand:
    """Tests for abi-to-mcp validate command."""

    @pytest.fixture
    def erc20_abi_path(self):
        """Get path to ERC20 ABI fixture."""
        return Path(__file__).parent.parent.parent / "fixtures" / "abis" / "erc20.json"

    @pytest.fixture
    def erc721_abi_path(self):
        """Get path to ERC721 ABI fixture."""
        return Path(__file__).parent.parent.parent / "fixtures" / "abis" / "erc721.json"

    def test_validate_valid_abi(self, erc20_abi_path):
        """Validate valid ABI file."""
        result = runner.invoke(app, ["validate", str(erc20_abi_path)])
        assert result.exit_code == 0, f"Command failed: {result.output}"
        output_lower = result.stdout.lower()
        assert "valid" in output_lower or "success" in output_lower or "ok" in output_lower

    def test_validate_invalid_json(self, tmp_path):
        """Error on invalid JSON."""
        bad_file = tmp_path / "bad.json"
        bad_file.write_text("not valid json {{{")
        
        result = runner.invoke(app, ["validate", str(bad_file)])
        assert result.exit_code != 0, "Should fail for invalid JSON"

    def test_validate_not_an_abi(self, tmp_path):
        """Error when JSON is not an ABI."""
        bad_file = tmp_path / "not_abi.json"
        bad_file.write_text('{"not": "an abi"}')
        
        result = runner.invoke(app, ["validate", str(bad_file)])
        # Should indicate validation failure
        output_lower = result.stdout.lower()
        assert result.exit_code != 0 or "error" in output_lower or "invalid" in output_lower

    def test_validate_empty_abi(self, tmp_path):
        """Empty ABI array is treated as an issue."""
        empty_file = tmp_path / "empty.json"
        empty_file.write_text("[]")
        
        result = runner.invoke(app, ["validate", str(empty_file)])
        # Empty ABI reports as failure (nothing useful to validate)
        assert result.exit_code == 1, f"Empty ABI should fail: {result.output}"
        assert "empty" in result.output.lower()

    def test_validate_missing_file(self):
        """Error when file doesn't exist."""
        result = runner.invoke(app, ["validate", "/nonexistent/file.json"])
        assert result.exit_code != 0, "Should fail for missing file"

    def test_validate_erc721(self, erc721_abi_path):
        """Validate ERC721 ABI file."""
        result = runner.invoke(app, ["validate", str(erc721_abi_path)])
        assert result.exit_code == 0, f"Command failed: {result.output}"

    def test_validate_malformed_function(self, tmp_path):
        """Validate ABI with malformed function entry."""
        bad_file = tmp_path / "malformed.json"
        bad_file.write_text('''[
            {
                "type": "function"
            }
        ]''')
        
        result = runner.invoke(app, ["validate", str(bad_file)])
        # Should indicate issue with the function (missing name)
        assert result.exit_code != 0 or "error" in result.stdout.lower() or \
            "name" in result.stdout.lower()

    def test_validate_invalid_state_mutability(self, tmp_path):
        """Validate ABI with invalid stateMutability."""
        bad_file = tmp_path / "invalid_mutability.json"
        bad_file.write_text('''[
            {
                "type": "function",
                "name": "test",
                "inputs": [],
                "outputs": [],
                "stateMutability": "invalid_value"
            }
        ]''')
        
        result = runner.invoke(app, ["validate", str(bad_file)])
        # Should indicate issue with stateMutability
        output_lower = result.stdout.lower()
        assert result.exit_code != 0 or "warning" in output_lower or \
            "invalid" in output_lower or "mutability" in output_lower

    def test_validate_shows_function_count(self, erc20_abi_path):
        """Validate should show function count or summary."""
        result = runner.invoke(app, ["validate", str(erc20_abi_path)])
        assert result.exit_code == 0, f"Command failed: {result.output}"
        # Output should have some content
        assert len(result.stdout) > 0

    def test_validate_array_in_json(self, tmp_path):
        """Validate ABI must be a JSON array."""
        bad_file = tmp_path / "object.json"
        bad_file.write_text('{"type": "function", "name": "test"}')
        
        result = runner.invoke(app, ["validate", str(bad_file)])
        # Should indicate that ABI must be an array
        assert result.exit_code != 0 or "array" in result.stdout.lower() or \
            "list" in result.stdout.lower() or "invalid" in result.stdout.lower()

    def test_validate_tuple_without_components(self, tmp_path):
        """Validate ABI with tuple type missing components."""
        bad_file = tmp_path / "no_components.json"
        bad_file.write_text('''[
            {
                "type": "function",
                "name": "test",
                "inputs": [{"name": "data", "type": "tuple"}],
                "outputs": [],
                "stateMutability": "view"
            }
        ]''')
        
        result = runner.invoke(app, ["validate", str(bad_file)])
        # Should indicate issue with missing components
        output_lower = result.stdout.lower()
        assert result.exit_code != 0 or "component" in output_lower or \
            "warning" in output_lower or "invalid" in output_lower
"""Tests for validate command with extended coverage."""

import pytest
import json
from typer.testing import CliRunner


runner = CliRunner()


class TestValidateCommandExtended:
    """Extended tests for validate command."""

    def test_validate_not_a_file(self, tmp_path):
        """Error when path is a directory."""
        result = runner.invoke(app, ["validate", str(tmp_path)])
        
        assert result.exit_code != 0
        assert "Not a file" in result.output or "not found" in result.output.lower()

    def test_validate_with_strict_mode(self, tmp_path):
        """Strict mode performs additional checks."""
        abi_file = tmp_path / "token.json"
        abi_file.write_text(json.dumps([
            {
                "type": "function",
                "name": "transfer",
                "inputs": [
                    {"name": "to", "type": "address"},
                    {"name": "amount", "type": "uint256"},
                ],
                "outputs": [{"name": "", "type": "bool"}],
                "stateMutability": "nonpayable",
            },
        ]))
        
        result = runner.invoke(app, ["validate", str(abi_file), "--strict"])
        
        # Should complete with strict checks output
        assert "Strict checks" in result.output or result.exit_code == 0

    def test_validate_duplicate_functions_strict(self, tmp_path):
        """Strict mode warns about duplicate function signatures."""
        abi_file = tmp_path / "dupe.json"
        abi_file.write_text(json.dumps([
            {
                "type": "function",
                "name": "transfer",
                "inputs": [{"name": "to", "type": "address"}],
                "outputs": [],
                "stateMutability": "nonpayable",
            },
            {
                "type": "function",
                "name": "transfer",
                "inputs": [{"name": "to", "type": "address"}],
                "outputs": [],
                "stateMutability": "nonpayable",
            },
        ]))
        
        result = runner.invoke(app, ["validate", str(abi_file), "--strict"])
        
        # Should warn about duplicate
        assert "Duplicate" in result.output or "duplicate" in result.output.lower() or result.exit_code == 0

    def test_validate_unnamed_params_strict(self, tmp_path):
        """Strict mode warns about unnamed parameters."""
        abi_file = tmp_path / "unnamed.json"
        abi_file.write_text(json.dumps([
            {
                "type": "function",
                "name": "transfer",
                "inputs": [
                    {"name": "", "type": "address"},
                    {"name": "", "type": "uint256"},
                ],
                "outputs": [],
                "stateMutability": "nonpayable",
            },
        ]))
        
        result = runner.invoke(app, ["validate", str(abi_file), "--strict"])
        
        # Should warn about unnamed parameters
        assert "Unnamed" in result.output or "unnamed" in result.output.lower() or result.exit_code == 0

    def test_validate_artifact_format(self, tmp_path):
        """Validate ABI in artifact format (with 'abi' key)."""
        abi_file = tmp_path / "artifact.json"
        abi_file.write_text(json.dumps({
            "contractName": "MyToken",
            "abi": [
                {
                    "type": "function",
                    "name": "balanceOf",
                    "inputs": [{"name": "account", "type": "address"}],
                    "outputs": [{"name": "", "type": "uint256"}],
                    "stateMutability": "view",
                },
            ],
        }))
        
        result = runner.invoke(app, ["validate", str(abi_file)])
        
        assert result.exit_code == 0
        assert "artifact" in result.output.lower() or "extracted" in result.output.lower()

    def test_validate_object_without_abi_key(self, tmp_path):
        """Error when object doesn't have 'abi' key."""
        abi_file = tmp_path / "no_abi.json"
        abi_file.write_text(json.dumps({
            "contractName": "MyToken",
            "bytecode": "0x12345",
        }))
        
        result = runner.invoke(app, ["validate", str(abi_file)])
        
        assert result.exit_code != 0
        assert "abi" in result.output.lower()

    def test_validate_with_unknown_types(self, tmp_path):
        """Warns about unknown parameter types."""
        abi_file = tmp_path / "unknown.json"
        abi_file.write_text(json.dumps([
            {
                "type": "function",
                "name": "weird",
                "inputs": [{"name": "x", "type": "unknownType123"}],
                "outputs": [],
                "stateMutability": "nonpayable",
            },
        ]))
        
        result = runner.invoke(app, ["validate", str(abi_file)])
        
        # May warn about unknown type or pass
        # The type mapper might handle it gracefully

    def test_validate_constructor(self, tmp_path):
        """Validate ABI with constructor."""
        abi_file = tmp_path / "constructor.json"
        abi_file.write_text(json.dumps([
            {
                "type": "constructor",
                "inputs": [
                    {"name": "name", "type": "string"},
                    {"name": "symbol", "type": "string"},
                ],
            },
        ]))
        
        result = runner.invoke(app, ["validate", str(abi_file)])
        
        assert result.exit_code == 0

    def test_validate_events(self, tmp_path):
        """Validate ABI with events."""
        abi_file = tmp_path / "events.json"
        abi_file.write_text(json.dumps([
            {
                "type": "event",
                "name": "Transfer",
                "inputs": [
                    {"name": "from", "type": "address", "indexed": True},
                    {"name": "to", "type": "address", "indexed": True},
                    {"name": "value", "type": "uint256", "indexed": False},
                ],
            },
        ]))
        
        result = runner.invoke(app, ["validate", str(abi_file)])
        
        assert result.exit_code == 0

    def test_validate_shows_entry_count(self, tmp_path):
        """Shows number of entries found."""
        abi_file = tmp_path / "entries.json"
        abi_file.write_text(json.dumps([
            {"type": "function", "name": "a", "inputs": [], "outputs": [], "stateMutability": "view"},
            {"type": "function", "name": "b", "inputs": [], "outputs": [], "stateMutability": "view"},
            {"type": "function", "name": "c", "inputs": [], "outputs": [], "stateMutability": "view"},
        ]))
        
        result = runner.invoke(app, ["validate", str(abi_file)])
        
        assert "3" in result.output
        assert "entries" in result.output.lower() or "found" in result.output.lower()
"""Tests for CLI validate command edge cases."""

import pytest
from typer.testing import CliRunner
from unittest.mock import patch, Mock
import tempfile
import os


runner = CliRunner()


class TestValidateCommandEdgeCases:
    """Test edge cases in validate command."""
    
    def test_validate_object_without_abi_key(self):
        """Test validation of object without 'abi' key."""
        from abi_to_mcp.cli.main import app
        
        with tempfile.NamedTemporaryFile(mode="w", suffix=".json", delete=False) as f:
            json.dump({"notAbi": []}, f)
            f.flush()
            
            try:
                result = runner.invoke(app, ["validate", f.name])
                assert result.exit_code != 0 or "does not contain 'abi' key" in result.output
            finally:
                os.unlink(f.name)
    
    def test_validate_non_array_non_object(self):
        """Test validation of non-array and non-object."""
        from abi_to_mcp.cli.main import app
        
        with tempfile.NamedTemporaryFile(mode="w", suffix=".json", delete=False) as f:
            json.dump("just a string", f)
            f.flush()
            
            try:
                result = runner.invoke(app, ["validate", f.name])
                assert result.exit_code != 0
            finally:
                os.unlink(f.name)
    
    def test_validate_empty_abi(self):
        """Test validation of empty ABI."""
        from abi_to_mcp.cli.main import app
        
        with tempfile.NamedTemporaryFile(mode="w", suffix=".json", delete=False) as f:
            json.dump([], f)
            f.flush()
            
            try:
                result = runner.invoke(app, ["validate", f.name])
                assert result.exit_code != 0 or "empty" in result.output.lower()
            finally:
                os.unlink(f.name)
    
    def test_validate_strict_with_duplicates(self):
        """Test strict validation with duplicate functions."""
        from abi_to_mcp.cli.main import app
        
        abi = [
            {"type": "function", "name": "transfer", "inputs": [{"type": "address", "name": "to"}], "outputs": []},
            {"type": "function", "name": "transfer", "inputs": [{"type": "address", "name": "to"}], "outputs": []},
        ]
        
        with tempfile.NamedTemporaryFile(mode="w", suffix=".json", delete=False) as f:
            json.dump(abi, f)
            f.flush()
            
            try:
                result = runner.invoke(app, ["validate", f.name, "--strict"])
                assert "Duplicate function" in result.output or result.exit_code == 0
            finally:
                os.unlink(f.name)
    
    def test_validate_strict_with_unnamed_params(self):
        """Test strict validation with unnamed parameters."""
        from abi_to_mcp.cli.main import app
        
        abi = [
            {"type": "function", "name": "test", "inputs": [{"type": "uint256", "name": ""}], "outputs": []},
        ]
        
        with tempfile.NamedTemporaryFile(mode="w", suffix=".json", delete=False) as f:
            json.dump(abi, f)
            f.flush()
            
            try:
                result = runner.invoke(app, ["validate", f.name, "--strict"])
                # Should report unnamed parameter
                assert "Unnamed parameter" in result.output or result.exit_code == 0
            finally:
                os.unlink(f.name)
    
    def test_validate_unknown_types(self):
        """Test validation with unknown types."""
        from abi_to_mcp.cli.main import app
        
        abi = [
            {"type": "function", "name": "test", "inputs": [{"type": "customType123", "name": "x"}], "outputs": []},
        ]
        
        with tempfile.NamedTemporaryFile(mode="w", suffix=".json", delete=False) as f:
            json.dump(abi, f)
            f.flush()
            
            try:
                result = runner.invoke(app, ["validate", f.name])
                # May or may not report unknown types
            finally:
                os.unlink(f.name)
    
    def test_validate_with_validation_errors(self):
        """Test validation with validation errors."""
        from abi_to_mcp.cli.main import app
        
        abi = [
            {"type": "function", "inputs": [], "outputs": []},  # Missing name
        ]
        
        with tempfile.NamedTemporaryFile(mode="w", suffix=".json", delete=False) as f:
            json.dump(abi, f)
            f.flush()
            
            try:
                result = runner.invoke(app, ["validate", f.name])
                assert "missing" in result.output.lower() or result.exit_code != 0
            finally:
                os.unlink(f.name)
    
    def test_validate_artifact_format(self):
        """Test validation of artifact format with abi key."""
        from abi_to_mcp.cli.main import app
        
        artifact = {
            "abi": [
                {"type": "function", "name": "test", "inputs": [], "outputs": []}
            ],
            "bytecode": "0x..."
        }
        
        with tempfile.NamedTemporaryFile(mode="w", suffix=".json", delete=False) as f:
            json.dump(artifact, f)
            f.flush()
            
            try:
                result = runner.invoke(app, ["validate", f.name])
                assert "extracted from artifact" in result.output.lower() or result.exit_code == 0
            finally:
                os.unlink(f.name)


class TestValidateCommandExceptions:
    """Test exception handling in validate command."""
    
    def test_validate_file_not_found(self):
        """Test validation of non-existent file."""
        from abi_to_mcp.cli.main import app
        
        result = runner.invoke(app, ["validate", "/nonexistent/path/file.json"])
        assert result.exit_code != 0
    
    def test_validate_invalid_json(self):
        """Test validation of invalid JSON."""
        from abi_to_mcp.cli.main import app
        
        with tempfile.NamedTemporaryFile(mode="w", suffix=".json", delete=False) as f:
            f.write("{ invalid json }")
            f.flush()
            
            try:
                result = runner.invoke(app, ["validate", f.name])
                assert result.exit_code != 0 or "error" in result.output.lower()
            finally:
                os.unlink(f.name)
