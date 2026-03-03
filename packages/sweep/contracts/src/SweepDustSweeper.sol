// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Permit.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IPermit2} from "./interfaces/IPermit2.sol";
import {SweepBatchSwap} from "./SweepBatchSwap.sol";
import {SweepVaultRouter} from "./SweepVaultRouter.sol";
import {SweepFeeCollector} from "./SweepFeeCollector.sol";

/// @title SweepDustSweeper
/// @author Sweep Team
/// @notice Main entry point for dust sweeping: Permit2 approvals → Swaps → DeFi routing → Fee collection
/// @dev Combines all Sweep contracts into a single transaction
contract SweepDustSweeper is Ownable2Step, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ============================================================
    // CONSTANTS
    // ============================================================

    /// @notice Native ETH address placeholder
    address public constant ETH_ADDRESS = 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE;

    /// @notice Canonical Permit2 deployment address
    address public constant PERMIT2 = 0x000000000022D473030F116dDEE9F6B43aC78BA3;

    /// @notice Maximum basis points
    uint256 public constant MAX_BPS = 10_000;

    /// @notice EIP-712 type strings for Permit2 witness
    string public constant WITNESS_TYPE_STRING =
        "SweepWitness witness)SweepWitness(address outputToken,uint256 minOutput,address vaultDestination,uint256 deadline,bytes32 swapsHash)TokenPermissions(address token,uint256 amount)";

    bytes32 public constant WITNESS_TYPEHASH =
        keccak256("SweepWitness(address outputToken,uint256 minOutput,address vaultDestination,uint256 deadline,bytes32 swapsHash)");

    // ============================================================
    // ENUMS
    // ============================================================

    /// @notice Destination for swept tokens
    enum SweepDestination {
        WALLET,     // Send to user's wallet
        AAVE,       // Deposit to Aave V3
        YEARN,      // Deposit to Yearn vault
        BEEFY,      // Deposit to Beefy vault
        LIDO        // Stake to Lido
    }

    // ============================================================
    // STATE VARIABLES
    // ============================================================

    /// @notice SweepBatchSwap contract
    SweepBatchSwap public immutable batchSwap;

    /// @notice SweepVaultRouter contract
    SweepVaultRouter public immutable vaultRouter;

    /// @notice SweepFeeCollector contract
    SweepFeeCollector public immutable feeCollector;

    /// @notice Permit2 interface
    IPermit2 public immutable permit2;

    /// @notice User nonces for replay protection
    mapping(address => uint256) public nonces;

    /// @notice Paused state
    bool public paused;

    // ============================================================
    // STRUCTS
    // ============================================================

    /// @notice Witness data for Permit2 signature
    struct SweepWitness {
        address outputToken;
        uint256 minOutput;
        address vaultDestination;
        uint256 deadline;
        bytes32 swapsHash;
    }

    /// @notice Full sweep parameters
    struct SweepParams {
        // Permit2 data
        IPermit2.PermitBatchTransferFrom permit;
        bytes signature;
        // Swap data
        SweepBatchSwap.SwapParams[] swaps;
        // Output configuration
        address outputToken;
        uint256 minTotalOutput;
        // Destination
        SweepDestination destination;
        address vaultAddress;       // Required if destination != WALLET
        uint256 minVaultSharesOut;  // Minimum shares from vault deposit
        // Recipient
        address recipient;
        uint256 deadline;
    }

    /// @notice Simplified sweep params without Permit2 (tokens already approved)
    struct SimpleSweepParams {
        address[] tokensIn;
        uint256[] amountsIn;
        SweepBatchSwap.SwapParams[] swaps;
        address outputToken;
        uint256 minTotalOutput;
        SweepDestination destination;
        address vaultAddress;
        uint256 minVaultSharesOut;
        address recipient;
        uint256 deadline;
    }

    /// @notice ERC-2612 permit data
    struct ERC2612Permit {
        address token;
        uint256 amount;
        uint256 deadline;
        uint8 v;
        bytes32 r;
        bytes32 s;
    }

    /// @notice Sweep with ERC-2612 permits
    struct ERC2612SweepParams {
        ERC2612Permit[] permits;
        SweepBatchSwap.SwapParams[] swaps;
        address outputToken;
        uint256 minTotalOutput;
        SweepDestination destination;
        address vaultAddress;
        uint256 minVaultSharesOut;
        address recipient;
        uint256 deadline;
    }

    /// @notice Sweep result
    struct SweepResult {
        uint256 totalSwapOutput;
        uint256 feeAmount;
        uint256 netOutput;
        uint256 vaultShares;
    }

    // ============================================================
    // EVENTS
    // ============================================================

    event DustSwept(
        address indexed user,
        uint256 tokenCount,
        address outputToken,
        uint256 totalOutput,
        uint256 feeAmount,
        SweepDestination destination,
        address vaultAddress,
        uint256 vaultShares
    );

    event SwapExecuted(
        address indexed user,
        address indexed tokenIn,
        address indexed tokenOut,
        uint256 amountIn,
        uint256 amountOut
    );

    event VaultDeposited(
        address indexed user,
        address indexed vault,
        uint256 amountIn,
        uint256 sharesOut
    );

    event PartialSwapFailed(
        address indexed user,
        address indexed tokenIn,
        uint256 amountIn,
        string reason
    );

    event Paused(bool isPaused);

    // ============================================================
    // ERRORS
    // ============================================================

    error ZeroAddress();
    error ZeroAmount();
    error DeadlineExpired();
    error InsufficientOutput();
    error InsufficientVaultShares();
    error ContractPaused();
    error InvalidDestination();
    error VaultRequired();
    error LengthMismatch();
    error TransferFailed();
    error AllSwapsFailed();
    error InvalidSignature();

    // ============================================================
    // MODIFIERS
    // ============================================================

    modifier whenNotPaused() {
        if (paused) revert ContractPaused();
        _;
    }

    modifier validDeadline(uint256 deadline) {
        if (block.timestamp > deadline) revert DeadlineExpired();
        _;
    }

    // ============================================================
    // CONSTRUCTOR
    // ============================================================

    /// @notice Initialize the dust sweeper
    /// @param _batchSwap SweepBatchSwap contract address
    /// @param _vaultRouter SweepVaultRouter contract address
    /// @param _feeCollector SweepFeeCollector contract address
    constructor(
        address _batchSwap,
        address _vaultRouter,
        address _feeCollector
    ) Ownable(msg.sender) {
        if (_batchSwap == address(0)) revert ZeroAddress();
        if (_vaultRouter == address(0)) revert ZeroAddress();
        if (_feeCollector == address(0)) revert ZeroAddress();

        batchSwap = SweepBatchSwap(payable(_batchSwap));
        vaultRouter = SweepVaultRouter(payable(_vaultRouter));
        feeCollector = SweepFeeCollector(payable(_feeCollector));
        permit2 = IPermit2(PERMIT2);
    }

    // ============================================================
    // MAIN SWEEP FUNCTIONS
    // ============================================================

    /// @notice Execute full dust sweep with Permit2 signatures
    /// @param params Sweep parameters
    /// @return result Sweep result with amounts
    function sweepWithPermit2(SweepParams calldata params)
        external
        nonReentrant
        whenNotPaused
        validDeadline(params.deadline)
        returns (SweepResult memory result)
    {
        if (params.recipient == address(0)) revert ZeroAddress();
        if (params.swaps.length == 0) revert LengthMismatch();

        // Validate destination
        _validateDestination(params.destination, params.vaultAddress);

        // Build and verify witness
        bytes32 swapsHash = keccak256(abi.encode(params.swaps));
        SweepWitness memory witness = SweepWitness({
            outputToken: params.outputToken,
            minOutput: params.minTotalOutput,
            vaultDestination: params.vaultAddress,
            deadline: params.deadline,
            swapsHash: swapsHash
        });

        // Execute Permit2 transfers
        _executePermit2Transfers(params.permit, params.signature, witness);

        // Execute swaps
        result = _executeSweep(
            params.swaps,
            params.outputToken,
            params.minTotalOutput,
            params.destination,
            params.vaultAddress,
            params.minVaultSharesOut,
            params.recipient
        );

        // Increment nonce
        nonces[msg.sender]++;

        emit DustSwept(
            msg.sender,
            params.permit.permitted.length,
            params.outputToken,
            result.totalSwapOutput,
            result.feeAmount,
            params.destination,
            params.vaultAddress,
            result.vaultShares
        );
    }

    /// @notice Execute dust sweep with tokens already approved
    /// @param params Simple sweep parameters
    /// @return result Sweep result with amounts
    function sweep(SimpleSweepParams calldata params)
        external
        payable
        nonReentrant
        whenNotPaused
        validDeadline(params.deadline)
        returns (SweepResult memory result)
    {
        if (params.recipient == address(0)) revert ZeroAddress();
        if (params.swaps.length == 0) revert LengthMismatch();
        if (params.tokensIn.length != params.amountsIn.length) revert LengthMismatch();

        // Validate destination
        _validateDestination(params.destination, params.vaultAddress);

        // Transfer tokens from user
        for (uint256 i = 0; i < params.tokensIn.length;) {
            if (params.tokensIn[i] != ETH_ADDRESS && params.amountsIn[i] > 0) {
                IERC20(params.tokensIn[i]).safeTransferFrom(
                    msg.sender,
                    address(this),
                    params.amountsIn[i]
                );
            }
            unchecked { ++i; }
        }

        // Execute swaps
        result = _executeSweep(
            params.swaps,
            params.outputToken,
            params.minTotalOutput,
            params.destination,
            params.vaultAddress,
            params.minVaultSharesOut,
            params.recipient
        );

        emit DustSwept(
            msg.sender,
            params.tokensIn.length,
            params.outputToken,
            result.totalSwapOutput,
            result.feeAmount,
            params.destination,
            params.vaultAddress,
            result.vaultShares
        );
    }

    /// @notice Execute dust sweep with ERC-2612 permits
    /// @param params ERC-2612 sweep parameters
    /// @return result Sweep result with amounts
    function sweepWithERC2612(ERC2612SweepParams calldata params)
        external
        nonReentrant
        whenNotPaused
        validDeadline(params.deadline)
        returns (SweepResult memory result)
    {
        if (params.recipient == address(0)) revert ZeroAddress();
        if (params.permits.length == 0 || params.swaps.length == 0) revert LengthMismatch();

        // Validate destination
        _validateDestination(params.destination, params.vaultAddress);

        // Execute permits and transfers
        for (uint256 i = 0; i < params.permits.length;) {
            ERC2612Permit calldata p = params.permits[i];

            // Execute permit
            try IERC20Permit(p.token).permit(
                msg.sender,
                address(this),
                p.amount,
                p.deadline,
                p.v,
                p.r,
                p.s
            ) {} catch {
                // Permit may have already been used, continue
            }

            // Transfer tokens
            IERC20(p.token).safeTransferFrom(msg.sender, address(this), p.amount);

            unchecked { ++i; }
        }

        // Execute swaps
        result = _executeSweep(
            params.swaps,
            params.outputToken,
            params.minTotalOutput,
            params.destination,
            params.vaultAddress,
            params.minVaultSharesOut,
            params.recipient
        );

        emit DustSwept(
            msg.sender,
            params.permits.length,
            params.outputToken,
            result.totalSwapOutput,
            result.feeAmount,
            params.destination,
            params.vaultAddress,
            result.vaultShares
        );
    }

    // ============================================================
    // INTERNAL FUNCTIONS
    // ============================================================

    /// @notice Validate destination configuration
    function _validateDestination(SweepDestination destination, address vaultAddress) internal pure {
        if (destination != SweepDestination.WALLET && vaultAddress == address(0)) {
            revert VaultRequired();
        }
    }

    /// @notice Execute Permit2 batch transfers with witness
    function _executePermit2Transfers(
        IPermit2.PermitBatchTransferFrom calldata permit,
        bytes calldata signature,
        SweepWitness memory witness
    ) internal {
        uint256 tokenCount = permit.permitted.length;
        IPermit2.SignatureTransferDetails[] memory transferDetails =
            new IPermit2.SignatureTransferDetails[](tokenCount);

        for (uint256 i = 0; i < tokenCount;) {
            transferDetails[i] = IPermit2.SignatureTransferDetails({
                to: address(this),
                requestedAmount: permit.permitted[i].amount
            });
            unchecked { ++i; }
        }

        permit2.permitWitnessTransferFrom(
            permit,
            transferDetails,
            msg.sender,
            keccak256(abi.encode(WITNESS_TYPEHASH, witness)),
            WITNESS_TYPE_STRING,
            signature
        );
    }

    /// @notice Execute the full sweep operation
    function _executeSweep(
        SweepBatchSwap.SwapParams[] calldata swaps,
        address outputToken,
        uint256 minTotalOutput,
        SweepDestination destination,
        address vaultAddress,
        uint256 minVaultSharesOut,
        address recipient
    ) internal returns (SweepResult memory result) {
        // Approve tokens for batch swap
        for (uint256 i = 0; i < swaps.length;) {
            if (swaps[i].tokenIn != ETH_ADDRESS) {
                uint256 balance = IERC20(swaps[i].tokenIn).balanceOf(address(this));
                if (balance > 0) {
                    IERC20(swaps[i].tokenIn).forceApprove(address(batchSwap), balance);
                }
            }
            unchecked { ++i; }
        }

        // Execute batch swap
        uint256 balanceBefore = _getBalance(outputToken);

        // Build batch swap params - output goes to this contract
        SweepBatchSwap.BatchSwapParams memory batchParams = SweepBatchSwap.BatchSwapParams({
            swaps: swaps,
            outputToken: outputToken,
            recipient: address(this),
            deadline: block.timestamp
        });

        result.totalSwapOutput = batchSwap.batchSwap(batchParams);

        // Calculate fee
        result.feeAmount = feeCollector.calculateFee(result.totalSwapOutput);
        result.netOutput = result.totalSwapOutput - result.feeAmount;

        if (result.netOutput < minTotalOutput) revert InsufficientOutput();

        // Send fee to collector
        if (result.feeAmount > 0) {
            if (outputToken == ETH_ADDRESS) {
                feeCollector.depositFee{value: result.feeAmount}(outputToken, result.feeAmount, msg.sender);
            } else {
                IERC20(outputToken).forceApprove(address(feeCollector), result.feeAmount);
                feeCollector.depositFee(outputToken, result.feeAmount, msg.sender);
            }
        }

        // Route output based on destination
        if (destination == SweepDestination.WALLET) {
            // Send directly to wallet
            _transfer(outputToken, recipient, result.netOutput);
        } else {
            // Deposit to vault
            result.vaultShares = _depositToVault(
                destination,
                vaultAddress,
                outputToken,
                result.netOutput,
                recipient
            );

            if (result.vaultShares < minVaultSharesOut) revert InsufficientVaultShares();

            emit VaultDeposited(msg.sender, vaultAddress, result.netOutput, result.vaultShares);
        }
    }

    /// @notice Deposit output to a DeFi vault
    function _depositToVault(
        SweepDestination destination,
        address vaultAddress,
        address token,
        uint256 amount,
        address recipient
    ) internal returns (uint256 sharesOut) {
        // Approve vault router
        if (token != ETH_ADDRESS) {
            IERC20(token).forceApprove(address(vaultRouter), amount);
        }

        // Determine vault type and deposit
        SweepVaultRouter.VaultType vaultType;

        if (destination == SweepDestination.AAVE) {
            vaultType = SweepVaultRouter.VaultType.AAVE_V3;
        } else if (destination == SweepDestination.YEARN) {
            vaultType = SweepVaultRouter.VaultType.YEARN_V3;
        } else if (destination == SweepDestination.BEEFY) {
            vaultType = SweepVaultRouter.VaultType.BEEFY;
        } else if (destination == SweepDestination.LIDO) {
            vaultType = SweepVaultRouter.VaultType.LIDO;
        } else {
            revert InvalidDestination();
        }

        // Build deposit params
        SweepVaultRouter.DepositParams memory depositParams = SweepVaultRouter.DepositParams({
            vault: vaultAddress,
            token: token,
            amount: amount,
            minSharesOut: 0, // We check this after
            recipient: recipient,
            deadline: block.timestamp
        });

        if (token == ETH_ADDRESS) {
            sharesOut = vaultRouter.deposit{value: amount}(depositParams);
        } else {
            sharesOut = vaultRouter.deposit(depositParams);
        }
    }

    /// @notice Get balance of token or ETH
    function _getBalance(address token) internal view returns (uint256 balance) {
        if (token == ETH_ADDRESS) {
            balance = address(this).balance;
        } else {
            balance = IERC20(token).balanceOf(address(this));
        }
    }

    /// @notice Transfer token or ETH
    function _transfer(address token, address to, uint256 amount) internal {
        if (amount == 0) return;

        if (token == ETH_ADDRESS) {
            (bool success,) = to.call{value: amount}("");
            if (!success) revert TransferFailed();
        } else {
            IERC20(token).safeTransfer(to, amount);
        }
    }

    // ============================================================
    // ADMIN FUNCTIONS
    // ============================================================

    /// @notice Pause/unpause the contract
    /// @param _paused New paused state
    function setPaused(bool _paused) external onlyOwner {
        paused = _paused;
        emit Paused(_paused);
    }

    /// @notice Rescue stuck tokens
    /// @param token Token address (ETH_ADDRESS for native)
    /// @param to Recipient
    /// @param amount Amount to rescue
    function rescueTokens(address token, address to, uint256 amount) external onlyOwner {
        if (to == address(0)) revert ZeroAddress();
        _transfer(token, to, amount);
    }

    // ============================================================
    // VIEW FUNCTIONS
    // ============================================================

    /// @notice Get user's nonce
    /// @param user User address
    /// @return Current nonce
    function getNonce(address user) external view returns (uint256) {
        return nonces[user];
    }

    /// @notice Build witness hash for signing
    /// @param outputToken Output token address
    /// @param minOutput Minimum output amount
    /// @param vaultDestination Vault address (0 for wallet)
    /// @param deadline Transaction deadline
    /// @param swaps Array of swap parameters
    /// @return witnessHash Hash of witness data
    function buildWitnessHash(
        address outputToken,
        uint256 minOutput,
        address vaultDestination,
        uint256 deadline,
        SweepBatchSwap.SwapParams[] calldata swaps
    ) external pure returns (bytes32) {
        bytes32 swapsHash = keccak256(abi.encode(swaps));

        return keccak256(abi.encode(
            WITNESS_TYPEHASH,
            outputToken,
            minOutput,
            vaultDestination,
            deadline,
            swapsHash
        ));
    }

    /// @notice Get Permit2 domain separator
    /// @return Domain separator bytes32
    function DOMAIN_SEPARATOR() external view returns (bytes32) {
        return permit2.DOMAIN_SEPARATOR();
    }

    /// @notice Preview sweep fee
    /// @param totalOutput Total swap output amount
    /// @return feeAmount Fee to be collected
    /// @return netOutput Net output after fee
    function previewSweepFee(uint256 totalOutput) external view returns (
        uint256 feeAmount,
        uint256 netOutput
    ) {
        feeAmount = feeCollector.calculateFee(totalOutput);
        netOutput = totalOutput - feeAmount;
    }

    /// @notice Check if contracts are properly configured
    /// @return isConfigured Whether all contracts are set up
    function isConfigured() external view returns (bool) {
        return address(batchSwap) != address(0) &&
               address(vaultRouter) != address(0) &&
               address(feeCollector) != address(0);
    }

    // ============================================================
    // RECEIVE FUNCTION
    // ============================================================

    /// @notice Receive ETH
    receive() external payable {}
}
