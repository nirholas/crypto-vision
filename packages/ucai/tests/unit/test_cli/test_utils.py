"""Tests for CLI utility functions."""

import pytest
import sys
from unittest.mock import patch, MagicMock

from abi_to_mcp.cli.utils import handle_error, confirm, console


class TestHandleError:
    """Tests for handle_error function."""

    def test_handle_error_prints_message(self, capsys):
        """Error message is printed."""
        with patch.object(console, 'print') as mock_print:
            with pytest.raises(SystemExit) as exc_info:
                handle_error(ValueError("Test error"))
            
            assert exc_info.value.code == 1
            mock_print.assert_called()
            # Check that "Error" appears in print calls
            call_args = str(mock_print.call_args_list)
            assert "Error" in call_args or "Test error" in call_args

    def test_handle_error_exits_with_code_1(self):
        """Exit code should be 1."""
        with patch.object(console, 'print'):
            with pytest.raises(SystemExit) as exc_info:
                handle_error(Exception("any error"))
            
            assert exc_info.value.code == 1

    def test_handle_error_verbose_shows_traceback(self):
        """Verbose mode shows traceback."""
        with patch.object(console, 'print') as mock_print:
            with pytest.raises(SystemExit):
                handle_error(RuntimeError("verbose error"), verbose=True)
            
            # Should have multiple print calls when verbose
            assert mock_print.call_count >= 2

    def test_handle_error_non_verbose_no_traceback(self):
        """Non-verbose mode hides traceback."""
        with patch.object(console, 'print') as mock_print:
            with pytest.raises(SystemExit):
                handle_error(RuntimeError("simple error"), verbose=False)
            
            # Should have fewer print calls when not verbose
            assert mock_print.call_count == 1


class TestConfirm:
    """Tests for confirm function."""

    def test_confirm_yes_response(self):
        """'y' response returns True."""
        with patch.object(console, 'input', return_value='y'):
            result = confirm("Continue?")
            assert result is True

    def test_confirm_yes_full_response(self):
        """'yes' response returns True."""
        with patch.object(console, 'input', return_value='yes'):
            result = confirm("Continue?")
            assert result is True

    def test_confirm_no_response(self):
        """'n' response returns False."""
        with patch.object(console, 'input', return_value='n'):
            result = confirm("Continue?")
            assert result is False

    def test_confirm_empty_uses_default_false(self):
        """Empty response uses default (False)."""
        with patch.object(console, 'input', return_value=''):
            result = confirm("Continue?", default=False)
            assert result is False

    def test_confirm_empty_uses_default_true(self):
        """Empty response uses default (True)."""
        with patch.object(console, 'input', return_value=''):
            result = confirm("Continue?", default=True)
            assert result is True

    def test_confirm_uppercase_yes(self):
        """'Y' response returns True."""
        with patch.object(console, 'input', return_value='Y'):
            result = confirm("Continue?")
            assert result is True

    def test_confirm_case_insensitive(self):
        """'YES' response returns True."""
        with patch.object(console, 'input', return_value='YES'):
            result = confirm("Continue?")
            assert result is True
