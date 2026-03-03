"""
Shared pytest fixtures for abi-to-mcp tests.

This module provides fixtures that are available to all tests automatically.
"""

import json
from pathlib import Path
from typing import Dict, Any, List

import pytest

from abi_to_mcp.core.models import (
    ABIParameter,
    ABIFunction,
    ABIEvent,
    ParsedABI,
    StateMutability,
)


# =============================================================================
# Path Fixtures
# =============================================================================


@pytest.fixture
def fixtures_dir() -> Path:
    """Path to the test fixtures directory."""
    return Path(__file__).parent / "fixtures"


@pytest.fixture
def abis_dir(fixtures_dir: Path) -> Path:
    """Path to the ABI fixtures directory."""
    return fixtures_dir / "abis"


# =============================================================================
# ABI JSON Fixtures
# =============================================================================


@pytest.fixture
def erc20_abi_json(abis_dir: Path) -> List[Dict[str, Any]]:
    """Load ERC20 ABI JSON."""
    with open(abis_dir / "erc20.json") as f:
        return json.load(f)


@pytest.fixture
def erc721_abi_json(abis_dir: Path) -> List[Dict[str, Any]]:
    """Load ERC721 ABI JSON."""
    with open(abis_dir / "erc721.json") as f:
        return json.load(f)


@pytest.fixture
def erc1155_abi_json(abis_dir: Path) -> List[Dict[str, Any]]:
    """Load ERC1155 ABI JSON (if exists)."""
    path = abis_dir / "erc1155.json"
    if path.exists():
        with open(path) as f:
            return json.load(f)
    pytest.skip("ERC1155 ABI fixture not found")


@pytest.fixture
def uniswap_v2_router_abi_json(abis_dir: Path) -> List[Dict[str, Any]]:
    """Load Uniswap V2 Router ABI JSON."""
    with open(abis_dir / "uniswap_v2_router.json") as f:
        return json.load(f)


@pytest.fixture
def uniswap_v3_router_abi_json(abis_dir: Path) -> List[Dict[str, Any]]:
    """Load Uniswap V3 Router ABI JSON (with tuple params)."""
    with open(abis_dir / "uniswap_v3_router.json") as f:
        return json.load(f)


@pytest.fixture
def gnosis_safe_abi_json(abis_dir: Path) -> List[Dict[str, Any]]:
    """Load Gnosis Safe multi-sig ABI JSON."""
    with open(abis_dir / "gnosis_safe.json") as f:
        return json.load(f)


@pytest.fixture
def governor_abi_json(abis_dir: Path) -> List[Dict[str, Any]]:
    """Load Governor (OpenZeppelin) ABI JSON."""
    with open(abis_dir / "governor.json") as f:
        return json.load(f)


@pytest.fixture
def transparent_proxy_abi_json(abis_dir: Path) -> List[Dict[str, Any]]:
    """Load Transparent Proxy ABI JSON."""
    with open(abis_dir / "transparent_proxy.json") as f:
        return json.load(f)


