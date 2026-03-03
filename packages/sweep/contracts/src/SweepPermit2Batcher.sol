// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Permit.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IPermit2} from "./interfaces/IPermit2.sol";
import {SweepBatchSwap} from "./SweepBatchSwap.sol";

/// @title SweepPermit2Batcher
/// @author Sweep Team
/// @notice Batch Permit2 transfers and swaps with a single signature
/// @dev Integrates with SweepBatchSwap for executing swaps after transfers
contract SweepPermit2Batcher is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ============================================================
    // CONSTANTS
    // ============================================================

    /// @notice Canonical Permit2 deployment address (same on all chains)
    address public constant PERMIT2 = 0x000000000022D473030F116dDEE9F6B43aC78BA3;

    /// @notice EIP-712 domain separator name
    string public constant WITNESS_TYPE_STRING =
        "SweepBatchWitness witness)SweepBatchWitness(address outputToken,uint256 minTotalOutput,uint256 deadline,bytes32 swapsHash)TokenPermissions(address token,uint256 amount)";

    bytes32 public constant WITNESS_TYPEHASH =
        keccak256("SweepBatchWitness(address outputToken,uint256 minTotalOutput,uint256 deadline,bytes32 swapsHash)");

    // ============================================================
    // STATE VARIABLES
    // ============================================================

    /// @notice SweepBatchSwap contract
    SweepBatchSwap public immutable batchSwap;

    /// @notice Permit2 contract interface
    IPermit2 public immutable permit2;

    /// @notice Nonces for replay protection (user => nonce)
    mapping(address => uint256) public nonces;

    // ============================================================
    // STRUCTS
    // ============================================================

    /// @notice Token transfer details for batch permit
    struct TokenTransfer {
        address token;
        uint256 amount;
    }

    /// @notice Witness data included in permit signature
    struct SweepBatchWitness {
        address outputToken;
        uint256 minTotalOutput;
        uint256 deadline;
        bytes32 swapsHash; // keccak256 of encoded swap params
    }

    /// @notice Full batch execution params
    struct BatchExecuteParams {
        // Permit2 data
        IPermit2.PermitBatchTransferFrom permit;
        bytes signature;
        // Swap data
        SweepBatchSwap.SwapParams[] swaps;
        // Output params
        address outputToken;
        uint256 minTotalOutput;
        address recipient;
        uint256 deadline;
    }

    /// @notice ERC-2612 permit data for fallback
    struct ERC2612Permit {
        address token;
        uint256 amount;
        uint256 deadline;
        uint8 v;
        bytes32 r;
        bytes32 s;
    }

    // ============================================================
    // EVENTS
    // ============================================================

    event BatchExecuted(
        address indexed user,
        uint256 tokenCount,
        address outputToken,
        uint256 totalOutput,
        uint256 nonce
    );

    event Permit2TransferExecuted(
        address indexed user,
        address indexed token,
        uint256 amount
    );

    event ERC2612PermitExecuted(
        address indexed user,
        address indexed token,
        uint256 amount
    );

    // ============================================================
    // ERRORS
    // ============================================================

    error InvalidPermit2Address();
    error InvalidBatchSwapAddress();
    error DeadlineExpired();
    error InvalidSignature();
    error InsufficientOutput();
    error ZeroAddress();
    error ZeroAmount();
    error LengthMismatch();
    error TransferFailed();
    error PermitFailed();
    error InvalidNonce();

    // ============================================================
    // CONSTRUCTOR
    // ============================================================

    constructor(address _batchSwap) Ownable(msg.sender) {
        if (_batchSwap == address(0)) revert InvalidBatchSwapAddress();
        
        batchSwap = SweepBatchSwap(payable(_batchSwap));
        permit2 = IPermit2(PERMIT2);
    }

    // ============================================================
    // EXTERNAL FUNCTIONS
    // ============================================================

    /// @notice Execute batch transfers and swaps using Permit2
    /// @param params Batch execution parameters
    /// @return totalOutput Total output token received
    function executeBatchWithPermit2(BatchExecuteParams calldata params)
        external
        nonReentrant
        returns (uint256 totalOutput)
    {
        if (block.timestamp > params.deadline) revert DeadlineExpired();
        if (params.recipient == address(0)) revert ZeroAddress();
        if (params.swaps.length == 0) revert LengthMismatch();

        // Verify swaps hash matches witness
        bytes32 swapsHash = keccak256(abi.encode(params.swaps));
        
        // Build witness
        SweepBatchWitness memory witness = SweepBatchWitness({
            outputToken: params.outputToken,
            minTotalOutput: params.minTotalOutput,
            deadline: params.deadline,
            swapsHash: swapsHash
        });

        // Build transfer details
        uint256 tokenCount = params.permit.permitted.length;
        IPermit2.SignatureTransferDetails[] memory transferDetails = 
            new IPermit2.SignatureTransferDetails[](tokenCount);
        
        for (uint256 i = 0; i < tokenCount;) {
            transferDetails[i] = IPermit2.SignatureTransferDetails({
                to: address(this),
                requestedAmount: params.permit.permitted[i].amount
            });
            unchecked { ++i; }
        }

        // Execute Permit2 batch transfer with witness
        permit2.permitWitnessTransferFrom(
            params.permit,
            transferDetails,
            msg.sender,
            keccak256(abi.encode(WITNESS_TYPEHASH, witness)),
            WITNESS_TYPE_STRING,
            params.signature
        );

        // Emit transfer events
        for (uint256 i = 0; i < tokenCount;) {
            emit Permit2TransferExecuted(
                msg.sender,
                params.permit.permitted[i].token,
                params.permit.permitted[i].amount
            );
            unchecked { ++i; }
        }

        // Execute swaps
        totalOutput = _executeSwaps(params.swaps, params.outputToken, params.recipient, params.deadline);

        if (totalOutput < params.minTotalOutput) revert InsufficientOutput();

        // Increment nonce
        uint256 nonce = nonces[msg.sender]++;

        emit BatchExecuted(msg.sender, tokenCount, params.outputToken, totalOutput, nonce);
    }

    /// @notice Execute batch transfers using ERC-2612 permits as fallback
    /// @param permits Array of ERC-2612 permit data
    /// @param swaps Array of swap parameters
    /// @param outputToken Output token address
    /// @param minTotalOutput Minimum total output
    /// @param recipient Recipient address
    /// @param deadline Deadline timestamp
    /// @return totalOutput Total output token received
    function executeBatchWithERC2612(
        ERC2612Permit[] calldata permits,
        SweepBatchSwap.SwapParams[] calldata swaps,
        address outputToken,
        uint256 minTotalOutput,
        address recipient,
        uint256 deadline
    ) external nonReentrant returns (uint256 totalOutput) {
        if (block.timestamp > deadline) revert DeadlineExpired();
        if (recipient == address(0)) revert ZeroAddress();
        if (permits.length == 0 || swaps.length == 0) revert LengthMismatch();

        // Execute permits and transfers
        for (uint256 i = 0; i < permits.length;) {
            ERC2612Permit calldata p = permits[i];
            
            // Execute permit
            try IERC20Permit(p.token).permit(
                msg.sender,
                address(this),
                p.amount,
                p.deadline,
                p.v,
                p.r,
                p.s
            ) {
                emit ERC2612PermitExecuted(msg.sender, p.token, p.amount);
            } catch {
                // Permit may have already been used, try transfer anyway
            }

            // Transfer tokens
            IERC20(p.token).safeTransferFrom(msg.sender, address(this), p.amount);

            unchecked { ++i; }
        }

        // Execute swaps
        totalOutput = _executeSwaps(swaps, outputToken, recipient, deadline);

        if (totalOutput < minTotalOutput) revert InsufficientOutput();

        // Increment nonce
        uint256 nonce = nonces[msg.sender]++;

        emit BatchExecuted(msg.sender, permits.length, outputToken, totalOutput, nonce);
    }

    /// @notice Execute swaps only (tokens already transferred)
    /// @param swaps Array of swap parameters
    /// @param outputToken Output token address
    /// @param minTotalOutput Minimum total output
    /// @param recipient Recipient address
    /// @param deadline Deadline timestamp
    /// @return totalOutput Total output received
    function executeSwapsOnly(
        SweepBatchSwap.SwapParams[] calldata swaps,
        address outputToken,
        uint256 minTotalOutput,
        address recipient,
        uint256 deadline
    ) external nonReentrant returns (uint256 totalOutput) {
        if (block.timestamp > deadline) revert DeadlineExpired();
        if (recipient == address(0)) revert ZeroAddress();

        totalOutput = _executeSwaps(swaps, outputToken, recipient, deadline);

        if (totalOutput < minTotalOutput) revert InsufficientOutput();
    }

    // ============================================================
    // INTERNAL FUNCTIONS
    // ============================================================

    /// @notice Execute swaps through SweepBatchSwap
    /// @param swaps Array of swap parameters
    /// @param outputToken Output token address
    /// @param recipient Recipient address
    /// @param deadline Deadline timestamp
    /// @return totalOutput Total output received
    function _executeSwaps(
        SweepBatchSwap.SwapParams[] calldata swaps,
        address outputToken,
        address recipient,
        uint256 deadline
    ) internal returns (uint256 totalOutput) {
        // Approve tokens for batch swap
        for (uint256 i = 0; i < swaps.length;) {
            if (swaps[i].tokenIn != SweepBatchSwap(payable(address(batchSwap))).ETH_ADDRESS()) {
                uint256 balance = IERC20(swaps[i].tokenIn).balanceOf(address(this));
                if (balance > 0) {
                    IERC20(swaps[i].tokenIn).forceApprove(address(batchSwap), balance);
                }
            }
            unchecked { ++i; }
        }

        // Build batch swap params
        SweepBatchSwap.BatchSwapParams memory batchParams = SweepBatchSwap.BatchSwapParams({
            swaps: swaps,
            outputToken: outputToken,
            recipient: recipient,
            deadline: deadline
        });

        // Execute batch swap
        totalOutput = batchSwap.batchSwap(batchParams);
    }

    // ============================================================
    // VIEW FUNCTIONS
    // ============================================================

    /// @notice Get current nonce for a user
    /// @param user User address
    /// @return Current nonce
    function getNonce(address user) external view returns (uint256) {
        return nonces[user];
    }

    /// @notice Build witness hash for signing
    /// @param outputToken Output token address
    /// @param minTotalOutput Minimum total output
    /// @param deadline Deadline timestamp
    /// @param swaps Array of swap parameters
    /// @return witnessHash Hash of witness data
    function buildWitnessHash(
        address outputToken,
        uint256 minTotalOutput,
        uint256 deadline,
        SweepBatchSwap.SwapParams[] calldata swaps
    ) external pure returns (bytes32) {
        bytes32 swapsHash = keccak256(abi.encode(swaps));
        
        return keccak256(abi.encode(
            WITNESS_TYPEHASH,
            outputToken,
            minTotalOutput,
            deadline,
            swapsHash
        ));
    }

    /// @notice Get the Permit2 domain separator
    /// @return Domain separator bytes32
    function DOMAIN_SEPARATOR() external view returns (bytes32) {
        return permit2.DOMAIN_SEPARATOR();
    }

    // ============================================================
    // ADMIN FUNCTIONS
    // ============================================================

    /// @notice Rescue stuck tokens
    /// @param token Token address
    /// @param to Recipient
    /// @param amount Amount to rescue
    function rescueTokens(address token, address to, uint256 amount) external onlyOwner {
        if (to == address(0)) revert ZeroAddress();
        IERC20(token).safeTransfer(to, amount);
    }

    /// @notice Rescue stuck ETH
    /// @param to Recipient
    /// @param amount Amount to rescue
    function rescueETH(address to, uint256 amount) external onlyOwner {
        if (to == address(0)) revert ZeroAddress();
        (bool success,) = to.call{value: amount}("");
        if (!success) revert TransferFailed();
    }

    // ============================================================
    // RECEIVE FUNCTION
    // ============================================================

    receive() external payable {}
}
