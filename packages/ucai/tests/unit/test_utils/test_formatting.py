"""Tests for formatting utilities."""

import pytest

from abi_to_mcp.utils.formatting import (
    format_address,
    format_wei,
    format_gas_price,
    truncate_middle,
    snake_to_camel,
    camel_to_snake,
)


def test_format_address():
    """Test address formatting."""
    address = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"
    
    # Full format
    assert format_address(address) == address
    
    # Short format
    short = format_address(address, short=True)
    assert short == "0xA0b8...eB48"
    assert len(short) < len(address)


def test_format_wei():
    """Test wei formatting."""
    # 1 ETH
    assert "1" in format_wei(10**18)
    assert "ETH" in format_wei(10**18)
    
    # 0.5 ETH
    assert "0.5" in format_wei(5 * 10**17)
    
    # Custom decimals (USDC = 6 decimals)
    assert "1000" in format_wei(1000_000000, decimals=6, symbol="USDC")


def test_format_gas_price():
    """Test gas price formatting."""
    assert "50" in format_gas_price(50)
    assert "gwei" in format_gas_price(50)
    assert "0.5" in format_gas_price(0.5)


def test_truncate_middle():
    """Test middle truncation."""
    long_text = "a" * 100
    truncated = truncate_middle(long_text, max_length=20)
    
    assert len(truncated) <= 20
    assert "..." in truncated
    assert truncated.startswith("a")
    assert truncated.endswith("a")
    
    # Short text unchanged
    short_text = "hello"
    assert truncate_middle(short_text, max_length=20) == short_text


def test_snake_to_camel():
    """Test snake_case to camelCase conversion."""
    assert snake_to_camel("hello_world") == "helloWorld"
    assert snake_to_camel("foo_bar_baz") == "fooBarBaz"
    assert snake_to_camel("single") == "single"


def test_camel_to_snake():
    """Test camelCase to snake_case conversion."""
    assert camel_to_snake("helloWorld") == "hello_world"
    assert camel_to_snake("fooBarBaz") == "foo_bar_baz"
    assert camel_to_snake("single") == "single"
    assert camel_to_snake("HTTPSConnection") == "h_t_t_p_s_connection"


def test_roundtrip_conversion():
    """Test snake/camel conversion roundtrip."""
    original = "hello_world_test"
    camel = snake_to_camel(original)
    back_to_snake = camel_to_snake(camel)
    assert back_to_snake == original
"""Tests for formatting utilities."""


from abi_to_mcp.utils.formatting import (
    format_function_signature,
    format_bytes_size,
    format_table_row,
)


class TestFormatAddress:
    """Tests for format_address function."""

    def test_format_full_address(self):
        """Format full address."""
        address = "0x1234567890abcdef1234567890abcdef12345678"
        result = format_address(address)

        assert result == address

    def test_format_short_address(self):
        """Format shortened address."""
        address = "0x1234567890abcdef1234567890abcdef12345678"
        result = format_address(address, short=True)

        assert result == "0x1234...5678"

    def test_format_empty_address(self):
        """Empty address returns empty string."""
        result = format_address("")

        assert result == ""

    def test_format_none_address(self):
        """None address returns empty string."""
        result = format_address(None)

        assert result == ""


class TestFormatWei:
    """Tests for format_wei function."""

    def test_format_zero_wei(self):
        """Format zero wei."""
        result = format_wei(0)

        assert result == "0 ETH"

    def test_format_1_eth(self):
        """Format 1 ETH."""
        result = format_wei(10**18)

        assert "1" in result
        assert "ETH" in result

    def test_format_small_amount(self):
        """Format very small amount."""
        result = format_wei(100)  # 100 wei

        assert "ETH" in result

    def test_format_string_wei(self):
        """Format wei from string."""
        result = format_wei("1000000000000000000")

        assert "1" in result
        assert "ETH" in result

    def test_format_custom_symbol(self):
        """Format with custom symbol."""
        result = format_wei(10**18, symbol="MATIC")

        assert "MATIC" in result

    def test_format_custom_decimals(self):
        """Format with custom decimals."""
        result = format_wei(10**6, decimals=6, symbol="USDC")

        assert "1" in result
        assert "USDC" in result


