// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";

/// @title SweepPausable
/// @author Sweep Team
/// @notice Enhanced pausable functionality with granular control
/// @dev Extends OpenZeppelin's pausable pattern with multi-level pause
abstract contract SweepPausable is Ownable2Step {
    // ============================================================
    // STATE VARIABLES
    // ============================================================

    /// @notice Global pause state
    bool public globalPaused;

    /// @notice Function-specific pause state
    mapping(bytes4 => bool) public functionPaused;

    /// @notice Guardian addresses that can pause (but not unpause)
    mapping(address => bool) public guardians;

    /// @notice Pause cooldown to prevent rapid toggling
    uint256 public lastPauseTimestamp;
    uint256 public constant PAUSE_COOLDOWN = 1 hours;

    // ============================================================
    // EVENTS
    // ============================================================

    event GlobalPaused(address indexed by);
    event GlobalUnpaused(address indexed by);
    event FunctionPaused(bytes4 indexed selector, address indexed by);
    event FunctionUnpaused(bytes4 indexed selector, address indexed by);
    event GuardianAdded(address indexed guardian);
    event GuardianRemoved(address indexed guardian);
    event EmergencyPause(address indexed by, string reason);

    // ============================================================
    // ERRORS
    // ============================================================

    error GlobalPausedError();
    error FunctionPausedError(bytes4 selector);
    error NotGuardianOrOwner();
    error OnlyOwnerCanUnpause();
    error PauseCooldownActive();

    // ============================================================
    // MODIFIERS
    // ============================================================

    /// @notice Check if globally paused
    modifier whenNotGlobalPaused() {
        if (globalPaused) revert GlobalPausedError();
        _;
    }

    /// @notice Check if specific function is paused
    modifier whenFunctionNotPaused(bytes4 selector) {
        if (globalPaused) revert GlobalPausedError();
        if (functionPaused[selector]) revert FunctionPausedError(selector);
        _;
    }

    /// @notice Only guardian or owner
    modifier onlyGuardianOrOwner() {
        if (!guardians[msg.sender] && msg.sender != owner()) {
            revert NotGuardianOrOwner();
        }
        _;
    }

    // ============================================================
    // PAUSE FUNCTIONS
    // ============================================================

    /// @notice Pause all functions globally
    /// @dev Can be called by owner or guardians
    function pauseGlobal() external onlyGuardianOrOwner {
        globalPaused = true;
        lastPauseTimestamp = block.timestamp;
        emit GlobalPaused(msg.sender);
    }

    /// @notice Unpause all functions globally
    /// @dev Can only be called by owner
    function unpauseGlobal() external onlyOwner {
        globalPaused = false;
        emit GlobalUnpaused(msg.sender);
    }

    /// @notice Pause a specific function
    /// @param selector Function selector to pause
    function pauseFunction(bytes4 selector) external onlyGuardianOrOwner {
        functionPaused[selector] = true;
        emit FunctionPaused(selector, msg.sender);
    }

    /// @notice Unpause a specific function
    /// @param selector Function selector to unpause
    function unpauseFunction(bytes4 selector) external onlyOwner {
        functionPaused[selector] = false;
        emit FunctionUnpaused(selector, msg.sender);
    }

    /// @notice Emergency pause with reason logging
    /// @param reason Reason for emergency pause
    function emergencyPause(string calldata reason) external onlyGuardianOrOwner {
        globalPaused = true;
        lastPauseTimestamp = block.timestamp;
        emit EmergencyPause(msg.sender, reason);
    }

    // ============================================================
    // GUARDIAN MANAGEMENT
    // ============================================================

    /// @notice Add a guardian
    /// @param guardian Address to add as guardian
    function addGuardian(address guardian) external onlyOwner {
        guardians[guardian] = true;
        emit GuardianAdded(guardian);
    }

    /// @notice Remove a guardian
    /// @param guardian Address to remove as guardian
    function removeGuardian(address guardian) external onlyOwner {
        guardians[guardian] = false;
        emit GuardianRemoved(guardian);
    }

    // ============================================================
    // VIEW FUNCTIONS
    // ============================================================

    /// @notice Check if a function is paused (global or specific)
    /// @param selector Function selector to check
    /// @return isPaused Whether the function is paused
    function isFunctionPaused(bytes4 selector) external view returns (bool isPaused) {
        return globalPaused || functionPaused[selector];
    }

    /// @notice Check if an address is a guardian
    /// @param account Address to check
    /// @return isGuardian Whether the address is a guardian
    function isGuardian(address account) external view returns (bool) {
        return guardians[account];
    }
}

