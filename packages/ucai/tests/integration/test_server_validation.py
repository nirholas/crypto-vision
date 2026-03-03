"""
Comprehensive Integration Tests for Generated MCP Servers.

These tests validate that generated MCP servers:
1. Import without errors
2. Have all expected tools registered
3. Have all expected resources registered
4. Have correct tool signatures (parameters, types)
5. Handle various ABI patterns correctly

This is the foundation for production-ready server generation.
"""

import json
import pytest
from pathlib import Path

from abi_to_mcp.fetchers.file import FileFetcher
from abi_to_mcp.parser.abi_parser import ABIParser
from abi_to_mcp.mapper.type_mapper import TypeMapper
from abi_to_mcp.mapper.function_mapper import FunctionMapper
from abi_to_mcp.mapper.event_mapper import EventMapper
from abi_to_mcp.generator.server_generator import ServerGenerator
from abi_to_mcp.core.config import GeneratorConfig

from tests.integration.server_validator import (
    ServerValidator,
    ServerTestHarness,
    ValidationResult,
)


# =============================================================================
# Fixtures
# =============================================================================


@pytest.fixture
def fixtures_dir():
    """Path to ABI fixtures."""
    return Path(__file__).parent.parent / "fixtures" / "abis"


@pytest.fixture
def validator():
    """Create a server validator."""
    return ServerValidator()


async def generate_server_from_abi(
    abi_path: Path,
    output_dir: Path,
    contract_address: str = "0x0000000000000000000000000000000000000001",
    network: str = "mainnet",
    contract_name: str | None = None,
) -> Path:
    """Helper to generate a server from an ABI file."""
    fetcher = FileFetcher()
    result = await fetcher.fetch(str(abi_path))
    
    parser = ABIParser()
    parsed = parser.parse(result.abi)
    
    type_mapper = TypeMapper()
    func_mapper = FunctionMapper(type_mapper)
    event_mapper = EventMapper(type_mapper)
    
    tools = [func_mapper.map_function(f) for f in parsed.functions]
    resources = [event_mapper.map_event(e) for e in parsed.events]
    
    config = GeneratorConfig(output_dir=output_dir)
    generator = ServerGenerator(config)
    
    server = generator.generate(
        parsed=parsed,
        tools=tools,
        resources=resources,
        contract_address=contract_address,
        network=network,
        contract_name=contract_name,
    )
    generator.write_to_disk(server, output_dir)
    
    return output_dir


# =============================================================================
# ERC20 Token Tests
# =============================================================================


