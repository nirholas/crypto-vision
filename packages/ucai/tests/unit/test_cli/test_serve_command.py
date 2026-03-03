"""Tests for the serve command."""

import pytest
from pathlib import Path
from typer.testing import CliRunner

from abi_to_mcp.cli.main import app

runner = CliRunner()


class TestServeCommand:
    """Tests for abi-to-mcp serve command."""

    def test_serve_help(self):
        """Serve command should show help."""
        result = runner.invoke(app, ["serve", "--help"])
        assert result.exit_code == 0, f"Command failed: {result.output}"
        assert "serve" in result.stdout.lower()

    def test_serve_missing_directory(self, tmp_path):
        """Error when directory doesn't exist."""
        result = runner.invoke(app, ["serve", str(tmp_path / "nonexistent")])
        assert result.exit_code != 0, "Should fail for missing directory"

    def test_serve_no_server_py(self, tmp_path):
        """Error when server.py doesn't exist in directory."""
        # Create empty directory
        empty_dir = tmp_path / "empty"
        empty_dir.mkdir()
        
        result = runner.invoke(app, ["serve", str(empty_dir)])
        assert result.exit_code != 0, "Should fail when server.py is missing"
        assert "server.py" in result.output.lower() or "not found" in result.output.lower()

    def test_serve_with_port_option(self):
        """Serve command should accept port option."""
        result = runner.invoke(app, ["serve", "--help"])
        assert result.exit_code == 0
        # Should show port option in help
        assert "port" in result.stdout.lower()

    def test_serve_with_transport_option(self):
        """Serve command should accept transport option."""
        result = runner.invoke(app, ["serve", "--help"])
        assert result.exit_code == 0
        # Should show transport option in help (stdio/http)
        output_lower = result.stdout.lower()
        assert "transport" in output_lower or "stdio" in output_lower or "http" in output_lower
"""Tests for serve command with extended coverage."""

from unittest.mock import patch, Mock
from typer.testing import CliRunner

from abi_to_mcp.cli.commands.serve import serve

runner = CliRunner()


class TestServeFunction:
    """Tests for serve function directly."""

    def test_serve_missing_server_py(self, tmp_path):
        """Error when server.py not found."""
        with pytest.raises(SystemExit) as exc_info:
            serve(tmp_path, port=8000)
        
        assert exc_info.value.code == 1

    def test_serve_with_requirements_warning(self, tmp_path):
        """Shows requirements warning when requirements.txt exists."""
        # Create server.py
        server_file = tmp_path / "server.py"
        server_file.write_text("# mock server")
        
        # Create requirements.txt
        req_file = tmp_path / "requirements.txt"
        req_file.write_text("mcp>=0.1.0")
        
        with patch('subprocess.run') as mock_run:
            mock_run.return_value = Mock(returncode=0)
            
            # Should complete without error
            serve(tmp_path, port=8000)

    def test_serve_with_env_warning(self, tmp_path):
        """Shows warning when .env.example exists but .env doesn't."""
        # Create server.py
        server_file = tmp_path / "server.py"
        server_file.write_text("# mock server")
        
        # Create .env.example but not .env
        env_example = tmp_path / ".env.example"
        env_example.write_text("RPC_URL=\nPRIVATE_KEY=")
        
        with patch('subprocess.run') as mock_run:
            mock_run.return_value = Mock(returncode=0)
            
            serve(tmp_path, port=8000)

    def test_serve_http_transport(self, tmp_path):
        """Serve with HTTP transport."""
        server_file = tmp_path / "server.py"
        server_file.write_text("# mock server")
        
        with patch('subprocess.run') as mock_run:
            mock_run.return_value = Mock(returncode=0)
            
            serve(tmp_path, port=8080, transport="http")
            
            # Check command includes http args
            call_args = mock_run.call_args[1] if mock_run.call_args[1] else {}
            cmd = mock_run.call_args[0][0] if mock_run.call_args[0] else []
            assert "--transport" in cmd or "http" in str(cmd)

    def test_serve_unknown_transport(self, tmp_path):
        """Error with unknown transport."""
        server_file = tmp_path / "server.py"
        server_file.write_text("# mock server")
        
        with pytest.raises(SystemExit) as exc_info:
            serve(tmp_path, port=8000, transport="unknown")
        
        assert exc_info.value.code == 1

    def test_serve_keyboard_interrupt(self, tmp_path):
        """Handle keyboard interrupt gracefully."""
        server_file = tmp_path / "server.py"
        server_file.write_text("# mock server")
        
        with patch('subprocess.run') as mock_run:
            mock_run.side_effect = KeyboardInterrupt()
            
            # Should not raise, just exit cleanly
            serve(tmp_path, port=8000)

    def test_serve_process_error(self, tmp_path):
        """Handle process errors."""
        server_file = tmp_path / "server.py"
        server_file.write_text("# mock server")
        
        with patch('subprocess.run') as mock_run:
            mock_run.return_value = Mock(returncode=1)
            
            with pytest.raises(SystemExit) as exc_info:
                serve(tmp_path, port=8000)
            
            assert exc_info.value.code == 1

    def test_serve_exception_handling(self, tmp_path):
        """Handle unexpected exceptions."""
        server_file = tmp_path / "server.py"
        server_file.write_text("# mock server")
        
        with patch('subprocess.run') as mock_run:
            mock_run.side_effect = Exception("unexpected error")
            
            with pytest.raises(SystemExit) as exc_info:
                serve(tmp_path, port=8000)
            
            assert exc_info.value.code == 1


class TestServeCommandCLI:
    """Tests for serve CLI command."""

    def test_serve_command_exists(self):
        """Serve command is registered."""
        result = runner.invoke(app, ["serve", "--help"])
        
        assert result.exit_code == 0
        assert "directory" in result.output.lower() or "path" in result.output.lower()
