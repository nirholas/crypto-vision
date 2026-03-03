// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title IPermit2
/// @notice Interface for Uniswap's Permit2 contract
/// @dev Enables gasless token approvals via signatures
interface IPermit2 {
    // ============================================================
    // STRUCTS
    // ============================================================

    /// @notice Token and amount for a single permit
    struct TokenPermissions {
        address token;
        uint256 amount;
    }

    /// @notice Data for a single token permit
    struct PermitDetails {
        address token;
        uint160 amount;
        uint48 expiration;
        uint48 nonce;
    }

    /// @notice Data for a batch of token permits
    struct PermitBatch {
        PermitDetails[] details;
        address spender;
        uint256 sigDeadline;
    }

    /// @notice A single permit for transferFrom
    struct PermitSingle {
        PermitDetails details;
        address spender;
        uint256 sigDeadline;
    }

    /// @notice Transfer details for permitTransferFrom
    struct SignatureTransferDetails {
        address to;
        uint256 requestedAmount;
    }

    /// @notice Permit data for signature-based transfers
    struct PermitTransferFrom {
        TokenPermissions permitted;
        uint256 nonce;
        uint256 deadline;
    }

    /// @notice Batch permit data for signature-based transfers
    struct PermitBatchTransferFrom {
        TokenPermissions[] permitted;
        uint256 nonce;
        uint256 deadline;
    }

    /// @notice Allowance data stored in Permit2
    struct PackedAllowance {
        uint160 amount;
        uint48 expiration;
        uint48 nonce;
    }

    // ============================================================
    // ERRORS
    // ============================================================

    error AllowanceExpired(uint256 deadline);
    error InsufficientAllowance(uint256 amount);
    error InvalidAmount(uint256 maxAmount);
    error InvalidContractSignature();
    error InvalidNonce();
    error InvalidSignature();
    error InvalidSignatureLength();
    error InvalidSigner();
    error LengthMismatch();
    error SignatureExpired(uint256 signatureDeadline);

    // ============================================================
    // EVENTS
    // ============================================================

    event Approval(
        address indexed owner, address indexed token, address indexed spender, uint160 amount, uint48 expiration
    );
    event Permit(
        address indexed owner,
        address indexed token,
        address indexed spender,
        uint160 amount,
        uint48 expiration,
        uint48 nonce
    );
    event Lockdown(address indexed owner, address token, address spender);
    event NonceInvalidation(
        address indexed owner, address indexed token, address indexed spender, uint48 newNonce, uint48 oldNonce
    );

    // ============================================================
    // ALLOWANCE TRANSFER FUNCTIONS
    // ============================================================

    /// @notice Approve a spender to access a token
    function approve(address token, address spender, uint160 amount, uint48 expiration) external;

    /// @notice Permit a spender via signature
    function permit(address owner, PermitSingle memory permitSingle, bytes calldata signature) external;

    /// @notice Permit a spender for multiple tokens via signature
    function permit(address owner, PermitBatch memory permitBatch, bytes calldata signature) external;

    /// @notice Transfer tokens using allowance
    function transferFrom(address from, address to, uint160 amount, address token) external;

    /// @notice Batch transfer using allowances
    struct AllowanceTransferDetails {
        address from;
        address to;
        uint160 amount;
        address token;
    }

    function transferFrom(AllowanceTransferDetails[] calldata transferDetails) external;

    /// @notice Get allowance info
    function allowance(address user, address token, address spender)
        external
        view
        returns (uint160 amount, uint48 expiration, uint48 nonce);

    // ============================================================
    // SIGNATURE TRANSFER FUNCTIONS
    // ============================================================

    /// @notice Transfer tokens via signature (one-time use nonce)
    function permitTransferFrom(
        PermitTransferFrom memory permit,
        SignatureTransferDetails calldata transferDetails,
        address owner,
        bytes calldata signature
    ) external;

    /// @notice Batch transfer tokens via signature
    function permitTransferFrom(
        PermitBatchTransferFrom memory permit,
        SignatureTransferDetails[] calldata transferDetails,
        address owner,
        bytes calldata signature
    ) external;

    /// @notice Transfer with witness data
    function permitWitnessTransferFrom(
        PermitTransferFrom memory permit,
        SignatureTransferDetails calldata transferDetails,
        address owner,
        bytes32 witness,
        string calldata witnessTypeString,
        bytes calldata signature
    ) external;

    /// @notice Batch transfer with witness data
    function permitWitnessTransferFrom(
        PermitBatchTransferFrom memory permit,
        SignatureTransferDetails[] calldata transferDetails,
        address owner,
        bytes32 witness,
        string calldata witnessTypeString,
        bytes calldata signature
    ) external;

    // ============================================================
    // NONCE MANAGEMENT
    // ============================================================

    /// @notice Invalidate nonces to cancel pending permits
    function invalidateNonces(address token, address spender, uint48 newNonce) external;

    /// @notice Revoke all allowances for a token/spender pair
    function lockdown(TokenPermissions[] calldata approvals) external;

    // ============================================================
    // VIEW FUNCTIONS
    // ============================================================

    function DOMAIN_SEPARATOR() external view returns (bytes32);

    /// @notice Check if a nonce has been used (for signature transfers)
    function nonceBitmap(address owner, uint256 wordPos) external view returns (uint256);
}
