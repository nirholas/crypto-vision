"""Transaction simulator for testing before execution."""

from typing import Dict, Any, Optional
from decimal import Decimal

from abi_to_mcp.runtime.web3_client import Web3Client
from abi_to_mcp.runtime.transaction import TransactionBuilder
from abi_to_mcp.core.exceptions import SimulationError
from abi_to_mcp.utils.logging import get_logger

logger = get_logger(__name__)


class TransactionSimulator:
    """Simulate transactions without executing them."""

    def __init__(self, web3_client: Web3Client):
        """
        Initialize transaction simulator.

        Args:
            web3_client: Web3Client instance
        """
        self.client = web3_client
        self.tx_builder = TransactionBuilder(web3_client)

    def simulate(
        self,
        contract_function,
        from_address: str,
        value: int = 0,
        gas_limit: Optional[int] = None,
    ) -> Dict[str, Any]:
        """
        Simulate a transaction.

        Returns:
        - success: bool
        - result: Any (return value)
        - error: Optional[str]
        - gas_estimate: int
        - gas_price: int (wei)
        - estimated_cost_wei: int
        - estimated_cost_eth: float

        Args:
            contract_function: Web3 contract function
            from_address: Sender address
            value: ETH value in wei
            gas_limit: Optional gas limit

        Returns:
            Simulation result dictionary
        """
        try:
            # Build transaction
            tx = self.tx_builder.build_transaction(
                contract_function=contract_function,
                from_address=from_address,
                value=value,
                gas_limit=gas_limit,
            )

            # Get gas estimate
            gas_estimate = tx.get("gas", 0)

            # Get gas price (EIP-1559 or legacy)
            if "maxFeePerGas" in tx:
                gas_price_wei = tx["maxFeePerGas"]
            elif "gasPrice" in tx:
                gas_price_wei = tx["gasPrice"]
            else:
                gas_price_wei = self.client.w3.eth.gas_price

            # Calculate cost
            estimated_cost_wei = gas_estimate * gas_price_wei
            estimated_cost_eth = float(Decimal(estimated_cost_wei) / Decimal(10**18))

            # Try to call the function to check if it reverts
            try:
                # Use eth_call to simulate
                result = contract_function.call(
                    {
                        "from": from_address,
                        "value": value,
                    }
                )

                return {
                    "success": True,
                    "result": result,
                    "error": None,
                    "gas_estimate": gas_estimate,
                    "gas_price_wei": gas_price_wei,
                    "gas_price_gwei": float(gas_price_wei / 10**9),
                    "estimated_cost_wei": estimated_cost_wei,
                    "estimated_cost_eth": estimated_cost_eth,
                    "transaction": tx,
                }

            except Exception as call_error:
                # Call reverted
                return {
                    "success": False,
                    "result": None,
                    "error": str(call_error),
                    "gas_estimate": gas_estimate,
                    "gas_price_wei": gas_price_wei,
                    "gas_price_gwei": float(gas_price_wei / 10**9),
                    "estimated_cost_wei": estimated_cost_wei,
                    "estimated_cost_eth": estimated_cost_eth,
                    "transaction": tx,
                }

        except Exception as e:
            logger.error(f"Simulation failed: {e}")
            raise SimulationError(
                f"Transaction simulation failed: {e}",
                function_name=str(contract_function),
                revert_reason=str(e),
            ) from e

    def simulate_batch(
        self,
        transactions: list,
        from_address: str,
    ) -> list:
        """
        Simulate multiple transactions in sequence.

        Args:
            transactions: List of (contract_function, value) tuples
            from_address: Sender address

        Returns:
            List of simulation results
        """
        results = []

        for contract_function, value in transactions:
            result = self.simulate(
                contract_function=contract_function,
                from_address=from_address,
                value=value,
            )
            results.append(result)

            # Stop if any transaction fails
            if not result["success"]:
                break

        return results
