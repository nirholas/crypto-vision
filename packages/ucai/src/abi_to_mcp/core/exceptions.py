"""Custom exceptions for abi-to-mcp."""

from typing import Optional, List, Any


class ABIToMCPError(Exception):
    """Base exception for all abi-to-mcp errors."""

    def __init__(self, message: str, details: Optional[dict] = None):
        super().__init__(message)
        self.message = message
        self.details = details or {}

    def __str__(self) -> str:
        if self.details:
            return f"{self.message} | Details: {self.details}"
        return self.message


# =============================================================================
# Fetcher Exceptions
# =============================================================================


class FetcherError(ABIToMCPError):
    """Base exception for fetcher-related errors."""

    pass


class ABINotFoundError(FetcherError):
    """ABI could not be found at the specified source."""

    def __init__(
        self,
        source: str,
        reason: Optional[str] = None,
        network: Optional[str] = None,
    ):
        message = f"ABI not found: {source}"
        if reason:
            message += f" ({reason})"

        super().__init__(
            message,
            details={
                "source": source,
                "reason": reason,
                "network": network,
            },
        )
        self.source = source
        self.reason = reason
        self.network = network


class ContractNotVerifiedError(FetcherError):
    """Contract source code is not verified on the block explorer."""

    def __init__(self, address: str, network: str):
        super().__init__(
            f"Contract {address} is not verified on {network}",
            details={"address": address, "network": network},
        )
        self.address = address
        self.network = network


class NetworkError(FetcherError):
    """Network-related error during fetching."""

    def __init__(
        self,
        message: str,
        url: Optional[str] = None,
        status_code: Optional[int] = None,
    ):
        super().__init__(
            message,
            details={"url": url, "status_code": status_code},
        )
        self.url = url
        self.status_code = status_code


class RateLimitError(FetcherError):
    """Rate limit exceeded on external API."""

    def __init__(
        self,
        service: str,
        retry_after: Optional[int] = None,
    ):
        message = f"Rate limit exceeded on {service}"
        if retry_after:
            message += f". Retry after {retry_after} seconds"

        super().__init__(
            message,
            details={"service": service, "retry_after": retry_after},
        )
        self.service = service
        self.retry_after = retry_after


class InvalidAddressError(FetcherError):
    """Invalid Ethereum address format."""

    def __init__(self, address: str):
        super().__init__(
            f"Invalid Ethereum address: {address}",
            details={"address": address},
        )
        self.address = address


# =============================================================================
# Parser Exceptions
# =============================================================================


class ParserError(ABIToMCPError):
    """Base exception for parser-related errors."""

    pass


class ABIParseError(ParserError):
    """Error parsing ABI JSON."""

    def __init__(
        self,
        message: str,
        entry_index: Optional[int] = None,
        entry_type: Optional[str] = None,
    ):
        super().__init__(
            message,
            details={"entry_index": entry_index, "entry_type": entry_type},
        )
        self.entry_index = entry_index
        self.entry_type = entry_type


class ABIValidationError(ParserError):
    """ABI structure is invalid."""

    def __init__(self, errors: List[str]):
        message = f"ABI validation failed with {len(errors)} error(s)"
        super().__init__(message, details={"errors": errors})
        self.errors = errors


class UnsupportedTypeError(ParserError):
    """Encountered an unsupported Solidity type."""

    def __init__(self, solidity_type: str, context: Optional[str] = None):
        message = f"Unsupported Solidity type: {solidity_type}"
        if context:
            message += f" (in {context})"

        super().__init__(
            message,
            details={"type": solidity_type, "context": context},
        )
        self.solidity_type = solidity_type
        self.context = context


# =============================================================================
# Generator Exceptions
# =============================================================================


class GeneratorError(ABIToMCPError):
    """Base exception for generator-related errors."""

    pass


class TemplateError(GeneratorError):
    """Error rendering Jinja2 template."""

    def __init__(
        self,
        template_name: str,
        original_error: Optional[Exception] = None,
    ):
        message = f"Failed to render template: {template_name}"
        if original_error:
            message += f" ({original_error})"

        super().__init__(
            message,
            details={"template": template_name, "error": str(original_error)},
        )
        self.template_name = template_name
        self.original_error = original_error