class TestFormatGasPrice:
    """Tests for format_gas_price function."""

    def test_format_integer_gwei(self):
        """Format integer gwei."""
        result = format_gas_price(50)

        assert "50" in result
        assert "gwei" in result

    def test_format_float_gwei(self):
        """Format float gwei."""
        result = format_gas_price(50.5)

        assert "50.5" in result
        assert "gwei" in result

    def test_format_small_gwei(self):
        """Format small gwei value."""
        result = format_gas_price(0.5)

        assert "0.5" in result or "0.50" in result
        assert "gwei" in result


class TestTruncateMiddle:
    """Tests for truncate_middle function."""

    def test_short_text_unchanged(self):
        """Short text is unchanged."""
        result = truncate_middle("short", max_length=50)

        assert result == "short"

    def test_long_text_truncated(self):
        """Long text is truncated."""
        long_text = "a" * 100
        result = truncate_middle(long_text, max_length=20)

        assert len(result) <= 20
        assert "..." in result

    def test_exact_length_unchanged(self):
        """Text at max length is unchanged."""
        text = "exactly50chars" + "x" * 36
        result = truncate_middle(text, max_length=50)

        assert result == text


class TestSnakeToCamel:
    """Tests for snake_to_camel function."""

    def test_simple_conversion(self):
        """Convert simple snake_case."""
        result = snake_to_camel("get_balance")

        assert result == "getBalance"

    def test_multiple_underscores(self):
        """Convert multiple underscores."""
        result = snake_to_camel("get_user_balance_by_id")

        assert result == "getUserBalanceById"

    def test_single_word(self):
        """Single word unchanged."""
        result = snake_to_camel("balance")

        assert result == "balance"


class TestCamelToSnake:
    """Tests for camel_to_snake function."""

    def test_simple_conversion(self):
        """Convert simple camelCase."""
        result = camel_to_snake("getBalance")

        assert result == "get_balance"

    def test_multiple_words(self):
        """Convert multiple words."""
        result = camel_to_snake("getUserBalanceById")

        assert result == "get_user_balance_by_id"

    def test_single_word(self):
        """Single lowercase word unchanged."""
        result = camel_to_snake("balance")

        assert result == "balance"


class TestFormatFunctionSignature:
    """Tests for format_function_signature function."""

    def test_simple_function(self):
        """Format simple function signature."""
        result = format_function_signature("transfer", [
            {"type": "address"},
            {"type": "uint256"},
        ])

        assert result == "transfer(address,uint256)"

    def test_no_params(self):
        """Format function with no parameters."""
        result = format_function_signature("totalSupply", [])

        assert result == "totalSupply()"


class TestFormatBytesSize:
    """Tests for format_bytes_size function."""

    def test_format_bytes(self):
        """Format bytes."""
        result = format_bytes_size(500)

        assert result == "500 B"

    def test_format_kilobytes(self):
        """Format kilobytes."""
        result = format_bytes_size(1500)

        assert "KB" in result

    def test_format_megabytes(self):
        """Format megabytes."""
        result = format_bytes_size(1500000)

        assert "MB" in result

    def test_format_gigabytes(self):
        """Format gigabytes."""
        result = format_bytes_size(1500000000)

        assert "GB" in result


class TestFormatTableRow:
    """Tests for format_table_row function."""

    def test_format_row(self):
        """Format a table row."""
        result = format_table_row(["Name", "Value"], [10, 10])

        assert "Name" in result
        assert "Value" in result
        assert "|" in result

    def test_truncate_long_column(self):
        """Truncate long column value."""
        result = format_table_row(["VeryLongColumnValue"], [10])

        assert len(result.split("|")[0].strip()) <= 10
        assert "..." in result
