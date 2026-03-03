// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {SweepBatchSwap} from "../src/SweepBatchSwap.sol";
import {SweepPermit2Batcher} from "../src/SweepPermit2Batcher.sol";
import {SweepVaultRouter} from "../src/SweepVaultRouter.sol";
import {SweepFeeCollector} from "../src/SweepFeeCollector.sol";
import {SweepDustSweeper} from "../src/SweepDustSweeper.sol";

/// @title DeployArbitrum
/// @notice Full deployment script for Arbitrum One
contract DeployArbitrum is Script {
    // ============================================================
    // ARBITRUM ADDRESSES
    // ============================================================

    // DEX Routers
    address constant UNISWAP_V3_ROUTER = 0xE592427A0AEce92De3Edee1F18E0157C05861564;
    address constant UNISWAP_V3_ROUTER_02 = 0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45;
    address constant ONEINCH_ROUTER = 0x111111125421cA6dc452d289314280a0f8842A65;
    address constant ZEROX_PROXY = 0xDef1C0ded9bec7F1a1670819833240f027b25EfF;
    address constant CAMELOT_ROUTER = 0xc873fEcbd354f5A56E00E710B90EF4201db2448d;
    address constant SUSHISWAP_ROUTER = 0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506;

    // DeFi Vaults
    address constant AAVE_V3_POOL = 0x794a61358D6845594F94dc1DB02A252b5b4814aD;

    // GMX
    address constant GMX_ROUTER = 0xaBBc5F99639c9B6bCb58544ddf04EFA6802F4064;

    // Radiant
    address constant RADIANT_LENDING_POOL = 0xF4B1486DD74D07706052A33d31d7c0AAFD0659E1;

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

        console2.log("=== Deploying to Arbitrum One ===");
        console2.log("Deployer:", deployer);
        console2.log("Treasury:", treasury);
        console2.log("Chain ID:", block.chainid);

        require(block.chainid == 42161, "Not Arbitrum");

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
        batchSwap.setRouterApproval(CAMELOT_ROUTER, true);
        batchSwap.setRouterApproval(SUSHISWAP_ROUTER, true);

        console2.log("Routers configured");
    }

    function _configureVaults() internal {
        // Aave V3
        vaultRouter.setVaultApproval(AAVE_V3_POOL, SweepVaultRouter.VaultType.AAVE_V3, true);

        console2.log("Vaults configured");
    }

    function _logDeploymentSummary() internal view {
        console2.log("");
        console2.log("=== Arbitrum Deployment Summary ===");
        console2.log("SweepFeeCollector:", address(feeCollector));
        console2.log("SweepBatchSwap:", address(batchSwap));
        console2.log("SweepPermit2Batcher:", address(permit2Batcher));
        console2.log("SweepVaultRouter:", address(vaultRouter));
        console2.log("SweepDustSweeper:", address(dustSweeper));
    }
}
