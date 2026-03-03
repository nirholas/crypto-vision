// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Address} from "@openzeppelin/contracts/utils/Address.sol";

/// @title SweepBatchSwap
/// @author Sweep Team
/// @notice Batch multiple ERC20 token swaps into a single transaction
/// @dev Supports 1inch, Uniswap, 0x, and generic DEX calldata
contract SweepBatchSwap is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;
    using Address for address;

    // ============================================================
    // CONSTANTS
    // ============================================================

    /// @notice Native ETH address placeholder
    address public constant ETH_ADDRESS = 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE;

    /// @notice Maximum basis points (100%)
    uint256 public constant MAX_BPS = 10_000;

    /// @notice Maximum fee (5%)
    uint256 public constant MAX_FEE_BPS = 500;

    // ============================================================
    // STATE VARIABLES
    // ============================================================

    /// @notice Protocol fee in basis points
    uint256 public feeBps;

    /// @notice Fee collector address
    address public feeCollector;

    /// @notice Approved DEX routers
    mapping(address => bool) public approvedRouters;

    /// @notice Paused state
    bool public paused;

    // ============================================================
    // STRUCTS
    // ============================================================

    /// @notice Single swap parameters
    struct SwapParams {
        address tokenIn;
        address tokenOut;
        uint256 amountIn;
        uint256 minAmountOut;
        address router;
        bytes routerData;
    }

    /// @notice Batch swap parameters
    struct BatchSwapParams {
        SwapParams[] swaps;
        address outputToken;
        address recipient;
        uint256 deadline;
    }

    // ============================================================
    // EVENTS
    // ============================================================

    event SwapExecuted(
        address indexed user,
        address indexed tokenIn,
        address indexed tokenOut,
        uint256 amountIn,
        uint256 amountOut,
        address router
    );

    event BatchSwapExecuted(
        address indexed user,
        uint256 swapCount,
        address outputToken,
        uint256 totalOutput,
        uint256 feeAmount
    );

    event RouterApproved(address indexed router, bool approved);
    event FeeUpdated(uint256 oldFee, uint256 newFee);
    event FeeCollectorUpdated(address indexed oldCollector, address indexed newCollector);
    event TokensRescued(address indexed token, address indexed to, uint256 amount);
    event Paused(bool isPaused);

    // ============================================================
    // ERRORS
    // ============================================================

    error InvalidRouter();
    error RouterNotApproved();
    error SwapFailed();
    error InsufficientOutput();
    error DeadlineExpired();
    error InvalidParams();
    error ContractPaused();
    error FeeTooHigh();
    error ZeroAddress();
    error ZeroAmount();
    error TransferFailed();

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

    constructor(address _feeCollector, uint256 _feeBps) Ownable(msg.sender) {
        if (_feeCollector == address(0)) revert ZeroAddress();
        if (_feeBps > MAX_FEE_BPS) revert FeeTooHigh();

        feeCollector = _feeCollector;
        feeBps = _feeBps;
    }

    // ============================================================
    // EXTERNAL FUNCTIONS
    // ============================================================

    /// @notice Execute a batch of swaps
    /// @param params Batch swap parameters
    /// @return totalOutput Total amount of output token received
    function batchSwap(BatchSwapParams calldata params)
        external
        payable
        nonReentrant
        whenNotPaused
        validDeadline(params.deadline)
        returns (uint256 totalOutput)
    {
        if (params.swaps.length == 0) revert InvalidParams();
        if (params.recipient == address(0)) revert ZeroAddress();

        uint256 swapCount = params.swaps.length;

        // Execute each swap
        for (uint256 i = 0; i < swapCount;) {
            SwapParams calldata swap = params.swaps[i];
            
            uint256 amountOut = _executeSwap(swap);
            
            emit SwapExecuted(
                msg.sender,
                swap.tokenIn,
                swap.tokenOut,
                swap.amountIn,
                amountOut,
                swap.router
            );

            unchecked {
                ++i;
            }
        }

        // Calculate total output
        totalOutput = _getBalance(params.outputToken);

        // Take fee
        uint256 feeAmount = 0;
        if (feeBps > 0 && totalOutput > 0) {
            feeAmount = (totalOutput * feeBps) / MAX_BPS;
            totalOutput -= feeAmount;
            _transfer(params.outputToken, feeCollector, feeAmount);
        }

        // Transfer output to recipient
        if (totalOutput > 0) {
            _transfer(params.outputToken, params.recipient, totalOutput);
        }

        emit BatchSwapExecuted(msg.sender, swapCount, params.outputToken, totalOutput, feeAmount);
    }

    /// @notice Execute a single swap
    /// @param swap Swap parameters
    /// @return amountOut Amount of output token received
    function singleSwap(SwapParams calldata swap)
        external
        payable
        nonReentrant
        whenNotPaused
        returns (uint256 amountOut)
    {
        amountOut = _executeSwap(swap);

        // Take fee
        uint256 feeAmount = 0;
        if (feeBps > 0 && amountOut > 0) {
            feeAmount = (amountOut * feeBps) / MAX_BPS;
            amountOut -= feeAmount;
            _transfer(swap.tokenOut, feeCollector, feeAmount);
        }

        // Transfer to sender
        _transfer(swap.tokenOut, msg.sender, amountOut);

        emit SwapExecuted(msg.sender, swap.tokenIn, swap.tokenOut, swap.amountIn, amountOut, swap.router);
    }

    // ============================================================
    // INTERNAL FUNCTIONS
    // ============================================================

    /// @notice Execute a single swap internally
    /// @param swap Swap parameters
    /// @return amountOut Amount received
    function _executeSwap(SwapParams calldata swap) internal returns (uint256 amountOut) {
        if (!approvedRouters[swap.router]) revert RouterNotApproved();
        if (swap.amountIn == 0) revert ZeroAmount();

        uint256 balanceBefore = _getBalance(swap.tokenOut);

        // Handle token input
        if (swap.tokenIn == ETH_ADDRESS) {
            // ETH swap - value should be sent with tx
        } else {
            // ERC20 swap - transfer tokens from user
            IERC20(swap.tokenIn).safeTransferFrom(msg.sender, address(this), swap.amountIn);
            
            // Approve router if needed
            _approveIfNeeded(swap.tokenIn, swap.router, swap.amountIn);
        }

        // Execute swap on router
        uint256 value = swap.tokenIn == ETH_ADDRESS ? swap.amountIn : 0;
        
        // Execute the swap call
        (bool success,) = swap.router.call{value: value}(swap.routerData);
        
        if (!success) revert SwapFailed();

        // Calculate amount out
        uint256 balanceAfter = _getBalance(swap.tokenOut);
        amountOut = balanceAfter - balanceBefore;

        if (amountOut < swap.minAmountOut) revert InsufficientOutput();
    }

    /// @notice Approve token for router if needed
    /// @param token Token address
    /// @param spender Spender address
    /// @param amount Amount to approve
    function _approveIfNeeded(address token, address spender, uint256 amount) internal {
        uint256 currentAllowance = IERC20(token).allowance(address(this), spender);
        if (currentAllowance < amount) {
            // Reset allowance first (for tokens like USDT)
            if (currentAllowance > 0) {
                IERC20(token).forceApprove(spender, 0);
            }
            IERC20(token).forceApprove(spender, type(uint256).max);
        }
    }

    /// @notice Get balance of token or ETH
    /// @param token Token address (ETH_ADDRESS for native)
    /// @return balance Current balance
    function _getBalance(address token) internal view returns (uint256 balance) {
        if (token == ETH_ADDRESS) {
            balance = address(this).balance;
        } else {
            balance = IERC20(token).balanceOf(address(this));
        }
    }

    /// @notice Transfer token or ETH
    /// @param token Token address (ETH_ADDRESS for native)
    /// @param to Recipient
    /// @param amount Amount to transfer
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

    /// @notice Approve or revoke a router
    /// @param router Router address
    /// @param approved Approval status
    function setRouterApproval(address router, bool approved) external onlyOwner {
        if (router == address(0)) revert ZeroAddress();
        approvedRouters[router] = approved;
        emit RouterApproved(router, approved);
    }

    /// @notice Batch approve routers
    /// @param routers Array of router addresses
    /// @param approved Approval status
    function setRouterApprovalBatch(address[] calldata routers, bool approved) external onlyOwner {
        for (uint256 i = 0; i < routers.length;) {
            if (routers[i] == address(0)) revert ZeroAddress();
            approvedRouters[routers[i]] = approved;
            emit RouterApproved(routers[i], approved);
            unchecked {
                ++i;
            }
        }
    }

    /// @notice Update protocol fee
    /// @param newFeeBps New fee in basis points
    function setFee(uint256 newFeeBps) external onlyOwner {
        if (newFeeBps > MAX_FEE_BPS) revert FeeTooHigh();
        uint256 oldFee = feeBps;
        feeBps = newFeeBps;
        emit FeeUpdated(oldFee, newFeeBps);
    }

    /// @notice Update fee collector
    /// @param newFeeCollector New fee collector address
    function setFeeCollector(address newFeeCollector) external onlyOwner {
        if (newFeeCollector == address(0)) revert ZeroAddress();
        address oldCollector = feeCollector;
        feeCollector = newFeeCollector;
        emit FeeCollectorUpdated(oldCollector, newFeeCollector);
    }

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
        emit TokensRescued(token, to, amount);
    }

    // ============================================================
    // VIEW FUNCTIONS
    // ============================================================

    /// @notice Check if a router is approved
    /// @param router Router address
    /// @return approved Approval status
    function isRouterApproved(address router) external view returns (bool) {
        return approvedRouters[router];
    }

    /// @notice Calculate fee for an amount
    /// @param amount Input amount
    /// @return fee Fee amount
    function calculateFee(uint256 amount) external view returns (uint256 fee) {
        return (amount * feeBps) / MAX_BPS;
    }

    // ============================================================
    // RECEIVE FUNCTION
    // ============================================================

    /// @notice Receive ETH
    receive() external payable {}
}
