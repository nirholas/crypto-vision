// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {SweepBatchSwap} from "../src/SweepBatchSwap.sol";
import {SweepPermit2Batcher} from "../src/SweepPermit2Batcher.sol";

/// @title Deploy
/// @notice Deployment script for Sweep contracts
contract Deploy is Script {
    // ============================================================
    // DEPLOYMENT ADDRESSES (per chain)
    // ============================================================

    // 1inch Router V6
    address constant ONEINCH_ROUTER_MAINNET = 0x111111125421cA6dc452d289314280a0f8842A65;
    address constant ONEINCH_ROUTER_BASE = 0x111111125421cA6dc452d289314280a0f8842A65;
    address constant ONEINCH_ROUTER_ARBITRUM = 0x111111125421cA6dc452d289314280a0f8842A65;
    address constant ONEINCH_ROUTER_POLYGON = 0x111111125421cA6dc452d289314280a0f8842A65;
    address constant ONEINCH_ROUTER_OPTIMISM = 0x111111125421cA6dc452d289314280a0f8842A65;
    address constant ONEINCH_ROUTER_BSC = 0x111111125421cA6dc452d289314280a0f8842A65;
    address constant ONEINCH_ROUTER_LINEA = 0x111111125421cA6dc452d289314280a0f8842A65;

    // Uniswap V3 SwapRouter
    address constant UNISWAP_V3_ROUTER = 0xE592427A0AEce92De3Edee1F18E0157C05861564;
    address constant UNISWAP_V3_ROUTER_02 = 0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45;

    // 0x Exchange Proxy
    address constant ZEROX_PROXY_MAINNET = 0xDef1C0ded9bec7F1a1670819833240f027b25EfF;
    address constant ZEROX_PROXY_BASE = 0xDef1C0ded9bec7F1a1670819833240f027b25EfF;
    address constant ZEROX_PROXY_ARBITRUM = 0xDef1C0ded9bec7F1a1670819833240f027b25EfF;
    address constant ZEROX_PROXY_POLYGON = 0xDef1C0ded9bec7F1a1670819833240f027b25EfF;

    // ============================================================
    // CONFIGURATION
    // ============================================================

    // Fee configuration
    uint256 constant INITIAL_FEE_BPS = 50; // 0.5% fee

    // Deployment parameters
    struct DeployConfig {
        address feeCollector;
        address[] routers;
        string chainName;
    }

    // ============================================================
    // MAIN DEPLOY FUNCTION
    // ============================================================

    function run() external virtual {
        uint256 deployerPrivateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        address feeCollector = vm.envOr("FEE_COLLECTOR", deployer);

        console2.log("Deployer:", deployer);
        console2.log("Fee Collector:", feeCollector);
        console2.log("Chain ID:", block.chainid);

        vm.startBroadcast(deployerPrivateKey);

        // Deploy contracts
        (SweepBatchSwap batchSwap, SweepPermit2Batcher batcher) = deploy(feeCollector);

        // Configure routers based on chain
        configureRouters(batchSwap);

        vm.stopBroadcast();

        // Log deployed addresses
        console2.log("=== Deployment Complete ===");
        console2.log("SweepBatchSwap:", address(batchSwap));
        console2.log("SweepPermit2Batcher:", address(batcher));
    }

    /// @notice Deploy all contracts
    function deploy(address feeCollector)
        public
        returns (SweepBatchSwap batchSwap, SweepPermit2Batcher batcher)
    {
        // Deploy SweepBatchSwap
        batchSwap = new SweepBatchSwap(feeCollector, INITIAL_FEE_BPS);
        console2.log("SweepBatchSwap deployed at:", address(batchSwap));

        // Deploy SweepPermit2Batcher
        batcher = new SweepPermit2Batcher(address(batchSwap));
        console2.log("SweepPermit2Batcher deployed at:", address(batcher));

        return (batchSwap, batcher);
    }

    /// @notice Configure approved routers for the current chain
    function configureRouters(SweepBatchSwap batchSwap) internal {
        address[] memory routers = getRoutersForChain();
        
        for (uint256 i = 0; i < routers.length; i++) {
            if (routers[i] != address(0)) {
                batchSwap.setRouterApproval(routers[i], true);
                console2.log("Approved router:", routers[i]);
            }
        }
    }

    /// @notice Get router addresses for current chain
    function getRoutersForChain() internal view returns (address[] memory) {
        address[] memory routers = new address[](5);
        
        // Common routers
        routers[0] = UNISWAP_V3_ROUTER;
        routers[1] = UNISWAP_V3_ROUTER_02;

        if (block.chainid == 1) {
            // Ethereum Mainnet
            routers[2] = ONEINCH_ROUTER_MAINNET;
            routers[3] = ZEROX_PROXY_MAINNET;
        } else if (block.chainid == 8453) {
            // Base
            routers[2] = ONEINCH_ROUTER_BASE;
            routers[3] = ZEROX_PROXY_BASE;
        } else if (block.chainid == 42161) {
            // Arbitrum
            routers[2] = ONEINCH_ROUTER_ARBITRUM;
            routers[3] = ZEROX_PROXY_ARBITRUM;
        } else if (block.chainid == 137) {
            // Polygon
            routers[2] = ONEINCH_ROUTER_POLYGON;
            routers[3] = ZEROX_PROXY_POLYGON;
        } else if (block.chainid == 10) {
            // Optimism
            routers[2] = ONEINCH_ROUTER_OPTIMISM;
        } else if (block.chainid == 56) {
            // BSC
            routers[2] = ONEINCH_ROUTER_BSC;
        } else if (block.chainid == 59144) {
            // Linea
            routers[2] = ONEINCH_ROUTER_LINEA;
        }

        return routers;
    }
}

