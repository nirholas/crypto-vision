// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {EnumerableSet} from "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";

/// @title SweepFeeCollector
/// @author Sweep Team
/// @notice Protocol fee management with configurable fees and treasury distribution
/// @dev Collects fees from swaps and distributes to treasury with admin controls
contract SweepFeeCollector is Ownable2Step, ReentrancyGuard {
    using SafeERC20 for IERC20;
    using EnumerableSet for EnumerableSet.AddressSet;

    // ============================================================
    // CONSTANTS
    // ============================================================

    /// @notice Native ETH address placeholder
    address public constant ETH_ADDRESS = 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE;

    /// @notice Maximum basis points (100%)
    uint256 public constant MAX_BPS = 10_000;

    /// @notice Maximum protocol fee (5%)
    uint256 public constant MAX_FEE_BPS = 500;

    /// @notice Default protocol fee (0.3%)
    uint256 public constant DEFAULT_FEE_BPS = 30;

    /// @notice Minimum withdrawal delay for security
    uint256 public constant MIN_WITHDRAWAL_DELAY = 1 hours;

    // ============================================================
    // STATE VARIABLES
    // ============================================================

    /// @notice Treasury address for fee distribution
    address public treasury;

    /// @notice Protocol fee in basis points
    uint256 public feeBps;

    /// @notice Fee discount for specific addresses (in basis points)
    mapping(address => uint256) public feeDiscounts;

    /// @notice Approved fee depositors (SweepBatchSwap, SweepDustSweeper, etc.)
    mapping(address => bool) public approvedDepositors;

    /// @notice Accumulated fees per token
    mapping(address => uint256) public accumulatedFees;

    /// @notice Total fees collected per token (historical)
    mapping(address => uint256) public totalFeesCollected;

    /// @notice Total fees withdrawn per token (historical)
    mapping(address => uint256) public totalFeesWithdrawn;

    /// @notice Withdrawal request timestamp (for time-delayed withdrawals)
    uint256 public withdrawalRequestTime;

    /// @notice Requested withdrawal amount per token
    mapping(address => uint256) public pendingWithdrawals;

    /// @notice Whether withdrawal delay is enabled
    bool public withdrawalDelayEnabled;

    /// @notice Set of tokens with accumulated fees
    EnumerableSet.AddressSet private _feeTokens;

    /// @notice Contract paused state
    bool public paused;

    // ============================================================
    // EVENTS
    // ============================================================

    event FeeDeposited(
        address indexed depositor,
        address indexed token,
        uint256 amount,
        address indexed user
    );

    event FeeWithdrawn(
        address indexed token,
        address indexed to,
        uint256 amount
    );

    event WithdrawalRequested(
        address indexed token,
        uint256 amount,
        uint256 executeTime
    );

    event TreasuryUpdated(address indexed oldTreasury, address indexed newTreasury);
    event FeeUpdated(uint256 oldFee, uint256 newFee);
    event FeeDiscountSet(address indexed account, uint256 discount);
    event DepositorApproved(address indexed depositor, bool approved);
    event WithdrawalDelayToggled(bool enabled);
    event Paused(bool isPaused);
    event EmergencyWithdraw(address indexed token, address indexed to, uint256 amount);

    // ============================================================
    // ERRORS
    // ============================================================

    error ZeroAddress();
    error ZeroAmount();
    error FeeTooHigh();
    error DiscountTooHigh();
    error NotApprovedDepositor();
    error ContractPaused();
    error WithdrawalPending();
    error WithdrawalNotReady();
    error NoWithdrawalPending();
    error InsufficientBalance();
    error TransferFailed();

    // ============================================================
    // MODIFIERS
    // ============================================================

    modifier whenNotPaused() {
        if (paused) revert ContractPaused();
        _;
    }

    modifier onlyApprovedDepositor() {
        if (!approvedDepositors[msg.sender]) revert NotApprovedDepositor();
        _;
    }

    // ============================================================
    // CONSTRUCTOR
    // ============================================================

    /// @notice Initialize the fee collector
    /// @param _treasury Treasury address for fee distribution
    /// @param _feeBps Initial protocol fee in basis points
    constructor(address _treasury, uint256 _feeBps) Ownable(msg.sender) {
        if (_treasury == address(0)) revert ZeroAddress();
        if (_feeBps > MAX_FEE_BPS) revert FeeTooHigh();

        treasury = _treasury;
        feeBps = _feeBps == 0 ? DEFAULT_FEE_BPS : _feeBps;
        withdrawalDelayEnabled = true;
    }

    // ============================================================
    // FEE DEPOSIT FUNCTIONS
    // ============================================================

    /// @notice Deposit fees from an approved depositor
    /// @param token Token address (ETH_ADDRESS for native)
    /// @param amount Amount of fees
    /// @param user User who paid the fee (for tracking)
    function depositFee(
        address token,
        uint256 amount,
        address user
    ) external payable whenNotPaused onlyApprovedDepositor {
        if (amount == 0) revert ZeroAmount();

        if (token == ETH_ADDRESS) {
            if (msg.value != amount) revert InsufficientBalance();
        } else {
            IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        }

        accumulatedFees[token] += amount;
        totalFeesCollected[token] += amount;
        _feeTokens.add(token);

        emit FeeDeposited(msg.sender, token, amount, user);
    }

    /// @notice Calculate fee for an amount with potential discount
    /// @param amount Input amount
    /// @param user User address for discount lookup
    /// @return fee Fee amount after discount
    function calculateFee(uint256 amount, address user) external view returns (uint256 fee) {
        uint256 discount = feeDiscounts[user];
        uint256 effectiveFee = feeBps > discount ? feeBps - discount : 0;
        return (amount * effectiveFee) / MAX_BPS;
    }

    /// @notice Calculate fee for an amount (no discount)
    /// @param amount Input amount
    /// @return fee Fee amount
    function calculateFee(uint256 amount) external view returns (uint256 fee) {
        return (amount * feeBps) / MAX_BPS;
    }

    // ============================================================
    // WITHDRAWAL FUNCTIONS
    // ============================================================

    /// @notice Request a withdrawal (starts time delay)
    /// @param token Token to withdraw
    /// @param amount Amount to withdraw
    function requestWithdrawal(address token, uint256 amount) external onlyOwner {
        if (amount == 0) revert ZeroAmount();
        if (amount > accumulatedFees[token]) revert InsufficientBalance();
        if (pendingWithdrawals[token] > 0) revert WithdrawalPending();

        pendingWithdrawals[token] = amount;
        withdrawalRequestTime = block.timestamp;

        emit WithdrawalRequested(token, amount, block.timestamp + MIN_WITHDRAWAL_DELAY);
    }

    /// @notice Execute a pending withdrawal after delay
    /// @param token Token to withdraw
    function executeWithdrawal(address token) external onlyOwner nonReentrant {
        uint256 amount = pendingWithdrawals[token];
        if (amount == 0) revert NoWithdrawalPending();

        if (withdrawalDelayEnabled) {
            if (block.timestamp < withdrawalRequestTime + MIN_WITHDRAWAL_DELAY) {
                revert WithdrawalNotReady();
            }
        }

        if (amount > accumulatedFees[token]) revert InsufficientBalance();

        pendingWithdrawals[token] = 0;
        accumulatedFees[token] -= amount;
        totalFeesWithdrawn[token] += amount;

        _transfer(token, treasury, amount);

        emit FeeWithdrawn(token, treasury, amount);
    }

    /// @notice Withdraw all accumulated fees for a token (with delay if enabled)
    /// @param token Token to withdraw
    function withdrawAllFees(address token) external onlyOwner nonReentrant {
        uint256 amount = accumulatedFees[token];
        if (amount == 0) revert ZeroAmount();

        if (withdrawalDelayEnabled) {
            // Must use request/execute flow
            revert WithdrawalNotReady();
        }

        accumulatedFees[token] = 0;
        totalFeesWithdrawn[token] += amount;

        _transfer(token, treasury, amount);

        emit FeeWithdrawn(token, treasury, amount);
    }

    /// @notice Cancel a pending withdrawal
    /// @param token Token for which to cancel withdrawal
    function cancelWithdrawal(address token) external onlyOwner {
        if (pendingWithdrawals[token] == 0) revert NoWithdrawalPending();
        pendingWithdrawals[token] = 0;
    }

    /// @notice Emergency withdraw all tokens (bypasses delay, only when paused)
    /// @param token Token to withdraw
    /// @param to Recipient address
    function emergencyWithdraw(address token, address to) external onlyOwner nonReentrant {
        if (!paused) revert ContractPaused();
        if (to == address(0)) revert ZeroAddress();

        uint256 amount;
        if (token == ETH_ADDRESS) {
            amount = address(this).balance;
        } else {
            amount = IERC20(token).balanceOf(address(this));
        }

        if (amount == 0) revert ZeroAmount();

        _transfer(token, to, amount);
        accumulatedFees[token] = 0;
        pendingWithdrawals[token] = 0;

        emit EmergencyWithdraw(token, to, amount);
    }

    // ============================================================
    // ADMIN FUNCTIONS
    // ============================================================

    /// @notice Update the treasury address
    /// @param newTreasury New treasury address
    function setTreasury(address newTreasury) external onlyOwner {
        if (newTreasury == address(0)) revert ZeroAddress();
        address oldTreasury = treasury;
        treasury = newTreasury;
        emit TreasuryUpdated(oldTreasury, newTreasury);
    }

    /// @notice Update the protocol fee
    /// @param newFeeBps New fee in basis points
    function setFee(uint256 newFeeBps) external onlyOwner {
        if (newFeeBps > MAX_FEE_BPS) revert FeeTooHigh();
        uint256 oldFee = feeBps;
        feeBps = newFeeBps;
        emit FeeUpdated(oldFee, newFeeBps);
    }

    /// @notice Set fee discount for an address
    /// @param account Address to set discount for
    /// @param discount Discount in basis points
    function setFeeDiscount(address account, uint256 discount) external onlyOwner {
        if (discount > feeBps) revert DiscountTooHigh();
        feeDiscounts[account] = discount;
        emit FeeDiscountSet(account, discount);
    }

    /// @notice Approve or revoke a depositor
    /// @param depositor Depositor address
    /// @param approved Approval status
    function setDepositorApproval(address depositor, bool approved) external onlyOwner {
        if (depositor == address(0)) revert ZeroAddress();
        approvedDepositors[depositor] = approved;
        emit DepositorApproved(depositor, approved);
    }

    /// @notice Toggle withdrawal delay
    /// @param enabled Whether delay is enabled
    function setWithdrawalDelayEnabled(bool enabled) external onlyOwner {
        withdrawalDelayEnabled = enabled;
        emit WithdrawalDelayToggled(enabled);
    }

    /// @notice Pause/unpause the contract
    /// @param _paused New paused state
    function setPaused(bool _paused) external onlyOwner {
        paused = _paused;
        emit Paused(_paused);
    }

    // ============================================================
    // VIEW FUNCTIONS
    // ============================================================

    /// @notice Get all tokens with accumulated fees
    /// @return tokens Array of token addresses
    function getFeeTokens() external view returns (address[] memory tokens) {
        return _feeTokens.values();
    }

    /// @notice Get accumulated fees for a token
    /// @param token Token address
    /// @return amount Accumulated fee amount
    function getAccumulatedFees(address token) external view returns (uint256 amount) {
        return accumulatedFees[token];
    }

    /// @notice Get fee statistics for a token
    /// @param token Token address
    /// @return collected Total collected
    /// @return withdrawn Total withdrawn
    /// @return pending Current pending
    function getFeeStats(address token) external view returns (
        uint256 collected,
        uint256 withdrawn,
        uint256 pending
    ) {
        return (
            totalFeesCollected[token],
            totalFeesWithdrawn[token],
            accumulatedFees[token]
        );
    }

    /// @notice Check if withdrawal is ready
    /// @param token Token to check
    /// @return ready Whether withdrawal can be executed
    /// @return timeRemaining Seconds until ready (0 if ready)
    function isWithdrawalReady(address token) external view returns (bool ready, uint256 timeRemaining) {
        if (pendingWithdrawals[token] == 0) {
            return (false, 0);
        }

        uint256 readyTime = withdrawalRequestTime + MIN_WITHDRAWAL_DELAY;
        if (block.timestamp >= readyTime) {
            return (true, 0);
        }

        return (false, readyTime - block.timestamp);
    }

    /// @notice Get effective fee for a user
    /// @param user User address
    /// @return effectiveFee Fee in basis points after discount
    function getEffectiveFee(address user) external view returns (uint256 effectiveFee) {
        uint256 discount = feeDiscounts[user];
        return feeBps > discount ? feeBps - discount : 0;
    }

    // ============================================================
    // INTERNAL FUNCTIONS
    // ============================================================

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
    // RECEIVE FUNCTION
    // ============================================================

    /// @notice Receive ETH
    receive() external payable {}
}
