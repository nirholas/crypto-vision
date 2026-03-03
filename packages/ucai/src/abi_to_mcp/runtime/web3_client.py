"""Web3 client for connecting to Ethereum networks."""

import os
from typing import Optional, Dict, Any
from web3 import Web3
from web3.contract import Contract

# Handle different web3.py versions
try:
    from web3.middleware import ExtraDataToPOAMiddleware as POAMiddleware
except ImportError:
    from web3.middleware import geth_poa_middleware as POAMiddleware

from abi_to_mcp.core.constants import NETWORKS
from abi_to_mcp.core.exceptions import NetworkError
from abi_to_mcp.utils.logging import get_logger
from abi_to_mcp.utils.validation import to_checksum_address

logger = get_logger(__name__)


class Web3Client:
    """Managed Web3 connection to Ethereum networks."""

    def __init__(
        self,
        rpc_url: Optional[str] = None,
        network: str = "mainnet",
    ):
        """
        Initialize Web3 connection.

        Priority for RPC URL:
        1. Explicit rpc_url parameter
        2. RPC_URL environment variable
        3. Default from NETWORKS[network]

        Args:
            rpc_url: Optional explicit RPC URL
            network: Network name (mainnet, polygon, etc.)

        Raises:
            NetworkError: If network is invalid or connection fails
        """
        self.network = network.lower()

        # Validate network
        if self.network not in NETWORKS:
            supported = ", ".join(NETWORKS.keys())
            raise NetworkError(
                f"Unknown network: {network}. Supported networks: {supported}",
            )

        self.network_config = NETWORKS[self.network]

        # Determine RPC URL
        if rpc_url:
            self._rpc_url = rpc_url
        elif "RPC_URL" in os.environ:
            self._rpc_url = os.environ["RPC_URL"]
        else:
            self._rpc_url = self.network_config["rpc"]

        self._w3: Optional[Web3] = None
        self._connected = False

        logger.info(f"Initialized Web3Client for {self.network}")

    @property
    def w3(self) -> Web3:
        """
        Get Web3 instance (lazy initialization).

        Returns:
            Connected Web3 instance

        Raises:
            NetworkError: If connection fails
        """
        if self._w3 is None:
            try:
                self._w3 = Web3(Web3.HTTPProvider(self._rpc_url))

                # Add PoA middleware for networks that need it
                if self.network in ("polygon", "bsc"):
                    self._w3.middleware_onion.inject(POAMiddleware, layer=0)

                # Test connection
                if not self._w3.is_connected():
                    raise NetworkError(
                        f"Failed to connect to {self.network} at {self._rpc_url}",
                    )

                self._connected = True
                logger.info(f"Connected to {self.network} (Chain ID: {self.get_chain_id()})")

            except Exception as e:
                raise NetworkError(
                    f"Failed to initialize Web3 for {self.network}: {e}",
                ) from e

        return self._w3

    def get_contract(self, address: str, abi: list) -> Contract:
        """
        Create contract instance with checksum address.

        Args:
            address: Contract address
            abi: Contract ABI

        Returns:
            Web3 Contract instance

        Raises:
            ValueError: If address is invalid
        """
        checksum_address = to_checksum_address(address)
        return self.w3.eth.contract(address=checksum_address, abi=abi)

    def is_connected(self) -> bool:
        """
        Check if connected to network.

        Returns:
            True if connected
        """
        if self._w3 is None:
            return False
        try:
            return self._w3.is_connected()
        except Exception:
            return False

    def get_chain_id(self) -> int:
        """
        Get current chain ID.

        Returns:
            Chain ID

        Raises:
            NetworkError: If not connected
        """
        try:
            return self.w3.eth.chain_id
        except Exception as e:
            raise NetworkError(
                f"Failed to get chain ID for {self.network}: {e}",
            ) from e

    def get_block_number(self) -> int:
        """
        Get current block number.

        Returns:
            Block number

        Raises:
            NetworkError: If connection fails
        """
        try:
            return self.w3.eth.block_number
        except Exception as e:
            raise NetworkError(
                f"Failed to get block number for {self.network}: {e}",
            ) from e

    def get_balance(self, address: str) -> int:
        """
        Get ETH balance of an address.

        Args:
            address: Ethereum address

        Returns:
            Balance in wei

        Raises:
            NetworkError: If query fails
        """
        try:
            checksum_address = to_checksum_address(address)
            return self.w3.eth.get_balance(checksum_address)
        except Exception as e:
            raise NetworkError(
                f"Failed to get balance for {address}: {e}",
            ) from e

    def get_transaction_count(self, address: str) -> int:
        """
        Get nonce for an address.

        Args:
            address: Ethereum address

        Returns:
            Transaction count (nonce)

        Raises:
            NetworkError: If query fails
        """
        try:
            checksum_address = to_checksum_address(address)
            return self.w3.eth.get_transaction_count(checksum_address)
        except Exception as e:
            raise NetworkError(
                f"Failed to get transaction count for {address}: {e}",
            ) from e

    def get_code(self, address: str) -> bytes:
        """
        Get contract bytecode at address.

        Args:
            address: Contract address

        Returns:
            Contract bytecode

        Raises:
            NetworkError: If query fails
        """
        try:
            checksum_address = to_checksum_address(address)
            return self.w3.eth.get_code(checksum_address)
        except Exception as e:
            raise NetworkError(
                f"Failed to get code for {address}: {e}",
            ) from e

    def is_contract(self, address: str) -> bool:
        """
        Check if address is a contract.

        Args:
            address: Ethereum address

        Returns:
            True if address has code
        """
        try:
            code = self.get_code(address)
            return len(code) > 0
        except Exception:
            return False
