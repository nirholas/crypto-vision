'use client';

import React from 'react';
import { useMultiChainGas, useEtherscanStats } from '@/hooks/data-sources';

interface ChainGasPrice {
  chain: string;
  low: number;
  standard: number;
  fast: number;
  instant: number;
  nativeToken: string;
  safeGas?: number;
  standardGas?: number;
  fastGas?: number;
  baseFee?: number;
}

/**
 * Multi-Chain Gas Tracker Component
 *
 * Displays gas prices across multiple EVM chains
 * using data from Etherscan and related block explorers
 */
export function MultiChainGasTracker() {
  const { gasPrices, isLoading: gasLoading } = useMultiChainGas();
  const { price, supply, gas, isLoading: statsLoading } = useEtherscanStats();

  const isLoading = gasLoading || statsLoading;

  if (isLoading) {
    return (
      <div className="bg-surface rounded-lg p-6 animate-pulse">
        <div className="h-6 bg-surface-alt rounded w-48 mb-4"></div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="h-24 bg-surface-alt rounded"></div>
          ))}
        </div>
      </div>
    );
  }

  // Get gas price tier color
  const getGasColor = (gwei: number): string => {
    if (gwei < 10) return 'text-green-500';
    if (gwei < 30) return 'text-yellow-500';
    if (gwei < 100) return 'text-orange-500';
    return 'text-red-500';
  };

  return (
    <div className="bg-surface rounded-lg p-6 border border-surface-border">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-text-primary">
          ⛽ Multi-Chain Gas Tracker
        </h2>
        {price && (
          <div className="text-right">
            <span className="text-text-muted text-sm">ETH Price: </span>
            <span className="text-text-primary font-medium">
              ${parseFloat(price.ethusd).toLocaleString()}
            </span>
          </div>
        )}
      </div>

      {/* Ethereum Stats */}
      {gas && (
        <div className="mb-6 p-4 bg-gradient-to-r from-blue-500/10 to-purple-500/10 rounded-lg border border-blue-500/20">
          <h3 className="text-sm font-medium text-text-muted mb-3">
            Ethereum Mainnet (Current)
          </h3>
          <div className="grid grid-cols-4 gap-4">
            <div className="text-center">
              <p className="text-text-muted text-xs">🐢 Low</p>
              <p className={`text-xl font-bold ${getGasColor(parseFloat(gas.SafeGasPrice))}`}>
                {gas.SafeGasPrice}
              </p>
              <p className="text-text-muted text-xs">Gwei</p>
            </div>
            <div className="text-center">
              <p className="text-text-muted text-xs">🚶 Standard</p>
              <p className={`text-xl font-bold ${getGasColor(parseFloat(gas.ProposeGasPrice))}`}>
                {gas.ProposeGasPrice}
              </p>
              <p className="text-text-muted text-xs">Gwei</p>
            </div>
            <div className="text-center">
              <p className="text-text-muted text-xs">🚀 Fast</p>
              <p className={`text-xl font-bold ${getGasColor(parseFloat(gas.FastGasPrice))}`}>
                {gas.FastGasPrice}
              </p>
              <p className="text-text-muted text-xs">Gwei</p>
            </div>
            <div className="text-center">
              <p className="text-text-muted text-xs">📦 Base Fee</p>
              <p className="text-xl font-bold text-text-primary">
                {parseFloat(gas.suggestBaseFee || '0').toFixed(1)}
              </p>
              <p className="text-text-muted text-xs">Gwei</p>
            </div>
          </div>
        </div>
      )}

      {/* Multi-chain gas prices */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {(gasPrices as ChainGasPrice[]).map((chain) => (
          <div
            key={chain.chain}
            className="bg-surface-alt rounded-lg p-4 hover:bg-surface-alt/80 transition-colors"
          >
            <div className="flex items-center gap-2 mb-2">
              <span className="text-lg">
                {chain.chain === 'ethereum'
                  ? '🔷'
                  : chain.chain === 'polygon'
                    ? '💜'
                    : chain.chain === 'arbitrum'
                      ? '🔵'
                      : chain.chain === 'optimism'
                        ? '🔴'
                        : chain.chain === 'base'
                          ? '🔵'
                          : chain.chain === 'bsc'
                            ? '🟡'
                            : chain.chain === 'avalanche'
                              ? '🔺'
                              : '⛓️'}
              </span>
              <span className="font-medium text-text-primary capitalize">
                {chain.chain}
              </span>
            </div>

            <div className="space-y-1">
              <div className="flex justify-between">
                <span className="text-text-muted text-xs">Low</span>
                <span className={`text-sm font-medium ${getGasColor(chain.safeGas || chain.low || 0)}`}>
                  {(chain.safeGas ?? chain.low ?? 0).toFixed(1)} Gwei
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted text-xs">Standard</span>
                <span className={`text-sm font-medium ${getGasColor(chain.standardGas || chain.standard || 0)}`}>
                  {(chain.standardGas ?? chain.standard ?? 0).toFixed(1)} Gwei
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted text-xs">Fast</span>
                <span className={`text-sm font-medium ${getGasColor(chain.fastGas || chain.fast || 0)}`}>
                  {(chain.fastGas ?? chain.fast ?? 0).toFixed(1)} Gwei
                </span>
              </div>
            </div>

            {chain.baseFee && (
              <div className="mt-2 pt-2 border-t border-surface-border">
                <div className="flex justify-between">
                  <span className="text-text-muted text-xs">Base</span>
                  <span className="text-sm text-text-primary">
                    {chain.baseFee.toFixed(1)} Gwei
                  </span>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* ETH Supply Stats */}
      {supply && (
        <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-surface-alt rounded-lg p-3 text-center">
            <p className="text-text-muted text-xs">Total Supply</p>
            <p className="text-lg font-bold text-text-primary">
              {(parseFloat(supply.EthSupply) / 1e18 / 1e6).toFixed(2)}M ETH
            </p>
          </div>
          <div className="bg-surface-alt rounded-lg p-3 text-center">
            <p className="text-text-muted text-xs">Staked (ETH2)</p>
            <p className="text-lg font-bold text-blue-500">
              {(parseFloat(supply.Eth2Staking) / 1e18 / 1e6).toFixed(2)}M ETH
            </p>
          </div>
          <div className="bg-surface-alt rounded-lg p-3 text-center">
            <p className="text-text-muted text-xs">Burnt Fees</p>
            <p className="text-lg font-bold text-orange-500">
              {(parseFloat(supply.BurntFees) / 1e18 / 1e6).toFixed(2)}M ETH
            </p>
          </div>
          <div className="bg-surface-alt rounded-lg p-3 text-center">
            <p className="text-text-muted text-xs">Withdrawn</p>
            <p className="text-lg font-bold text-green-500">
              {(parseFloat(supply.WithdrawnTotal) / 1e18 / 1e6).toFixed(2)}M ETH
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export default MultiChainGasTracker;