/// @title DeployBase
/// @notice Deploy to Base chain
contract DeployBase is Deploy {
    function run() external override {
        uint256 deployerPrivateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address feeCollector = vm.envOr("FEE_COLLECTOR", vm.addr(deployerPrivateKey));

        vm.createSelectFork("base");
        
        vm.startBroadcast(deployerPrivateKey);
        
        (SweepBatchSwap batchSwap, SweepPermit2Batcher batcher) = deploy(feeCollector);
        configureRouters(batchSwap);
        
        vm.stopBroadcast();

        console2.log("=== Base Deployment Complete ===");
        console2.log("SweepBatchSwap:", address(batchSwap));
        console2.log("SweepPermit2Batcher:", address(batcher));
    }
}

/// @title DeployArbitrum
/// @notice Deploy to Arbitrum chain
contract DeployArbitrum is Deploy {
    function run() external override {
        uint256 deployerPrivateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address feeCollector = vm.envOr("FEE_COLLECTOR", vm.addr(deployerPrivateKey));

        vm.createSelectFork("arbitrum");
        
        vm.startBroadcast(deployerPrivateKey);
        
        (SweepBatchSwap batchSwap, SweepPermit2Batcher batcher) = deploy(feeCollector);
        configureRouters(batchSwap);
        
        vm.stopBroadcast();

        console2.log("=== Arbitrum Deployment Complete ===");
        console2.log("SweepBatchSwap:", address(batchSwap));
        console2.log("SweepPermit2Batcher:", address(batcher));
    }
}

/// @title DeployPolygon
/// @notice Deploy to Polygon chain
contract DeployPolygon is Deploy {
    function run() external override {
        uint256 deployerPrivateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address feeCollector = vm.envOr("FEE_COLLECTOR", vm.addr(deployerPrivateKey));

        vm.createSelectFork("polygon");
        
        vm.startBroadcast(deployerPrivateKey);
        
        (SweepBatchSwap batchSwap, SweepPermit2Batcher batcher) = deploy(feeCollector);
        configureRouters(batchSwap);
        
        vm.stopBroadcast();

        console2.log("=== Polygon Deployment Complete ===");
        console2.log("SweepBatchSwap:", address(batchSwap));
        console2.log("SweepPermit2Batcher:", address(batcher));
    }
}

/// @title DeployAllChains
/// @notice Deploy to all supported chains
contract DeployAllChains is Deploy {
    function run() external override {
        uint256 deployerPrivateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address feeCollector = vm.envOr("FEE_COLLECTOR", vm.addr(deployerPrivateKey));

        string[5] memory chains = ["base", "arbitrum", "polygon", "optimism", "mainnet"];

        for (uint256 i = 0; i < chains.length; i++) {
            console2.log("Deploying to:", chains[i]);
            
            vm.createSelectFork(chains[i]);
            
            vm.startBroadcast(deployerPrivateKey);
            
            (SweepBatchSwap batchSwap, SweepPermit2Batcher batcher) = deploy(feeCollector);
            configureRouters(batchSwap);
            
            vm.stopBroadcast();

            console2.log("  SweepBatchSwap:", address(batchSwap));
            console2.log("  SweepPermit2Batcher:", address(batcher));
        }

        console2.log("=== All Chains Deployed ===");
    }
}
