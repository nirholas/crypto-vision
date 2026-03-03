// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console2} from "forge-std/Test.sol";
import {SweepFeeCollector} from "../src/SweepFeeCollector.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @title SweepFeeCollectorTest
/// @notice Tests for SweepFeeCollector
contract SweepFeeCollectorTest is Test {
    // ============================================================
    // CONSTANTS
    // ============================================================

    address constant USDC = 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48;
    address constant WETH = 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2;

    // ============================================================
    // STATE
    // ============================================================

    SweepFeeCollector public collector;

    address public owner;
    address public treasury;
    address public depositor;
    address public user;

    // ============================================================
    // SETUP
    // ============================================================

    function setUp() public {
        string memory rpc = vm.envOr("RPC_ETHEREUM", string("https://eth.llamarpc.com"));
        vm.createSelectFork(rpc);

        owner = makeAddr("owner");
        treasury = makeAddr("treasury");
        depositor = makeAddr("depositor");
        user = makeAddr("user");

        vm.prank(owner);
        collector = new SweepFeeCollector(treasury, 30); // 0.3% fee

        // Approve depositor
        vm.prank(owner);
        collector.setDepositorApproval(depositor, true);

        // Fund accounts
        deal(USDC, depositor, 100_000 * 1e6);
        deal(WETH, depositor, 100 ether);
        vm.deal(depositor, 100 ether);
    }

    // ============================================================
    // DEPLOYMENT TESTS
    // ============================================================

    function test_deployment() public view {
        assertEq(collector.owner(), owner);
        assertEq(collector.treasury(), treasury);
        assertEq(collector.feeBps(), 30);
        assertTrue(collector.withdrawalDelayEnabled());
        assertFalse(collector.paused());
    }

    function test_deployment_defaultFee() public {
        vm.prank(owner);
        SweepFeeCollector newCollector = new SweepFeeCollector(treasury, 0);

        assertEq(newCollector.feeBps(), 30); // Default 0.3%
    }

    function test_deployment_reverts_zeroTreasury() public {
        vm.prank(owner);
        vm.expectRevert(SweepFeeCollector.ZeroAddress.selector);
        new SweepFeeCollector(address(0), 30);
    }

    function test_deployment_reverts_feeTooHigh() public {
        vm.prank(owner);
        vm.expectRevert(SweepFeeCollector.FeeTooHigh.selector);
        new SweepFeeCollector(treasury, 501); // > 5%
    }

    // ============================================================
    // FEE DEPOSIT TESTS
    // ============================================================

    function test_depositFee_ERC20() public {
        uint256 amount = 1000 * 1e6;

        vm.startPrank(depositor);
        IERC20(USDC).approve(address(collector), amount);
        collector.depositFee(USDC, amount, user);
        vm.stopPrank();

        assertEq(collector.accumulatedFees(USDC), amount);
        assertEq(collector.totalFeesCollected(USDC), amount);
    }

    function test_depositFee_ETH() public {
        uint256 amount = 1 ether;

        vm.prank(depositor);
        collector.depositFee{value: amount}(collector.ETH_ADDRESS(), amount, user);

        assertEq(collector.accumulatedFees(collector.ETH_ADDRESS()), amount);
        assertEq(address(collector).balance, amount);
    }

    function test_depositFee_reverts_notApproved() public {
        vm.prank(user);
        vm.expectRevert(SweepFeeCollector.NotApprovedDepositor.selector);
        collector.depositFee(USDC, 100 * 1e6, user);
    }

    function test_depositFee_reverts_zeroAmount() public {
        vm.prank(depositor);
        vm.expectRevert(SweepFeeCollector.ZeroAmount.selector);
        collector.depositFee(USDC, 0, user);
    }

    function test_depositFee_reverts_paused() public {
        vm.prank(owner);
        collector.setPaused(true);

        vm.startPrank(depositor);
        IERC20(USDC).approve(address(collector), 100 * 1e6);
        vm.expectRevert(SweepFeeCollector.ContractPaused.selector);
        collector.depositFee(USDC, 100 * 1e6, user);
        vm.stopPrank();
    }

    // ============================================================
    // FEE CALCULATION TESTS
    // ============================================================

    function test_calculateFee() public view {
        uint256 amount = 10_000 * 1e6; // 10k
        uint256 fee = collector.calculateFee(amount);

        // 0.3% of 10,000 = 30
        assertEq(fee, 30 * 1e6);
    }

    function test_calculateFee_withDiscount() public {
        // Set 50% discount for user (15 bps discount)
        vm.prank(owner);
        collector.setFeeDiscount(user, 15);

        uint256 amount = 10_000 * 1e6;
        uint256 fee = collector.calculateFee(amount, user);

        // 0.15% of 10,000 = 15
        assertEq(fee, 15 * 1e6);
    }

    function test_getEffectiveFee() public view {
        assertEq(collector.getEffectiveFee(user), 30);
    }

    function test_getEffectiveFee_withDiscount() public {
        vm.prank(owner);
        collector.setFeeDiscount(user, 10);

        assertEq(collector.getEffectiveFee(user), 20);
    }

    // ============================================================
    // WITHDRAWAL TESTS
    // ============================================================

    function test_requestWithdrawal() public {
        // Deposit fees first
        uint256 amount = 1000 * 1e6;
        vm.startPrank(depositor);
        IERC20(USDC).approve(address(collector), amount);
        collector.depositFee(USDC, amount, user);
        vm.stopPrank();

        // Request withdrawal
        vm.prank(owner);
        collector.requestWithdrawal(USDC, amount);

        assertEq(collector.pendingWithdrawals(USDC), amount);
    }

    function test_executeWithdrawal() public {
        // Deposit fees
        uint256 amount = 1000 * 1e6;
        vm.startPrank(depositor);
        IERC20(USDC).approve(address(collector), amount);
        collector.depositFee(USDC, amount, user);
        vm.stopPrank();

        // Request withdrawal
        vm.prank(owner);
        collector.requestWithdrawal(USDC, amount);

        // Wait for delay
        vm.warp(block.timestamp + 1 hours + 1);

        // Execute withdrawal
        uint256 treasuryBalanceBefore = IERC20(USDC).balanceOf(treasury);

        vm.prank(owner);
        collector.executeWithdrawal(USDC);

        uint256 treasuryBalanceAfter = IERC20(USDC).balanceOf(treasury);

        assertEq(treasuryBalanceAfter - treasuryBalanceBefore, amount);
        assertEq(collector.accumulatedFees(USDC), 0);
        assertEq(collector.pendingWithdrawals(USDC), 0);
        assertEq(collector.totalFeesWithdrawn(USDC), amount);
    }

    function test_executeWithdrawal_reverts_notReady() public {
        // Deposit fees
        uint256 amount = 1000 * 1e6;
        vm.startPrank(depositor);
        IERC20(USDC).approve(address(collector), amount);
        collector.depositFee(USDC, amount, user);
        vm.stopPrank();

        // Request withdrawal
        vm.prank(owner);
        collector.requestWithdrawal(USDC, amount);

        // Try to execute immediately (should fail)
        vm.prank(owner);
        vm.expectRevert(SweepFeeCollector.WithdrawalNotReady.selector);
        collector.executeWithdrawal(USDC);
    }

    function test_executeWithdrawal_reverts_noPending() public {
        vm.prank(owner);
        vm.expectRevert(SweepFeeCollector.NoWithdrawalPending.selector);
        collector.executeWithdrawal(USDC);
    }

    function test_cancelWithdrawal() public {
        // Deposit fees
        uint256 amount = 1000 * 1e6;
        vm.startPrank(depositor);
        IERC20(USDC).approve(address(collector), amount);
        collector.depositFee(USDC, amount, user);
        vm.stopPrank();

        // Request withdrawal
        vm.prank(owner);
        collector.requestWithdrawal(USDC, amount);

        // Cancel
        vm.prank(owner);
        collector.cancelWithdrawal(USDC);

        assertEq(collector.pendingWithdrawals(USDC), 0);
        assertEq(collector.accumulatedFees(USDC), amount); // Still there
    }

    function test_isWithdrawalReady() public {
        // Deposit fees
        uint256 amount = 1000 * 1e6;
        vm.startPrank(depositor);
        IERC20(USDC).approve(address(collector), amount);
        collector.depositFee(USDC, amount, user);
        vm.stopPrank();

        // No pending withdrawal
        (bool ready, uint256 timeRemaining) = collector.isWithdrawalReady(USDC);
        assertFalse(ready);
        assertEq(timeRemaining, 0);

        // Request withdrawal
        vm.prank(owner);
        collector.requestWithdrawal(USDC, amount);

        // Check before delay
        (ready, timeRemaining) = collector.isWithdrawalReady(USDC);
        assertFalse(ready);
        assertGt(timeRemaining, 0);

        // After delay
        vm.warp(block.timestamp + 1 hours + 1);
        (ready, timeRemaining) = collector.isWithdrawalReady(USDC);
        assertTrue(ready);
        assertEq(timeRemaining, 0);
    }

    function test_withdrawAllFees_delayDisabled() public {
        // Disable delay
        vm.prank(owner);
        collector.setWithdrawalDelayEnabled(false);

        // Deposit fees
        uint256 amount = 1000 * 1e6;
        vm.startPrank(depositor);
        IERC20(USDC).approve(address(collector), amount);
        collector.depositFee(USDC, amount, user);
        vm.stopPrank();

        // Withdraw immediately
        vm.prank(owner);
        collector.withdrawAllFees(USDC);

        assertEq(IERC20(USDC).balanceOf(treasury), amount);
        assertEq(collector.accumulatedFees(USDC), 0);
    }

    function test_withdrawAllFees_reverts_delayEnabled() public {
        // Deposit fees
        uint256 amount = 1000 * 1e6;
        vm.startPrank(depositor);
        IERC20(USDC).approve(address(collector), amount);
        collector.depositFee(USDC, amount, user);
        vm.stopPrank();

        // Try to withdraw (should fail because delay is enabled)
        vm.prank(owner);
        vm.expectRevert(SweepFeeCollector.WithdrawalNotReady.selector);
        collector.withdrawAllFees(USDC);
    }

    // ============================================================
    // EMERGENCY WITHDRAWAL TESTS
    // ============================================================

    function test_emergencyWithdraw() public {
        // Deposit fees
        uint256 amount = 1000 * 1e6;
        vm.startPrank(depositor);
        IERC20(USDC).approve(address(collector), amount);
        collector.depositFee(USDC, amount, user);
        vm.stopPrank();

        // Pause contract
        vm.prank(owner);
        collector.setPaused(true);

        // Emergency withdraw
        vm.prank(owner);
        collector.emergencyWithdraw(USDC, treasury);

        assertEq(IERC20(USDC).balanceOf(treasury), amount);
        assertEq(IERC20(USDC).balanceOf(address(collector)), 0);
    }

    function test_emergencyWithdraw_ETH() public {
        // Deposit ETH fees
        uint256 amount = 1 ether;
        vm.prank(depositor);
        collector.depositFee{value: amount}(collector.ETH_ADDRESS(), amount, user);

        // Pause contract
        vm.prank(owner);
        collector.setPaused(true);

        uint256 treasuryBalanceBefore = treasury.balance;

        // Emergency withdraw
        vm.prank(owner);
        collector.emergencyWithdraw(collector.ETH_ADDRESS(), treasury);

        assertEq(treasury.balance, treasuryBalanceBefore + amount);
    }

    function test_emergencyWithdraw_reverts_notPaused() public {
        vm.prank(owner);
        vm.expectRevert(SweepFeeCollector.ContractPaused.selector);
        collector.emergencyWithdraw(USDC, treasury);
    }

    // ============================================================
    // ADMIN TESTS
    // ============================================================

    function test_setTreasury() public {
        address newTreasury = makeAddr("newTreasury");

        vm.prank(owner);
        collector.setTreasury(newTreasury);

        assertEq(collector.treasury(), newTreasury);
    }

    function test_setTreasury_reverts_zeroAddress() public {
        vm.prank(owner);
        vm.expectRevert(SweepFeeCollector.ZeroAddress.selector);
        collector.setTreasury(address(0));
    }

    function test_setFee() public {
        vm.prank(owner);
        collector.setFee(50); // 0.5%

        assertEq(collector.feeBps(), 50);
    }

    function test_setFee_reverts_tooHigh() public {
        vm.prank(owner);
        vm.expectRevert(SweepFeeCollector.FeeTooHigh.selector);
        collector.setFee(501);
    }

    function test_setFeeDiscount() public {
        vm.prank(owner);
        collector.setFeeDiscount(user, 15);

        assertEq(collector.feeDiscounts(user), 15);
    }

    function test_setFeeDiscount_reverts_tooHigh() public {
        vm.prank(owner);
        vm.expectRevert(SweepFeeCollector.DiscountTooHigh.selector);
        collector.setFeeDiscount(user, 50); // More than fee itself
    }

    function test_setDepositorApproval() public {
        address newDepositor = makeAddr("newDepositor");

        vm.prank(owner);
        collector.setDepositorApproval(newDepositor, true);

        assertTrue(collector.approvedDepositors(newDepositor));
    }

    function test_setDepositorApproval_reverts_zeroAddress() public {
        vm.prank(owner);
        vm.expectRevert(SweepFeeCollector.ZeroAddress.selector);
        collector.setDepositorApproval(address(0), true);
    }

    function test_setWithdrawalDelayEnabled() public {
        vm.prank(owner);
        collector.setWithdrawalDelayEnabled(false);

        assertFalse(collector.withdrawalDelayEnabled());
    }

    function test_setPaused() public {
        vm.prank(owner);
        collector.setPaused(true);

        assertTrue(collector.paused());
    }

    // ============================================================
    // VIEW FUNCTION TESTS
    // ============================================================

    function test_getFeeTokens() public {
        // Deposit multiple tokens
        vm.startPrank(depositor);
        IERC20(USDC).approve(address(collector), 1000 * 1e6);
        collector.depositFee(USDC, 1000 * 1e6, user);

        IERC20(WETH).approve(address(collector), 1 ether);
        collector.depositFee(WETH, 1 ether, user);

        collector.depositFee{value: 1 ether}(collector.ETH_ADDRESS(), 1 ether, user);
        vm.stopPrank();

        address[] memory tokens = collector.getFeeTokens();
        assertEq(tokens.length, 3);
    }

    function test_getFeeStats() public {
        uint256 amount = 1000 * 1e6;

        // Deposit
        vm.startPrank(depositor);
        IERC20(USDC).approve(address(collector), amount);
        collector.depositFee(USDC, amount, user);
        vm.stopPrank();

        (uint256 collected, uint256 withdrawn, uint256 pending) = collector.getFeeStats(USDC);

        assertEq(collected, amount);
        assertEq(withdrawn, 0);
        assertEq(pending, amount);
    }

    // ============================================================
    // TWO-STEP OWNERSHIP TESTS
    // ============================================================

    function test_transferOwnership() public {
        address newOwner = makeAddr("newOwner");

        vm.prank(owner);
        collector.transferOwnership(newOwner);

        // Still old owner until accepted
        assertEq(collector.owner(), owner);

        vm.prank(newOwner);
        collector.acceptOwnership();

        assertEq(collector.owner(), newOwner);
    }

    // ============================================================
    // FUZZ TESTS
    // ============================================================

    function testFuzz_calculateFee(uint256 amount) public view {
        amount = bound(amount, 0, type(uint128).max);

        uint256 fee = collector.calculateFee(amount);
        uint256 expected = (amount * collector.feeBps()) / collector.MAX_BPS();

        assertEq(fee, expected);
    }

    function testFuzz_setFee(uint256 feeBps) public {
        feeBps = bound(feeBps, 0, collector.MAX_FEE_BPS());

        vm.prank(owner);
        collector.setFee(feeBps);

        assertEq(collector.feeBps(), feeBps);
    }
}
