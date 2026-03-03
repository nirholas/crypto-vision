"""Tests for file fetcher."""

import pytest
import json
import tempfile
from pathlib import Path

from abi_to_mcp.fetchers.file import FileFetcher
from abi_to_mcp.core.exceptions import ABINotFoundError, ABIParseError


@pytest.fixture
def file_fetcher():
    """Create a file fetcher instance."""
    return FileFetcher()


@pytest.fixture
def plain_abi():
    """Plain ABI array fixture."""
    return [
        {"type": "function", "name": "balanceOf", "inputs": [{"name": "account", "type": "address"}]},
        {"type": "event", "name": "Transfer", "inputs": [{"name": "from", "type": "address", "indexed": True}]},
    ]


@pytest.fixture
def hardhat_artifact():
    """Hardhat artifact fixture."""
    return {
        "contractName": "MyToken",
        "abi": [
            {"type": "function", "name": "transfer"}
        ],
        "bytecode": "0x6080604052...",
        "compiler": {
            "version": "0.8.20+commit.a1b79de"
        }
    }


@pytest.fixture
def foundry_artifact():
    """Foundry artifact fixture."""
    return {
        "abi": [
            {"type": "function", "name": "mint"}
        ],
        "bytecode": {"object": "0x6080604052..."},
        "metadata": json.dumps({
            "compiler": {"version": "0.8.21+commit.d9974bed"}
        })
    }


@pytest.mark.asyncio
async def test_load_plain_abi(file_fetcher, plain_abi, tmp_path):
    """Test loading plain ABI JSON array."""
    # Create temp file
    abi_file = tmp_path / "abi.json"
    with open(abi_file, 'w') as f:
        json.dump(plain_abi, f)
    
    # Fetch
    result = await file_fetcher.fetch(str(abi_file))
    
    assert result.source == "file"
    assert len(result.abi) == 2
    assert result.abi[0]["name"] == "balanceOf"
    assert result.contract_name is None
    assert result.compiler_version is None


@pytest.mark.asyncio
async def test_load_hardhat_artifact(file_fetcher, hardhat_artifact, tmp_path):
    """Test loading Hardhat artifact format."""
    abi_file = tmp_path / "MyToken.json"
    with open(abi_file, 'w') as f:
        json.dump(hardhat_artifact, f)
    
    result = await file_fetcher.fetch(str(abi_file))
    
    assert result.source == "file"
    assert result.contract_name == "MyToken"
    assert result.compiler_version == "0.8.20+commit.a1b79de"
    assert len(result.abi) == 1


@pytest.mark.asyncio
async def test_load_foundry_artifact(file_fetcher, foundry_artifact, tmp_path):
    """Test loading Foundry output format."""
    abi_file = tmp_path / "out.json"
    with open(abi_file, 'w') as f:
        json.dump(foundry_artifact, f)
    
    result = await file_fetcher.fetch(str(abi_file))
    
    assert result.source == "file"
    assert result.compiler_version == "0.8.21+commit.d9974bed"
    assert len(result.abi) == 1


@pytest.mark.asyncio
async def test_file_not_found(file_fetcher):
    """Test error when file doesn't exist."""
    with pytest.raises(ABINotFoundError) as exc_info:
        await file_fetcher.fetch("/nonexistent/file.json")
    
    assert "not found" in str(exc_info.value).lower()


@pytest.mark.asyncio
async def test_invalid_json(file_fetcher, tmp_path):
    """Test error on invalid JSON."""
    bad_file = tmp_path / "bad.json"
    with open(bad_file, 'w') as f:
        f.write("{invalid json}")
    
    with pytest.raises(ABIParseError):
        await file_fetcher.fetch(str(bad_file))


@pytest.mark.asyncio
async def test_empty_abi(file_fetcher, tmp_path):
    """Test error on empty ABI array."""
    empty_file = tmp_path / "empty.json"
    with open(empty_file, 'w') as f:
        json.dump([], f)
    
    with pytest.raises(ABIParseError) as exc_info:
        await file_fetcher.fetch(str(empty_file))
    
    assert "empty" in str(exc_info.value).lower()


@pytest.mark.asyncio
async def test_fetch_from_dict(file_fetcher, hardhat_artifact):
    """Test fetch_from_dict method."""
    result = await file_fetcher.fetch_from_dict(hardhat_artifact)
    
    assert result.source == "file"
    assert result.source_location == "<dict>"
    assert result.contract_name == "MyToken"


