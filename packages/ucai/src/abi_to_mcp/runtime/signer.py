"""Transaction signing utilities."""

import os
from typing import Dict, Any, Optional
from eth_account import Account
from eth_account.signers.local import LocalAccount

from abi_to_mcp.core.exceptions import SignerError
from abi_to_mcp.utils.logging import get_logger

logger = get_logger(__name__)


class TransactionSigner:
    """Sign transactions with private keys."""

    def __init__(self, private_key: Optional[str] = None):
        """
        Initialize transaction signer.

        Args:
            private_key: Private key (with or without 0x prefix)
                        If not provided, checks PRIVATE_KEY env var

        Raises:
            SignerError: If no private key provided or invalid
        """
        # Get private key from parameter or environment
        if private_key is None:
            private_key = os.environ.get("PRIVATE_KEY")

        if not private_key:
            raise SignerError(
                "No private key provided. Set PRIVATE_KEY environment variable.",
            )

        try:
            # Normalize private key (add 0x if missing)
            if not private_key.startswith("0x"):
                private_key = "0x" + private_key

            # Create account from private key
            self.account: LocalAccount = Account.from_key(private_key)
            self.address = self.account.address

            logger.info(f"Initialized signer for address: {self.address}")

        except Exception as e:
            raise SignerError(
                f"Invalid private key: {e}",
            ) from e

    def sign_transaction(self, transaction: Dict[str, Any]) -> Dict[str, Any]:
        """
        Sign a transaction.

        Args:
            transaction: Transaction dictionary

        Returns:
            Signed transaction dictionary with rawTransaction, hash, r, s, v

        Raises:
            SignerError: If signing fails
        """
        try:
            signed = self.account.sign_transaction(transaction)

            return {
                "raw_transaction": signed.raw_transaction,
                "hash": signed.hash,
                "r": signed.r,
                "s": signed.s,
                "v": signed.v,
            }

        except Exception as e:
            raise SignerError(
                f"Failed to sign transaction: {e}",
            ) from e

    def sign_message(self, message: str) -> str:
        """
        Sign a message.

        Args:
            message: Message to sign

        Returns:
            Signature as hex string

        Raises:
            SignerError: If signing fails
        """
        try:
            # Encode message using encode_defunct
            from eth_account.messages import encode_defunct

            encoded_message = encode_defunct(text=message)

            # Sign
            signed_message = self.account.sign_message(encoded_message)

            return signed_message.signature.hex()

        except Exception as e:
            raise SignerError(
                f"Failed to sign message: {e}",
            ) from e

    def get_address(self) -> str:
        """
        Get the address associated with this signer.

        Returns:
            Ethereum address
        """
        return self.address
