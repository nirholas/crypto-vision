"""Tests for transaction signing module."""

import pytest
import os
from unittest.mock import patch, Mock

from abi_to_mcp.runtime.signer import TransactionSigner
from abi_to_mcp.core.exceptions import SignerError


class TestTransactionSigner:
    """Tests for TransactionSigner class."""

    # Test private key (DO NOT USE IN PRODUCTION)
    # This is a well-known test key with no real funds
    TEST_PRIVATE_KEY = "0x" + "1" * 64

    def test_init_with_private_key(self):
        """Initialize signer with private key."""
        signer = TransactionSigner(self.TEST_PRIVATE_KEY)
        assert signer.address is not None
        assert signer.address.startswith("0x")
        assert len(signer.address) == 42

    def test_init_without_prefix(self):
        """Initialize with private key without 0x prefix."""
        key_without_prefix = "1" * 64
        signer = TransactionSigner(key_without_prefix)
        assert signer.address is not None
        assert signer.address.startswith("0x")

    def test_init_from_env_var(self):
        """Initialize from PRIVATE_KEY environment variable."""
        with patch.dict(os.environ, {"PRIVATE_KEY": self.TEST_PRIVATE_KEY}, clear=False):
            signer = TransactionSigner()
            assert signer.address is not None
            assert signer.address.startswith("0x")

    def test_init_no_key_raises(self):
        """Error when no private key available."""
        # Clear the environment variable
        with patch.dict(os.environ, {}, clear=True):
            with pytest.raises(SignerError) as exc_info:
                TransactionSigner()
            # Should have an error message about private key
            assert "private key" in str(exc_info.value).lower()

    def test_init_invalid_key_raises(self):
        """Error with invalid private key."""
        with pytest.raises(SignerError):
            TransactionSigner("invalid_key")

    def test_init_short_key_raises(self):
        """Error with too short private key."""
        with pytest.raises(SignerError):
            TransactionSigner("0x1234")

    def test_get_address(self):
        """Get signer address."""
        signer = TransactionSigner(self.TEST_PRIVATE_KEY)
        address = signer.get_address()

        assert address == signer.address
        assert address.startswith("0x")
        assert len(address) == 42

    def test_address_is_deterministic(self):
        """Same private key should always produce same address."""
        signer1 = TransactionSigner(self.TEST_PRIVATE_KEY)
        signer2 = TransactionSigner(self.TEST_PRIVATE_KEY)

        assert signer1.address == signer2.address

    def test_different_keys_different_addresses(self):
        """Different private keys should produce different addresses."""
        key1 = "0x" + "1" * 64
        key2 = "0x" + "2" * 64

        signer1 = TransactionSigner(key1)
        signer2 = TransactionSigner(key2)

        assert signer1.address != signer2.address
"""Tests for TransactionSigner with extended coverage."""

from unittest.mock import MagicMock



class TestTransactionSigner:
    """Tests for TransactionSigner."""

    @pytest.fixture
    def valid_private_key(self):
        """A valid test private key (never use in production!)."""
        return "0x" + "1" * 64

    def test_init_with_valid_key(self, valid_private_key):
        """Initialize with valid private key."""
        with patch('abi_to_mcp.runtime.signer.Account') as mock_account:
            mock_acct = Mock()
            mock_acct.address = "0x" + "a" * 40
            mock_account.from_key.return_value = mock_acct

            signer = TransactionSigner(private_key=valid_private_key)
            
            assert signer.address == "0x" + "a" * 40

    def test_init_with_invalid_key(self):
        """Initialize with invalid private key raises SignerError."""
        with patch('abi_to_mcp.runtime.signer.Account') as mock_account:
            mock_account.from_key.side_effect = ValueError("Invalid key")
            
            with pytest.raises(SignerError):
                TransactionSigner(private_key="invalid")

    def test_sign_transaction(self, valid_private_key):
        """Sign a transaction."""
        with patch('abi_to_mcp.runtime.signer.Account') as mock_account:
            mock_acct = Mock()
            mock_acct.address = "0x" + "a" * 40
            mock_signed = Mock()
            mock_signed.raw_transaction = b"\x12\x34"
            mock_signed.hash = b"\xab\xcd"
            mock_signed.r = 123
            mock_signed.s = 456
            mock_signed.v = 27
            mock_acct.sign_transaction.return_value = mock_signed
            mock_account.from_key.return_value = mock_acct

            signer = TransactionSigner(private_key=valid_private_key)
            
            tx = {
                "from": "0x" + "a" * 40,
                "to": "0x" + "b" * 40,
                "value": 0,
                "gas": 21000,
                "gasPrice": 10**9,
                "nonce": 0,
                "chainId": 1,
            }
            
            signed = signer.sign_transaction(tx)
            
            assert "raw_transaction" in signed
            assert "hash" in signed
            assert signed["r"] == 123
            assert signed["v"] == 27

    def test_sign_transaction_error(self, valid_private_key):
        """Signing error raises SignerError."""
        with patch('abi_to_mcp.runtime.signer.Account') as mock_account:
            mock_acct = Mock()
            mock_acct.address = "0x" + "a" * 40
            mock_acct.sign_transaction.side_effect = Exception("Sign failed")
            mock_account.from_key.return_value = mock_acct

            signer = TransactionSigner(private_key=valid_private_key)
            
            with pytest.raises(SignerError):
                signer.sign_transaction({"nonce": 0})

    def test_sign_message(self, valid_private_key):
        """Sign a message."""
        with patch('abi_to_mcp.runtime.signer.Account') as mock_account:
            mock_acct = Mock()
            mock_acct.address = "0x" + "a" * 40
            mock_signed_msg = Mock()
            mock_signed_msg.signature = bytes.fromhex("ab" * 65)
            mock_acct.sign_message.return_value = mock_signed_msg
            mock_account.from_key.return_value = mock_acct

            signer = TransactionSigner(private_key=valid_private_key)
            
            with patch('eth_account.messages.encode_defunct') as mock_encode:
                mock_encode.return_value = Mock()
                signature = signer.sign_message("Hello, World!")
                
                assert isinstance(signature, str)

    def test_get_address(self, valid_private_key):
        """Get signer address."""
        with patch('abi_to_mcp.runtime.signer.Account') as mock_account:
            mock_acct = Mock()
            mock_acct.address = "0x" + "a" * 40
            mock_account.from_key.return_value = mock_acct

            signer = TransactionSigner(private_key=valid_private_key)
            
            assert signer.get_address() == "0x" + "a" * 40