# Legacy alias for backwards compatibility
@pytest.fixture
def uniswap_router_abi_json(uniswap_v2_router_abi_json: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Load Uniswap Router ABI JSON (alias for v2)."""
    return uniswap_v2_router_abi_json


# =============================================================================
# Parsed ABI Fixtures
# =============================================================================


@pytest.fixture
def erc20_parsed() -> ParsedABI:
    """Pre-parsed ERC20 ABI for testing mappers and generators."""
    return ParsedABI(
        functions=[
            ABIFunction(
                name="name",
                inputs=[],
                outputs=[ABIParameter(name="", type="string")],
                state_mutability=StateMutability.VIEW,
            ),
            ABIFunction(
                name="symbol",
                inputs=[],
                outputs=[ABIParameter(name="", type="string")],
                state_mutability=StateMutability.VIEW,
            ),
            ABIFunction(
                name="decimals",
                inputs=[],
                outputs=[ABIParameter(name="", type="uint8")],
                state_mutability=StateMutability.VIEW,
            ),
            ABIFunction(
                name="totalSupply",
                inputs=[],
                outputs=[ABIParameter(name="", type="uint256")],
                state_mutability=StateMutability.VIEW,
            ),
            ABIFunction(
                name="balanceOf",
                inputs=[ABIParameter(name="account", type="address")],
                outputs=[ABIParameter(name="", type="uint256")],
                state_mutability=StateMutability.VIEW,
            ),
            ABIFunction(
                name="transfer",
                inputs=[
                    ABIParameter(name="to", type="address"),
                    ABIParameter(name="amount", type="uint256"),
                ],
                outputs=[ABIParameter(name="", type="bool")],
                state_mutability=StateMutability.NONPAYABLE,
            ),
            ABIFunction(
                name="approve",
                inputs=[
                    ABIParameter(name="spender", type="address"),
                    ABIParameter(name="amount", type="uint256"),
                ],
                outputs=[ABIParameter(name="", type="bool")],
                state_mutability=StateMutability.NONPAYABLE,
            ),
            ABIFunction(
                name="allowance",
                inputs=[
                    ABIParameter(name="owner", type="address"),
                    ABIParameter(name="spender", type="address"),
                ],
                outputs=[ABIParameter(name="", type="uint256")],
                state_mutability=StateMutability.VIEW,
            ),
            ABIFunction(
                name="transferFrom",
                inputs=[
                    ABIParameter(name="from", type="address"),
                    ABIParameter(name="to", type="address"),
                    ABIParameter(name="amount", type="uint256"),
                ],
                outputs=[ABIParameter(name="", type="bool")],
                state_mutability=StateMutability.NONPAYABLE,
            ),
        ],
        events=[
            ABIEvent(
                name="Transfer",
                inputs=[
                    ABIParameter(name="from", type="address", indexed=True),
                    ABIParameter(name="to", type="address", indexed=True),
                    ABIParameter(name="value", type="uint256", indexed=False),
                ],
            ),
            ABIEvent(
                name="Approval",
                inputs=[
                    ABIParameter(name="owner", type="address", indexed=True),
                    ABIParameter(name="spender", type="address", indexed=True),
                    ABIParameter(name="value", type="uint256", indexed=False),
                ],
            ),
        ],
        errors=[],
        raw_abi=[],  # Not needed for most tests
        detected_standard="ERC20",
        has_constructor=True,
    )


# =============================================================================
# Sample Data Fixtures
# =============================================================================


@pytest.fixture
def sample_address() -> str:
    """Sample Ethereum address for testing."""
    return "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"


@pytest.fixture
def sample_private_key() -> str:
    """Sample private key for testing (DO NOT USE IN PRODUCTION)."""
    # This is a well-known test private key - never use for real funds
    return "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"


@pytest.fixture
def sample_tx_hash() -> str:
    """Sample transaction hash for testing."""
    return "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef"


# =============================================================================
# Mock Fixtures
# =============================================================================


@pytest.fixture
def mock_etherscan_response() -> Dict[str, Any]:
    """Mock successful Etherscan API response."""
    return {
        "status": "1",
        "message": "OK",
        "result": json.dumps([
            {"type": "function", "name": "balanceOf", "inputs": [], "outputs": []}
        ]),
    }


@pytest.fixture
def mock_etherscan_not_verified_response() -> Dict[str, Any]:
    """Mock Etherscan response for unverified contract."""
    return {
        "status": "0",
        "message": "NOTOK",
        "result": "Contract source code not verified",
    }


# =============================================================================
# Temporary Directory Fixtures
# =============================================================================


@pytest.fixture
def output_dir(tmp_path: Path) -> Path:
    """Temporary output directory for generated files."""
    output = tmp_path / "output"
    output.mkdir()
    return output


# =============================================================================
# Configuration Fixtures
# =============================================================================


@pytest.fixture
def generator_config():
    """Default generator configuration for testing."""
    from abi_to_mcp.core.config import GeneratorConfig

    return GeneratorConfig(
        read_only=False,
        include_events=True,
        include_utilities=True,
        simulation_default=True,
    )


@pytest.fixture
def fetcher_config():
    """Default fetcher configuration for testing."""
    from abi_to_mcp.core.config import FetcherConfig

    return FetcherConfig(
        timeout=10.0,
        max_retries=1,
        detect_proxy=True,
    )