/// @title SweepRateLimiter
/// @notice Rate limiting for sensitive operations
abstract contract SweepRateLimiter {
    // ============================================================
    // STATE VARIABLES
    // ============================================================

    /// @notice Rate limit per user (operations per period)
    uint256 public rateLimit;

    /// @notice Rate limit period in seconds
    uint256 public ratePeriod;

    /// @notice User operation counts
    mapping(address => uint256) public operationCount;

    /// @notice User period start timestamps
    mapping(address => uint256) public periodStart;

    // ============================================================
    // EVENTS
    // ============================================================

    event RateLimitUpdated(uint256 newLimit, uint256 newPeriod);
    event RateLimitExceeded(address indexed user, uint256 count, uint256 limit);

    // ============================================================
    // ERRORS
    // ============================================================

    error RateLimitExceededError();

    // ============================================================
    // MODIFIERS
    // ============================================================

    /// @notice Check rate limit for user
    modifier rateLimited() {
        _checkRateLimit(msg.sender);
        _;
    }

    // ============================================================
    // INTERNAL FUNCTIONS
    // ============================================================

    /// @notice Check and update rate limit for user
    /// @param user User address to check
    function _checkRateLimit(address user) internal {
        // If rate limiting is disabled, skip
        if (rateLimit == 0) return;

        // Reset count if period has passed
        if (block.timestamp >= periodStart[user] + ratePeriod) {
            operationCount[user] = 0;
            periodStart[user] = block.timestamp;
        }

        // Check limit
        if (operationCount[user] >= rateLimit) {
            emit RateLimitExceeded(user, operationCount[user], rateLimit);
            revert RateLimitExceededError();
        }

        // Increment count
        operationCount[user]++;
    }

    /// @notice Set rate limit parameters
    /// @param newLimit Operations per period
    /// @param newPeriod Period in seconds
    function _setRateLimit(uint256 newLimit, uint256 newPeriod) internal {
        rateLimit = newLimit;
        ratePeriod = newPeriod;
        emit RateLimitUpdated(newLimit, newPeriod);
    }
}

/// @title SweepCircuitBreaker
/// @notice Automatic circuit breaker for anomaly detection
abstract contract SweepCircuitBreaker {
    // ============================================================
    // STATE VARIABLES
    // ============================================================

    /// @notice Circuit breaker state
    bool public circuitBroken;

    /// @notice Maximum single transaction value
    uint256 public maxTransactionValue;

    /// @notice Maximum total value per period
    uint256 public maxPeriodValue;

    /// @notice Current period start
    uint256 public currentPeriodStart;

    /// @notice Total value in current period
    uint256 public currentPeriodValue;

    /// @notice Period duration
    uint256 public constant PERIOD_DURATION = 1 hours;

    // ============================================================
    // EVENTS
    // ============================================================

    event CircuitBroken(string reason, uint256 value);
    event CircuitReset(address indexed by);
    event LimitsUpdated(uint256 maxTransaction, uint256 maxPeriod);

    // ============================================================
    // ERRORS
    // ============================================================

    error CircuitBrokenError();
    error TransactionTooLarge(uint256 value, uint256 max);
    error PeriodLimitExceeded(uint256 total, uint256 max);

    // ============================================================
    // MODIFIERS
    // ============================================================

    /// @notice Check circuit breaker
    modifier circuitCheck(uint256 value) {
        _checkCircuit(value);
        _;
    }

    // ============================================================
    // INTERNAL FUNCTIONS
    // ============================================================

    /// @notice Check circuit breaker and update values
    /// @param value Transaction value
    function _checkCircuit(uint256 value) internal {
        if (circuitBroken) revert CircuitBrokenError();

        // Check single transaction limit
        if (maxTransactionValue > 0 && value > maxTransactionValue) {
            circuitBroken = true;
            emit CircuitBroken("Transaction too large", value);
            revert TransactionTooLarge(value, maxTransactionValue);
        }

        // Reset period if needed
        if (block.timestamp >= currentPeriodStart + PERIOD_DURATION) {
            currentPeriodStart = block.timestamp;
            currentPeriodValue = 0;
        }

        // Check period limit
        if (maxPeriodValue > 0 && currentPeriodValue + value > maxPeriodValue) {
            circuitBroken = true;
            emit CircuitBroken("Period limit exceeded", currentPeriodValue + value);
            revert PeriodLimitExceeded(currentPeriodValue + value, maxPeriodValue);
        }

        currentPeriodValue += value;
    }

    /// @notice Reset circuit breaker (owner only in implementation)
    function _resetCircuit() internal {
        circuitBroken = false;
        currentPeriodValue = 0;
        currentPeriodStart = block.timestamp;
        emit CircuitReset(msg.sender);
    }

    /// @notice Set circuit breaker limits
    /// @param maxTransaction Maximum single transaction value
    /// @param maxPeriod Maximum total value per period
    function _setCircuitLimits(uint256 maxTransaction, uint256 maxPeriod) internal {
        maxTransactionValue = maxTransaction;
        maxPeriodValue = maxPeriod;
        emit LimitsUpdated(maxTransaction, maxPeriod);
    }
}
