// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IAaveV3Pool, IYearnVault, IBeefyVault, ILido, IWstETH, IWETH} from "./interfaces/IDefiProtocols.sol";

/// @title SweepVaultRouter
/// @author Sweep Team
/// @notice Routes dust to DeFi vaults (Aave, Yearn, Beefy, Lido)
/// @dev Supports slippage protection, deadlines, and multi-hop routing
contract SweepVaultRouter is Ownable2Step, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ============================================================
    // CONSTANTS
    // ============================================================

    /// @notice Native ETH address placeholder
    address public constant ETH_ADDRESS = 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE;

    /// @notice Maximum basis points (100%)
    uint256 public constant MAX_BPS = 10_000;

    /// @notice Maximum slippage tolerance (50%)
    uint256 public constant MAX_SLIPPAGE_BPS = 5_000;

    /// @notice Default slippage tolerance (1%)
    uint256 public constant DEFAULT_SLIPPAGE_BPS = 100;

    // ============================================================
    // ENUMS
    // ============================================================

    /// @notice Vault protocol types
    enum VaultType {
        AAVE_V3,
        YEARN_V2,
        YEARN_V3,
        BEEFY,
        LIDO,
        LIDO_WSTETH
    }

    // ============================================================
    // STATE VARIABLES
    // ============================================================

    /// @notice Aave V3 Pool addresses per chain
    mapping(uint256 => address) public aaveV3Pools;

    /// @notice Lido stETH addresses per chain
    mapping(uint256 => address) public lidoAddresses;

    /// @notice wstETH addresses per chain
    mapping(uint256 => address) public wstETHAddresses;

    /// @notice WETH addresses per chain
    mapping(uint256 => address) public wethAddresses;

    /// @notice Approved vault addresses
    mapping(address => bool) public approvedVaults;

    /// @notice Vault type mapping
    mapping(address => VaultType) public vaultTypes;

    /// @notice Underlying token for each vault
    mapping(address => address) public vaultUnderlyingTokens;

    /// @notice Default slippage tolerance
    uint256 public defaultSlippageBps;

    /// @notice Paused state
    bool public paused;

    /// @notice Aave referral code
    uint16 public aaveReferralCode;

    // ============================================================
    // STRUCTS
    // ============================================================

    /// @notice Deposit parameters for vault routing
    struct DepositParams {
        address vault;          // Vault address (or protocol address for Aave/Lido)
        address token;          // Token to deposit
        uint256 amount;         // Amount to deposit
        uint256 minSharesOut;   // Minimum shares/aTokens to receive
        address recipient;      // Recipient of vault shares
        uint256 deadline;       // Transaction deadline
    }

    /// @notice Batch deposit parameters
    struct BatchDepositParams {
        DepositParams[] deposits;
        uint256 deadline;
    }

    /// @notice Multi-hop route step
    struct RouteStep {
        address protocol;       // Protocol address
        VaultType vaultType;    // Type of vault
        address tokenIn;        // Input token
        address tokenOut;       // Output token (shares)
        bytes extraData;        // Additional data for the step
    }

    // ============================================================
    // EVENTS
    // ============================================================

    event VaultDeposit(
        address indexed user,
        address indexed vault,
        VaultType vaultType,
        address token,
        uint256 amountIn,
        uint256 sharesOut
    );

    event BatchVaultDeposit(
        address indexed user,
        uint256 depositCount,
        uint256 totalValue
    );

    event VaultApproved(address indexed vault, VaultType vaultType, bool approved);
    event ProtocolAddressUpdated(string protocol, uint256 chainId, address newAddress);
    event SlippageUpdated(uint256 oldSlippage, uint256 newSlippage);
    event AaveReferralCodeUpdated(uint16 oldCode, uint16 newCode);
    event TokensRescued(address indexed token, address indexed to, uint256 amount);
    event Paused(bool isPaused);

    // ============================================================
    // ERRORS
    // ============================================================

    error ZeroAddress();
    error ZeroAmount();
    error InvalidSlippage();
    error VaultNotApproved();
    error DeadlineExpired();
    error InsufficientOutput();
    error ContractPaused();
    error InvalidVaultType();
    error UnsupportedChain();
    error TransferFailed();
    error DepositFailed();

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

    constructor() Ownable(msg.sender) {
        defaultSlippageBps = DEFAULT_SLIPPAGE_BPS;
        _initializeProtocolAddresses();
    }

    /// @notice Initialize known protocol addresses
    function _initializeProtocolAddresses() internal {
        // Aave V3 Pool addresses
        aaveV3Pools[1] = 0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2;     // Ethereum
        aaveV3Pools[137] = 0x794a61358D6845594F94dc1DB02A252b5b4814aD;   // Polygon
        aaveV3Pools[42161] = 0x794a61358D6845594F94dc1DB02A252b5b4814aD; // Arbitrum
        aaveV3Pools[10] = 0x794a61358D6845594F94dc1DB02A252b5b4814aD;    // Optimism
        aaveV3Pools[8453] = 0xA238Dd80C259a72e81d7e4664a9801593F98d1c5;  // Base

        // Lido addresses (Ethereum only)
        lidoAddresses[1] = 0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84;
        wstETHAddresses[1] = 0x7f39C581F595B53c5cb19bD0b3f8dA6c935E2Ca0;

        // WETH addresses
        wethAddresses[1] = 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2;
        wethAddresses[137] = 0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619;
        wethAddresses[42161] = 0x82aF49447D8a07e3bd95BD0d56f35241523fBab1;
        wethAddresses[10] = 0x4200000000000000000000000000000000000006;
        wethAddresses[8453] = 0x4200000000000000000000000000000000000006;
    }

    // ============================================================
    // EXTERNAL FUNCTIONS
    // ============================================================

    /// @notice Deposit tokens into a vault
    /// @param params Deposit parameters
    /// @return sharesOut Amount of shares received
    function deposit(DepositParams calldata params)
        external
        payable
        nonReentrant
        whenNotPaused
        validDeadline(params.deadline)
        returns (uint256 sharesOut)
    {
        if (params.amount == 0) revert ZeroAmount();
        if (params.recipient == address(0)) revert ZeroAddress();
        if (!approvedVaults[params.vault]) revert VaultNotApproved();

        VaultType vType = vaultTypes[params.vault];

        // Handle token transfer
        if (params.token == ETH_ADDRESS) {
            // ETH deposit - for Lido
            if (vType != VaultType.LIDO && vType != VaultType.LIDO_WSTETH) {
                revert InvalidVaultType();
            }
        } else {
            IERC20(params.token).safeTransferFrom(msg.sender, address(this), params.amount);
        }

        // Execute deposit based on vault type
        sharesOut = _executeDeposit(params.vault, vType, params.token, params.amount, params.recipient);

        if (sharesOut < params.minSharesOut) revert InsufficientOutput();

        emit VaultDeposit(
            msg.sender,
            params.vault,
            vType,
            params.token,
            params.amount,
            sharesOut
        );
    }

    /// @notice Deposit tokens into multiple vaults
    /// @param params Batch deposit parameters
    /// @return totalSharesOut Total shares received across all deposits
    function batchDeposit(BatchDepositParams calldata params)
        external
        payable
        nonReentrant
        whenNotPaused
        validDeadline(params.deadline)
        returns (uint256 totalSharesOut)
    {
        uint256 depositCount = params.deposits.length;

        for (uint256 i = 0; i < depositCount;) {
            DepositParams calldata dep = params.deposits[i];

            if (dep.amount == 0) revert ZeroAmount();
            if (dep.recipient == address(0)) revert ZeroAddress();
            if (!approvedVaults[dep.vault]) revert VaultNotApproved();

            VaultType vType = vaultTypes[dep.vault];

            // Handle token transfer
            if (dep.token != ETH_ADDRESS) {
                IERC20(dep.token).safeTransferFrom(msg.sender, address(this), dep.amount);
            }

            uint256 sharesOut = _executeDeposit(dep.vault, vType, dep.token, dep.amount, dep.recipient);

            if (sharesOut < dep.minSharesOut) revert InsufficientOutput();

            totalSharesOut += sharesOut;

            emit VaultDeposit(
                msg.sender,
                dep.vault,
                vType,
                dep.token,
                dep.amount,
                sharesOut
            );

            unchecked { ++i; }
        }

        emit BatchVaultDeposit(msg.sender, depositCount, totalSharesOut);
    }

    /// @notice Deposit ETH to Lido and receive stETH
    /// @param recipient Recipient of stETH
    /// @param minSharesOut Minimum stETH to receive
    /// @param deadline Transaction deadline
    /// @return sharesOut Amount of stETH received
    function depositToLido(
        address recipient,
        uint256 minSharesOut,
        uint256 deadline
    )
        external
        payable
        nonReentrant
        whenNotPaused
        validDeadline(deadline)
        returns (uint256 sharesOut)
    {
        if (msg.value == 0) revert ZeroAmount();
        if (recipient == address(0)) revert ZeroAddress();

        address lido = lidoAddresses[block.chainid];
        if (lido == address(0)) revert UnsupportedChain();

        sharesOut = ILido(lido).submit{value: msg.value}(address(0));

        if (sharesOut < minSharesOut) revert InsufficientOutput();

        // Transfer stETH to recipient
        if (recipient != address(this)) {
            ILido(lido).transfer(recipient, sharesOut);
        }

        emit VaultDeposit(msg.sender, lido, VaultType.LIDO, ETH_ADDRESS, msg.value, sharesOut);
    }

    /// @notice Deposit to Aave V3
    /// @param token Token to supply
    /// @param amount Amount to supply
    /// @param recipient Recipient of aTokens
    /// @param minSharesOut Minimum aTokens to receive
    /// @param deadline Transaction deadline
    /// @return sharesOut Amount of aTokens received
    function depositToAave(
        address token,
        uint256 amount,
        address recipient,
        uint256 minSharesOut,
        uint256 deadline
    )
        external
        nonReentrant
        whenNotPaused
        validDeadline(deadline)
        returns (uint256 sharesOut)
    {
        if (amount == 0) revert ZeroAmount();
        if (recipient == address(0)) revert ZeroAddress();

        address aavePool = aaveV3Pools[block.chainid];
        if (aavePool == address(0)) revert UnsupportedChain();

        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);

        // Get aToken address
        IAaveV3Pool.ReserveData memory reserveData = IAaveV3Pool(aavePool).getReserveData(token);
        address aToken = reserveData.aTokenAddress;

        uint256 balanceBefore = IERC20(aToken).balanceOf(recipient);

        // Approve and supply
        IERC20(token).forceApprove(aavePool, amount);
        IAaveV3Pool(aavePool).supply(token, amount, recipient, aaveReferralCode);

        uint256 balanceAfter = IERC20(aToken).balanceOf(recipient);
        sharesOut = balanceAfter - balanceBefore;

        if (sharesOut < minSharesOut) revert InsufficientOutput();

        emit VaultDeposit(msg.sender, aavePool, VaultType.AAVE_V3, token, amount, sharesOut);
    }

    // ============================================================
    // INTERNAL FUNCTIONS
    // ============================================================

    /// @notice Execute deposit based on vault type
    function _executeDeposit(
        address vault,
        VaultType vType,
        address token,
        uint256 amount,
        address recipient
    ) internal returns (uint256 sharesOut) {
        if (vType == VaultType.AAVE_V3) {
            sharesOut = _depositAave(vault, token, amount, recipient);
        } else if (vType == VaultType.YEARN_V2 || vType == VaultType.YEARN_V3) {
            sharesOut = _depositYearn(vault, token, amount, recipient);
        } else if (vType == VaultType.BEEFY) {
            sharesOut = _depositBeefy(vault, token, amount, recipient);
        } else if (vType == VaultType.LIDO) {
            sharesOut = _depositLido(vault, amount, recipient);
        } else if (vType == VaultType.LIDO_WSTETH) {
            sharesOut = _depositWstETH(vault, amount, recipient);
        } else {
            revert InvalidVaultType();
        }
    }

    /// @notice Deposit to Aave V3
    function _depositAave(
        address pool,
        address token,
        uint256 amount,
        address recipient
    ) internal returns (uint256 sharesOut) {
        IAaveV3Pool.ReserveData memory reserveData = IAaveV3Pool(pool).getReserveData(token);
        address aToken = reserveData.aTokenAddress;

        uint256 balanceBefore = IERC20(aToken).balanceOf(recipient);

        IERC20(token).forceApprove(pool, amount);
        IAaveV3Pool(pool).supply(token, amount, recipient, aaveReferralCode);

        uint256 balanceAfter = IERC20(aToken).balanceOf(recipient);
        sharesOut = balanceAfter - balanceBefore;
    }

    /// @notice Deposit to Yearn Vault
    function _depositYearn(
        address vault,
        address token,
        uint256 amount,
        address recipient
    ) internal returns (uint256 sharesOut) {
        IERC20(token).forceApprove(vault, amount);

        uint256 balanceBefore = IYearnVault(vault).balanceOf(recipient);
        IYearnVault(vault).deposit(amount, recipient);
        uint256 balanceAfter = IYearnVault(vault).balanceOf(recipient);

        sharesOut = balanceAfter - balanceBefore;
    }

    /// @notice Deposit to Beefy Vault
    function _depositBeefy(
        address vault,
        address token,
        uint256 amount,
        address recipient
    ) internal returns (uint256 sharesOut) {
        IERC20(token).forceApprove(vault, amount);

        uint256 balanceBefore = IBeefyVault(vault).balanceOf(address(this));
        IBeefyVault(vault).deposit(amount);
        uint256 balanceAfter = IBeefyVault(vault).balanceOf(address(this));

        sharesOut = balanceAfter - balanceBefore;

        // Transfer shares to recipient
        if (recipient != address(this) && sharesOut > 0) {
            IBeefyVault(vault).transfer(recipient, sharesOut);
        }
    }

    /// @notice Deposit ETH to Lido
    function _depositLido(
        address lido,
        uint256 amount,
        address recipient
    ) internal returns (uint256 sharesOut) {
        sharesOut = ILido(lido).submit{value: amount}(address(0));

        if (recipient != address(this) && sharesOut > 0) {
            ILido(lido).transfer(recipient, sharesOut);
        }
    }

    /// @notice Deposit ETH to Lido and wrap to wstETH
    function _depositWstETH(
        address wstETH,
        uint256 amount,
        address recipient
    ) internal returns (uint256 sharesOut) {
        address lido = lidoAddresses[block.chainid];
        if (lido == address(0)) revert UnsupportedChain();

        // First stake ETH to get stETH
        uint256 stETHAmount = ILido(lido).submit{value: amount}(address(0));

        // Approve wstETH to wrap stETH
        ILido(lido).approve(wstETH, stETHAmount);

        // Wrap to wstETH
        sharesOut = IWstETH(wstETH).wrap(stETHAmount);

        // Transfer wstETH to recipient
        if (recipient != address(this) && sharesOut > 0) {
            IWstETH(wstETH).transfer(recipient, sharesOut);
        }
    }

    // ============================================================
    // ADMIN FUNCTIONS
    // ============================================================

    /// @notice Approve or revoke a vault
    /// @param vault Vault address
    /// @param vType Vault type
    /// @param approved Approval status
    function setVaultApproval(
        address vault,
        VaultType vType,
        bool approved
    ) external onlyOwner {
        if (vault == address(0)) revert ZeroAddress();

        approvedVaults[vault] = approved;
        vaultTypes[vault] = vType;

        emit VaultApproved(vault, vType, approved);
    }

    /// @notice Batch approve vaults
    /// @param vaults Array of vault addresses
    /// @param vTypes Array of vault types
    /// @param approved Approval status
    function setVaultApprovalBatch(
        address[] calldata vaults,
        VaultType[] calldata vTypes,
        bool approved
    ) external onlyOwner {
        for (uint256 i = 0; i < vaults.length;) {
            if (vaults[i] == address(0)) revert ZeroAddress();
            approvedVaults[vaults[i]] = approved;
            vaultTypes[vaults[i]] = vTypes[i];
            emit VaultApproved(vaults[i], vTypes[i], approved);
            unchecked { ++i; }
        }
    }

    /// @notice Update protocol address
    /// @param protocol Protocol name
    /// @param chainId Chain ID
    /// @param addr New address
    function setProtocolAddress(
        string calldata protocol,
        uint256 chainId,
        address addr
    ) external onlyOwner {
        bytes32 protocolHash = keccak256(bytes(protocol));

        if (protocolHash == keccak256("aaveV3")) {
            aaveV3Pools[chainId] = addr;
        } else if (protocolHash == keccak256("lido")) {
            lidoAddresses[chainId] = addr;
        } else if (protocolHash == keccak256("wstETH")) {
            wstETHAddresses[chainId] = addr;
        } else if (protocolHash == keccak256("weth")) {
            wethAddresses[chainId] = addr;
        }

        emit ProtocolAddressUpdated(protocol, chainId, addr);
    }

    /// @notice Update default slippage tolerance
    /// @param newSlippageBps New slippage in basis points
    function setDefaultSlippage(uint256 newSlippageBps) external onlyOwner {
        if (newSlippageBps > MAX_SLIPPAGE_BPS) revert InvalidSlippage();
        uint256 oldSlippage = defaultSlippageBps;
        defaultSlippageBps = newSlippageBps;
        emit SlippageUpdated(oldSlippage, newSlippageBps);
    }

    /// @notice Update Aave referral code
    /// @param newCode New referral code
    function setAaveReferralCode(uint16 newCode) external onlyOwner {
        uint16 oldCode = aaveReferralCode;
        aaveReferralCode = newCode;
        emit AaveReferralCodeUpdated(oldCode, newCode);
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

        if (token == ETH_ADDRESS) {
            (bool success,) = to.call{value: amount}("");
            if (!success) revert TransferFailed();
        } else {
            IERC20(token).safeTransfer(to, amount);
        }

        emit TokensRescued(token, to, amount);
    }

    // ============================================================
    // VIEW FUNCTIONS
    // ============================================================

    /// @notice Check if a vault is approved
    /// @param vault Vault address
    /// @return approved Approval status
    function isVaultApproved(address vault) external view returns (bool) {
        return approvedVaults[vault];
    }

    /// @notice Get vault type
    /// @param vault Vault address
    /// @return vType Vault type
    function getVaultType(address vault) external view returns (VaultType) {
        return vaultTypes[vault];
    }

    /// @notice Get Aave pool for current chain
    /// @return pool Aave V3 Pool address
    function getAavePool() external view returns (address pool) {
        return aaveV3Pools[block.chainid];
    }

    /// @notice Get Lido address for current chain
    /// @return lido Lido stETH address
    function getLido() external view returns (address lido) {
        return lidoAddresses[block.chainid];
    }

    /// @notice Preview Yearn deposit
    /// @param vault Vault address
    /// @param amount Amount to deposit
    /// @return shares Expected shares
    function previewYearnDeposit(address vault, uint256 amount) external view returns (uint256 shares) {
        return IYearnVault(vault).previewDeposit(amount);
    }

    /// @notice Preview Beefy deposit
    /// @param vault Vault address
    /// @param amount Amount to deposit
    /// @return shares Expected shares
    function previewBeefyDeposit(address vault, uint256 amount) external view returns (uint256 shares) {
        uint256 pricePerShare = IBeefyVault(vault).getPricePerFullShare();
        return (amount * 1e18) / pricePerShare;
    }

    /// @notice Calculate minimum output with slippage
    /// @param expectedOutput Expected output amount
    /// @param slippageBps Slippage tolerance in basis points
    /// @return minOutput Minimum acceptable output
    function calculateMinOutput(
        uint256 expectedOutput,
        uint256 slippageBps
    ) external pure returns (uint256 minOutput) {
        return expectedOutput - (expectedOutput * slippageBps) / MAX_BPS;
    }

    // ============================================================
    // RECEIVE FUNCTION
    // ============================================================

    /// @notice Receive ETH for Lido deposits
    receive() external payable {}
}
