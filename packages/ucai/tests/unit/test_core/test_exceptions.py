"""Tests for exceptions module with extended coverage."""

import pytest

from abi_to_mcp.core.exceptions import (
    ABIToMCPError,
    FetcherError,
    ABINotFoundError,
    ContractNotVerifiedError,
    NetworkError,
    RateLimitError,
    InvalidAddressError,
    ParserError,
    ABIParseError,
    ABIValidationError,
    UnsupportedTypeError,
    GeneratorError,
    TemplateError,
    CodeGenerationError,
    OutputDirectoryError,
    RuntimeError as ABIRuntimeError,
    Web3ConnectionError,
    TransactionError,
    GasEstimationError,
    SimulationError,
    SignerError,
    SignerNotConfiguredError,
    InsufficientFundsError,
    CLIError,
    InvalidInputError,
    ConfigurationError,
)


class TestABIToMCPError:
    """Tests for base exception."""

    def test_basic_error(self):
        """Create basic error."""
        error = ABIToMCPError("Something went wrong")
        
        assert str(error) == "Something went wrong"
        assert error.message == "Something went wrong"
        assert error.details == {}

    def test_error_with_details(self):
        """Create error with details."""
        error = ABIToMCPError("Error", details={"key": "value"})
        
        assert "key" in str(error)
        assert error.details == {"key": "value"}


class TestFetcherErrors:
    """Tests for fetcher exceptions."""

    def test_abi_not_found(self):
        """ABINotFoundError creation."""
        error = ABINotFoundError(
            source="0x1234",
            reason="Contract not verified",
            network="mainnet",
        )
        
        assert "0x1234" in str(error)
        assert error.source == "0x1234"
        assert error.reason == "Contract not verified"
        assert error.network == "mainnet"

    def test_contract_not_verified(self):
        """ContractNotVerifiedError creation."""
        error = ContractNotVerifiedError(
            address="0x" + "1" * 40,
            network="mainnet",
        )
        
        assert "not verified" in str(error).lower()
        assert error.address == "0x" + "1" * 40
        assert error.network == "mainnet"

    def test_network_error(self):
        """NetworkError creation."""
        error = NetworkError(
            message="Connection failed",
            url="https://api.etherscan.io",
            status_code=500,
        )
        
        assert "Connection failed" in str(error)
        assert error.details["url"] == "https://api.etherscan.io"
        assert error.details["status_code"] == 500

    def test_rate_limit_error(self):
        """RateLimitError creation."""
        error = RateLimitError(
            service="Etherscan",
            retry_after=60,
        )
        
        assert "rate limit" in str(error).lower()
        assert error.service == "Etherscan"
        assert error.retry_after == 60

    def test_invalid_address_error(self):
        """InvalidAddressError creation."""
        error = InvalidAddressError(address="invalid")
        
        assert "Invalid" in str(error)
        assert error.address == "invalid"


class TestParserErrors:
    """Tests for parser exceptions."""

    def test_parser_error(self):
        """ParserError creation."""
        error = ParserError("Failed to parse ABI")
        
        assert "parse" in str(error).lower()

    def test_abi_parse_error(self):
        """ABIParseError creation."""
        error = ABIParseError(
            message="Invalid ABI format",
            entry_index=5,
            entry_type="function",
        )
        
        assert error.entry_index == 5
        assert error.entry_type == "function"

    def test_abi_validation_error(self):
        """ABIValidationError creation."""
        error = ABIValidationError(errors=["error1", "error2"])
        
        assert len(error.errors) == 2
        assert "2 error" in str(error)

    def test_unsupported_type_error(self):
        """UnsupportedTypeError creation."""
        error = UnsupportedTypeError(
            solidity_type="custom_type",
            context="function parameter",
        )
        
        assert "custom_type" in str(error)
        assert error.solidity_type == "custom_type"


class TestGeneratorErrors:
    """Tests for generator exceptions."""

    def test_generator_error(self):
        """GeneratorError creation."""
        error = GeneratorError("Failed to generate server")
        
        assert "generate" in str(error).lower()

    def test_template_error(self):
        """TemplateError creation."""
        error = TemplateError(
            template_name="server.py.jinja2",
            original_error=ValueError("bad value"),
        )
        
        assert error.template_name == "server.py.jinja2"
        assert error.original_error is not None

    def test_code_generation_error(self):
        """CodeGenerationError creation."""
        error = CodeGenerationError(
            message="Code generation failed",
            function_name="transfer",
        )
        
        assert error.function_name == "transfer"

    def test_output_directory_error(self):
        """OutputDirectoryError creation."""
        error = OutputDirectoryError(path="/output", reason="exists")
        
        assert error.path == "/output"
        assert error.reason == "exists"


class TestRuntimeErrors:
    """Tests for runtime exceptions."""

    def test_web3_connection_error(self):
        """Web3ConnectionError creation."""
        error = Web3ConnectionError(
            rpc_url="https://rpc.mainnet.eth",
            original_error=ConnectionError("failed"),
        )
        
        assert "rpc.mainnet" in str(error)

    def test_transaction_error(self):
        """TransactionError creation."""
        error = TransactionError(
            message="Transaction failed",
            tx_hash="0x" + "a" * 64,
        )
        
        assert error.tx_hash == "0x" + "a" * 64

    def test_simulation_error(self):
        """SimulationError creation."""
        error = SimulationError(
            message="Simulation failed",
            function_name="transfer",
        )
        
        assert error.function_name == "transfer"

    def test_signer_error(self):
        """SignerError creation."""
        error = SignerError(
            message="Invalid private key",
        )
        
        assert "Invalid" in str(error)

    def test_gas_estimation_error(self):
        """GasEstimationError creation."""
        error = GasEstimationError(
            message="Gas estimation failed",
            function_name="transfer",
        )
        
        assert error.function_name == "transfer"

    def test_signer_not_configured_error(self):
        """SignerNotConfiguredError creation."""
        error = SignerNotConfiguredError()
        
        assert "PRIVATE_KEY" in str(error)

    def test_insufficient_funds_error(self):
        """InsufficientFundsError creation."""
        error = InsufficientFundsError(
            required=1000,
            available=500,
            currency="ETH",
        )
        
        assert error.required == 1000
        assert error.available == 500


class TestConfigErrors:
    """Tests for configuration exceptions."""

    def test_cli_error(self):
        """CLIError creation."""
        error = CLIError(message="CLI failed")
        
        assert error.exit_code == 1

    def test_invalid_input_error(self):
        """InvalidInputError creation."""
        error = InvalidInputError(message="Bad input", argument="--file")
        
        assert error.argument == "--file"
        assert error.exit_code == 2

    def test_configuration_error(self):
        """ConfigurationError creation."""
        error = ConfigurationError(message="Invalid configuration")
        
        assert error.exit_code == 3
