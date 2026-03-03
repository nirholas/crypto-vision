"""Tests for Sourcify fetcher."""

import pytest
from unittest.mock import AsyncMock, Mock, patch, MagicMock, PropertyMock
import json

from abi_to_mcp.fetchers.sourcify import SourcifyFetcher
from abi_to_mcp.core.exceptions import ABINotFoundError, InvalidAddressError


@pytest.fixture
def mock_metadata_file():
    """Mock metadata.json file from Sourcify."""
    return {
        "name": "metadata.json",
        "content": json.dumps({
            "output": {
                "abi": [
                    {"type": "function", "name": "transfer"},
                    {"type": "event", "name": "Transfer"}
                ]
            },
            "compiler": {
                "version": "0.8.20+commit.a1b79de6"
            },
            "settings": {
                "compilationTarget": {
                    "Token.sol": "MyToken"
                }
            }
        })
    }


@pytest.fixture
def mock_source_file():
    """Mock Solidity source file."""
    return {
        "name": "Token.sol",
        "content": "pragma solidity ^0.8.0;\n\ncontract MyToken { }"
    }


class MockResponse:
    """Mock httpx response."""
    def __init__(self, json_data, status_code=200):
        self._json_data = json_data
        self.status_code = status_code
    
    def json(self):
        return self._json_data
    
    def raise_for_status(self):
        if self.status_code >= 400:
            import httpx
            raise httpx.HTTPStatusError(
                "Error",
                request=Mock(),
                response=self
            )


@pytest.mark.asyncio
async def test_fetch_full_match(mock_metadata_file, mock_source_file):
    """Test fetching with full match."""
    mock_response = MockResponse([mock_metadata_file, mock_source_file])
    
    with patch.object(SourcifyFetcher, '__init__', lambda x: None):
        fetcher = SourcifyFetcher()
        fetcher.SOURCIFY_API = "https://sourcify.dev/server"
        fetcher.ADDRESS_PATTERN = SourcifyFetcher.ADDRESS_PATTERN
        
        mock_client = MagicMock()
        mock_client.get = AsyncMock(return_value=mock_response)
        mock_client.aclose = AsyncMock()
        fetcher.client = mock_client
        
        result = await fetcher.fetch(
            "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
            chain_id=1
        )
        
        assert result.source == "sourcify"
        assert len(result.abi) == 2
        assert result.contract_name == "MyToken"
        assert result.compiler_version == "0.8.20+commit.a1b79de6"
        assert result.source_code is not None


@pytest.mark.asyncio
async def test_fetch_partial_match(mock_metadata_file):
    """Test fetching with partial match fallback."""
    # First call (full_match) returns 404
    mock_response_404 = MockResponse([], status_code=404)
    
    # Second call (partial_match) succeeds
    mock_response_200 = MockResponse([mock_metadata_file])
    
    with patch.object(SourcifyFetcher, '__init__', lambda x: None):
        fetcher = SourcifyFetcher()
        fetcher.SOURCIFY_API = "https://sourcify.dev/server"
        fetcher.ADDRESS_PATTERN = SourcifyFetcher.ADDRESS_PATTERN
        
        mock_client = MagicMock()
        mock_client.get = AsyncMock(side_effect=[mock_response_404, mock_response_200])
        mock_client.aclose = AsyncMock()
        fetcher.client = mock_client
        
        result = await fetcher.fetch(
            "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
            chain_id=1
        )
        
        assert result.source == "sourcify"
        assert len(result.abi) == 2


@pytest.mark.asyncio
async def test_fetch_not_found():
    """Test handling of contract not found."""
    mock_response = MockResponse([], status_code=404)
    
    with patch.object(SourcifyFetcher, '__init__', lambda x: None):
        fetcher = SourcifyFetcher()
        fetcher.SOURCIFY_API = "https://sourcify.dev/server"
        fetcher.ADDRESS_PATTERN = SourcifyFetcher.ADDRESS_PATTERN
        
        mock_client = MagicMock()
        mock_client.get = AsyncMock(return_value=mock_response)
        mock_client.aclose = AsyncMock()
        fetcher.client = mock_client
        
        with pytest.raises(ABINotFoundError):
            await fetcher.fetch(
                "0x0000000000000000000000000000000000000000",
                chain_id=1
            )


