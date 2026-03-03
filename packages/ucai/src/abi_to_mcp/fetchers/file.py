"""File fetcher module.

This module provides the FileFetcher class for loading ABIs from local files.

AGENT 2: This file needs full implementation. See AGENTS.md for requirements.
"""

import json
from pathlib import Path
from typing import Dict, Any, List

from abi_to_mcp.fetchers.base import ABIFetcher
from abi_to_mcp.core.models import FetchResult
from abi_to_mcp.core.exceptions import ABINotFoundError, ABIParseError


class FileFetcher(ABIFetcher):
    """
    Fetcher for local ABI JSON files.

    Supports:
    - Plain ABI array: [{"type": "function", ...}]
    - Truffle/Hardhat artifact: {"abi": [...], "contractName": "..."}
    - Foundry output: {"abi": [...]}
    """

    async def fetch(self, source: str, **kwargs) -> FetchResult:
        """
        Load ABI from local file.

        Args:
            source: Path to JSON file

        Returns:
            FetchResult with ABI data
        """
        path = Path(source).expanduser().resolve()

        if not path.exists():
            raise ABINotFoundError(source, f"File not found: {path}")

        if not path.is_file():
            raise ABINotFoundError(source, f"Not a file: {path}")

        try:
            with open(path, "r", encoding="utf-8") as f:
                data = json.load(f)
        except json.JSONDecodeError as e:
            raise ABIParseError(f"Invalid JSON in {path}: {e}", entry_type="file") from e
        except Exception as e:
            raise ABINotFoundError(source, f"Failed to read file: {e}") from e

        # Extract ABI from various formats
        abi, contract_name, compiler_version = self._extract_abi(data, str(path))

        return FetchResult(
            abi=abi,
            source="file",
            source_location=str(path),
            contract_name=contract_name,
            compiler_version=compiler_version,
        )

    def can_handle(self, source: str) -> bool:
        """Check if source is a local file path."""
        # Check for common file path patterns
        if source.startswith("0x") and len(source) == 42:
            return False  # Ethereum address

        if source.startswith(("http://", "https://")):
            return False  # URL

        # Check common file patterns
        path = Path(source)

        # If it has a JSON extension, likely a file
        if path.suffix.lower() in (".json", ".abi"):
            return True

        # If it exists as a file, it's a file
        if path.exists() and path.is_file():
            return True

        # If it has path separators, likely a file path
        if "/" in source or "\\" in source or source.startswith("./") or source.startswith("../"):
            return True

        return False

    def _extract_abi(self, data: Any, source_location: str = "memory") -> tuple:
        """
        Extract ABI from various file formats.

        Args:
            data: Loaded JSON data
            source_location: File path for error messages

        Returns:
            Tuple of (abi, contract_name, compiler_version)

        Raises:
            ABIParseError: If format is not recognized
        """
        contract_name = None
        compiler_version = None

        # Plain ABI array
        if isinstance(data, list):
            if not data:
                raise ABIParseError("ABI array is empty", entry_type="file")
            return data, None, None

        # Object with abi key (Truffle/Hardhat/Foundry)
        if isinstance(data, dict):
            if "abi" in data:
                abi = data["abi"]

                if not isinstance(abi, list):
                    raise ABIParseError(
                        f"ABI must be an array, got {type(abi).__name__}", entry_type="file"
                    )

                if not abi:
                    raise ABIParseError("ABI array is empty", entry_type="file")

                contract_name = data.get("contractName") or data.get("name")

                # Hardhat format
                if "compiler" in data:
                    compiler_info = data["compiler"]
                    if isinstance(compiler_info, dict):
                        compiler_version = compiler_info.get("version")
                    else:
                        compiler_version = str(compiler_info)
                elif "solcVersion" in data:
                    compiler_version = data["solcVersion"]

                # Foundry format
                elif "metadata" in data:
                    try:
                        metadata = data["metadata"]
                        if isinstance(metadata, str):
                            metadata = json.loads(metadata)
                        if isinstance(metadata, dict) and "compiler" in metadata:
                            compiler_version = metadata["compiler"].get("version")
                    except Exception:
                        pass  # Ignore metadata parsing errors

                return abi, contract_name, compiler_version

        raise ABIParseError(
            f"Unrecognized artifact format in {source_location}. Expected ABI array or artifact with 'abi' key.",
            entry_type="file",
        )

    async def fetch_from_dict(self, data: Dict[str, Any]) -> FetchResult:
        """Fetch from already-loaded dictionary (for testing)."""
        abi, contract_name, compiler_version = self._extract_abi(data, "<dict>")
        return FetchResult(
            abi=abi,
            source="file",
            source_location="<dict>",
            contract_name=contract_name,
            compiler_version=compiler_version,
        )
