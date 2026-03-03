/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
export interface CreateAccountResult {
  address: string;
  privateKey: string;
}

export interface RekeyAccountParams {
  sourceAddress: string;
  targetAddress: string;
}

export interface RekeyAccountResult {
  txId: string;
  signedTxn: string; // Base64 encoded signed transaction
}

export interface AccountDetails {
  address: string;
  amount: number;
  assets: Array<{
    assetId: number;
    amount: number;
  }>;
  authAddress?: string;
}

export interface TransactionInfo {
  id: string;
  type: string;
  sender: string;
  receiver?: string;
  amount?: number;
  assetId?: number;
  timestamp: string;
}

export interface AssetHolding {
  assetId: number;
  amount: number;
  creator: string;
  frozen: boolean;
}

export interface ApplicationState {
  appId: number;
  globalState: Record<string, any>;
  localState?: Record<string, any>;
}