@pytest.mark.asyncio
async def test_invalid_address():
    """Test invalid address format."""
    with patch.object(SourcifyFetcher, '__init__', lambda x: None):
        fetcher = SourcifyFetcher()
        fetcher.SOURCIFY_API = "https://sourcify.dev/server"
        fetcher.ADDRESS_PATTERN = SourcifyFetcher.ADDRESS_PATTERN
        fetcher.client = MagicMock()
        
        with pytest.raises(InvalidAddressError):
            await fetcher.fetch("invalid-address")


@pytest.mark.asyncio
async def test_fetch_with_network_name(mock_metadata_file):
    """Test fetch using network name instead of chain_id."""
    mock_response = MockResponse([mock_metadata_file])
    
    with patch.object(SourcifyFetcher, '__init__', lambda x: None):
        fetcher = SourcifyFetcher()
        fetcher.SOURCIFY_API = "https://sourcify.dev/server"
        fetcher.ADDRESS_PATTERN = SourcifyFetcher.ADDRESS_PATTERN
        
        mock_client = MagicMock()
        mock_client.get = AsyncMock(return_value=mock_response)
        mock_client.aclose = AsyncMock()
        fetcher.client = mock_client
        
        result = await fetcher.fetch(
            "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
            network="mainnet"
        )
        
        assert result.source == "sourcify"


def test_can_handle_valid_address():
    """Test can_handle recognizes valid addresses."""
    with patch.object(SourcifyFetcher, '__init__', lambda x: None):
        fetcher = SourcifyFetcher()
        fetcher.ADDRESS_PATTERN = SourcifyFetcher.ADDRESS_PATTERN
        
        assert fetcher.can_handle("0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48")
        assert fetcher.can_handle("0x" + "0" * 40)


def test_can_handle_invalid_format():
    """Test can_handle rejects invalid formats."""
    with patch.object(SourcifyFetcher, '__init__', lambda x: None):
        fetcher = SourcifyFetcher()
        fetcher.ADDRESS_PATTERN = SourcifyFetcher.ADDRESS_PATTERN
        
        assert not fetcher.can_handle("./file.json")
        assert not fetcher.can_handle("http://example.com")
        assert not fetcher.can_handle("0x123")  # Too short
"""Extended tests for Sourcify fetcher."""

import pytest
import sys


