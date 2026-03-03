# Removed Tools Documentation

This document lists tools that were removed due to missing SDK support. These can be re-added when Binance provides official SDK packages or by implementing direct REST API calls.

## Date: January 20, 2026

---

## Crypto Loans - Fixed-Term Loan Tools (Removed)

The `@binance/crypto-loan` SDK v9.0.1 only supports **Flexible Rate** loan APIs. The following **Fixed-Term/Stable Rate** loan tools were removed because their methods don't exist in the SDK:

### Files Removed from `/src/tools/binance-crypto-loans/`:

| File | Tool Name | Description | Required SDK Method |
|------|-----------|-------------|---------------------|
| `borrow.ts` | `BinanceCryptoLoanBorrow` | Borrow crypto loan (fixed-term) | `borrow()` - not available |
| `repay.ts` | `BinanceCryptoLoanRepay` | Repay crypto loan (fixed-term) | `repay()` - not available |
| `adjustLTV.ts` | `BinanceCryptoLoanAdjustLTV` | Adjust LTV for fixed-term loan | `adjustLTV()` - not available |
| `borrowHistory.ts` | `BinanceCryptoLoanBorrowHistory` | Get borrow history (fixed-term) | `borrowHistory()` - not available |
| `repayHistory.ts` | `BinanceCryptoLoanRepayHistory` | Get repay history (fixed-term) | `repayHistory()` - not available |
| `ongoingOrders.ts` | `BinanceCryptoLoanOngoingOrders` | Get ongoing loan orders (fixed-term) | `ongoingOrders()` - not available |
| `ltvAdjustmentHistory.ts` | `BinanceCryptoLoanLTVAdjustmentHistory` | Get LTV adjustment history (fixed-term) | `ltvAdjustmentHistory()` - not available |
| `customizeMarginCall.ts` | `BinanceCryptoLoanCustomizeMarginCall` | Customize margin call settings | `customizeMarginCall()` - not available |
| `getCollateralAssets.ts` | `BinanceCryptoLoanGetCollateralAssets` | Get collateral assets list | `getCollateralAssetsData()` - not available |
| `getLoanableAssets.ts` | `BinanceCryptoLoanGetLoanableAssets` | Get loanable assets list | `getLoanableAssetsData()` - not available |

### Available Methods in `@binance/crypto-loan` SDK:

The SDK provides these methods for **Flexible Rate** loans:
- `checkCollateralRepayRate()` - Check collateral repay rate
- `flexibleLoanBorrow()` - Borrow flexible loan
- `flexibleLoanRepay()` - Repay flexible loan
- `flexibleLoanAdjustLtv()` - Adjust LTV for flexible loan
- `getFlexibleLoanAssetsData()` - Get flexible loan assets data
- `getFlexibleLoanBorrowHistory()` - Get flexible loan borrow history
- `getFlexibleLoanCollateralAssetsData()` - Get flexible loan collateral assets data
- `getFlexibleLoanInterestRateHistory()` - Get flexible loan interest rate history
- `getFlexibleLoanLiquidationHistory()` - Get flexible loan liquidation history
- `getFlexibleLoanLtvAdjustmentHistory()` - Get flexible loan LTV adjustment history
- `getFlexibleLoanOngoingOrders()` - Get flexible loan ongoing orders
- `getFlexibleLoanRepaymentHistory()` - Get flexible loan repayment history

And these for **Stable Rate** (legacy/history only):
- `checkCollateralRepayRateStableRate()` - Check collateral repay rate (stable rate)
- `getCryptoLoansIncomeHistory()` - Get crypto loans income history
- `getLoanBorrowHistory()` - Get loan borrow history (stable rate)
- `getLoanLtvAdjustmentHistory()` - Get loan LTV adjustment history (stable rate)
- `getLoanRepaymentHistory()` - Get loan repayment history (stable rate)

---

## How to Re-Add These Tools

### Option 1: Wait for SDK Updates
Monitor `@binance/crypto-loan` package updates for new methods.

### Option 2: Use Direct REST API Calls
Implement using the custom REST client pattern in `binanceClient.ts`:

```typescript
// Example: Add to binanceClient.ts
export const cryptoLoanApiClient = {
    borrow: (params: Record<string, any>) => 
        makeSignedRequest("POST", "/sapi/v1/loan/borrow", params),
    repay: (params: Record<string, any>) => 
        makeSignedRequest("POST", "/sapi/v1/loan/repay", params),
    adjustLTV: (params: Record<string, any>) => 
        makeSignedRequest("POST", "/sapi/v1/loan/adjust/ltv", params),
    // ... etc
};
```

### Binance API Documentation
- Fixed-Term Crypto Loans: https://developers.binance.com/docs/crypto_loan/stable-rate
- Flexible Crypto Loans: https://developers.binance.com/docs/crypto_loan/flexible-rate

---

## Other Potential Issues Found

These tools may also have issues but were not removed yet:

### binance-options
- `exerciseHistory.ts` - Method `exerciseHistory()` not in wrapper
- `historicalTrades.ts` - Method `historicalTrades()` not in wrapper  
- `openInterest.ts` - Method `openInterest()` not in wrapper

### binance-futures-coinm
- Various method name mismatches (e.g., `getAccount` vs `account`, `getBalance` vs `balance`)

### binance-spot/userdatastream-api
- `deleteUserDataStream`, `newUserDataStream`, `putUserDataStream` - Methods may have different names in SDK

### binance-wallet/travel-rule-api
- `onboardedVaspList` - Method not in SDK

### binance-modules (src/modules/)
- Various files have similar issues with SDK method mismatches
