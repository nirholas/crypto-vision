// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console2} from "forge-std/Test.sol";
import {SweepDustSweeper} from "../src/SweepDustSweeper.sol";
import {SweepBatchSwap} from "../src/SweepBatchSwap.sol";
import {SweepVaultRouter} from "../src/SweepVaultRouter.sol";
import {SweepFeeCollector} from "../src/SweepFeeCollector.sol";
import {IPermit2} from "../src/interfaces/IPermit2.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @title SweepDustSweeperTest
/// @notice E2E tests for SweepDustSweeper
contract SweepDustSweeperTest is Test {
    // ============================================================
    // CONSTANTS
    // ============================================================

    address constant WETH = 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2;
    address constant USDC = 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48;
    address constant USDT = 0xdAC17F958D2ee523a2206206994597C13D831ec7;
    address constant DAI = 0x6B175474E89094C44Da98b954EedeAC495271d0F;
    address constant PERMIT2 = 0x000000000022D473030F116dDEE9F6B43aC78BA3;

    address constant UNISWAP_V3_ROUTER = 0xE592427A0AEce92De3Edee1F18E0157C05861564;
    address constant AAVE_V3_POOL = 0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2;
    address constant A_USDC = 0x98C23E9d8f34FEFb1B7BD6a91B7FF122F4e16F5c;
    address constant LIDO = 0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84;

    // ============================================================
    // STATE
    // ============================================================

    SweepBatchSwap public batchSwap;
    SweepVaultRouter public vaultRouter;
    SweepFeeCollector public feeCollector;
    SweepDustSweeper public sweeper;

    address public owner;
    address public treasury;
    address public user;
    uint256 public userPrivateKey;

    // ============================================================
    // SETUP
    // ============================================================

    function setUp() public {
        string memory rpc = vm.envOr("RPC_ETHEREUM", string("https://eth.llamarpc.com"));
        vm.createSelectFork(rpc);

        owner = makeAddr("owner");
        treasury = makeAddr("treasury");
        (user, userPrivateKey) = makeAddrAndKey("user");

        vm.startPrank(owner);

        // Deploy all contracts
        feeCollector = new SweepFeeCollector(treasury, 30); // 0.3%
        batchSwap = new SweepBatchSwap(address(feeCollector), 0); // Fee handled by sweeper
        vaultRouter = new SweepVaultRouter();
        sweeper = new SweepDustSweeper(
            address(batchSwap),
            address(vaultRouter),
            address(feeCollector)
        );

        // Configure batch swap
        batchSwap.setRouterApproval(UNISWAP_V3_ROUTER, true);

        // Configure vault router
        vaultRouter.setVaultApproval(AAVE_V3_POOL, SweepVaultRouter.VaultType.AAVE_V3, true);
        vaultRouter.setVaultApproval(LIDO, SweepVaultRouter.VaultType.LIDO, true);

        // Configure fee collector
        feeCollector.setDepositorApproval(address(sweeper), true);

        vm.stopPrank();

        // Fund user
        deal(WETH, user, 100 ether);
        deal(USDC, user, 100_000 * 1e6);
        deal(USDT, user, 100_000 * 1e6);
        deal(DAI, user, 100_000 * 1e18);
        vm.deal(user, 100 ether);
    }

    // ============================================================
    // DEPLOYMENT TESTS
    // ============================================================

    function test_deployment() public view {
        assertEq(address(sweeper.batchSwap()), address(batchSwap));
        assertEq(address(sweeper.vaultRouter()), address(vaultRouter));
        assertEq(address(sweeper.feeCollector()), address(feeCollector));
        assertTrue(sweeper.isConfigured());
    }

    function test_deployment_reverts_zeroBatchSwap() public {
        vm.expectRevert(SweepDustSweeper.ZeroAddress.selector);
        new SweepDustSweeper(address(0), address(vaultRouter), address(feeCollector));
    }

    function test_deployment_reverts_zeroVaultRouter() public {
        vm.expectRevert(SweepDustSweeper.ZeroAddress.selector);
        new SweepDustSweeper(address(batchSwap), address(0), address(feeCollector));
    }

    function test_deployment_reverts_zeroFeeCollector() public {
        vm.expectRevert(SweepDustSweeper.ZeroAddress.selector);
        new SweepDustSweeper(address(batchSwap), address(vaultRouter), address(0));
    }

    // ============================================================
    // SIMPLE SWEEP TESTS (TO WALLET)
    // ============================================================

    function test_sweep_singleToken_toWallet() public {
        uint256 wethAmount = 1 ether;

        // Build swap data
        bytes memory swapData = _buildUniswapSwapData(WETH, USDC, wethAmount);

        address[] memory tokensIn = new address[](1);
        tokensIn[0] = WETH;

        uint256[] memory amountsIn = new uint256[](1);
        amountsIn[0] = wethAmount;

        SweepBatchSwap.SwapParams[] memory swaps = new SweepBatchSwap.SwapParams[](1);
        swaps[0] = SweepBatchSwap.SwapParams({
            tokenIn: WETH,
            tokenOut: USDC,
            amountIn: wethAmount,
            minAmountOut: 1,
            router: UNISWAP_V3_ROUTER,
            routerData: swapData
        });

        SweepDustSweeper.SimpleSweepParams memory params = SweepDustSweeper.SimpleSweepParams({
            tokensIn: tokensIn,
            amountsIn: amountsIn,
            swaps: swaps,
            outputToken: USDC,
            minTotalOutput: 1,
            destination: SweepDustSweeper.SweepDestination.WALLET,
            vaultAddress: address(0),
            minVaultSharesOut: 0,
            recipient: user,
            deadline: block.timestamp + 1800
        });

        uint256 userUsdcBefore = IERC20(USDC).balanceOf(user);
        uint256 treasuryUsdcBefore = IERC20(USDC).balanceOf(treasury);

        vm.startPrank(user);
        IERC20(WETH).approve(address(sweeper), wethAmount);
        SweepDustSweeper.SweepResult memory result = sweeper.sweep(params);
        vm.stopPrank();

        uint256 userUsdcAfter = IERC20(USDC).balanceOf(user);

        assertGt(result.totalSwapOutput, 0);
        assertGt(result.netOutput, 0);
        assertEq(result.vaultShares, 0);
        assertEq(userUsdcAfter - userUsdcBefore, result.netOutput);

        // Fee should have been collected
        assertGt(result.feeAmount, 0);
    }

    function test_sweep_multipleTokens_toWallet() public {
        uint256 wethAmount = 0.5 ether;
        uint256 daiAmount = 1000 * 1e18;

        // Build swap data
        bytes memory swap1Data = _buildUniswapSwapData(WETH, USDC, wethAmount);
        bytes memory swap2Data = _buildUniswapSwapData(DAI, USDC, daiAmount);

        address[] memory tokensIn = new address[](2);
        tokensIn[0] = WETH;
        tokensIn[1] = DAI;

        uint256[] memory amountsIn = new uint256[](2);
        amountsIn[0] = wethAmount;
        amountsIn[1] = daiAmount;

        SweepBatchSwap.SwapParams[] memory swaps = new SweepBatchSwap.SwapParams[](2);
        swaps[0] = SweepBatchSwap.SwapParams({
            tokenIn: WETH,
            tokenOut: USDC,
            amountIn: wethAmount,
            minAmountOut: 1,
            router: UNISWAP_V3_ROUTER,
            routerData: swap1Data
        });
        swaps[1] = SweepBatchSwap.SwapParams({
            tokenIn: DAI,
            tokenOut: USDC,
            amountIn: daiAmount,
            minAmountOut: 1,
            router: UNISWAP_V3_ROUTER,
            routerData: swap2Data
        });

        SweepDustSweeper.SimpleSweepParams memory params = SweepDustSweeper.SimpleSweepParams({
            tokensIn: tokensIn,
            amountsIn: amountsIn,
            swaps: swaps,
            outputToken: USDC,
            minTotalOutput: 1,
            destination: SweepDustSweeper.SweepDestination.WALLET,
            vaultAddress: address(0),
            minVaultSharesOut: 0,
            recipient: user,
            deadline: block.timestamp + 1800
        });

        vm.startPrank(user);
        IERC20(WETH).approve(address(sweeper), wethAmount);
        IERC20(DAI).approve(address(sweeper), daiAmount);
        SweepDustSweeper.SweepResult memory result = sweeper.sweep(params);
        vm.stopPrank();

        assertGt(result.totalSwapOutput, 0);
        assertGt(result.netOutput, 0);
    }

    // ============================================================
    // SWEEP TO DEFI VAULT TESTS
    // ============================================================

    function test_sweep_toAave() public {
        uint256 wethAmount = 1 ether;

        bytes memory swapData = _buildUniswapSwapData(WETH, USDC, wethAmount);

        address[] memory tokensIn = new address[](1);
        tokensIn[0] = WETH;

        uint256[] memory amountsIn = new uint256[](1);
        amountsIn[0] = wethAmount;

        SweepBatchSwap.SwapParams[] memory swaps = new SweepBatchSwap.SwapParams[](1);
        swaps[0] = SweepBatchSwap.SwapParams({
            tokenIn: WETH,
            tokenOut: USDC,
            amountIn: wethAmount,
            minAmountOut: 1,
            router: UNISWAP_V3_ROUTER,
            routerData: swapData
        });

        SweepDustSweeper.SimpleSweepParams memory params = SweepDustSweeper.SimpleSweepParams({
            tokensIn: tokensIn,
            amountsIn: amountsIn,
            swaps: swaps,
            outputToken: USDC,
            minTotalOutput: 1,
            destination: SweepDustSweeper.SweepDestination.AAVE,
            vaultAddress: AAVE_V3_POOL,
            minVaultSharesOut: 1,
            recipient: user,
            deadline: block.timestamp + 1800
        });

        uint256 aUsdcBefore = IERC20(A_USDC).balanceOf(user);

        vm.startPrank(user);
        IERC20(WETH).approve(address(sweeper), wethAmount);
        SweepDustSweeper.SweepResult memory result = sweeper.sweep(params);
        vm.stopPrank();

        uint256 aUsdcAfter = IERC20(A_USDC).balanceOf(user);

        assertGt(result.vaultShares, 0);
        assertEq(aUsdcAfter - aUsdcBefore, result.vaultShares);
    }

    // ============================================================
    // FEE CALCULATION TESTS
    // ============================================================

    function test_previewSweepFee() public view {
        uint256 totalOutput = 10_000 * 1e6; // 10k USDC

        (uint256 feeAmount, uint256 netOutput) = sweeper.previewSweepFee(totalOutput);

        // 0.3% fee
        assertEq(feeAmount, 30 * 1e6);
        assertEq(netOutput, 9970 * 1e6);
    }

    function test_feeCollection() public {
        uint256 wethAmount = 1 ether;

        bytes memory swapData = _buildUniswapSwapData(WETH, USDC, wethAmount);

        address[] memory tokensIn = new address[](1);
        tokensIn[0] = WETH;

        uint256[] memory amountsIn = new uint256[](1);
        amountsIn[0] = wethAmount;

        SweepBatchSwap.SwapParams[] memory swaps = new SweepBatchSwap.SwapParams[](1);
        swaps[0] = SweepBatchSwap.SwapParams({
            tokenIn: WETH,
            tokenOut: USDC,
            amountIn: wethAmount,
            minAmountOut: 1,
            router: UNISWAP_V3_ROUTER,
            routerData: swapData
        });

        SweepDustSweeper.SimpleSweepParams memory params = SweepDustSweeper.SimpleSweepParams({
            tokensIn: tokensIn,
            amountsIn: amountsIn,
            swaps: swaps,
            outputToken: USDC,
            minTotalOutput: 1,
            destination: SweepDustSweeper.SweepDestination.WALLET,
            vaultAddress: address(0),
            minVaultSharesOut: 0,
            recipient: user,
            deadline: block.timestamp + 1800
        });

        uint256 feesBefore = feeCollector.accumulatedFees(USDC);

        vm.startPrank(user);
        IERC20(WETH).approve(address(sweeper), wethAmount);
        SweepDustSweeper.SweepResult memory result = sweeper.sweep(params);
        vm.stopPrank();

        uint256 feesAfter = feeCollector.accumulatedFees(USDC);

        assertEq(feesAfter - feesBefore, result.feeAmount);
    }

    // ============================================================
    // ERROR TESTS
    // ============================================================

    function test_sweep_reverts_deadlineExpired() public {
        address[] memory tokensIn = new address[](1);
        tokensIn[0] = WETH;

        uint256[] memory amountsIn = new uint256[](1);
        amountsIn[0] = 1 ether;

        SweepBatchSwap.SwapParams[] memory swaps = new SweepBatchSwap.SwapParams[](1);
        swaps[0] = SweepBatchSwap.SwapParams({
            tokenIn: WETH,
            tokenOut: USDC,
            amountIn: 1 ether,
            minAmountOut: 1,
            router: UNISWAP_V3_ROUTER,
            routerData: ""
        });

        SweepDustSweeper.SimpleSweepParams memory params = SweepDustSweeper.SimpleSweepParams({
            tokensIn: tokensIn,
            amountsIn: amountsIn,
            swaps: swaps,
            outputToken: USDC,
            minTotalOutput: 1,
            destination: SweepDustSweeper.SweepDestination.WALLET,
            vaultAddress: address(0),
            minVaultSharesOut: 0,
            recipient: user,
            deadline: block.timestamp - 1 // Expired
        });

        vm.prank(user);
        vm.expectRevert(SweepDustSweeper.DeadlineExpired.selector);
        sweeper.sweep(params);
    }

    function test_sweep_reverts_zeroRecipient() public {
        address[] memory tokensIn = new address[](1);
        tokensIn[0] = WETH;

        uint256[] memory amountsIn = new uint256[](1);
        amountsIn[0] = 1 ether;

        SweepBatchSwap.SwapParams[] memory swaps = new SweepBatchSwap.SwapParams[](1);
        swaps[0] = SweepBatchSwap.SwapParams({
            tokenIn: WETH,
            tokenOut: USDC,
            amountIn: 1 ether,
            minAmountOut: 1,
            router: UNISWAP_V3_ROUTER,
            routerData: ""
        });

        SweepDustSweeper.SimpleSweepParams memory params = SweepDustSweeper.SimpleSweepParams({
            tokensIn: tokensIn,
            amountsIn: amountsIn,
            swaps: swaps,
            outputToken: USDC,
            minTotalOutput: 1,
            destination: SweepDustSweeper.SweepDestination.WALLET,
            vaultAddress: address(0),
            minVaultSharesOut: 0,
            recipient: address(0),
            deadline: block.timestamp + 1800
        });

        vm.prank(user);
        vm.expectRevert(SweepDustSweeper.ZeroAddress.selector);
        sweeper.sweep(params);
    }

    function test_sweep_reverts_lengthMismatch() public {
        address[] memory tokensIn = new address[](2);
        tokensIn[0] = WETH;
        tokensIn[1] = USDC;

        uint256[] memory amountsIn = new uint256[](1); // Mismatch!
        amountsIn[0] = 1 ether;

        SweepBatchSwap.SwapParams[] memory swaps = new SweepBatchSwap.SwapParams[](1);
        swaps[0] = SweepBatchSwap.SwapParams({
            tokenIn: WETH,
            tokenOut: USDC,
            amountIn: 1 ether,
            minAmountOut: 1,
            router: UNISWAP_V3_ROUTER,
            routerData: ""
        });

        SweepDustSweeper.SimpleSweepParams memory params = SweepDustSweeper.SimpleSweepParams({
            tokensIn: tokensIn,
            amountsIn: amountsIn,
            swaps: swaps,
            outputToken: USDC,
            minTotalOutput: 1,
            destination: SweepDustSweeper.SweepDestination.WALLET,
            vaultAddress: address(0),
            minVaultSharesOut: 0,
            recipient: user,
            deadline: block.timestamp + 1800
        });

        vm.prank(user);
        vm.expectRevert(SweepDustSweeper.LengthMismatch.selector);
        sweeper.sweep(params);
    }

    function test_sweep_reverts_vaultRequired() public {
        address[] memory tokensIn = new address[](1);
        tokensIn[0] = WETH;

        uint256[] memory amountsIn = new uint256[](1);
        amountsIn[0] = 1 ether;

        SweepBatchSwap.SwapParams[] memory swaps = new SweepBatchSwap.SwapParams[](1);
        swaps[0] = SweepBatchSwap.SwapParams({
            tokenIn: WETH,
            tokenOut: USDC,
            amountIn: 1 ether,
            minAmountOut: 1,
            router: UNISWAP_V3_ROUTER,
            routerData: ""
        });

        SweepDustSweeper.SimpleSweepParams memory params = SweepDustSweeper.SimpleSweepParams({
            tokensIn: tokensIn,
            amountsIn: amountsIn,
            swaps: swaps,
            outputToken: USDC,
            minTotalOutput: 1,
            destination: SweepDustSweeper.SweepDestination.AAVE,
            vaultAddress: address(0), // Missing vault!
            minVaultSharesOut: 0,
            recipient: user,
            deadline: block.timestamp + 1800
        });

        vm.prank(user);
        vm.expectRevert(SweepDustSweeper.VaultRequired.selector);
        sweeper.sweep(params);
    }

    // ============================================================
    // ADMIN TESTS
    // ============================================================

    function test_setPaused() public {
        vm.prank(owner);
        sweeper.setPaused(true);

        assertTrue(sweeper.paused());
    }

    function test_sweep_reverts_paused() public {
        vm.prank(owner);
        sweeper.setPaused(true);

        address[] memory tokensIn = new address[](1);
        tokensIn[0] = WETH;

        uint256[] memory amountsIn = new uint256[](1);
        amountsIn[0] = 1 ether;

        SweepBatchSwap.SwapParams[] memory swaps = new SweepBatchSwap.SwapParams[](1);
        swaps[0] = SweepBatchSwap.SwapParams({
            tokenIn: WETH,
            tokenOut: USDC,
            amountIn: 1 ether,
            minAmountOut: 1,
            router: UNISWAP_V3_ROUTER,
            routerData: ""
        });

        SweepDustSweeper.SimpleSweepParams memory params = SweepDustSweeper.SimpleSweepParams({
            tokensIn: tokensIn,
            amountsIn: amountsIn,
            swaps: swaps,
            outputToken: USDC,
            minTotalOutput: 1,
            destination: SweepDustSweeper.SweepDestination.WALLET,
            vaultAddress: address(0),
            minVaultSharesOut: 0,
            recipient: user,
            deadline: block.timestamp + 1800
        });

        vm.prank(user);
        vm.expectRevert(SweepDustSweeper.ContractPaused.selector);
        sweeper.sweep(params);
    }

    function test_rescueTokens() public {
        // Send tokens to sweeper
        vm.prank(user);
        IERC20(USDC).transfer(address(sweeper), 1000 * 1e6);

        vm.prank(owner);
        sweeper.rescueTokens(USDC, owner, 1000 * 1e6);

        assertEq(IERC20(USDC).balanceOf(owner), 1000 * 1e6);
    }

    // ============================================================
    // VIEW FUNCTION TESTS
    // ============================================================

    function test_getNonce() public view {
        assertEq(sweeper.getNonce(user), 0);
    }

    function test_buildWitnessHash() public view {
        SweepBatchSwap.SwapParams[] memory swaps = new SweepBatchSwap.SwapParams[](1);
        swaps[0] = SweepBatchSwap.SwapParams({
            tokenIn: WETH,
            tokenOut: USDC,
            amountIn: 1 ether,
            minAmountOut: 1000 * 1e6,
            router: UNISWAP_V3_ROUTER,
            routerData: ""
        });

        bytes32 hash = sweeper.buildWitnessHash(
            USDC,
            1000 * 1e6,
            address(0),
            block.timestamp + 1800,
            swaps
        );

        assertTrue(hash != bytes32(0));
    }

    function test_domainSeparator() public view {
        bytes32 separator = sweeper.DOMAIN_SEPARATOR();
        assertTrue(separator != bytes32(0));
    }

    // ============================================================
    // HELPER FUNCTIONS
    // ============================================================

    function _buildUniswapSwapData(
        address tokenIn,
        address tokenOut,
        uint256 amountIn
    ) internal view returns (bytes memory) {
        return abi.encodeWithSignature(
            "exactInputSingle((address,address,uint24,address,uint256,uint256,uint256,uint160))",
            tokenIn,
            tokenOut,
            3000, // 0.3% fee
            address(batchSwap),
            block.timestamp + 1800,
            amountIn,
            0,
            0
        );
    }
}
