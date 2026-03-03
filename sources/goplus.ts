/**
 * Crypto Vision — GoPlus Security Data Source
 *
 * 100% free, no API key required.
 *
 * Provides: token security audits, honeypot detection,
 *           malicious address checking, contract safety scores.
 */

import { fetchJSON } from "../lib/fetcher.js";
import { cache } from "../lib/cache.js";

const API = "https://api.gopluslabs.io/api/v1";

// Chain IDs: 1=Ethereum, 56=BSC, 137=Polygon, 42161=Arbitrum,
//            10=Optimism, 8453=Base, 43114=Avalanche, 250=Fantom

// ─── Token Security ──────────────────────────────────────────

export interface TokenSecurity {
  is_open_source: string;
  is_proxy: string;
  is_mintable: string;
  can_take_back_ownership: string;
  owner_change_balance: string;
  hidden_owner: string;
  selfdestruct: string;
  external_call: string;
  buy_tax: string;
  sell_tax: string;
  is_honeypot: string;
  holder_count: string;
  total_supply: string;
  holders: Array<{ address: string; is_locked: number; percent: string }>;
  lp_holders: Array<{ address: string; is_locked: number; percent: string }>;
  is_true_token: string;
  is_airdrop_scam: string;
  trust_list: string;
  other_potential_risks: string;
  note: string;
  honeypot_with_same_creator: string;
  fake_token: string;
}

export function getTokenSecurity(
  chainId: number,
  addresses: string[],
): Promise<{ code: number; result: Record<string, TokenSecurity> }> {
  const addrs = addresses.join(",").toLowerCase();
  return cache.wrap(`goplus:token:${chainId}:${addrs}`, 300, () =>
    fetchJSON(`${API}/token_security/${chainId}?contract_addresses=${addrs}`),
  );
}

// ─── Address Security ────────────────────────────────────────

export interface AddressSecurity {
  cybercrime: string;
  money_laundering: string;
  number_of_malicious_contracts_created: string;
  financial_crime: string;
  darkweb_transactions: string;
  phishing_activities: string;
  fake_kyc: string;
  blacklist_doubt: string;
  stealing_attack: string;
  blackmail_activities: string;
  sanctioned: string;
  malicious_mining_activities: string;
  mixer: string;
  honeypot_related_address: string;
}

export function getAddressSecurity(
  chainId: number,
  address: string,
): Promise<{ code: number; result: AddressSecurity }> {
  return cache.wrap(`goplus:addr:${chainId}:${address.toLowerCase()}`, 300, () =>
    fetchJSON(`${API}/address_security/${address}?chain_id=${chainId}`),
  );
}

// ─── Approval Security ───────────────────────────────────────

export function getApprovalSecurity(
  chainId: number,
  address: string,
): Promise<{
  code: number;
  result: Record<string, {
    approved_amount: string;
    approved_contract: string;
    approved_spender: string;
    is_open_source: string;
    trust_list: string;
    tag: string;
    is_contract: string;
  }>;
}> {
  return cache.wrap(`goplus:approval:${chainId}:${address.toLowerCase()}`, 300, () =>
    fetchJSON(
      `${API}/approval_security/${chainId}?contract_addresses=${address}`,
    ),
  );
}

// ─── NFT Security ────────────────────────────────────────────

export function getNFTSecurity(
  chainId: number,
  address: string,
): Promise<{
  code: number;
  result: {
    nft_open_source: string;
    nft_proxy: string;
    restricted_approval: string;
    transfer_without_approval: string;
    privileged_minting: string;
    self_destruct: string;
    oversupply_minting: string;
  };
}> {
  return cache.wrap(`goplus:nft:${chainId}:${address.toLowerCase()}`, 300, () =>
    fetchJSON(`${API}/nft_security/${chainId}?contract_addresses=${address}`),
  );
}

// ─── Supported Chains ────────────────────────────────────────

export function getSupportedChains(): Promise<{
  code: number;
  result: Array<{ id: string; name: string }>;
}> {
  return cache.wrap("goplus:chains", 3600, () =>
    fetchJSON(`${API}/supported_chains`),
  );
}

// ─── dApp Security ───────────────────────────────────────────

export function getDappSecurity(url: string): Promise<{
  code: number;
  result: {
    is_audit: string;
    trust_list: string;
    is_open_source: string;
    phishing_site: string;
    darkweb_activity: string;
  };
}> {
  return cache.wrap(`goplus:dapp:${url}`, 600, () =>
    fetchJSON(`${API}/dapp_security?url=${encodeURIComponent(url)}`),
  );
}
