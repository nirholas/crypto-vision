// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {SweepBatchSwap} from "../src/SweepBatchSwap.sol";
import {SweepPermit2Batcher} from "../src/SweepPermit2Batcher.sol";
import {SweepVaultRouter} from "../src/SweepVaultRouter.sol";
import {SweepFeeCollector} from "../src/SweepFeeCollector.sol";
import {SweepDustSweeper} from "../src/SweepDustSweeper.sol";

/// @title DeployBase
/// @notice Full deployment script for Base
contract DeployBase is Script {
    // ============================================================
    // BASE ADDRESSES
    // ============================================================

    // DEX Routers
    address constant UNISWAP_V3_ROUTER = 0x2626664c2603336E57B271c5C0b26F421741e481;
    address constant UNISWAP_V3_ROUTER_02 = 0x2626664c2603336E57B271c5C0b26F421741e481;
    address constant ONEINCH_ROUTER = 0x111111125421cA6dc452d289314280a0f8842A65;
    address constant ZEROX_PROXY = 0xDef1C0ded9bec7F1a1670819833240f027b25EfF;
    address constant AERODROME_ROUTER = 0xcF77a3Ba9A5CA399B7c97c74d54e5b1Beb874E43;

    // DeFi Vaults
    address constant AAVE_V3_POOL = 0xA238Dd80C259a72e81d7e4664a9801593F98d1c5;

    // Moonwell (Compound fork on Base)
    address constant MOONWELL_USDC = 0xEdc817A28E8B93B03976FBd4a3dDBc9f7D176c22;
    address constant MOONWELL_WETH = 0x628ff693426583D9a7FB391E54366292F509D457;

    // Configuration
    uint256 constant INITIAL_FEE_BPS = 30; // 0.3%

    // ============================================================
    // DEPLOYED CONTRACTS
    // ============================================================

    SweepBatchSwap public batchSwap;
    SweepPermit2Batcher public permit2Batcher;
    SweepVaultRouter public vaultRouter;
    SweepFeeCollector public feeCollector;
    SweepDustSweeper public dustSweeper;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        address treasury = vm.envOr("TREASURY_ADDRESS", deployer);

        console2.log("=== Deploying to Base ===");
        console2.log("Deployer:", deployer);
        console2.log("Treasury:", treasury);
        console2.log("Chain ID:", block.chainid);

        require(block.chainid == 8453, "Not Base");

        vm.startBroadcast(deployerPrivateKey);

        // 1. Deploy Fee Collector first
        feeCollector = new SweepFeeCollector(treasury, INITIAL_FEE_BPS);
        console2.log("SweepFeeCollector:", address(feeCollector));

        // 2. Deploy BatchSwap
        batchSwap = new SweepBatchSwap(address(feeCollector), 0);
        console2.log("SweepBatchSwap:", address(batchSwap));

        // 3. Deploy Permit2Batcher
        permit2Batcher = new SweepPermit2Batcher(address(batchSwap));
        console2.log("SweepPermit2Batcher:", address(permit2Batcher));

        // 4. Deploy VaultRouter
        vaultRouter = new SweepVaultRouter();
        console2.log("SweepVaultRouter:", address(vaultRouter));

        // 5. Deploy DustSweeper
        dustSweeper = new SweepDustSweeper(
            address(batchSwap),
            address(vaultRouter),
            address(feeCollector)
        );
        console2.log("SweepDustSweeper:", address(dustSweeper));

        // Configure
        _configureRouters();
        _configureVaults();

        // Configure FeeCollector
        feeCollector.setDepositorApproval(address(dustSweeper), true);
        feeCollector.setDepositorApproval(address(batchSwap), true);

        vm.stopBroadcast();

        _logDeploymentSummary();
    }

    function _configureRouters() internal {
        batchSwap.setRouterApproval(UNISWAP_V3_ROUTER, true);
        batchSwap.setRouterApproval(UNISWAP_V3_ROUTER_02, true);
        batchSwap.setRouterApproval(ONEINCH_ROUTER, true);
        batchSwap.setRouterApproval(ZEROX_PROXY, true);
        batchSwap.setRouterApproval(AERODROME_ROUTER, true);

        console2.log("Routers configured");
    }

    function _configureVaults() internal {
        // Aave V3
        vaultRouter.setVaultApproval(AAVE_V3_POOL, SweepVaultRouter.VaultType.AAVE_V3, true);

        console2.log("Vaults configured");
    }

    function _logDeploymentSummary() internal view {
        console2.log("");
        console2.log("=== Base Deployment Summary ===");
        console2.log("SweepFeeCollector:", address(feeCollector));
        console2.log("SweepBatchSwap:", address(batchSwap));
        console2.log("SweepPermit2Batcher:", address(permit2Batcher));
        console2.log("SweepVaultRouter:", address(vaultRouter));
        console2.log("SweepDustSweeper:", address(dustSweeper));
    }
}