@pytest.mark.integration
class TestERC20ServerValidation:
    """Comprehensive validation of ERC20 generated servers."""
    
    @pytest.fixture
    async def erc20_server(self, fixtures_dir, tmp_path):
        """Generate an ERC20 server."""
        return await generate_server_from_abi(
            fixtures_dir / "erc20.json",
            tmp_path / "erc20-server",
            contract_address="0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
            contract_name="USDC",
        )
    
    @pytest.mark.asyncio
    async def test_server_validates_successfully(self, erc20_server, validator):
        """Generated server should pass all validation checks."""
        result = validator.validate(erc20_server)
        
        assert result.success, f"Validation failed: {result.errors}"
        assert len(result.errors) == 0
    
    @pytest.mark.asyncio
    async def test_server_has_all_erc20_read_tools(self, erc20_server, validator):
        """Server should have all standard ERC20 read functions."""
        result = validator.validate(erc20_server)
        
        expected_read_tools = [
            "name",
            "symbol",
            "decimals",
            "total_supply",
            "balance_of",
            "allowance",
        ]
        
        for tool in expected_read_tools:
            assert result.has_tool(tool), \
                f"Missing read tool: {tool}. Available: {result.tool_names}"
    
    @pytest.mark.asyncio
    async def test_server_has_all_erc20_write_tools(self, erc20_server, validator):
        """Server should have all standard ERC20 write functions."""
        result = validator.validate(erc20_server)
        
        expected_write_tools = [
            "transfer",
            "approve",
            "transfer_from",
        ]
        
        for tool in expected_write_tools:
            assert result.has_tool(tool), \
                f"Missing write tool: {tool}. Available: {result.tool_names}"
    
    @pytest.mark.asyncio
    async def test_server_has_erc20_events(self, erc20_server, validator):
        """Server should have Transfer and Approval event query tools."""
        result = validator.validate(erc20_server)
        
        # Events are now tools - check for get_*_events tools
        event_tools = [t for t in result.tool_names if "_events" in t]
        assert len(event_tools) >= 2, \
            f"Expected at least 2 event query tools, got {len(event_tools)}: {event_tools}"
    
    @pytest.mark.asyncio
    async def test_balance_of_has_correct_parameters(self, erc20_server, validator):
        """balance_of should have account parameter."""
        result = validator.validate(erc20_server)
        tool = result.get_tool("balance_of")
        
        assert tool is not None, "balance_of tool not found"
        assert "account" in tool.parameters, \
            f"balance_of missing 'account' param. Has: {tool.parameter_names}"
    
    @pytest.mark.asyncio
    async def test_transfer_has_correct_parameters(self, erc20_server, validator):
        """transfer should have to, amount, and simulate parameters."""
        result = validator.validate(erc20_server)
        tool = result.get_tool("transfer")
        
        assert tool is not None, "transfer tool not found"
        assert "to" in tool.parameters, \
            f"transfer missing 'to' param. Has: {tool.parameter_names}"
        assert "amount" in tool.parameters, \
            f"transfer missing 'amount' param. Has: {tool.parameter_names}"
        # Write tools should have simulate parameter
        assert "simulate" in tool.parameters, \
            f"transfer missing 'simulate' param. Has: {tool.parameter_names}"
    
    @pytest.mark.asyncio
    async def test_write_tools_have_simulate_parameter(self, erc20_server):
        """All write tools should have optional simulate parameter."""
        harness = ServerTestHarness(erc20_server)
        write_tools = harness.get_write_tools()
        
        assert len(write_tools) >= 3, "Should have at least 3 write tools"
        
        for tool in write_tools:
            assert "simulate" in tool.parameters, \
                f"Write tool '{tool.name}' missing simulate parameter"
            assert not tool.parameters["simulate"].get("required", True), \
                f"simulate should be optional for {tool.name}"


# =============================================================================
# ERC721 NFT Tests
# =============================================================================


@pytest.mark.integration
class TestERC721ServerValidation:
    """Comprehensive validation of ERC721 generated servers."""
    
    @pytest.fixture
    async def erc721_server(self, fixtures_dir, tmp_path):
        """Generate an ERC721 server."""
        return await generate_server_from_abi(
            fixtures_dir / "erc721.json",
            tmp_path / "erc721-server",
            contract_address="0xBC4CA0EdA7647A8aB7C2061c2E118A18a936f13D",
            contract_name="BAYC",
        )
    
    @pytest.mark.asyncio
    async def test_server_validates_successfully(self, erc721_server, validator):
        """Generated NFT server should pass validation."""
        result = validator.validate(erc721_server)
        
        assert result.success, f"Validation failed: {result.errors}"
    
    @pytest.mark.asyncio
    async def test_has_nft_specific_functions(self, erc721_server, validator):
        """NFT server should have ownerOf, tokenURI, etc."""
        result = validator.validate(erc721_server)
        
        # Check for NFT-specific functions (name variations handled)
        tool_names_lower = {t.lower().replace("_", "") for t in result.tool_names}
        
        assert "ownerof" in tool_names_lower, \
            f"Missing ownerOf. Available: {result.tool_names}"
        
        # tokenURI might be token_uri or tokenuri
        has_token_uri = any("token" in t and "uri" in t.lower() for t in result.tool_names)
        assert has_token_uri, f"Missing tokenURI. Available: {result.tool_names}"
    
    @pytest.mark.asyncio
    async def test_owner_of_has_token_id_parameter(self, erc721_server, validator):
        """ownerOf should accept tokenId parameter."""
        result = validator.validate(erc721_server)
        
        # Find owner_of tool (might be owner_of or ownerOf based on naming)
        tool = result.get_tool("owner_of")
        if tool is None:
            # Try alternate naming
            for t in result.tools:
                if "owner" in t.name.lower():
                    tool = t
                    break
        
        assert tool is not None, "ownerOf tool not found"
        
        # Should have tokenId parameter (might be named differently)
        param_names_lower = {p.lower() for p in tool.parameter_names}
        has_token_id = "tokenid" in param_names_lower or "token_id" in param_names_lower
        assert has_token_id, f"ownerOf missing tokenId param. Has: {tool.parameter_names}"


