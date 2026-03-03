"""Gas estimation and pricing utilities."""

from typing import Dict, Any, Optional
from decimal import Decimal
from dataclasses import dataclass

from abi_to_mcp.runtime.web3_client import Web3Client
from abi_to_mcp.core.exceptions import GasEstimationError
from abi_to_mcp.utils.logging import get_logger

logger = get_logger(__name__)


@dataclass
class GasPrice:
    """Gas price information."""

    slow: int  # Wei
    standard: int  # Wei
    fast: int  # Wei
    instant: int  # Wei
    base_fee: Optional[int] = None  # Wei (EIP-1559 only)
    priority_fee: Optional[int] = None  # Wei (EIP-1559 only)
    is_eip1559: bool = False

    def to_gwei(self, price: int) -> float:
        """Convert wei to gwei."""
        return float(price / 10**9)

    @property
    def slow_gwei(self) -> float:
        """Slow price in gwei."""
        return self.to_gwei(self.slow)

    @property
    def standard_gwei(self) -> float:
        """Standard price in gwei."""
        return self.to_gwei(self.standard)

    @property
    def fast_gwei(self) -> float:
        """Fast price in gwei."""
        return self.to_gwei(self.fast)

    @property
    def instant_gwei(self) -> float:
        """Instant price in gwei."""
        return self.to_gwei(self.instant)


class GasEstimator:
    """Estimate gas costs and provide price recommendations."""

    def __init__(self, web3_client: Web3Client):
        """
        Initialize gas estimator.

        Args:
            web3_client: Web3Client instance
        """
        self.client = web3_client

    def get_gas_price(self) -> GasPrice:
        """
        Get current gas price recommendations.

        Returns:
            GasPrice with slow/standard/fast/instant options

        Raises:
            GasEstimationError: If price fetching fails
        """
        try:
            # Check if network supports EIP-1559
            latest_block = self.client.w3.eth.get_block("latest")
            is_eip1559 = "baseFeePerGas" in latest_block

            if is_eip1559:
                base_fee = latest_block["baseFeePerGas"]

                # Priority fee recommendations
                slow_priority = int(1 * 10**9)  # 1 gwei
                standard_priority = int(2 * 10**9)  # 2 gwei
                fast_priority = int(3 * 10**9)  # 3 gwei
                instant_priority = int(5 * 10**9)  # 5 gwei

                # Max fee = base_fee * multiplier + priority_fee
                return GasPrice(
                    slow=base_fee * 2 + slow_priority,
                    standard=base_fee * 2 + standard_priority,
                    fast=base_fee * 2 + fast_priority,
                    instant=base_fee * 2 + instant_priority,
                    base_fee=base_fee,
                    priority_fee=standard_priority,
                    is_eip1559=True,
                )

            else:
                # Legacy gas pricing
                current_price = self.client.w3.eth.gas_price

                # Create tiers based on current price
                return GasPrice(
                    slow=int(current_price * 0.8),
                    standard=current_price,
                    fast=int(current_price * 1.2),
                    instant=int(current_price * 1.5),
                    is_eip1559=False,
                )

        except Exception as e:
            raise GasEstimationError(
                f"Failed to get gas price: {e}",
                details={"error": str(e)},
            ) from e

    def estimate_transaction_cost(
        self,
        gas_limit: int,
        gas_price: Optional[int] = None,
        speed: str = "standard",
    ) -> Dict[str, Any]:
        """
        Estimate transaction cost in ETH.

        Args:
            gas_limit: Gas limit for transaction
            gas_price: Optional specific gas price (wei)
            speed: Price tier (slow/standard/fast/instant)

        Returns:
            Dictionary with cost estimates

        Raises:
            GasEstimationError: If estimation fails
        """
        try:
            # Get gas price if not provided
            if gas_price is None:
                gas_prices = self.get_gas_price()
                gas_price = getattr(gas_prices, speed)

            # Calculate cost
            cost_wei = gas_limit * gas_price
            cost_eth = float(Decimal(cost_wei) / Decimal(10**18))

            # Get network currency
            currency = self.client.network_config.get("currency", "ETH")

            return {
                "gas_limit": gas_limit,
                "gas_price_wei": gas_price,
                "gas_price_gwei": float(gas_price / 10**9),
                "cost_wei": cost_wei,
                "cost_eth": cost_eth,
                "cost_formatted": f"{cost_eth:.6f} {currency}",
                "currency": currency,
            }

        except Exception as e:
            raise GasEstimationError(
                f"Failed to estimate cost: {e}",
                details={
                    "gas_limit": gas_limit,
                    "gas_price": gas_price,
                    "error": str(e),
                },
            ) from e

    def estimate_function_cost(
        self,
        contract_function,
        from_address: str,
        value: int = 0,
        speed: str = "standard",
    ) -> Dict[str, Any]:
        """
        Estimate cost for a contract function call.

        Args:
            contract_function: Web3 contract function
            from_address: Sender address
            value: ETH value in wei
            speed: Price tier

        Returns:
            Dictionary with cost estimates including gas limit

        Raises:
            GasEstimationError: If estimation fails
        """
        try:
            # Build transaction for estimation
            tx = {
                "from": from_address,
            }

            if value > 0:
                tx["value"] = value

            # Estimate gas
            gas_estimate = contract_function.estimate_gas(tx)

            # Add buffer (20%)
            gas_limit = int(gas_estimate * 1.2)

            # Get cost estimate
            cost = self.estimate_transaction_cost(
                gas_limit=gas_limit,
                speed=speed,
            )

            # Add gas estimate details
            cost["gas_estimate"] = gas_estimate
            cost["gas_buffer"] = gas_limit - gas_estimate

            return cost

        except Exception as e:
            raise GasEstimationError(
                f"Failed to estimate function cost: {e}",
                details={
                    "function": str(contract_function),
                    "from": from_address,
                    "error": str(e),
                },
            ) from e
