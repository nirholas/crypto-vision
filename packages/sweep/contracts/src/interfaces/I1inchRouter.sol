// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title I1inchRouter
/// @notice Interface for 1inch AggregationRouter V6
/// @dev Used for executing swaps through 1inch
interface I1inchRouter {
    // ============================================================
    // STRUCTS
    // ============================================================

    /// @notice Swap description for swap() function
    struct SwapDescription {
        address srcToken;
        address dstToken;
        address payable srcReceiver;
        address payable dstReceiver;
        uint256 amount;
        uint256 minReturnAmount;
        uint256 flags;
    }

    /// @notice Order for limit order protocol
    struct Order {
        uint256 salt;
        address makerAsset;
        address takerAsset;
        address maker;
        address receiver;
        address allowedSender;
        uint256 makingAmount;
        uint256 takingAmount;
        uint256 offsets;
        bytes interactions;
    }

    // ============================================================
    // ERRORS
    // ============================================================

    error BadPool();
    error EmptyPools();
    error EthDepositRejected();
    error InsufficientBalance();
    error InvalidMsgValue();
    error MinReturnError();
    error OnlyWeth();
    error ReturnAmountIsNotEnough();
    error ZeroMinReturn();
    error ZeroAddress();

    // ============================================================
    // SWAP FUNCTIONS
    // ============================================================

    /// @notice Perform a swap using 1inch router
    /// @param executor Address of the executor contract
    /// @param desc Swap description
    /// @param data Encoded swap data
    /// @return returnAmount Amount of destination token received
    /// @return spentAmount Amount of source token spent
    function swap(address executor, SwapDescription calldata desc, bytes calldata data)
        external
        payable
        returns (uint256 returnAmount, uint256 spentAmount);

    /// @notice Swap with permit (ERC-2612)
    function swapWithPermit(
        address executor,
        SwapDescription calldata desc,
        bytes calldata data,
        bytes calldata permit
    ) external payable returns (uint256 returnAmount, uint256 spentAmount);

    /// @notice Simple swap through Uniswap V2/V3 pools
    function uniswapV3Swap(uint256 amount, uint256 minReturn, uint256[] calldata pools)
        external
        payable
        returns (uint256 returnAmount);

    /// @notice Swap through Uniswap V3 with permit
    function uniswapV3SwapTo(address payable recipient, uint256 amount, uint256 minReturn, uint256[] calldata pools)
        external
        payable
        returns (uint256 returnAmount);

    /// @notice Swap with callback (flash swap)
    function uniswapV3SwapCallback(int256 amount0Delta, int256 amount1Delta, bytes calldata data) external;

    /// @notice Swap through Uniswap V2 pools
    function unoswap(address srcToken, uint256 amount, uint256 minReturn, uint256[] calldata pools)
        external
        payable
        returns (uint256 returnAmount);

    /// @notice Swap through Uniswap V2 pools to specific recipient
    function unoswapTo(
        address payable recipient,
        address srcToken,
        uint256 amount,
        uint256 minReturn,
        uint256[] calldata pools
    ) external payable returns (uint256 returnAmount);

    // ============================================================
    // LIMIT ORDER FUNCTIONS
    // ============================================================

    /// @notice Fill a limit order
    function fillOrder(
        Order calldata order,
        bytes calldata signature,
        bytes calldata interaction,
        uint256 makingAmount,
        uint256 takingAmount,
        uint256 skipPermitAndThresholdAmount
    ) external payable returns (uint256 actualMakingAmount, uint256 actualTakingAmount, bytes32 orderHash);

    /// @notice Fill a limit order to specific receiver
    function fillOrderTo(
        Order calldata order,
        bytes calldata signature,
        bytes calldata interaction,
        uint256 makingAmount,
        uint256 takingAmount,
        uint256 skipPermitAndThresholdAmount,
        address target
    ) external payable returns (uint256 actualMakingAmount, uint256 actualTakingAmount, bytes32 orderHash);

    /// @notice Cancel an order
    function cancelOrder(Order calldata order) external returns (uint256 orderRemaining, bytes32 orderHash);

    // ============================================================
    // UTILITY FUNCTIONS
    // ============================================================

    /// @notice Rescue tokens stuck in the contract
    function rescueFunds(address token, uint256 amount) external;

    /// @notice Destroy the contract
    function destroy() external;
}

/// @title IUniswapV2Router
/// @notice Minimal interface for Uniswap V2 style routers
interface IUniswapV2Router {
    function swapExactTokensForTokens(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external returns (uint256[] memory amounts);

    function swapExactETHForTokens(uint256 amountOutMin, address[] calldata path, address to, uint256 deadline)
        external
        payable
        returns (uint256[] memory amounts);

    function swapExactTokensForETH(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external returns (uint256[] memory amounts);

    function getAmountsOut(uint256 amountIn, address[] calldata path) external view returns (uint256[] memory amounts);
}

/// @title IUniswapV3Router
/// @notice Minimal interface for Uniswap V3 SwapRouter
interface IUniswapV3Router {
    struct ExactInputSingleParams {
        address tokenIn;
        address tokenOut;
        uint24 fee;
        address recipient;
        uint256 deadline;
        uint256 amountIn;
        uint256 amountOutMinimum;
        uint160 sqrtPriceLimitX96;
    }

    struct ExactInputParams {
        bytes path;
        address recipient;
        uint256 deadline;
        uint256 amountIn;
        uint256 amountOutMinimum;
    }

    function exactInputSingle(ExactInputSingleParams calldata params) external payable returns (uint256 amountOut);

    function exactInput(ExactInputParams calldata params) external payable returns (uint256 amountOut);
}

/// @title I0xExchangeProxy
/// @notice Minimal interface for 0x Exchange Proxy
interface I0xExchangeProxy {
    /// @notice Execute a swap via 0x
    function transformERC20(
        address inputToken,
        address outputToken,
        uint256 inputTokenAmount,
        uint256 minOutputTokenAmount,
        bytes calldata transformations
    ) external payable returns (uint256 outputTokenAmount);

    /// @notice Fill a 0x limit order
    function fillLimitOrder(
        bytes calldata order,
        bytes calldata signature,
        uint128 takerTokenFillAmount
    ) external payable returns (uint128 takerTokenFilledAmount, uint128 makerTokenFilledAmount);
}
