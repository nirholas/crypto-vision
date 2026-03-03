// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title IAaveV3Pool
/// @notice Interface for Aave V3 Pool
interface IAaveV3Pool {
    /// @notice Supplies an amount of underlying asset into the reserve
    /// @param asset The address of the underlying asset to supply
    /// @param amount The amount to be supplied
    /// @param onBehalfOf The address that will receive the aTokens
    /// @param referralCode Code used to register the integrator (0 if none)
    function supply(
        address asset,
        uint256 amount,
        address onBehalfOf,
        uint16 referralCode
    ) external;

    /// @notice Withdraws an amount of underlying asset from the reserve
    /// @param asset The address of the underlying asset to withdraw
    /// @param amount The underlying amount to be withdrawn
    /// @param to The address that will receive the underlying
    /// @return The final amount withdrawn
    function withdraw(
        address asset,
        uint256 amount,
        address to
    ) external returns (uint256);

    /// @notice Returns the normalized income of the reserve
    /// @param asset The address of the underlying asset of the reserve
    /// @return The reserve's normalized income
    function getReserveNormalizedIncome(address asset) external view returns (uint256);

    /// @notice Returns the state and configuration of the reserve
    /// @param asset The address of the underlying asset of the reserve
    /// @return The state and configuration data of the reserve
    function getReserveData(address asset) external view returns (ReserveData memory);

    struct ReserveData {
        uint256 configuration;
        uint128 liquidityIndex;
        uint128 currentLiquidityRate;
        uint128 variableBorrowIndex;
        uint128 currentVariableBorrowRate;
        uint128 currentStableBorrowRate;
        uint40 lastUpdateTimestamp;
        uint16 id;
        address aTokenAddress;
        address stableDebtTokenAddress;
        address variableDebtTokenAddress;
        address interestRateStrategyAddress;
        uint128 accruedToTreasury;
        uint128 unbacked;
        uint128 isolationModeTotalDebt;
    }
}

/// @title IYearnVault
/// @notice Interface for Yearn V2/V3 Vaults
interface IYearnVault {
    /// @notice Deposits tokens into the vault
    /// @param amount Amount of underlying tokens to deposit
    /// @return shares Amount of vault shares received
    function deposit(uint256 amount) external returns (uint256 shares);

    /// @notice Deposits tokens into the vault for a recipient
    /// @param amount Amount of underlying tokens to deposit
    /// @param recipient Address to receive the shares
    /// @return shares Amount of vault shares received
    function deposit(uint256 amount, address recipient) external returns (uint256 shares);

    /// @notice Withdraws underlying tokens from the vault
    /// @param maxShares Maximum number of shares to redeem
    /// @return Amount of underlying tokens received
    function withdraw(uint256 maxShares) external returns (uint256);

    /// @notice Withdraws underlying tokens from the vault
    /// @param maxShares Maximum number of shares to redeem
    /// @param recipient Address to receive the underlying tokens
    /// @return Amount of underlying tokens received
    function withdraw(uint256 maxShares, address recipient) external returns (uint256);

    /// @notice Returns the price of one share in underlying terms
    /// @return The price per share
    function pricePerShare() external view returns (uint256);

    /// @notice Returns the address of the underlying token
    /// @return The underlying token address
    function token() external view returns (address);

    /// @notice Returns the total assets managed by the vault
    /// @return The total assets
    function totalAssets() external view returns (uint256);

    /// @notice Returns the total supply of shares
    /// @return The total shares
    function totalSupply() external view returns (uint256);

    /// @notice Returns the balance of shares for an account
    /// @param account The address to query
    /// @return The share balance
    function balanceOf(address account) external view returns (uint256);

    /// @notice Preview deposit amount
    /// @param assets Amount of assets to deposit
    /// @return shares Expected shares to receive
    function previewDeposit(uint256 assets) external view returns (uint256 shares);

    /// @notice Preview withdrawal amount
    /// @param shares Amount of shares to redeem
    /// @return assets Expected assets to receive
    function previewRedeem(uint256 shares) external view returns (uint256 assets);
}

/// @title IBeefyVault
/// @notice Interface for Beefy Finance Vaults
interface IBeefyVault {
    /// @notice Deposits all the caller's balance of the underlying token
    function depositAll() external;

    /// @notice Deposits a specified amount of the underlying token
    /// @param amount Amount to deposit
    function deposit(uint256 amount) external;

    /// @notice Withdraws all shares for the caller
    function withdrawAll() external;

    /// @notice Withdraws a specified amount of shares
    /// @param shares Amount of shares to withdraw
    function withdraw(uint256 shares) external;

    /// @notice Returns the price of one share in underlying terms
    /// @return The price per full share
    function getPricePerFullShare() external view returns (uint256);

    /// @notice Returns the address of the underlying want token
    /// @return The want token address
    function want() external view returns (address);

    /// @notice Returns the total balance managed by the vault
    /// @return The total balance
    function balance() external view returns (uint256);

    /// @notice Returns the total supply of vault shares
    /// @return The total supply
    function totalSupply() external view returns (uint256);

