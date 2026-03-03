// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";

/// @title Verify
/// @notice Script to verify contracts on block explorers
/// @dev Run after deployment with deployed addresses
contract Verify is Script {
    // ============================================================
    // CONSTRUCTOR ARGS (update after deployment)
    // ============================================================

    // Set these based on your deployment
    address public treasury = address(0); // Set after deployment
    uint256 public feeBps = 30;

    // Deployed contract addresses (update after deployment)
    address public feeCollector = address(0);
    address public batchSwap = address(0);
    address public permit2Batcher = address(0);
    address public vaultRouter = address(0);
    address public dustSweeper = address(0);

    function run() external view {
        console2.log("=== Contract Verification Commands ===");
        console2.log("");
        console2.log("Run these commands to verify your contracts:");
        console2.log("");

        // Verification commands for different networks
        _printMainnetCommands();
        _printBaseCommands();
        _printArbitrumCommands();
    }

    function _printMainnetCommands() internal view {
        console2.log("--- ETHEREUM MAINNET ---");
        console2.log("");

        // FeeCollector
        console2.log("# SweepFeeCollector");
        console2.log(
            string.concat(
                "forge verify-contract ",
                _toHexString(feeCollector),
                " src/SweepFeeCollector.sol:SweepFeeCollector ",
                "--constructor-args $(cast abi-encode 'constructor(address,uint256)' ",
                _toHexString(treasury),
                " ",
                _toString(feeBps),
                ") ",
                "--chain mainnet --etherscan-api-key $ETHERSCAN_API_KEY"
            )
        );
        console2.log("");

        // BatchSwap
        console2.log("# SweepBatchSwap");
        console2.log(
            string.concat(
                "forge verify-contract ",
                _toHexString(batchSwap),
                " src/SweepBatchSwap.sol:SweepBatchSwap ",
                "--constructor-args $(cast abi-encode 'constructor(address,uint256)' ",
                _toHexString(feeCollector),
                " 0) ",
                "--chain mainnet --etherscan-api-key $ETHERSCAN_API_KEY"
            )
        );
        console2.log("");

        // Permit2Batcher
        console2.log("# SweepPermit2Batcher");
        console2.log(
            string.concat(
                "forge verify-contract ",
                _toHexString(permit2Batcher),
                " src/SweepPermit2Batcher.sol:SweepPermit2Batcher ",
                "--constructor-args $(cast abi-encode 'constructor(address)' ",
                _toHexString(batchSwap),
                ") ",
                "--chain mainnet --etherscan-api-key $ETHERSCAN_API_KEY"
            )
        );
        console2.log("");

        // VaultRouter
        console2.log("# SweepVaultRouter");
        console2.log(
            string.concat(
                "forge verify-contract ",
                _toHexString(vaultRouter),
                " src/SweepVaultRouter.sol:SweepVaultRouter ",
                "--chain mainnet --etherscan-api-key $ETHERSCAN_API_KEY"
            )
        );
        console2.log("");

        // DustSweeper
        console2.log("# SweepDustSweeper");
        console2.log(
            string.concat(
                "forge verify-contract ",
                _toHexString(dustSweeper),
                " src/SweepDustSweeper.sol:SweepDustSweeper ",
                "--constructor-args $(cast abi-encode 'constructor(address,address,address)' ",
                _toHexString(batchSwap),
                " ",
                _toHexString(vaultRouter),
                " ",
                _toHexString(feeCollector),
                ") ",
                "--chain mainnet --etherscan-api-key $ETHERSCAN_API_KEY"
            )
        );
        console2.log("");
    }

    function _printBaseCommands() internal view {
        console2.log("--- BASE ---");
        console2.log("");
        console2.log("# Same commands as mainnet but with:");
        console2.log("# --chain base --etherscan-api-key $BASESCAN_API_KEY");
        console2.log("");
    }

    function _printArbitrumCommands() internal view {
        console2.log("--- ARBITRUM ---");
        console2.log("");
        console2.log("# Same commands as mainnet but with:");
        console2.log("# --chain arbitrum --etherscan-api-key $ARBISCAN_API_KEY");
        console2.log("");
    }

    function _toHexString(address addr) internal pure returns (string memory) {
        if (addr == address(0)) return "0x0000000000000000000000000000000000000000";
        return vm.toString(addr);
    }

    function _toString(uint256 value) internal pure returns (string memory) {
        return vm.toString(value);
    }
}

/// @title VerifyWithAddresses
/// @notice Verify script that takes addresses as environment variables
contract VerifyWithAddresses is Script {
    function run() external {
        // Read addresses from environment
        address feeCollector = vm.envAddress("FEE_COLLECTOR_ADDRESS");
        address batchSwap = vm.envAddress("BATCH_SWAP_ADDRESS");
        address permit2Batcher = vm.envAddress("PERMIT2_BATCHER_ADDRESS");
        address vaultRouter = vm.envAddress("VAULT_ROUTER_ADDRESS");
        address dustSweeper = vm.envAddress("DUST_SWEEPER_ADDRESS");
        address treasury = vm.envAddress("TREASURY_ADDRESS");
        uint256 chainId = block.chainid;

        string memory network;
        string memory apiKeyEnv;

        if (chainId == 1) {
            network = "mainnet";
            apiKeyEnv = "ETHERSCAN_API_KEY";
        } else if (chainId == 8453) {
            network = "base";
            apiKeyEnv = "BASESCAN_API_KEY";
        } else if (chainId == 42161) {
            network = "arbitrum";
            apiKeyEnv = "ARBISCAN_API_KEY";
        } else {
            revert("Unsupported chain");
        }

        console2.log("Verifying on", network);
        console2.log("");

        console2.log("Contract addresses:");
        console2.log("  FeeCollector:", feeCollector);
        console2.log("  BatchSwap:", batchSwap);
        console2.log("  Permit2Batcher:", permit2Batcher);
        console2.log("  VaultRouter:", vaultRouter);
        console2.log("  DustSweeper:", dustSweeper);
        console2.log("");

        console2.log("Run verification with:");
        console2.log("");
        console2.log(
            string.concat(
                "forge verify-contract ",
                vm.toString(feeCollector),
                " SweepFeeCollector --constructor-args $(cast abi-encode 'constructor(address,uint256)' ",
                vm.toString(treasury),
                " 30) --chain ",
                network,
                " --etherscan-api-key $",
                apiKeyEnv
            )
        );
    }
}
