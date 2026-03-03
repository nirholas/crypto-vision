// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console2} from "forge-std/Test.sol";
import {SweepVaultRouter} from "../src/SweepVaultRouter.sol";
import {IAaveV3Pool, IYearnVault, ILido, IWstETH} from "../src/interfaces/IDefiProtocols.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @title SweepVaultRouterTest
/// @notice Fork tests for SweepVaultRouter against mainnet
contract SweepVaultRouterTest is Test {
    // ============================================================
    // CONSTANTS - Mainnet Addresses
    // ============================================================

    // Tokens
    address constant WETH = 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2;
    address constant USDC = 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48;
    address constant DAI = 0x6B175474E89094C44Da98b954EedeAC495271d0F;
    address constant STETH = 0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84;
    address constant WSTETH = 0x7f39C581F595B53c5cb19bD0b3f8dA6c935E2Ca0;

    // Aave V3
    address constant AAVE_V3_POOL = 0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2;
    address constant A_USDC = 0x98C23E9d8f34FEFb1B7BD6a91B7FF122F4e16F5c;
    address constant A_WETH = 0x4d5F47FA6A74757f35C14fD3a6Ef8E3C9BC514E8;

    // Yearn
    address constant YEARN_USDC_VAULT = 0xa354F35829Ae975e850e23e9615b11Da1B3dC4DE; // yvUSDC

    // Lido
    address constant LIDO = 0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84;

    // ============================================================
    // STATE
    // ============================================================

    SweepVaultRouter public router;

    address public owner;
    address public user;
    address public feeCollector;

    // ============================================================
    // SETUP
    // ============================================================

    function setUp() public {
        string memory rpc = vm.envOr("RPC_ETHEREUM", string("https://eth.llamarpc.com"));
        vm.createSelectFork(rpc);

        owner = makeAddr("owner");
        user = makeAddr("user");
        feeCollector = makeAddr("feeCollector");

        vm.startPrank(owner);
        router = new SweepVaultRouter();

        // Approve vaults
        router.setVaultApproval(AAVE_V3_POOL, SweepVaultRouter.VaultType.AAVE_V3, true);
        router.setVaultApproval(LIDO, SweepVaultRouter.VaultType.LIDO, true);
        router.setVaultApproval(WSTETH, SweepVaultRouter.VaultType.LIDO_WSTETH, true);
        
        vm.stopPrank();

        // Fund user
        deal(WETH, user, 100 ether);
        deal(USDC, user, 100_000 * 1e6);
        deal(DAI, user, 100_000 * 1e18);
        vm.deal(user, 100 ether);
    }

    // ============================================================
    // DEPLOYMENT TESTS
    // ============================================================

    function test_deployment() public view {
        assertEq(router.owner(), owner);
        assertEq(router.defaultSlippageBps(), 100); // 1%
        assertFalse(router.paused());
    }

    function test_initialProtocolAddresses() public view {
        assertEq(router.aaveV3Pools(1), AAVE_V3_POOL);
        assertEq(router.lidoAddresses(1), LIDO);
        assertEq(router.wstETHAddresses(1), WSTETH);
        assertEq(router.wethAddresses(1), WETH);
    }

    // ============================================================
    // AAVE V3 SUPPLY TESTS
    // ============================================================

    function test_depositToAave_USDC() public {
        uint256 amount = 10_000 * 1e6; // 10k USDC

        vm.startPrank(user);
        IERC20(USDC).approve(address(router), amount);

        uint256 balanceBefore = IERC20(A_USDC).balanceOf(user);

        uint256 sharesOut = router.depositToAave(
            USDC,
            amount,
            user,
            amount * 99 / 100, // 1% slippage
            block.timestamp + 1800
        );

        uint256 balanceAfter = IERC20(A_USDC).balanceOf(user);
        vm.stopPrank();

        assertGt(sharesOut, 0);
        assertEq(balanceAfter - balanceBefore, sharesOut);
        // Aave supply should be ~1:1 for stablecoins
        assertApproxEqRel(sharesOut, amount, 0.01e18); // Within 1%
    }

    function test_depositToAave_WETH() public {
        uint256 amount = 1 ether;

        vm.startPrank(user);
        IERC20(WETH).approve(address(router), amount);

        uint256 balanceBefore = IERC20(A_WETH).balanceOf(user);

        uint256 sharesOut = router.depositToAave(
            WETH,
            amount,
            user,
            amount * 99 / 100,
            block.timestamp + 1800
        );

        uint256 balanceAfter = IERC20(A_WETH).balanceOf(user);
        vm.stopPrank();

        assertGt(sharesOut, 0);
        assertEq(balanceAfter - balanceBefore, sharesOut);
        assertApproxEqRel(sharesOut, amount, 0.01e18);
    }

    function test_depositToAave_reverts_deadlineExpired() public {
        uint256 amount = 10_000 * 1e6;

        vm.startPrank(user);
        IERC20(USDC).approve(address(router), amount);

        vm.expectRevert(SweepVaultRouter.DeadlineExpired.selector);
        router.depositToAave(
            USDC,
            amount,
            user,
            0,
            block.timestamp - 1 // Expired
        );
        vm.stopPrank();
    }

    function test_depositToAave_reverts_zeroAmount() public {
        vm.prank(user);
        vm.expectRevert(SweepVaultRouter.ZeroAmount.selector);
        router.depositToAave(USDC, 0, user, 0, block.timestamp + 1800);
    }

    function test_depositToAave_reverts_zeroRecipient() public {
        vm.prank(user);
        vm.expectRevert(SweepVaultRouter.ZeroAddress.selector);
        router.depositToAave(USDC, 1000 * 1e6, address(0), 0, block.timestamp + 1800);
    }

    // ============================================================
    // LIDO STAKE TESTS
    // ============================================================

    function test_depositToLido() public {
        uint256 amount = 1 ether;

        uint256 stETHBefore = IERC20(STETH).balanceOf(user);

        vm.prank(user);
        uint256 sharesOut = router.depositToLido{value: amount}(
            user,
            amount * 99 / 100, // 1% slippage
            block.timestamp + 1800
        );

        uint256 stETHAfter = IERC20(STETH).balanceOf(user);

        assertGt(sharesOut, 0);
        assertGt(stETHAfter, stETHBefore);
        // stETH should be ~1:1 with ETH
        assertApproxEqRel(sharesOut, amount, 0.01e18);
    }

    function test_depositToLido_reverts_zeroAmount() public {
        vm.prank(user);
        vm.expectRevert(SweepVaultRouter.ZeroAmount.selector);
        router.depositToLido{value: 0}(user, 0, block.timestamp + 1800);
    }

    function test_depositToLido_reverts_zeroRecipient() public {
        vm.prank(user);
        vm.expectRevert(SweepVaultRouter.ZeroAddress.selector);
        router.depositToLido{value: 1 ether}(address(0), 0, block.timestamp + 1800);
    }

    function test_depositToLido_reverts_deadlineExpired() public {
        vm.prank(user);
        vm.expectRevert(SweepVaultRouter.DeadlineExpired.selector);
        router.depositToLido{value: 1 ether}(user, 0, block.timestamp - 1);
    }

    function test_depositToLido_reverts_slippage() public {
        vm.prank(user);
        vm.expectRevert(SweepVaultRouter.InsufficientOutput.selector);
        router.depositToLido{value: 1 ether}(
            user,
            2 ether, // Impossible minimum
            block.timestamp + 1800
        );
    }

    // ============================================================
    // GENERIC DEPOSIT TESTS
    // ============================================================

    function test_deposit_toAave() public {
        uint256 amount = 5000 * 1e6;

        SweepVaultRouter.DepositParams memory params = SweepVaultRouter.DepositParams({
            vault: AAVE_V3_POOL,
            token: USDC,
            amount: amount,
            minSharesOut: amount * 99 / 100,
            recipient: user,
            deadline: block.timestamp + 1800
        });

        vm.startPrank(user);
        IERC20(USDC).approve(address(router), amount);
        uint256 sharesOut = router.deposit(params);
        vm.stopPrank();

        assertGt(sharesOut, 0);
        assertApproxEqRel(sharesOut, amount, 0.01e18);
    }

    function test_deposit_toLido() public {
        uint256 amount = 2 ether;

        SweepVaultRouter.DepositParams memory params = SweepVaultRouter.DepositParams({
            vault: LIDO,
            token: router.ETH_ADDRESS(),
            amount: amount,
            minSharesOut: amount * 99 / 100,
            recipient: user,
            deadline: block.timestamp + 1800
        });

        vm.prank(user);
        uint256 sharesOut = router.deposit{value: amount}(params);

        assertGt(sharesOut, 0);
        assertApproxEqRel(sharesOut, amount, 0.01e18);
    }

    function test_deposit_reverts_vaultNotApproved() public {
        address randomVault = makeAddr("randomVault");

        SweepVaultRouter.DepositParams memory params = SweepVaultRouter.DepositParams({
            vault: randomVault,
            token: USDC,
            amount: 1000 * 1e6,
            minSharesOut: 0,
            recipient: user,
            deadline: block.timestamp + 1800
        });

        vm.startPrank(user);
        IERC20(USDC).approve(address(router), 1000 * 1e6);

        vm.expectRevert(SweepVaultRouter.VaultNotApproved.selector);
        router.deposit(params);
        vm.stopPrank();
    }

    // ============================================================
    // BATCH DEPOSIT TESTS
    // ============================================================

    function test_batchDeposit() public {
        uint256 usdcAmount = 5000 * 1e6;
        uint256 ethAmount = 1 ether;

        SweepVaultRouter.DepositParams[] memory deposits = new SweepVaultRouter.DepositParams[](2);

        deposits[0] = SweepVaultRouter.DepositParams({
            vault: AAVE_V3_POOL,
            token: USDC,
            amount: usdcAmount,
            minSharesOut: usdcAmount * 99 / 100,
            recipient: user,
            deadline: block.timestamp + 1800
        });

        deposits[1] = SweepVaultRouter.DepositParams({
            vault: LIDO,
            token: router.ETH_ADDRESS(),
            amount: ethAmount,
            minSharesOut: ethAmount * 99 / 100,
            recipient: user,
            deadline: block.timestamp + 1800
        });

        SweepVaultRouter.BatchDepositParams memory params = SweepVaultRouter.BatchDepositParams({
            deposits: deposits,
            deadline: block.timestamp + 1800
        });

        vm.startPrank(user);
        IERC20(USDC).approve(address(router), usdcAmount);

        uint256 totalShares = router.batchDeposit{value: ethAmount}(params);
        vm.stopPrank();

        assertGt(totalShares, 0);
    }

    // ============================================================
    // SLIPPAGE TESTS
    // ============================================================

    function test_calculateMinOutput() public view {
        uint256 expected = 1000 * 1e6;
        uint256 slippage = 100; // 1%

        uint256 minOutput = router.calculateMinOutput(expected, slippage);
        assertEq(minOutput, 990 * 1e6);
    }

    function test_calculateMinOutput_highSlippage() public view {
        uint256 expected = 1000 * 1e6;
        uint256 slippage = 500; // 5%

        uint256 minOutput = router.calculateMinOutput(expected, slippage);
        assertEq(minOutput, 950 * 1e6);
    }

    // ============================================================
    // DEADLINE TESTS
    // ============================================================

    function test_deposit_reverts_deadlineExpired() public {
        SweepVaultRouter.DepositParams memory params = SweepVaultRouter.DepositParams({
            vault: AAVE_V3_POOL,
            token: USDC,
            amount: 1000 * 1e6,
            minSharesOut: 0,
            recipient: user,
            deadline: block.timestamp - 1 // Expired
        });

        vm.prank(user);
        vm.expectRevert(SweepVaultRouter.DeadlineExpired.selector);
        router.deposit(params);
    }

    function test_batchDeposit_reverts_deadlineExpired() public {
        SweepVaultRouter.DepositParams[] memory deposits = new SweepVaultRouter.DepositParams[](1);
        deposits[0] = SweepVaultRouter.DepositParams({
            vault: AAVE_V3_POOL,
            token: USDC,
            amount: 1000 * 1e6,
            minSharesOut: 0,
            recipient: user,
            deadline: block.timestamp + 1800
        });

        SweepVaultRouter.BatchDepositParams memory params = SweepVaultRouter.BatchDepositParams({
            deposits: deposits,
            deadline: block.timestamp - 1 // Expired
        });

        vm.prank(user);
        vm.expectRevert(SweepVaultRouter.DeadlineExpired.selector);
        router.batchDeposit(params);
    }

    // ============================================================
    // ADMIN TESTS
    // ============================================================

    function test_setVaultApproval() public {
        address newVault = makeAddr("newVault");

        vm.prank(owner);
        router.setVaultApproval(newVault, SweepVaultRouter.VaultType.YEARN_V3, true);

        assertTrue(router.isVaultApproved(newVault));
        assertEq(uint256(router.getVaultType(newVault)), uint256(SweepVaultRouter.VaultType.YEARN_V3));
    }

    function test_setVaultApproval_reverts_notOwner() public {
        vm.prank(user);
        vm.expectRevert();
        router.setVaultApproval(makeAddr("vault"), SweepVaultRouter.VaultType.AAVE_V3, true);
    }

    function test_setVaultApprovalBatch() public {
        address[] memory vaults = new address[](2);
        vaults[0] = makeAddr("vault1");
        vaults[1] = makeAddr("vault2");

        SweepVaultRouter.VaultType[] memory types = new SweepVaultRouter.VaultType[](2);
        types[0] = SweepVaultRouter.VaultType.YEARN_V2;
        types[1] = SweepVaultRouter.VaultType.BEEFY;

        vm.prank(owner);
        router.setVaultApprovalBatch(vaults, types, true);

        assertTrue(router.isVaultApproved(vaults[0]));
        assertTrue(router.isVaultApproved(vaults[1]));
    }

    function test_setDefaultSlippage() public {
        vm.prank(owner);
        router.setDefaultSlippage(200); // 2%

        assertEq(router.defaultSlippageBps(), 200);
    }

    function test_setDefaultSlippage_reverts_tooHigh() public {
        vm.prank(owner);
        vm.expectRevert(SweepVaultRouter.InvalidSlippage.selector);
        router.setDefaultSlippage(5001); // > 50%
    }

    function test_setAaveReferralCode() public {
        vm.prank(owner);
        router.setAaveReferralCode(123);

        assertEq(router.aaveReferralCode(), 123);
    }

    function test_setPaused() public {
        vm.prank(owner);
        router.setPaused(true);

        assertTrue(router.paused());

        // Try to deposit when paused
        SweepVaultRouter.DepositParams memory params = SweepVaultRouter.DepositParams({
            vault: AAVE_V3_POOL,
            token: USDC,
            amount: 1000 * 1e6,
            minSharesOut: 0,
            recipient: user,
            deadline: block.timestamp + 1800
        });

        vm.prank(user);
        vm.expectRevert(SweepVaultRouter.ContractPaused.selector);
        router.deposit(params);
    }

    function test_setProtocolAddress() public {
        address newPool = makeAddr("newAavePool");

        vm.prank(owner);
        router.setProtocolAddress("aaveV3", 1, newPool);

        assertEq(router.aaveV3Pools(1), newPool);
    }

    function test_rescueTokens() public {
        // Send tokens to router
        vm.prank(user);
        IERC20(USDC).transfer(address(router), 1000 * 1e6);

        uint256 ownerBalanceBefore = IERC20(USDC).balanceOf(owner);

        vm.prank(owner);
        router.rescueTokens(USDC, owner, 1000 * 1e6);

        assertEq(IERC20(USDC).balanceOf(owner), ownerBalanceBefore + 1000 * 1e6);
    }

    function test_rescueETH() public {
        vm.deal(address(router), 1 ether);

        uint256 ownerBalanceBefore = owner.balance;

        vm.prank(owner);
        router.rescueTokens(router.ETH_ADDRESS(), owner, 1 ether);

        assertEq(owner.balance, ownerBalanceBefore + 1 ether);
    }

    // ============================================================
    // VIEW FUNCTION TESTS
    // ============================================================

    function test_getAavePool() public view {
        assertEq(router.getAavePool(), AAVE_V3_POOL);
    }

    function test_getLido() public view {
        assertEq(router.getLido(), LIDO);
    }

    function test_isVaultApproved() public {
        assertTrue(router.isVaultApproved(AAVE_V3_POOL));
        assertTrue(router.isVaultApproved(LIDO));
        assertFalse(router.isVaultApproved(makeAddr("random")));
    }

    // ============================================================
    // RECEIVE ETH TEST
    // ============================================================

    function test_receiveETH() public {
        vm.deal(user, 1 ether);

        vm.prank(user);
        (bool success,) = address(router).call{value: 1 ether}("");

        assertTrue(success);
        assertEq(address(router).balance, 1 ether);
    }

    // ============================================================
    // FUZZ TESTS
    // ============================================================

    function testFuzz_calculateMinOutput(uint256 expected, uint256 slippage) public view {
        expected = bound(expected, 1, type(uint128).max);
        slippage = bound(slippage, 0, router.MAX_SLIPPAGE_BPS());

        uint256 minOutput = router.calculateMinOutput(expected, slippage);
        assertLe(minOutput, expected);
    }

    function testFuzz_setDefaultSlippage(uint256 slippage) public {
        slippage = bound(slippage, 0, router.MAX_SLIPPAGE_BPS());

        vm.prank(owner);
        router.setDefaultSlippage(slippage);

        assertEq(router.defaultSlippageBps(), slippage);
    }
}
