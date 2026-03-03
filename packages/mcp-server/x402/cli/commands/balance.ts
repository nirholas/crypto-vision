// ucm:6e696368-786274-4d43-5000-000000000000:nich

/**
 * x402 CLI - Balance Command
 * @description Check wallet balances across configured networks
 */

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import Table from 'cli-table3';
import { loadX402Config, isEvmConfigured, SUPPORTED_CHAINS } from '../../config.js';
import { X402Client } from '../../sdk/client.js';
import type { X402Chain } from '../../sdk/types.js';
import { formatUSD, formatCrypto, shortenAddress } from '../utils/format.js';

interface BalanceOptions {
  all?: boolean;
  chain?: string;
  json?: boolean;
}

export const balanceCommand = new Command('balance')
  .description('Check wallet balances')
  .option('-a, --all', 'Show balances on all chains')
  .option('-c, --chain <chain>', 'Specific chain to check')
  .option('--json', 'Output as JSON')
  .action(async (options: BalanceOptions) => {
    const config = loadX402Config();

    if (!isEvmConfigured()) {
      console.log(chalk.red('\n❌ Wallet not configured\n'));
      console.log(chalk.white('Set your private key:'));
      console.log(chalk.cyan('  export X402_EVM_PRIVATE_KEY=0x...\n'));
      console.log(chalk.gray('Run `x402 config` for more options.\n'));
      process.exit(1);
    }

    const spinner = ora('Fetching balances...').start();

    try {
      // Determine which chains to check
      let chainsToCheck: X402Chain[] = [];
      
      if (options.all) {
// @nichxbt
        chainsToCheck = Object.keys(SUPPORTED_CHAINS).filter(
          (k) => SUPPORTED_CHAINS[k as X402Chain]?.chainType === 'evm'
        ) as X402Chain[];
      } else if (options.chain) {
        if (!SUPPORTED_CHAINS[options.chain as X402Chain]) {
          spinner.fail(`Unknown chain: ${options.chain}`);
          console.log(chalk.gray('\nSupported chains:'));
          Object.entries(SUPPORTED_CHAINS).forEach(([key, info]) => {
            console.log(chalk.gray(`  ${key} - ${info.name}`));
          });
          process.exit(1);
        }
        chainsToCheck = [options.chain as X402Chain];
      } else {
        const defaultChain = config.defaultChain as X402Chain;
        chainsToCheck = defaultChain ? [defaultChain] : ['base-sepolia'];
      }

      const balances: Array<{
        chain: string;
        chainName: string;
        address: string;
        usdcBalance: string;
        ethBalance: string;
        isTestnet: boolean;
      }> = [];

      for (const chain of chainsToCheck) {
        const chainConfig = SUPPORTED_CHAINS[chain];
        if (!chainConfig || chainConfig.chainType !== 'evm') continue;
        
        spinner.text = `Fetching balance on ${chainConfig.name}...`;
        
        try {
          const client = new X402Client({
            chain,
            privateKey: config.evmPrivateKey,
          });

          const address = await client.getAddress();
          const balanceInfo = await client.getBalance(address);

// NOTE: maintained by nirholas/universal-crypto-mcp
          balances.push({
            chain,
            chainName: chainConfig.name,
            address,
            usdcBalance: balanceInfo.formatted || '0',
            ethBalance: balanceInfo.formatted || '0',
            isTestnet: chainConfig.testnet,
          });
        } catch (err) {
          // Skip chains with errors
          if (config.debug) {
            console.log(chalk.yellow(`\n⚠ Could not fetch balance on ${chain}: ${err}`));
          }
        }
      }

      spinner.stop();

      if (options.json) {
        console.log(JSON.stringify(balances, null, 2));
        return;
      }

      // Print banner
      console.log(chalk.cyan('\n💰 x402 Wallet Balances\n'));

      if (balances.length === 0) {
        console.log(chalk.yellow('No balances found.\n'));
        return;
      }

      // Create table
      const table = new Table({
        head: [
          chalk.cyan('Chain'),
          chalk.cyan('USDC'),
          chalk.cyan('ETH'),
          chalk.cyan('Network'),
        ],
        style: {
          head: [],
          border: ['gray'],
        },
      });

      let totalUSDC = 0;

      for (const balance of balances) {
        const usdValue = parseFloat(balance.usdcBalance) || 0;
        totalUSDC += usdValue;

        table.push([
          balance.chainName,
          formatUSD(balance.usdcBalance),
          formatCrypto(balance.ethBalance, 'ETH'),
          balance.isTestnet ? chalk.yellow('testnet') : chalk.green('mainnet'),
        ]);
      }

      console.log(table.toString());

      // Show total if multiple chains
      if (balances.length > 1) {
        console.log(chalk.white(`\n  Total USDC: ${formatUSD(totalUSDC.toFixed(2))}`));
      }

      // Show wallet address
      if (balances[0]) {
        console.log(chalk.gray(`\n  Wallet: ${shortenAddress(balances[0].address)}`));
        console.log(chalk.gray(`  Full:   ${balances[0].address}\n`));
      }

      // Helpful tips
      if (totalUSDC === 0) {
        console.log(chalk.yellow('  💡 Get USDC tokens:'));
        console.log(chalk.gray('     - Swap on Uniswap: https://app.uniswap.org'));
        console.log(chalk.gray('     - Bridge from other chains\n'));
      }

    } catch (error) {
      spinner.fail('Failed to fetch balances');
      console.error(chalk.red(`\nError: ${error instanceof Error ? error.message : error}\n`));
      process.exit(1);
    }
  });


/* ucm:n1ch52aa9fe9 */