class TestSourcifyFetcher:
    """Tests for SourcifyFetcher."""

    @pytest.fixture
    def valid_address(self):
        """Valid Ethereum address."""
        return "0x1234567890123456789012345678901234567890"

    @pytest.fixture
    def sample_metadata(self):
        """Sample Sourcify metadata."""
        return {
            "output": {
                "abi": [
                    {
                        "type": "function",
                        "name": "test",
                        "inputs": [],
                        "outputs": [],
                    }
                ]
            },
            "compiler": {"version": "0.8.19"},
            "settings": {
                "compilationTarget": {"Contract.sol": "TestContract"}
            },
        }

    @pytest.mark.asyncio
    async def test_fetch_full_match_success(self, valid_address, sample_metadata):
        """Test successful fetch with full match."""
        # Import httpx for proper exception types
        import httpx
        
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = [
            {"name": "metadata.json", "content": json.dumps(sample_metadata)}
        ]
        mock_response.raise_for_status = Mock()

        mock_client = AsyncMock()
        mock_client.get.return_value = mock_response
        mock_client.aclose = AsyncMock()

        with patch("abi_to_mcp.fetchers.sourcify.httpx") as mock_httpx:
            mock_httpx.AsyncClient.return_value = mock_client
            mock_httpx.HTTPStatusError = httpx.HTTPStatusError
            mock_httpx.RequestError = httpx.RequestError

            from abi_to_mcp.fetchers.sourcify import SourcifyFetcher

            fetcher = SourcifyFetcher()
            fetcher.client = mock_client
            
            result = await fetcher.fetch(valid_address)

            assert result.abi == sample_metadata["output"]["abi"]
            assert result.contract_name == "TestContract"
            assert result.compiler_version == "0.8.19"

    @pytest.mark.asyncio
    async def test_fetch_not_found(self, valid_address):
        """Test when contract is not found on Sourcify."""
        import httpx
        
        mock_response = Mock()
        mock_response.status_code = 404

        mock_client = AsyncMock()
        mock_client.get.return_value = mock_response
        mock_client.aclose = AsyncMock()

        with patch("abi_to_mcp.fetchers.sourcify.httpx") as mock_httpx:
            mock_httpx.AsyncClient.return_value = mock_client
            mock_httpx.HTTPStatusError = httpx.HTTPStatusError
            mock_httpx.RequestError = httpx.RequestError

            from abi_to_mcp.fetchers.sourcify import SourcifyFetcher
            from abi_to_mcp.core.exceptions import ABINotFoundError

            fetcher = SourcifyFetcher()
            fetcher.client = mock_client
            
            with pytest.raises(ABINotFoundError):
                await fetcher.fetch(valid_address)

    @pytest.mark.asyncio
    async def test_fetch_invalid_address(self):
        """Test with invalid address."""
        import httpx
        
        mock_client = AsyncMock()

        with patch("abi_to_mcp.fetchers.sourcify.httpx") as mock_httpx:
            mock_httpx.AsyncClient.return_value = mock_client
            mock_httpx.HTTPStatusError = httpx.HTTPStatusError
            mock_httpx.RequestError = httpx.RequestError

            from abi_to_mcp.fetchers.sourcify import SourcifyFetcher
            from abi_to_mcp.core.exceptions import InvalidAddressError

            fetcher = SourcifyFetcher()
            fetcher.client = mock_client
            
            with pytest.raises(InvalidAddressError):
                await fetcher.fetch("invalid-address")

    @pytest.mark.asyncio
    async def test_fetch_with_network(self, valid_address, sample_metadata):
        """Test fetch with network name."""
        import httpx
        
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = [
            {"name": "metadata.json", "content": json.dumps(sample_metadata)}
        ]
        mock_response.raise_for_status = Mock()

        mock_client = AsyncMock()
        mock_client.get.return_value = mock_response
        mock_client.aclose = AsyncMock()

        with patch("abi_to_mcp.fetchers.sourcify.httpx") as mock_httpx:
            mock_httpx.AsyncClient.return_value = mock_client
            mock_httpx.HTTPStatusError = httpx.HTTPStatusError
            mock_httpx.RequestError = httpx.RequestError

            from abi_to_mcp.fetchers.sourcify import SourcifyFetcher

            fetcher = SourcifyFetcher()
            fetcher.client = mock_client
            
            result = await fetcher.fetch(valid_address, network="mainnet")

            assert result.abi is not None

    @pytest.mark.asyncio
    async def test_parse_files_with_source_code(self, valid_address, sample_metadata):
        """Test parsing files that include source code."""
        import httpx
        
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = [
            {"name": "metadata.json", "content": json.dumps(sample_metadata)},
            {"name": "Contract.sol", "content": "pragma solidity ^0.8.0;"},
        ]
        mock_response.raise_for_status = Mock()

        mock_client = AsyncMock()
        mock_client.get.return_value = mock_response
        mock_client.aclose = AsyncMock()

        with patch("abi_to_mcp.fetchers.sourcify.httpx") as mock_httpx:
            mock_httpx.AsyncClient.return_value = mock_client
            mock_httpx.HTTPStatusError = httpx.HTTPStatusError
            mock_httpx.RequestError = httpx.RequestError

            from abi_to_mcp.fetchers.sourcify import SourcifyFetcher

            fetcher = SourcifyFetcher()
            fetcher.client = mock_client
            
            result = await fetcher.fetch(valid_address)

            assert result.source_code is not None
            assert "Contract.sol" in result.source_code

    def test_can_handle_valid_address(self, valid_address):
        """Test can_handle with valid address."""
        import httpx
        
        with patch("abi_to_mcp.fetchers.sourcify.httpx") as mock_httpx:
            mock_httpx.AsyncClient.return_value = AsyncMock()
            mock_httpx.HTTPStatusError = httpx.HTTPStatusError
            mock_httpx.RequestError = httpx.RequestError

            from abi_to_mcp.fetchers.sourcify import SourcifyFetcher

            fetcher = SourcifyFetcher()
            assert fetcher.can_handle(valid_address) is True

    def test_can_handle_invalid_address(self):
        """Test can_handle with invalid address."""
        import httpx
        
        with patch("abi_to_mcp.fetchers.sourcify.httpx") as mock_httpx:
            mock_httpx.AsyncClient.return_value = AsyncMock()
            mock_httpx.HTTPStatusError = httpx.HTTPStatusError
            mock_httpx.RequestError = httpx.RequestError

            from abi_to_mcp.fetchers.sourcify import SourcifyFetcher

            fetcher = SourcifyFetcher()
            assert fetcher.can_handle("not-an-address") is False
            assert fetcher.can_handle("0x123") is False

    @pytest.mark.asyncio
    async def test_context_manager(self, valid_address):
        """Test async context manager."""
        import httpx
        
        mock_client = AsyncMock()
        mock_client.aclose = AsyncMock()

        with patch("abi_to_mcp.fetchers.sourcify.httpx") as mock_httpx:
            mock_httpx.AsyncClient.return_value = mock_client
            mock_httpx.HTTPStatusError = httpx.HTTPStatusError
            mock_httpx.RequestError = httpx.RequestError

            from abi_to_mcp.fetchers.sourcify import SourcifyFetcher

            async with SourcifyFetcher() as fetcher:
                assert fetcher is not None

            mock_client.aclose.assert_called_once()

    @pytest.mark.asyncio
    async def test_parse_files_metadata_as_dict(self, valid_address):
        """Test parsing when metadata content is already a dict."""
        import httpx
        
        metadata = {
            "output": {"abi": [{"type": "function", "name": "test"}]},
            "compiler": {"version": "0.8.19"},
        }

        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = [
            {"name": "metadata.json", "content": metadata}  # Already a dict
        ]
        mock_response.raise_for_status = Mock()

        mock_client = AsyncMock()
        mock_client.get.return_value = mock_response
        mock_client.aclose = AsyncMock()

        with patch("abi_to_mcp.fetchers.sourcify.httpx") as mock_httpx:
            mock_httpx.AsyncClient.return_value = mock_client
            mock_httpx.HTTPStatusError = httpx.HTTPStatusError
            mock_httpx.RequestError = httpx.RequestError

            from abi_to_mcp.fetchers.sourcify import SourcifyFetcher

            fetcher = SourcifyFetcher()
            fetcher.client = mock_client
            
            result = await fetcher.fetch(valid_address)

            assert result.abi == metadata["output"]["abi"]


class TestSourcifyImportError:
    """Test Sourcify behavior when httpx is not installed."""

    def test_import_without_httpx(self):
        """Test that SourcifyFetcher raises ImportError without httpx."""
        # Create a mock module that mimics httpx not being available
        with patch.dict(sys.modules, {"httpx": None}):
            # We need to reload the module
            import importlib
            
            # Just verify the httpx check logic - when httpx=None,
            # the SourcifyFetcher should raise ImportError on init
            with patch("abi_to_mcp.fetchers.sourcify.httpx", None):
                from abi_to_mcp.fetchers import sourcify as sourcify_module
                
                # Store original
                orig_httpx = sourcify_module.httpx
                sourcify_module.httpx = None
                
                try:
                    with pytest.raises(ImportError):
                        sourcify_module.SourcifyFetcher()
                finally:
                    sourcify_module.httpx = orig_httpx