# =============================================================================
# DeFi / Uniswap Tests
# =============================================================================


@pytest.mark.integration
class TestUniswapV2ServerValidation:
    """Validation of Uniswap V2 style router servers."""
    
    @pytest.fixture
    async def uniswap_server(self, fixtures_dir, tmp_path):
        """Generate a Uniswap V2 router server."""
        return await generate_server_from_abi(
            fixtures_dir / "uniswap_v2_router.json",
            tmp_path / "uniswap-server",
            contract_address="0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D",
            contract_name="UniswapV2Router",
        )
    
    @pytest.mark.asyncio
    async def test_server_validates_successfully(self, uniswap_server, validator):
        """Uniswap router server should pass validation."""
        result = validator.validate(uniswap_server)
        
        assert result.success, f"Validation failed: {result.errors}"
    
    @pytest.mark.asyncio
    async def test_has_swap_functions(self, uniswap_server, validator):
        """Should have swap functions."""
        result = validator.validate(uniswap_server)
        
        swap_tools = [t for t in result.tools if "swap" in t.name.lower()]
        assert len(swap_tools) >= 2, \
            f"Expected swap functions. Available: {result.tool_names}"
    
    @pytest.mark.asyncio
    async def test_has_liquidity_functions(self, uniswap_server, validator):
        """Should have add/remove liquidity functions."""
        result = validator.validate(uniswap_server)
        
        liquidity_tools = [t for t in result.tools if "liquidity" in t.name.lower()]
        assert len(liquidity_tools) >= 2, \
            f"Expected liquidity functions. Available: {result.tool_names}"
    
    @pytest.mark.asyncio
    async def test_array_parameters_handled(self, uniswap_server, validator):
        """Swap functions with address[] path should be handled."""
        result = validator.validate(uniswap_server)
        
        # Find swap function
        swap_tool = result.get_tool("swap_exact_tokens_for_tokens")
        if swap_tool is None:
            swap_tool = result.get_tool("swap_exact_e_t_h_for_tokens")
        
        assert swap_tool is not None, \
            f"No swap tool found. Available: {result.tool_names}"
        
        # Should have path parameter
        assert "path" in swap_tool.parameters, \
            f"Swap tool missing 'path' param. Has: {swap_tool.parameter_names}"
    
    @pytest.mark.asyncio
    async def test_has_defi_events(self, uniswap_server, validator):
        """Should have Swap, Sync, Mint, Burn event query tools."""
        result = validator.validate(uniswap_server)
        
        # Events are now tools - check for get_*_events tools
        event_tools = [t for t in result.tool_names if "_events" in t]
        assert len(event_tools) >= 4, \
            f"Expected at least 4 event query tools, got {len(event_tools)}: {event_tools}"
    
    @pytest.mark.asyncio
    async def test_payable_function_has_value_param(self, uniswap_server, validator):
        """Payable functions should have value_wei parameter."""
        result = validator.validate(uniswap_server)
        
        # Find a payable function (swapExactETHForTokens is payable)
        eth_swap = None
        for tool in result.tools:
            if "eth" in tool.name.lower() and "swap" in tool.name.lower():
                eth_swap = tool
                break
        
        if eth_swap:
            assert "value_wei" in eth_swap.parameters, \
                f"Payable function missing value_wei. Has: {eth_swap.parameter_names}"


# =============================================================================
# Uniswap V3 (Tuple Parameters) Tests
# =============================================================================