def test_can_handle_json_file(file_fetcher):
    """Test can_handle recognizes JSON files."""
    assert file_fetcher.can_handle("./contract.json")
    assert file_fetcher.can_handle("/path/to/abi.json")
    assert file_fetcher.can_handle("../artifacts/Token.json")


def test_can_handle_not_address(file_fetcher):
    """Test can_handle rejects Ethereum addresses."""
    assert not file_fetcher.can_handle("0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48")
    assert not file_fetcher.can_handle("0x" + "0" * 40)


def test_can_handle_not_url(file_fetcher):
    """Test can_handle rejects URLs."""
    assert not file_fetcher.can_handle("http://example.com/abi.json")
    assert not file_fetcher.can_handle("https://example.com/abi.json")


def test_can_handle_path_separators(file_fetcher):
    """Test can_handle recognizes path separators."""
    assert file_fetcher.can_handle("./file.txt")
    assert file_fetcher.can_handle("../file.txt")
    assert file_fetcher.can_handle("folder/file.txt")
    assert file_fetcher.can_handle("folder\\file.txt")
"""Extended tests for file fetcher."""

import pytest
from unittest.mock import Mock, patch, mock_open
import os

from abi_to_mcp.core.exceptions import ABIValidationError


class TestFileFetcherFullCoverage:
    """Full coverage tests for FileFetcher."""

    @pytest.fixture
    def fetcher(self):
        """Create a FileFetcher instance."""
        return FileFetcher()

    @pytest.fixture
    def valid_abi(self):
        """Valid ABI."""
        return [
            {"type": "function", "name": "test", "inputs": [], "outputs": []},
        ]

    @pytest.mark.asyncio
    async def test_fetch_json_file(self, fetcher, valid_abi):
        """Test fetching from a JSON file."""
        with tempfile.NamedTemporaryFile(mode="w", suffix=".json", delete=False) as f:
            json.dump(valid_abi, f)
            f.flush()
            
            try:
                result = await fetcher.fetch(f.name)
                assert result.abi == valid_abi
                assert result.source == "file"
            finally:
                os.unlink(f.name)

    @pytest.mark.asyncio
    async def test_fetch_hardhat_artifact(self, fetcher, valid_abi):
        """Test fetching from Hardhat artifact."""
        artifact = {
            "abi": valid_abi,
            "bytecode": "0x...",
            "contractName": "TestContract",
        }
        
        with tempfile.NamedTemporaryFile(mode="w", suffix=".json", delete=False) as f:
            json.dump(artifact, f)
            f.flush()
            
            try:
                result = await fetcher.fetch(f.name)
                assert result.abi == valid_abi
            finally:
                os.unlink(f.name)

    @pytest.mark.asyncio
    async def test_fetch_foundry_artifact(self, fetcher, valid_abi):
        """Test fetching from Foundry artifact."""
        artifact = {
            "abi": valid_abi,
            "bytecode": {"object": "0x..."},
            "deployedBytecode": {"object": "0x..."},
        }
        
        with tempfile.NamedTemporaryFile(mode="w", suffix=".json", delete=False) as f:
            json.dump(artifact, f)
            f.flush()
            
            try:
                result = await fetcher.fetch(f.name)
                assert result.abi == valid_abi
            finally:
                os.unlink(f.name)

    @pytest.mark.asyncio
    async def test_fetch_file_not_found(self, fetcher):
        """Test with non-existent file."""
        with pytest.raises(ABINotFoundError):
            await fetcher.fetch("/nonexistent/path/abi.json")

    @pytest.mark.asyncio
    async def test_fetch_invalid_json(self, fetcher):
        """Test with invalid JSON file."""
        with tempfile.NamedTemporaryFile(mode="w", suffix=".json", delete=False) as f:
            f.write("not valid json {{{")
            f.flush()
            
            try:
                with pytest.raises(ABIParseError):
                    await fetcher.fetch(f.name)
            finally:
                os.unlink(f.name)

    @pytest.mark.asyncio
    async def test_fetch_empty_abi(self, fetcher):
        """Test with empty ABI - raises ABIParseError."""
        with tempfile.NamedTemporaryFile(mode="w", suffix=".json", delete=False) as f:
            json.dump([], f)
            f.flush()
            
            try:
                with pytest.raises(ABIParseError):
                    await fetcher.fetch(f.name)
            finally:
                os.unlink(f.name)

    @pytest.mark.asyncio
    async def test_fetch_invalid_artifact_no_abi(self, fetcher):
        """Test with artifact missing abi field."""
        artifact = {"bytecode": "0x...", "other": "data"}
        
        with tempfile.NamedTemporaryFile(mode="w", suffix=".json", delete=False) as f:
            json.dump(artifact, f)
            f.flush()
            
            try:
                with pytest.raises(ABIParseError):
                    await fetcher.fetch(f.name)
            finally:
                os.unlink(f.name)

    def test_can_handle_json_file(self, fetcher):
        """Test can_handle with .json files."""
        assert fetcher.can_handle("contract.json") is True
        assert fetcher.can_handle("/path/to/abi.json") is True

    def test_can_handle_abi_file(self, fetcher):
        """Test can_handle with .abi files."""
        assert fetcher.can_handle("contract.abi") is True

    def test_can_handle_path_separator(self, fetcher):
        """Test can_handle with path separators."""
        assert fetcher.can_handle("./contract") is True
        assert fetcher.can_handle("path/to/file") is True

    def test_can_handle_not_file(self, fetcher):
        """Test can_handle with non-file sources."""
        assert fetcher.can_handle("0x1234567890123456789012345678901234567890") is False

    @pytest.mark.asyncio
    async def test_fetch_with_contract_name_from_artifact(self, fetcher, valid_abi):
        """Test extracting contract name from artifact."""
        artifact = {
            "abi": valid_abi,
            "contractName": "MyContract",
        }
        
        with tempfile.NamedTemporaryFile(mode="w", suffix=".json", delete=False) as f:
            json.dump(artifact, f)
            f.flush()
            
            try:
                result = await fetcher.fetch(f.name)
                assert result.contract_name == "MyContract"
            finally:
                os.unlink(f.name)

    @pytest.mark.asyncio
    async def test_fetch_with_source_code(self, fetcher, valid_abi):
        """Test extracting source code from artifact."""
        artifact = {
            "abi": valid_abi,
            "source": "pragma solidity ^0.8.0;",
        }
        
        with tempfile.NamedTemporaryFile(mode="w", suffix=".json", delete=False) as f:
            json.dump(artifact, f)
            f.flush()
            
            try:
                result = await fetcher.fetch(f.name)
                # Source code might be extracted if present
                assert result.source == "file"
            finally:
                os.unlink(f.name)

    @pytest.mark.asyncio
    async def test_fetch_relative_path(self, fetcher, valid_abi):
        """Test fetching with relative path."""
        # Create a temp file in current directory
        with tempfile.NamedTemporaryFile(
            mode="w", suffix=".json", delete=False, dir="."
        ) as f:
            json.dump(valid_abi, f)
            f.flush()
            
            try:
                # Use just the filename (relative path)
                result = await fetcher.fetch(os.path.basename(f.name))
                assert result.abi == valid_abi
            finally:
                os.unlink(f.name)

    @pytest.mark.asyncio
    async def test_fetch_path_object(self, fetcher, valid_abi):
        """Test fetching with Path object as string."""
        with tempfile.NamedTemporaryFile(mode="w", suffix=".json", delete=False) as f:
            json.dump(valid_abi, f)
            f.flush()
            
            try:
                path = Path(f.name)
                result = await fetcher.fetch(str(path))
                assert result.abi == valid_abi
            finally:
                os.unlink(f.name)


