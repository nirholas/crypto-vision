"""Transaction builder for contract interactions."""

from typing import Optional, Dict, Any

# Handle different web3.py versions
try:
    from web3.contract.contract import ContractFunction
except ImportError:
    from web3.contract import ContractFunction

from abi_to_mcp.runtime.web3_client import Web3Client
from abi_to_mcp.core.exceptions import TransactionError
from abi_to_mcp.utils.logging import get_logger
from abi_to_mcp.utils.validation import to_checksum_address

logger = get_logger(__name__)


class TransactionBuilder:
    """Build transactions for contract calls."""

    def __init__(self, web3_client: Web3Client):
        """
        Initialize transaction builder.

        Args:
            web3_client: Web3Client instance
        """
        self.client = web3_client

    def build_transaction(
        self,
        contract_function: ContractFunction,
        from_address: str,
        value: int = 0,
        gas_limit: Optional[int] = None,
        gas_price: Optional[int] = None,
        max_fee_per_gas: Optional[int] = None,
        max_priority_fee_per_gas: Optional[int] = None,
        nonce: Optional[int] = None,
    ) -> Dict[str, Any]:
        """
        Build a transaction dictionary.

        Support both legacy and EIP-1559 transactions.

        Args:
            contract_function: Web3 contract function
            from_address: Sender address
            value: ETH value in wei
            gas_limit: Optional gas limit
            gas_price: Legacy gas price (wei)
            max_fee_per_gas: EIP-1559 max fee per gas (wei)
            max_priority_fee_per_gas: EIP-1559 priority fee (wei)
            nonce: Optional nonce (will fetch if not provided)

        Returns:
            Transaction dictionary

        Raises:
            TransactionError: If transaction building fails
        """
        try:
            from_address = to_checksum_address(from_address)

            # Get nonce if not provided
            if nonce is None:
                nonce = self.client.get_transaction_count(from_address)

            # Build base transaction
            tx: Dict[str, Any] = {
                "from": from_address,
                "nonce": nonce,
                "chainId": self.client.get_chain_id(),
            }

            # Add value if specified
            if value > 0:
                tx["value"] = value

            # Determine gas pricing strategy
            if max_fee_per_gas is not None or max_priority_fee_per_gas is not None:
                # EIP-1559 transaction
                if max_fee_per_gas is None:
                    # Use current base fee + priority fee
                    latest_block = self.client.w3.eth.get_block("latest")
                    base_fee = latest_block.get("baseFeePerGas", 0)
                    priority_fee = max_priority_fee_per_gas or 2_000_000_000  # 2 gwei
                    max_fee_per_gas = base_fee * 2 + priority_fee

                if max_priority_fee_per_gas is None:
                    max_priority_fee_per_gas = 2_000_000_000  # 2 gwei

                tx["maxFeePerGas"] = max_fee_per_gas
                tx["maxPriorityFeePerGas"] = max_priority_fee_per_gas

            elif gas_price is not None:
                # Legacy transaction
                tx["gasPrice"] = gas_price
            else:
                # Auto-detect best strategy
                try:
                    latest_block = self.client.w3.eth.get_block("latest")
                    if "baseFeePerGas" in latest_block:
                        # Network supports EIP-1559
                        base_fee = latest_block["baseFeePerGas"]
                        priority_fee = 2_000_000_000  # 2 gwei
                        tx["maxFeePerGas"] = base_fee * 2 + priority_fee
                        tx["maxPriorityFeePerGas"] = priority_fee
                    else:
                        # Legacy gas pricing
                        tx["gasPrice"] = self.client.w3.eth.gas_price
                except Exception:
                    # Fallback to legacy
                    tx["gasPrice"] = self.client.w3.eth.gas_price

            # Build transaction with contract function
            tx = contract_function.build_transaction(tx)

            # Override gas if specified
            if gas_limit is not None:
                tx["gas"] = gas_limit
            elif "gas" not in tx:
                # Estimate gas if not already set
                tx["gas"] = self.estimate_gas(tx)

            logger.debug(f"Built transaction: {tx}")
            return tx

        except Exception as e:
            raise TransactionError(f"Failed to build transaction: {e}") from e

    def estimate_gas(self, tx: Dict[str, Any]) -> int:
        """
        Estimate gas for transaction.

        Args:
            tx: Transaction dictionary

        Returns:
            Estimated gas limit

        Raises:
            TransactionError: If estimation fails
        """
        try:
            # Remove fields that shouldn't be in estimation
            tx_copy = tx.copy()
            tx_copy.pop("gas", None)
            tx_copy.pop("nonce", None)

            estimate = self.client.w3.eth.estimate_gas(tx_copy)

            # Add 20% buffer for safety
            buffered = int(estimate * 1.2)

            logger.debug(f"Gas estimate: {estimate} (buffered: {buffered})")
            return buffered

        except Exception as e:
            raise TransactionError(f"Gas estimation failed: {e}") from e

    def build_call_transaction(
        self,
        contract_function: ContractFunction,
        from_address: Optional[str] = None,
        value: int = 0,
        block_identifier: str = "latest",
    ) -> Dict[str, Any]:
        """
        Build a transaction for eth_call (read-only).

        Args:
            contract_function: Web3 contract function
            from_address: Optional sender address
            value: ETH value in wei
            block_identifier: Block to query

        Returns:
            Call transaction dictionary
        """
        tx: Dict[str, Any] = {}

        if from_address:
            tx["from"] = to_checksum_address(from_address)

        if value > 0:
            tx["value"] = value

        return tx