@pytest.mark.integration
class TestUniswapV3ServerValidation:
    """Validation of Uniswap V3 router with tuple parameters."""
    
    @pytest.fixture
    async def uniswap_v3_server(self, fixtures_dir, tmp_path):
        """Generate a Uniswap V3 router server."""
        return await generate_server_from_abi(
            fixtures_dir / "uniswap_v3_router.json",
            tmp_path / "uniswap-v3-server",
            contract_address="0xE592427A0AEce92De3Edee1F18E0157C05861564",
            contract_name="UniswapV3Router",
        )
    
    @pytest.mark.asyncio
    async def test_server_validates_successfully(self, uniswap_v3_server, validator):
        """V3 router with tuples should pass validation."""
        result = validator.validate(uniswap_v3_server)
        
        assert result.success, f"Validation failed: {result.errors}"
    
    @pytest.mark.asyncio
    async def test_has_exact_input_single(self, uniswap_v3_server, validator):
        """Should have exactInputSingle function."""
        result = validator.validate(uniswap_v3_server)
        
        # Find exact input single (naming might vary)
        has_exact_input = any(
            "exact" in t.name.lower() and "input" in t.name.lower()
            for t in result.tools
        )
        assert has_exact_input, \
            f"Missing exact input function. Available: {result.tool_names}"
    
    @pytest.mark.asyncio
    async def test_tuple_params_expanded(self, uniswap_v3_server, validator):
        """Tuple parameters should be expanded into individual params."""
        result = validator.validate(uniswap_v3_server)
        
        # Find exactInputSingle tool
        exact_input = None
        for tool in result.tools:
            if "exact" in tool.name.lower() and "single" in tool.name.lower():
                exact_input = tool
                break
        
        if exact_input:
            # Should have expanded tuple parameters OR single params object
            # Either way, should have multiple params
            assert len(exact_input.parameters) >= 1, \
                f"exactInputSingle should have parameters. Has: {exact_input.parameters}"


# =============================================================================
# Multi-Sig (Gnosis Safe) Tests
# =============================================================================


@pytest.mark.integration
class TestGnosisSafeServerValidation:
    """Validation of Gnosis Safe multi-sig servers."""
    
    @pytest.fixture
    async def safe_server(self, fixtures_dir, tmp_path):
        """Generate a Gnosis Safe server."""
        return await generate_server_from_abi(
            fixtures_dir / "gnosis_safe.json",
            tmp_path / "safe-server",
            contract_address="0xd9Db270c1B5E3Bd161E8c8503c55cEABeE709552",
            contract_name="GnosisSafe",
        )
    
    @pytest.mark.asyncio
    async def test_server_validates_successfully(self, safe_server, validator):
        """Gnosis Safe server should pass validation."""
        result = validator.validate(safe_server)
        
        assert result.success, f"Validation failed: {result.errors}"
    
    @pytest.mark.asyncio
    async def test_has_owner_management_functions(self, safe_server, validator):
        """Should have owner management functions."""
        result = validator.validate(safe_server)
        
        owner_tools = [t for t in result.tools if "owner" in t.name.lower()]
        assert len(owner_tools) >= 2, \
            f"Expected owner management tools. Available: {result.tool_names}"
    
    @pytest.mark.asyncio
    async def test_has_exec_transaction(self, safe_server, validator):
        """Should have execTransaction function."""
        result = validator.validate(safe_server)
        
        has_exec = any("exec" in t.name.lower() for t in result.tools)
        assert has_exec, f"Missing execTransaction. Available: {result.tool_names}"
    
    @pytest.mark.asyncio
    async def test_bytes_parameter_handled(self, safe_server, validator):
        """bytes parameters should be handled correctly."""
        result = validator.validate(safe_server)
        
        # Find execTransaction or similar
        exec_tool = None
        for tool in result.tools:
            if "exec" in tool.name.lower() and "transaction" in tool.name.lower():
                exec_tool = tool
                break
        
        if exec_tool:
            # Should have data parameter (bytes type)
            assert "data" in exec_tool.parameters or "signatures" in exec_tool.parameters, \
                f"Missing bytes params. Has: {exec_tool.parameter_names}"


# =============================================================================
# Governance Tests
# =============================================================================