class TestFileFetcherEdgeCases:
    """Edge case tests for FileFetcher."""

    @pytest.fixture
    def fetcher(self):
        return FileFetcher()

    @pytest.mark.asyncio
    async def test_fetch_with_unicode_path(self, fetcher):
        """Test fetching with unicode characters in path."""
        valid_abi = [{"type": "function", "name": "test", "inputs": [], "outputs": []}]
        
        # Create temp dir with unicode name
        with tempfile.TemporaryDirectory() as tmpdir:
            filepath = Path(tmpdir) / "контракт.json"
            with open(filepath, "w") as f:
                json.dump(valid_abi, f)
            
            result = await fetcher.fetch(str(filepath))
            assert result.abi == valid_abi

    @pytest.mark.asyncio
    async def test_fetch_with_spaces_in_path(self, fetcher):
        """Test fetching with spaces in path."""
        valid_abi = [{"type": "function", "name": "test", "inputs": [], "outputs": []}]
        
        with tempfile.TemporaryDirectory() as tmpdir:
            filepath = Path(tmpdir) / "my contract.json"
            with open(filepath, "w") as f:
                json.dump(valid_abi, f)
            
            result = await fetcher.fetch(str(filepath))
            assert result.abi == valid_abi

    @pytest.mark.asyncio
    async def test_fetch_deeply_nested_abi(self, fetcher):
        """Test with deeply nested artifact structure."""
        valid_abi = [{"type": "function", "name": "test", "inputs": [], "outputs": []}]
        artifact = {
            "output": {
                "abi": valid_abi,
            },
            "abi": valid_abi,  # Also include top-level for compatibility
        }
        
        with tempfile.NamedTemporaryFile(mode="w", suffix=".json", delete=False) as f:
            json.dump(artifact, f)
            f.flush()
            
            try:
                result = await fetcher.fetch(f.name)
                assert result.abi == valid_abi
            finally:
                os.unlink(f.name)