    /// @notice Returns the balance of shares for an account
    /// @param account The address to query
    /// @return The share balance
    function balanceOf(address account) external view returns (uint256);

    /// @notice Transfers shares to another address
    /// @param to Recipient address
    /// @param amount Amount of shares to transfer
    /// @return success Whether the transfer succeeded
    function transfer(address to, uint256 amount) external returns (bool);
}

/// @title ILido
/// @notice Interface for Lido stETH
interface ILido {
    /// @notice Submit ETH for staking
    /// @param referral Referral address (can be zero)
    /// @return amount Amount of stETH received
    function submit(address referral) external payable returns (uint256 amount);

    /// @notice Returns the amount of stETH tokens owned by the account
    /// @param account Address to query
    /// @return balance The stETH balance
    function balanceOf(address account) external view returns (uint256 balance);

    /// @notice Returns the total supply of stETH
    /// @return The total supply
    function totalSupply() external view returns (uint256);

    /// @notice Returns the total amount of ETH in the protocol
    /// @return The total pooled ETH
    function getTotalPooledEther() external view returns (uint256);

    /// @notice Returns the total amount of stETH shares
    /// @return The total shares
    function getTotalShares() external view returns (uint256);

    /// @notice Returns the amount of shares for a given stETH amount
    /// @param ethAmount Amount of stETH
    /// @return sharesAmount Equivalent shares
    function getSharesByPooledEth(uint256 ethAmount) external view returns (uint256 sharesAmount);

    /// @notice Returns the amount of stETH for a given shares amount
    /// @param sharesAmount Amount of shares
    /// @return ethAmount Equivalent stETH
    function getPooledEthByShares(uint256 sharesAmount) external view returns (uint256 ethAmount);

    /// @notice Transfers stETH to another address
    /// @param recipient Recipient address
    /// @param amount Amount to transfer
    /// @return success Whether the transfer succeeded
    function transfer(address recipient, uint256 amount) external returns (bool);

    /// @notice Approves spender to transfer tokens
    /// @param spender Spender address
    /// @param amount Amount to approve
    /// @return success Whether the approval succeeded
    function approve(address spender, uint256 amount) external returns (bool);
}

/// @title IWstETH
/// @notice Interface for Lido wrapped stETH
interface IWstETH {
    /// @notice Wrap stETH to wstETH
    /// @param stETHAmount Amount of stETH to wrap
    /// @return wstETHAmount Amount of wstETH received
    function wrap(uint256 stETHAmount) external returns (uint256 wstETHAmount);

    /// @notice Unwrap wstETH to stETH
    /// @param wstETHAmount Amount of wstETH to unwrap
    /// @return stETHAmount Amount of stETH received
    function unwrap(uint256 wstETHAmount) external returns (uint256 stETHAmount);

    /// @notice Get amount of wstETH for a given stETH amount
    /// @param stETHAmount Amount of stETH
    /// @return wstETHAmount Equivalent wstETH
    function getWstETHByStETH(uint256 stETHAmount) external view returns (uint256 wstETHAmount);

    /// @notice Get amount of stETH for a given wstETH amount
    /// @param wstETHAmount Amount of wstETH
    /// @return stETHAmount Equivalent stETH
    function getStETHByWstETH(uint256 wstETHAmount) external view returns (uint256 stETHAmount);

    /// @notice Returns stETH tokens per wstETH
    /// @return The stETH per token
    function stEthPerToken() external view returns (uint256);

    /// @notice Returns wstETH tokens per stETH
    /// @return The wstETH per stETH
    function tokensPerStEth() external view returns (uint256);

    /// @notice Returns the balance of wstETH for an account
    /// @param account The address to query
    /// @return The wstETH balance
    function balanceOf(address account) external view returns (uint256);

    /// @notice Transfers wstETH to another address
    /// @param to Recipient address
    /// @param amount Amount to transfer
    /// @return success Whether the transfer succeeded
    function transfer(address to, uint256 amount) external returns (bool);
}

/// @title IWETH
/// @notice Interface for Wrapped ETH
interface IWETH {
    /// @notice Deposit ETH to get WETH
    function deposit() external payable;

    /// @notice Withdraw WETH to get ETH
    /// @param amount Amount of WETH to withdraw
    function withdraw(uint256 amount) external;

    /// @notice Returns the WETH balance for an account
    /// @param account The address to query
    /// @return The WETH balance
    function balanceOf(address account) external view returns (uint256);

    /// @notice Transfers WETH to another address
    /// @param to Recipient address
    /// @param amount Amount to transfer
    /// @return success Whether the transfer succeeded
    function transfer(address to, uint256 amount) external returns (bool);

    /// @notice Approves spender to transfer tokens
    /// @param spender Spender address
    /// @param amount Amount to approve
    /// @return success Whether the approval succeeded
    function approve(address spender, uint256 amount) external returns (bool);

    /// @notice Returns the allowance for a spender
    /// @param owner Owner address
    /// @param spender Spender address
    /// @return remaining The remaining allowance
    function allowance(address owner, address spender) external view returns (uint256 remaining);
}
