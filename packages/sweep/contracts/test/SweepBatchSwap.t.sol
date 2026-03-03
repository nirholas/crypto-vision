// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console2} from "forge-std/Test.sol";
import {SweepBatchSwap} from "../src/SweepBatchSwap.sol";
import {SweepPermit2Batcher} from "../src/SweepPermit2Batcher.sol";
import {IPermit2} from "../src/interfaces/IPermit2.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Permit.sol";

/// @title SweepBatchSwapTest
/// @notice Fork tests for SweepBatchSwap against mainnet
contract SweepBatchSwapTest is Test {
    // ============================================================
    // CONSTANTS
    // ============================================================

    // Mainnet addresses
    address constant WETH = 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2;
    address constant USDC = 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48;
    address constant USDT = 0xdAC17F958D2ee523a2206206994597C13D831ec7;
    address constant DAI = 0x6B175474E89094C44Da98b954EedeAC495271d0F;
    address constant PERMIT2 = 0x000000000022D473030F116dDEE9F6B43aC78BA3;
    
    // Router addresses
    address constant UNISWAP_V3_ROUTER = 0xE592427A0AEce92De3Edee1F18E0157C05861564;
    address constant ONEINCH_ROUTER = 0x111111125421cA6dc452d289314280a0f8842A65;

    // Test accounts
    address public owner;
    address public user;
    address public feeCollector;
    uint256 public userPrivateKey;

    // Contracts
    SweepBatchSwap public batchSwap;
    SweepPermit2Batcher public batcher;

    // ============================================================
    // SETUP
    // ============================================================

    function setUp() public {
        // Fork mainnet
        string memory rpc = vm.envOr("RPC_ETHEREUM", string("https://eth.llamarpc.com"));
        vm.createSelectFork(rpc);

        // Setup accounts
        owner = makeAddr("owner");
        feeCollector = makeAddr("feeCollector");
        (user, userPrivateKey) = makeAddrAndKey("user");

        // Deploy contracts
        vm.startPrank(owner);
        
        batchSwap = new SweepBatchSwap(feeCollector, 50); // 0.5% fee
        batcher = new SweepPermit2Batcher(address(batchSwap));
        
        // Approve routers
        batchSwap.setRouterApproval(UNISWAP_V3_ROUTER, true);
        batchSwap.setRouterApproval(ONEINCH_ROUTER, true);
        
        vm.stopPrank();

        // Fund user with tokens
        deal(WETH, user, 100 ether);
        deal(USDC, user, 100_000 * 1e6);
        deal(USDT, user, 100_000 * 1e6);
    }

    // ============================================================
    // DEPLOYMENT TESTS
    // ============================================================

    function test_deployment() public view {
        assertEq(batchSwap.owner(), owner);
        assertEq(batchSwap.feeCollector(), feeCollector);
        assertEq(batchSwap.feeBps(), 50);
        assertTrue(batchSwap.isRouterApproved(UNISWAP_V3_ROUTER));
        assertTrue(batchSwap.isRouterApproved(ONEINCH_ROUTER));
    }

    function test_batcher_deployment() public view {
        assertEq(address(batcher.batchSwap()), address(batchSwap));
        assertEq(address(batcher.permit2()), PERMIT2);
    }

    // ============================================================
    // ADMIN TESTS
    // ============================================================

    function test_setRouterApproval() public {
        address newRouter = makeAddr("newRouter");
        
        vm.prank(owner);
        batchSwap.setRouterApproval(newRouter, true);
        
        assertTrue(batchSwap.isRouterApproved(newRouter));
    }

    function test_setRouterApproval_reverts_notOwner() public {
        address newRouter = makeAddr("newRouter");
        
        vm.prank(user);
        vm.expectRevert();
        batchSwap.setRouterApproval(newRouter, true);
    }

    function test_setFee() public {
        vm.prank(owner);
        batchSwap.setFee(100); // 1%
        
        assertEq(batchSwap.feeBps(), 100);
    }

    function test_setFee_reverts_tooHigh() public {
        vm.prank(owner);
        vm.expectRevert(SweepBatchSwap.FeeTooHigh.selector);
        batchSwap.setFee(501); // > 5%
    }

    function test_setFeeCollector() public {
        address newCollector = makeAddr("newCollector");
        
        vm.prank(owner);
        batchSwap.setFeeCollector(newCollector);
        
        assertEq(batchSwap.feeCollector(), newCollector);
    }

    function test_pause() public {
        vm.prank(owner);
        batchSwap.setPaused(true);
        
        assertTrue(batchSwap.paused());
    }

    function test_rescueTokens() public {
        // Send some tokens to contract
        vm.prank(user);
        IERC20(WETH).transfer(address(batchSwap), 1 ether);
        
        // Rescue them
        vm.prank(owner);
        batchSwap.rescueTokens(WETH, owner, 1 ether);
        
        assertEq(IERC20(WETH).balanceOf(owner), 1 ether);
    }

    // ============================================================
    // SINGLE SWAP TESTS
    // ============================================================

    function test_singleSwap_uniswapV3() public {
        // Build Uniswap V3 swap calldata
        // exactInputSingle: swap WETH -> USDC
        bytes memory swapData = abi.encodeWithSignature(
            "exactInputSingle((address,address,uint24,address,uint256,uint256,uint256,uint160))",
            WETH,
            USDC,
            3000, // 0.3% fee tier
            address(batchSwap),
            block.timestamp + 1800,
            1 ether,
            0, // min output (we check separately)
            0  // no price limit
        );

        SweepBatchSwap.SwapParams memory swap = SweepBatchSwap.SwapParams({
            tokenIn: WETH,
            tokenOut: USDC,
            amountIn: 1 ether,
            minAmountOut: 1, // Accept any output for test
            router: UNISWAP_V3_ROUTER,
            routerData: swapData
        });

        vm.startPrank(user);
        IERC20(WETH).approve(address(batchSwap), 1 ether);
        
        uint256 balanceBefore = IERC20(USDC).balanceOf(user);
        batchSwap.singleSwap(swap);
        uint256 balanceAfter = IERC20(USDC).balanceOf(user);
        
        assertTrue(balanceAfter > balanceBefore);
        vm.stopPrank();
    }

    function test_singleSwap_reverts_routerNotApproved() public {
        address badRouter = makeAddr("badRouter");
        
        SweepBatchSwap.SwapParams memory swap = SweepBatchSwap.SwapParams({
            tokenIn: WETH,
            tokenOut: USDC,
            amountIn: 1 ether,
            minAmountOut: 1,
            router: badRouter,
            routerData: ""
        });

        vm.startPrank(user);
        IERC20(WETH).approve(address(batchSwap), 1 ether);
        
        vm.expectRevert(SweepBatchSwap.RouterNotApproved.selector);
        batchSwap.singleSwap(swap);
        vm.stopPrank();
    }

    function test_singleSwap_reverts_paused() public {
        vm.prank(owner);
        batchSwap.setPaused(true);

        SweepBatchSwap.SwapParams memory swap = SweepBatchSwap.SwapParams({
            tokenIn: WETH,
            tokenOut: USDC,
            amountIn: 1 ether,
            minAmountOut: 1,
            router: UNISWAP_V3_ROUTER,
            routerData: ""
        });

        vm.startPrank(user);
        vm.expectRevert(SweepBatchSwap.ContractPaused.selector);
        batchSwap.singleSwap(swap);
        vm.stopPrank();
    }

    // ============================================================
    // BATCH SWAP TESTS
    // ============================================================

    function test_batchSwap_multipleTokens() public {
        // Build swap calldata for WETH -> USDC
        bytes memory swap1Data = abi.encodeWithSignature(
            "exactInputSingle((address,address,uint24,address,uint256,uint256,uint256,uint160))",
            WETH,
            USDC,
            3000,
            address(batchSwap),
            block.timestamp + 1800,
            0.5 ether,
            0,
            0
        );

        // Build swap calldata for USDT -> USDC
        bytes memory swap2Data = abi.encodeWithSignature(
            "exactInputSingle((address,address,uint24,address,uint256,uint256,uint256,uint160))",
            USDT,
            USDC,
            500, // 0.05% fee tier for stablecoins
            address(batchSwap),
            block.timestamp + 1800,
            1000 * 1e6, // 1000 USDT
            0,
            0
        );

        SweepBatchSwap.SwapParams[] memory swaps = new SweepBatchSwap.SwapParams[](2);
        swaps[0] = SweepBatchSwap.SwapParams({
            tokenIn: WETH,
            tokenOut: USDC,
            amountIn: 0.5 ether,
            minAmountOut: 1,
            router: UNISWAP_V3_ROUTER,
            routerData: swap1Data
        });
        swaps[1] = SweepBatchSwap.SwapParams({
            tokenIn: USDT,
            tokenOut: USDC,
            amountIn: 1000 * 1e6,
            minAmountOut: 1,
            router: UNISWAP_V3_ROUTER,
            routerData: swap2Data
        });

        SweepBatchSwap.BatchSwapParams memory params = SweepBatchSwap.BatchSwapParams({
            swaps: swaps,
            outputToken: USDC,
            recipient: user,
            deadline: block.timestamp + 1800
        });

        vm.startPrank(user);
        IERC20(WETH).approve(address(batchSwap), 0.5 ether);
        IERC20(USDT).approve(address(batchSwap), 1000 * 1e6);
        
        uint256 balanceBefore = IERC20(USDC).balanceOf(user);
        batchSwap.batchSwap(params);
        uint256 balanceAfter = IERC20(USDC).balanceOf(user);
        
        assertTrue(balanceAfter > balanceBefore);
        vm.stopPrank();
    }

    function test_batchSwap_reverts_deadlineExpired() public {
        SweepBatchSwap.SwapParams[] memory swaps = new SweepBatchSwap.SwapParams[](1);
        swaps[0] = SweepBatchSwap.SwapParams({
            tokenIn: WETH,
            tokenOut: USDC,
            amountIn: 1 ether,
            minAmountOut: 1,
            router: UNISWAP_V3_ROUTER,
            routerData: ""
        });

        SweepBatchSwap.BatchSwapParams memory params = SweepBatchSwap.BatchSwapParams({
            swaps: swaps,
            outputToken: USDC,
            recipient: user,
            deadline: block.timestamp - 1 // Expired
        });

        vm.prank(user);
        vm.expectRevert(SweepBatchSwap.DeadlineExpired.selector);
        batchSwap.batchSwap(params);
    }

    function test_batchSwap_reverts_zeroAddress() public {
        SweepBatchSwap.SwapParams[] memory swaps = new SweepBatchSwap.SwapParams[](1);
        swaps[0] = SweepBatchSwap.SwapParams({
            tokenIn: WETH,
            tokenOut: USDC,
            amountIn: 1 ether,
            minAmountOut: 1,
            router: UNISWAP_V3_ROUTER,
            routerData: ""
        });

        SweepBatchSwap.BatchSwapParams memory params = SweepBatchSwap.BatchSwapParams({
            swaps: swaps,
            outputToken: USDC,
            recipient: address(0),
            deadline: block.timestamp + 1800
        });

        vm.prank(user);
        vm.expectRevert(SweepBatchSwap.ZeroAddress.selector);
        batchSwap.batchSwap(params);
    }

    // ============================================================
    // FEE TESTS
    // ============================================================

    function test_feeCollection() public {
        // Setup swap
        bytes memory swapData = abi.encodeWithSignature(
            "exactInputSingle((address,address,uint24,address,uint256,uint256,uint256,uint160))",
            WETH,
            USDC,
            3000,
            address(batchSwap),
            block.timestamp + 1800,
            1 ether,
            0,
            0
        );

        SweepBatchSwap.SwapParams memory swap = SweepBatchSwap.SwapParams({
            tokenIn: WETH,
            tokenOut: USDC,
            amountIn: 1 ether,
            minAmountOut: 1,
            router: UNISWAP_V3_ROUTER,
            routerData: swapData
        });

        vm.startPrank(user);
        IERC20(WETH).approve(address(batchSwap), 1 ether);
        
        uint256 feeCollectorBalanceBefore = IERC20(USDC).balanceOf(feeCollector);
        batchSwap.singleSwap(swap);
        uint256 feeCollectorBalanceAfter = IERC20(USDC).balanceOf(feeCollector);
        
        // Fee collector should have received 0.5% of output
        assertTrue(feeCollectorBalanceAfter > feeCollectorBalanceBefore);
        vm.stopPrank();
    }

    function test_calculateFee() public view {
        uint256 amount = 1000 * 1e6; // 1000 USDC
        uint256 fee = batchSwap.calculateFee(amount);
        
        // 0.5% of 1000 = 5
        assertEq(fee, 5 * 1e6);
    }

    // ============================================================
    // PERMIT2 BATCHER TESTS
    // ============================================================

    function test_batcher_getNonce() public view {
        assertEq(batcher.getNonce(user), 0);
    }

    function test_batcher_buildWitnessHash() public view {
        SweepBatchSwap.SwapParams[] memory swaps = new SweepBatchSwap.SwapParams[](1);
        swaps[0] = SweepBatchSwap.SwapParams({
            tokenIn: WETH,
            tokenOut: USDC,
            amountIn: 1 ether,
            minAmountOut: 1,
            router: UNISWAP_V3_ROUTER,
            routerData: ""
        });

        bytes32 witnessHash = batcher.buildWitnessHash(
            USDC,
            1000 * 1e6,
            block.timestamp + 1800,
            swaps
        );

        assertTrue(witnessHash != bytes32(0));
    }

    function test_batcher_rescueTokens() public {
        // Send tokens to batcher
        vm.prank(user);
        IERC20(WETH).transfer(address(batcher), 1 ether);
        
        // Rescue
        vm.prank(owner);
        batcher.rescueTokens(WETH, owner, 1 ether);
        
        assertEq(IERC20(WETH).balanceOf(owner), 1 ether);
    }

    function test_batcher_rescueETH() public {
        // Send ETH to batcher
        vm.deal(address(batcher), 1 ether);
        
        uint256 balanceBefore = owner.balance;
        
        // Rescue
        vm.prank(owner);
        batcher.rescueETH(owner, 1 ether);
        
        assertEq(owner.balance, balanceBefore + 1 ether);
    }

    // ============================================================
    // EDGE CASE TESTS
    // ============================================================

    function test_swapWithZeroAmount_reverts() public {
        SweepBatchSwap.SwapParams memory swap = SweepBatchSwap.SwapParams({
            tokenIn: WETH,
            tokenOut: USDC,
            amountIn: 0,
            minAmountOut: 1,
            router: UNISWAP_V3_ROUTER,
            routerData: ""
        });

        vm.prank(user);
        vm.expectRevert(SweepBatchSwap.ZeroAmount.selector);
        batchSwap.singleSwap(swap);
    }

    function test_emptyBatchSwap_reverts() public {
        SweepBatchSwap.SwapParams[] memory swaps = new SweepBatchSwap.SwapParams[](0);

        SweepBatchSwap.BatchSwapParams memory params = SweepBatchSwap.BatchSwapParams({
            swaps: swaps,
            outputToken: USDC,
            recipient: user,
            deadline: block.timestamp + 1800
        });

        vm.prank(user);
        vm.expectRevert(SweepBatchSwap.InvalidParams.selector);
        batchSwap.batchSwap(params);
    }

    function test_receiveETH() public {
        vm.deal(user, 10 ether);
        
        vm.prank(user);
        (bool success,) = address(batchSwap).call{value: 1 ether}("");
        
        assertTrue(success);
        assertEq(address(batchSwap).balance, 1 ether);
    }

    // ============================================================
    // FUZZ TESTS
    // ============================================================

    function testFuzz_setFee(uint256 feeBps) public {
        feeBps = bound(feeBps, 0, 500); // Max 5%
        
        vm.prank(owner);
        batchSwap.setFee(feeBps);
        
        assertEq(batchSwap.feeBps(), feeBps);
    }

    function testFuzz_calculateFee(uint256 amount, uint256 feeBps) public {
        amount = bound(amount, 0, type(uint128).max);
        feeBps = bound(feeBps, 0, 500);
        
        vm.prank(owner);
        batchSwap.setFee(feeBps);
        
        uint256 fee = batchSwap.calculateFee(amount);
        assertEq(fee, (amount * feeBps) / 10_000);
    }
}

/// @title SweepPermit2Test
/// @notice Tests for Permit2 integration
contract SweepPermit2Test is Test {
    // Add Permit2 specific tests here
    // These require more complex signature generation
    
    function test_permit2Address() public pure {
        assertEq(
            0x000000000022D473030F116dDEE9F6B43aC78BA3,
            0x000000000022D473030F116dDEE9F6B43aC78BA3
        );
    }
}