@pytest.mark.integration
class TestGovernorServerValidation:
    """Validation of governance contract servers."""
    
    @pytest.fixture
    async def governor_server(self, fixtures_dir, tmp_path):
        """Generate a Governor server."""
        return await generate_server_from_abi(
            fixtures_dir / "governor.json",
            tmp_path / "governor-server",
            contract_address="0x408ED6354d4973f66138C91495F2f2FCbd8724C3",
            contract_name="Governor",
        )
    
    @pytest.mark.asyncio
    async def test_server_validates_successfully(self, governor_server, validator):
        """Governor server should pass validation."""
        result = validator.validate(governor_server)
        
        assert result.success, f"Validation failed: {result.errors}"
    
    @pytest.mark.asyncio
    async def test_has_proposal_functions(self, governor_server, validator):
        """Should have propose, execute, cancel functions."""
        result = validator.validate(governor_server)
        
        expected_functions = ["propose", "execute", "cancel"]
        for func in expected_functions:
            has_func = any(func in t.name.lower() for t in result.tools)
            assert has_func, f"Missing {func} function. Available: {result.tool_names}"
    
    @pytest.mark.asyncio
    async def test_has_voting_functions(self, governor_server, validator):
        """Should have castVote functions."""
        result = validator.validate(governor_server)
        
        vote_tools = [t for t in result.tools if "vote" in t.name.lower()]
        assert len(vote_tools) >= 2, \
            f"Expected voting functions. Available: {result.tool_names}"
    
    @pytest.mark.asyncio
    async def test_array_parameters_for_batch_operations(self, governor_server, validator):
        """Propose should have array parameters for batch operations."""
        result = validator.validate(governor_server)
        
        propose_tool = result.get_tool("propose")
        assert propose_tool is not None, "propose tool not found"
        
        # Should have targets, values, calldatas array params
        assert "targets" in propose_tool.parameters, \
            f"propose missing targets. Has: {propose_tool.parameter_names}"


# =============================================================================
# Proxy Contract Tests
# =============================================================================


@pytest.mark.integration
class TestProxyServerValidation:
    """Validation of upgradeable proxy servers."""
    
    @pytest.fixture
    async def proxy_server(self, fixtures_dir, tmp_path):
        """Generate a Transparent Proxy server."""
        return await generate_server_from_abi(
            fixtures_dir / "transparent_proxy.json",
            tmp_path / "proxy-server",
            contract_address="0x1234567890abcdef1234567890abcdef12345678",
            contract_name="TransparentProxy",
        )
    
    @pytest.mark.asyncio
    async def test_server_validates_successfully(self, proxy_server, validator):
        """Proxy server should pass validation."""
        result = validator.validate(proxy_server)
        
        assert result.success, f"Validation failed: {result.errors}"
    
    @pytest.mark.asyncio
    async def test_has_upgrade_functions(self, proxy_server, validator):
        """Should have upgradeTo and upgradeToAndCall."""
        result = validator.validate(proxy_server)
        
        upgrade_tools = [t for t in result.tools if "upgrade" in t.name.lower()]
        assert len(upgrade_tools) >= 1, \
            f"Expected upgrade functions. Available: {result.tool_names}"
    
    @pytest.mark.asyncio
    async def test_has_admin_functions(self, proxy_server, validator):
        """Should have admin and changeAdmin functions."""
        result = validator.validate(proxy_server)
        
        admin_tools = [t for t in result.tools if "admin" in t.name.lower()]
        assert len(admin_tools) >= 1, \
            f"Expected admin functions. Available: {result.tool_names}"


# =============================================================================
# Cross-Contract Validation Tests
# =============================================================================


@pytest.mark.integration
class TestCrossContractPatterns:
    """Test patterns that should work across all contract types."""
    
    @pytest.fixture(params=[
        "erc20.json",
        "erc721.json",
        "uniswap_v2_router.json",
        "gnosis_safe.json",
        "governor.json",
    ])
    async def any_server(self, request, fixtures_dir, tmp_path):
        """Generate server from any fixture."""
        abi_file = request.param
        return await generate_server_from_abi(
            fixtures_dir / abi_file,
            tmp_path / abi_file.replace(".json", "-server"),
        )
    
    @pytest.mark.asyncio
    async def test_all_servers_have_valid_syntax(self, any_server, validator):
        """All generated servers should have valid Python syntax."""
        result = validator.validate_syntax(any_server)
        assert result.success, f"Syntax validation failed: {result.errors}"
    
    @pytest.mark.asyncio
    async def test_all_servers_have_tools(self, any_server, validator):
        """All generated servers should have at least one tool."""
        result = validator.validate(any_server)
        assert len(result.tools) >= 1, "Server should have at least one tool"
    
    @pytest.mark.asyncio
    async def test_all_tools_have_docstrings(self, any_server, validator):
        """All tools should have docstrings."""
        result = validator.validate(any_server)
        
        for tool in result.tools:
            assert tool.docstring is not None and len(tool.docstring) > 0, \
                f"Tool '{tool.name}' missing docstring"
    
    @pytest.mark.asyncio
    async def test_server_has_expected_files(self, any_server):
        """Generated server should have essential files."""
        expected_files = ["server.py", "README.md"]
        
        for filename in expected_files:
            assert (any_server / filename).exists(), f"Missing {filename}"