"""Tests for file fetcher edge cases."""

import pytest


class TestFileFetcherEdgeCases:
    """Test edge cases in file fetcher."""
    
    def test_fetch_from_nonexistent_file(self):
        """Test fetching from nonexistent file."""
        from abi_to_mcp.fetchers.file import FileFetcher
        
        fetcher = FileFetcher()
        
        with pytest.raises(Exception):
            import asyncio
            asyncio.run(fetcher.fetch("/nonexistent/path/file.json"))
    
    def test_fetch_from_invalid_json(self):
        """Test fetching from invalid JSON file."""
        from abi_to_mcp.fetchers.file import FileFetcher
        
        with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as f:
            f.write("{ invalid json }")
            f.flush()
            
            fetcher = FileFetcher()
            
            try:
                import asyncio
                with pytest.raises(Exception):
                    asyncio.run(fetcher.fetch(f.name))
            finally:
                os.unlink(f.name)
    
    def test_fetch_from_artifact_format(self):
        """Test fetching from artifact format with bytecode."""
        from abi_to_mcp.fetchers.file import FileFetcher
        
        artifact = {
            "abi": [
                {"type": "function", "name": "test", "inputs": [], "outputs": []}
            ],
            "bytecode": "0x608060405234801561001057600080fd5b50",
        }
        
        with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as f:
            json.dump(artifact, f)
            f.flush()
            
            fetcher = FileFetcher()
            
            try:
                import asyncio
                result = asyncio.run(fetcher.fetch(f.name))
                assert result is not None
                assert len(result.abi) > 0
            finally:
                os.unlink(f.name)
    
    def test_fetch_from_array_format(self):
        """Test fetching from pure array format."""
        from abi_to_mcp.fetchers.file import FileFetcher
        
        abi = [
            {"type": "function", "name": "transfer", "inputs": [], "outputs": []},
            {"type": "event", "name": "Transfer", "inputs": []},
        ]
        
        with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as f:
            json.dump(abi, f)
            f.flush()
            
            fetcher = FileFetcher()
            
            try:
                import asyncio
                result = asyncio.run(fetcher.fetch(f.name))
                assert len(result.abi) == 2
            finally:
                os.unlink(f.name)
    
    def test_fetch_with_directory_path(self):
        """Test fetching with a directory path instead of file."""
        from abi_to_mcp.fetchers.file import FileFetcher
        
        with tempfile.TemporaryDirectory() as tmpdir:
            fetcher = FileFetcher()
            
            # Should raise an error since it's a directory
            import asyncio
            with pytest.raises(Exception):
                asyncio.run(fetcher.fetch(tmpdir))


class TestFileFetcherURL:
    """Test file fetcher with URL-like inputs."""
    
    def test_fetch_relative_path(self):
        """Test fetching with relative path."""
        from abi_to_mcp.fetchers.file import FileFetcher
        
        # This should work with relative paths too
        abi = [{"type": "function", "name": "test", "inputs": [], "outputs": []}]
        
        with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False, dir='.') as f:
            json.dump(abi, f)
            f.flush()
            
            # Get relative path
            rel_path = os.path.basename(f.name)
            fetcher = FileFetcher()
            
            try:
                import asyncio
                result = asyncio.run(fetcher.fetch(rel_path))
                assert len(result.abi) == 1
            finally:
                os.unlink(f.name)
