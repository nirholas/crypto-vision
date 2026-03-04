import { NextRequest, NextResponse } from 'next/server';
import * as etherscan from '@/lib/etherscan';
import type { Chain } from '@/lib/etherscan';

export const runtime = 'edge';
export const revalidate = 30;

/**
 * GET /api/market/etherscan
 *
 * Get Etherscan/multi-chain explorer data (gas, prices, supply, transactions)
 *
 * Query params:
 * - action: 'gas' | 'allgas' | 'price' | 'supply' | 'stats' | 'balance' | 'transactions' | 'tokens' | 'gascompare'
 * - chain: 'ethereum' | 'base' | 'arbitrum' | 'polygon' | 'optimism' | 'bsc' | 'avalanche'
 * - address: wallet/contract address (for balance/transactions/tokens)
 * - page: page number (default: 1)
 * - limit: number of results (default: 10)
 *
 * @example
 * GET /api/market/etherscan?action=gas
 * GET /api/market/etherscan?action=allgas
 * GET /api/market/etherscan?action=stats
 * GET /api/market/etherscan?action=balance&address=0x...&chain=ethereum
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'stats';
    const chain = (searchParams.get('chain') || 'ethereum') as Chain;
    const address = searchParams.get('address') || '';
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '10', 10);

    let data: unknown;

    switch (action) {
      // Gas
      case 'gas':
        data = await etherscan.getGasOracle(chain);
        break;

      case 'allgas':
        data = await etherscan.getAllChainGasPrices();
        break;

      case 'gascompare':
        data = await etherscan.getGasComparison();
        break;

      // ETH Price & Supply
      case 'price':
        data = await etherscan.getEthPrice();
        break;

      case 'supply':
        data = await etherscan.getEthSupply();
        break;

      case 'totalsupply':
        data = await etherscan.getTotalEthSupply();
        break;

      case 'nodes':
        data = await etherscan.getNodeCount();
        break;

      // Network Stats
      case 'stats':
        data = await etherscan.getNetworkStats();
        break;

      // Account
      case 'balance':
        if (!address) {
          return NextResponse.json(
            { success: false, error: 'Address required' },
            { status: 400 }
          );
        }
        data = await etherscan.getBalance(address, chain);
        break;

      case 'multibalance':
        const addresses = searchParams.get('addresses')?.split(',') || [];
        if (addresses.length === 0) {
          return NextResponse.json(
            { success: false, error: 'Addresses required' },
            { status: 400 }
          );
        }
        data = await etherscan.getMultiBalance(addresses, chain);
        break;

      case 'transactions':
        if (!address) {
          return NextResponse.json(
            { success: false, error: 'Address required' },
            { status: 400 }
          );
        }
        data = await etherscan.getTransactions(address, chain, page, limit);
        break;

      case 'tokens':
        if (!address) {
          return NextResponse.json(
            { success: false, error: 'Address required' },
            { status: 400 }
          );
        }
        const contractAddress = searchParams.get('contract');
        data = await etherscan.getTokenTransfers(
          address,
          chain,
          contractAddress || undefined,
          page,
          limit
        );
        break;

      case 'wallet':
        if (!address) {
          return NextResponse.json(
            { success: false, error: 'Address required' },
            { status: 400 }
          );
        }
        data = await etherscan.getWalletOverview(address, chain);
        break;

      // Contract
      case 'abi':
        if (!address) {
          return NextResponse.json(
            { success: false, error: 'Contract address required' },
            { status: 400 }
          );
        }
        data = await etherscan.getContractABI(address, chain);
        break;

      case 'source':
        if (!address) {
          return NextResponse.json(
            { success: false, error: 'Contract address required' },
            { status: 400 }
          );
        }
        data = await etherscan.getContractSource(address, chain);
        break;

      // Token
      case 'tokeninfo':
        if (!address) {
          return NextResponse.json(
            { success: false, error: 'Token contract address required' },
            { status: 400 }
          );
        }
        data = await etherscan.getTokenInfo(address, chain);
        break;

      case 'tokenholders':
        if (!address) {
          return NextResponse.json(
            { success: false, error: 'Token contract address required' },
            { status: 400 }
          );
        }
        data = await etherscan.getTokenHolderCount(address, chain);
        break;

      // Historical Stats
      case 'dailytx':
        const startdate = searchParams.get('start') || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        const enddate = searchParams.get('end') || new Date().toISOString().split('T')[0];
        data = await etherscan.getDailyTxCount(startdate, enddate);
        break;

      case 'dailyaddresses':
        const addrStart = searchParams.get('start') || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        const addrEnd = searchParams.get('end') || new Date().toISOString().split('T')[0];
        data = await etherscan.getDailyNewAddresses(addrStart, addrEnd);
        break;

      case 'dailygas':
        const gasStart = searchParams.get('start') || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        const gasEnd = searchParams.get('end') || new Date().toISOString().split('T')[0];
        data = await etherscan.getDailyAvgGasPrice(gasStart, gasEnd);
        break;

      // Block
      case 'blockreward':
        const blockNo = parseInt(searchParams.get('block') || '0', 10);
        data = await etherscan.getBlockReward(blockNo, chain);
        break;

      case 'blockbytime':
        const timestamp = parseInt(searchParams.get('timestamp') || '0', 10);
        data = await etherscan.getBlockByTimestamp(timestamp, 'before', chain);
        break;

      default:
        data = await etherscan.getNetworkStats();
    }

    return NextResponse.json(
      { success: true, data },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  } catch (error) {
    console.error('Etherscan API error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch Etherscan data', message: String(error) },
      { status: 500 }
    );
  }
}