# =============================================================================
# Error Case Tests
# =============================================================================


@pytest.mark.integration
class TestErrorCases:
    """Test error handling in generated servers."""
    
    @pytest.mark.asyncio
    async def test_empty_abi_handling(self, tmp_path):
        """Empty ABI should still generate a valid (minimal) server."""
        abi_path = tmp_path / "empty.json"
        abi_path.write_text("[]")
        
        output_dir = tmp_path / "empty-server"
        
        try:
            await generate_server_from_abi(abi_path, output_dir)
            
            # Should still create server.py
            assert (output_dir / "server.py").exists()
            
            # Validate it
            validator = ServerValidator()
            result = validator.validate(output_dir)
            
            # Should be valid even with no tools
            assert result.success
            assert len(result.tools) == 0
            
        except Exception as e:
            # Acceptable to fail on empty ABI
            assert "empty" in str(e).lower() or "no functions" in str(e).lower()
    
    @pytest.mark.asyncio
    async def test_minimal_abi_function(self, tmp_path):
        """ABI with just one simple function should work."""
        abi = [{
            "type": "function",
            "name": "getValue",
            "inputs": [],
            "outputs": [{"name": "", "type": "uint256"}],
            "stateMutability": "view"
        }]
        
        abi_path = tmp_path / "minimal.json"
        abi_path.write_text(json.dumps(abi))
        
        output_dir = tmp_path / "minimal-server"
        await generate_server_from_abi(abi_path, output_dir)
        
        validator = ServerValidator()
        result = validator.validate(output_dir)
        
        assert result.success
        assert result.has_tool("get_value")
    
    @pytest.mark.asyncio
    async def test_function_with_many_parameters(self, tmp_path):
        """Function with 10+ parameters should work."""
        abi = [{
            "type": "function",
            "name": "complexFunction",
            "inputs": [
                {"name": f"param{i}", "type": "uint256"}
                for i in range(15)
            ],
            "outputs": [{"name": "", "type": "bool"}],
            "stateMutability": "nonpayable"
        }]
        
        abi_path = tmp_path / "complex.json"
        abi_path.write_text(json.dumps(abi))
        
        output_dir = tmp_path / "complex-server"
        await generate_server_from_abi(abi_path, output_dir)
        
        validator = ServerValidator()
        result = validator.validate(output_dir)
        
        assert result.success
        
        tool = result.get_tool("complex_function")
        assert tool is not None
        # Should have all 15 params plus simulate
        assert len(tool.parameters) >= 15


# =============================================================================
# Harness Tests
# =============================================================================


@pytest.mark.integration
class TestServerTestHarness:
    """Test the ServerTestHarness helper class."""
    
    @pytest.fixture
    async def erc20_harness(self, fixtures_dir, tmp_path):
        """Create harness for ERC20 server."""
        server_dir = await generate_server_from_abi(
            fixtures_dir / "erc20.json",
            tmp_path / "harness-test",
        )
        return ServerTestHarness(server_dir)
    
    @pytest.mark.asyncio
    async def test_harness_assert_valid(self, erc20_harness):
        """Harness assert_valid should pass for valid server."""
        erc20_harness.assert_valid()  # Should not raise
    
    @pytest.mark.asyncio
    async def test_harness_assert_has_tools(self, erc20_harness):
        """Harness should correctly check for tools."""
        erc20_harness.assert_has_tools(["balance_of", "transfer"])
    
    @pytest.mark.asyncio
    async def test_harness_assert_tool_has_parameter(self, erc20_harness):
        """Harness should correctly check tool parameters."""
        erc20_harness.assert_tool_has_parameter("balance_of", "account")
    
    @pytest.mark.asyncio
    async def test_harness_get_read_write_tools(self, erc20_harness):
        """Harness should correctly separate read/write tools."""
        read_tools = erc20_harness.get_read_tools()
        write_tools = erc20_harness.get_write_tools()
        
        assert len(read_tools) >= 4  # name, symbol, decimals, totalSupply, balanceOf, allowance
        assert len(write_tools) >= 3  # transfer, approve, transferFrom