class CodeGenerationError(GeneratorError):
    """Error generating Python code."""

    def __init__(
        self,
        message: str,
        function_name: Optional[str] = None,
        generated_code: Optional[str] = None,
    ):
        super().__init__(
            message,
            details={"function": function_name},
        )
        self.function_name = function_name
        self.generated_code = generated_code


class OutputDirectoryError(GeneratorError):
    """Error with output directory (exists, permissions, etc.)."""

    def __init__(self, path: str, reason: str):
        super().__init__(
            f"Output directory error: {reason}",
            details={"path": path, "reason": reason},
        )
        self.path = path
        self.reason = reason


# =============================================================================
# Runtime Exceptions
# =============================================================================


class RuntimeError(ABIToMCPError):
    """Base exception for runtime errors."""

    pass


class Web3ConnectionError(RuntimeError):
    """Failed to connect to Web3 provider."""

    def __init__(self, rpc_url: str, original_error: Optional[Exception] = None):
        message = f"Failed to connect to {rpc_url}"
        if original_error:
            message += f": {original_error}"

        super().__init__(
            message,
            details={"rpc_url": rpc_url, "error": str(original_error)},
        )
        self.rpc_url = rpc_url
        self.original_error = original_error


class TransactionError(RuntimeError):
    """Error building or sending transaction."""

    def __init__(
        self,
        message: str,
        tx_hash: Optional[str] = None,
        revert_reason: Optional[str] = None,
    ):
        super().__init__(
            message,
            details={"tx_hash": tx_hash, "revert_reason": revert_reason},
        )
        self.tx_hash = tx_hash
        self.revert_reason = revert_reason


class SimulationError(ABIToMCPError):
    """Error during transaction simulation."""

    def __init__(
        self,
        message: str,
        function_name: str = "",
        revert_reason: Optional[str] = None,
    ):
        super().__init__(
            message,
            details={"function": function_name, "revert_reason": revert_reason},
        )
        self.function_name = function_name
        self.revert_reason = revert_reason


class SignerError(ABIToMCPError):
    """Error related to transaction signing."""

    def __init__(
        self,
        message: str,
        address: Optional[str] = None,
    ):
        super().__init__(
            message,
            details={"address": address},
        )
        self.address = address


class GasEstimationError(ABIToMCPError):
    """Error during gas estimation."""

    def __init__(
        self,
        message: str,
        function_name: Optional[str] = None,
    ):
        super().__init__(
            message,
            details={"function": function_name},
        )
        self.function_name = function_name


class SignerNotConfiguredError(ABIToMCPError):
    """Private key not configured for write operations."""

    def __init__(self):
        super().__init__(
            "Private key not configured. Set PRIVATE_KEY environment variable for write operations.",
            details={"required_env_var": "PRIVATE_KEY"},
        )


class InsufficientFundsError(RuntimeError):
    """Insufficient funds for transaction."""

    def __init__(
        self,
        required: int,
        available: int,
        currency: str = "ETH",
    ):
        super().__init__(
            f"Insufficient funds: need {required} {currency}, have {available} {currency}",
            details={"required": required, "available": available, "currency": currency},
        )
        self.required = required
        self.available = available
        self.currency = currency


# =============================================================================
# CLI Exceptions
# =============================================================================


class CLIError(ABIToMCPError):
    """Base exception for CLI errors."""

    exit_code: int = 1


class InvalidInputError(CLIError):
    """Invalid CLI input."""

    exit_code = 2

    def __init__(self, message: str, argument: Optional[str] = None):
        super().__init__(
            message,
            details={"argument": argument},
        )
        self.argument = argument


class ConfigurationError(CLIError):
    """Configuration error."""

    exit_code = 3

    def __init__(self, message: str, config_key: Optional[str] = None):
        super().__init__(
            message,
            details={"config_key": config_key},
        )
        self.config_key = config_key
