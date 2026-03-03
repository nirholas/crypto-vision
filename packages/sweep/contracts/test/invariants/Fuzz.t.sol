// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console2} from "forge-std/Test.sol";
import {SweepBatchSwap} from "../../src/SweepBatchSwap.sol";
import {SweepFeeCollector} from "../../src/SweepFeeCollector.sol";
import {SweepVaultRouter} from "../../src/SweepVaultRouter.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @title SweepFuzzTest
/// @notice Comprehensive fuzz tests for Sweep contracts
contract SweepFuzzTest is Test {
    // ============================================================
    // CONSTANTS
    // ============================================================

    address constant WETH = 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2;
    address constant USDC = 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48;
    address constant DAI = 0x6B175474E89094C44Da98b954EedeAC495271d0F;
    address constant UNISWAP_V3_ROUTER = 0xE592427A0AEce92De3Edee1F18E0157C05861564;
    address constant AAVE_V3_POOL = 0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2;

    // ============================================================
    // STATE
    // ============================================================

    SweepBatchSwap public batchSwap;
    SweepFeeCollector public feeCollector;
    SweepVaultRouter public vaultRouter;

    address public owner;
    address public treasury;
    address public user;

    // ============================================================
    // SETUP
    // ============================================================

    function setUp() public {
        string memory rpc = vm.envOr("RPC_ETHEREUM", string("https://eth.llamarpc.com"));
        vm.createSelectFork(rpc);

        owner = makeAddr("owner");
        treasury = makeAddr("treasury");
        user = makeAddr("user");

        vm.startPrank(owner);
        feeCollector = new SweepFeeCollector(treasury, 30);
        batchSwap = new SweepBatchSwap(address(feeCollector), 50);
        vaultRouter = new SweepVaultRouter();

        batchSwap.setRouterApproval(UNISWAP_V3_ROUTER, true);
        vaultRouter.setVaultApproval(AAVE_V3_POOL, SweepVaultRouter.VaultType.AAVE_V3, true);
        feeCollector.setDepositorApproval(user, true);
        vm.stopPrank();

        // Fund user
        deal(WETH, user, 1000 ether);
        deal(USDC, user, 10_000_000 * 1e6);
        deal(DAI, user, 10_000_000 * 1e18);
        vm.deal(user, 1000 ether);
    }

    // ============================================================
    // BATCH SWAP FUZZ TESTS
    // ============================================================

    function testFuzz_setFee(uint256 newFee) public {
        // Bound to valid range
        newFee = bound(newFee, 0, batchSwap.MAX_FEE_BPS());

        vm.prank(owner);
        batchSwap.setFee(newFee);

        assertEq(batchSwap.feeBps(), newFee);
    }

    function testFuzz_setFee_reverts_tooHigh(uint256 newFee) public {
        // Only test invalid fees
        newFee = bound(newFee, batchSwap.MAX_FEE_BPS() + 1, type(uint256).max);

        vm.prank(owner);
        vm.expectRevert(SweepBatchSwap.FeeTooHigh.selector);
        batchSwap.setFee(newFee);
    }

    function testFuzz_calculateFee(uint256 amount, uint256 feeBps) public {
        // Bound inputs
        amount = bound(amount, 0, type(uint128).max);
        feeBps = bound(feeBps, 0, batchSwap.MAX_FEE_BPS());

        vm.prank(owner);
        batchSwap.setFee(feeBps);

        uint256 fee = batchSwap.calculateFee(amount);
        uint256 expected = (amount * feeBps) / 10_000;

        assertEq(fee, expected);
    }

    function testFuzz_routerApproval(address router) public {
        // Skip zero address
        vm.assume(router != address(0));

        vm.prank(owner);
        batchSwap.setRouterApproval(router, true);

        assertTrue(batchSwap.isRouterApproved(router));

        vm.prank(owner);
        batchSwap.setRouterApproval(router, false);

        assertFalse(batchSwap.isRouterApproved(router));
    }

    function testFuzz_feeCollectorAddress(address newCollector) public {
        vm.assume(newCollector != address(0));

        vm.prank(owner);
        batchSwap.setFeeCollector(newCollector);

        assertEq(batchSwap.feeCollector(), newCollector);
    }

    // ============================================================
    // FEE COLLECTOR FUZZ TESTS
    // ============================================================

    function testFuzz_depositFee(uint256 amount) public {
        // Bound to reasonable range
        amount = bound(amount, 1, 1_000_000 * 1e6);

        vm.startPrank(user);
        IERC20(USDC).approve(address(feeCollector), amount);
        feeCollector.depositFee(USDC, amount, user);
        vm.stopPrank();

        assertEq(feeCollector.accumulatedFees(USDC), amount);
        assertEq(feeCollector.totalFeesCollected(USDC), amount);
    }

    function testFuzz_feeDiscount(address account, uint256 discount) public {
        vm.assume(account != address(0));
        discount = bound(discount, 0, feeCollector.feeBps());

        vm.prank(owner);
        feeCollector.setFeeDiscount(account, discount);

        assertEq(feeCollector.feeDiscounts(account), discount);
    }

    function testFuzz_effectiveFee(address account, uint256 discount) public {
        vm.assume(account != address(0));
        discount = bound(discount, 0, feeCollector.feeBps());

        vm.prank(owner);
        feeCollector.setFeeDiscount(account, discount);

        uint256 effectiveFee = feeCollector.getEffectiveFee(account);
        assertEq(effectiveFee, feeCollector.feeBps() - discount);
    }

    function testFuzz_calculateFeeWithDiscount(
        uint256 amount,
        address account,
        uint256 discount
    ) public {
        vm.assume(account != address(0));
        amount = bound(amount, 1, type(uint128).max);
        discount = bound(discount, 0, feeCollector.feeBps());

        vm.prank(owner);
        feeCollector.setFeeDiscount(account, discount);

        uint256 fee = feeCollector.calculateFee(amount, account);
        uint256 effectiveFee = feeCollector.feeBps() - discount;
        uint256 expected = (amount * effectiveFee) / 10_000;

        assertEq(fee, expected);
    }

    function testFuzz_treasuryUpdate(address newTreasury) public {
        vm.assume(newTreasury != address(0));

        vm.prank(owner);
        feeCollector.setTreasury(newTreasury);

        assertEq(feeCollector.treasury(), newTreasury);
    }

    // ============================================================
    // VAULT ROUTER FUZZ TESTS
    // ============================================================

    function testFuzz_setDefaultSlippage(uint256 slippage) public {
        slippage = bound(slippage, 0, vaultRouter.MAX_SLIPPAGE_BPS());

        vm.prank(owner);
        vaultRouter.setDefaultSlippage(slippage);

        assertEq(vaultRouter.defaultSlippageBps(), slippage);
    }

    function testFuzz_setDefaultSlippage_reverts_tooHigh(uint256 slippage) public {
        slippage = bound(slippage, vaultRouter.MAX_SLIPPAGE_BPS() + 1, type(uint256).max);

        vm.prank(owner);
        vm.expectRevert(SweepVaultRouter.InvalidSlippage.selector);
        vaultRouter.setDefaultSlippage(slippage);
    }

    function testFuzz_calculateMinOutput(uint256 expected, uint256 slippage) public view {
        expected = bound(expected, 1, type(uint128).max);
        slippage = bound(slippage, 0, vaultRouter.MAX_SLIPPAGE_BPS());

        uint256 minOutput = vaultRouter.calculateMinOutput(expected, slippage);

        // Min output should be expected - (expected * slippage / 10000)
        uint256 expectedMin = expected - (expected * slippage) / 10_000;
        assertEq(minOutput, expectedMin);

        // Min output should always be <= expected
        assertLe(minOutput, expected);
    }

    function testFuzz_vaultApproval(address vault, uint8 vaultTypeRaw) public {
        vm.assume(vault != address(0));
        
        // Bound vault type to valid enum values (0-5)
        uint8 boundedType = uint8(bound(vaultTypeRaw, 0, 5));
        SweepVaultRouter.VaultType vaultType = SweepVaultRouter.VaultType(boundedType);

        vm.prank(owner);
        vaultRouter.setVaultApproval(vault, vaultType, true);

        assertTrue(vaultRouter.isVaultApproved(vault));
        assertEq(uint256(vaultRouter.getVaultType(vault)), uint256(vaultType));
    }

    function testFuzz_aaveReferralCode(uint16 code) public {
        vm.prank(owner);
        vaultRouter.setAaveReferralCode(code);

        assertEq(vaultRouter.aaveReferralCode(), code);
    }

    // ============================================================
    // SWAP AMOUNT FUZZ TESTS
    // ============================================================

    function testFuzz_swapAmount_underflow(uint256 amount) public view {
        // Ensure fee calculation never underflows
        amount = bound(amount, 0, type(uint128).max);

        uint256 fee = batchSwap.calculateFee(amount);
        
        // Fee should never be greater than amount (prevents underflow)
        assertLe(fee, amount);
    }

    function testFuzz_swapAmount_overflow(uint256 amount, uint256 feeBps) public {
        // Test that fee calculation doesn't overflow
        amount = bound(amount, 0, type(uint128).max);
        feeBps = bound(feeBps, 0, batchSwap.MAX_FEE_BPS());

        vm.prank(owner);
        batchSwap.setFee(feeBps);

        // This should not revert due to overflow
        uint256 fee = batchSwap.calculateFee(amount);
        assertTrue(fee <= amount);
    }

    // ============================================================
    // DEADLINE FUZZ TESTS
    // ============================================================

    function testFuzz_deadline_valid(uint256 deadlineOffset) public view {
        // Any positive offset from now should be valid
        deadlineOffset = bound(deadlineOffset, 1, 365 days);
        uint256 deadline = block.timestamp + deadlineOffset;

        assertTrue(deadline > block.timestamp);
    }

    function testFuzz_deadline_expired(uint256 timeInPast) public {
        // Any time in the past should be expired
        timeInPast = bound(timeInPast, 1, block.timestamp);
        uint256 expiredDeadline = block.timestamp - timeInPast;

        // Create minimal swap params
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
            deadline: expiredDeadline
        });

        vm.prank(user);
        vm.expectRevert(SweepBatchSwap.DeadlineExpired.selector);
        batchSwap.batchSwap(params);
    }

    // ============================================================
    // EDGE CASE FUZZ TESTS
    // ============================================================

    function testFuzz_zeroFee(uint256 amount) public {
        amount = bound(amount, 1, type(uint128).max);

        vm.prank(owner);
        batchSwap.setFee(0);

        uint256 fee = batchSwap.calculateFee(amount);
        assertEq(fee, 0);
    }

    function testFuzz_maxFee(uint256 amount) public {
        amount = bound(amount, 1, type(uint128).max);

        vm.prank(owner);
        batchSwap.setFee(batchSwap.MAX_FEE_BPS());

        uint256 fee = batchSwap.calculateFee(amount);
        uint256 expected = (amount * batchSwap.MAX_FEE_BPS()) / 10_000;

        assertEq(fee, expected);
        assertLe(fee, amount / 2); // Max 5% should be <= 50% of amount
    }
}
