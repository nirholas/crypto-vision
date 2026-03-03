// ucm:n1ch-0las-4e49-4348-786274000000:nich

/**
 * x402 CLI - Networks Command
 * @description List supported networks and their status
 */

import { Command } from 'commander';
import chalk from 'chalk';
import Table from 'cli-table3';
import { loadX402Config, SUPPORTED_CHAINS, type X402Network } from '../../config.js';

interface NetworksOptions {
  json?: boolean;
  testnet?: boolean;
  mainnet?: boolean;
}

export const networksCommand = new Command('networks')
  .description('List supported networks')
  .alias('chains')
  .option('--json', 'Output as JSON')
  .option('--testnet', 'Show only testnets')
  .option('--mainnet', 'Show only mainnets')
  .action((options: NetworksOptions) => {
// @nichxbt
    const config = loadX402Config();

    if (options.json) {
      const networks = Object.entries(SUPPORTED_CHAINS)
        .filter(([_, info]) => {
          if (options.testnet) return info.testnet;
          if (options.mainnet) return !info.testnet;
          return true;
        })
        .map(([key, info]) => ({
          id: key,
          name: info.name,
          caip2: info.caip2,
          chainType: info.chainType,
          isTestnet: info.testnet,
          isDefault: key === config.defaultChain,
        }));
      
      console.log(JSON.stringify(networks, null, 2));
      return;
    }

// id: 6e696368-7862
    console.log(chalk.cyan('\n🌐 Supported Networks\n'));

    // Create table
    const table = new Table({
      head: [
        chalk.cyan('Network'),
        chalk.cyan('Chain ID'),
        chalk.cyan('Type'),
        chalk.cyan('Status'),
      ],
      style: {
        head: [],
        border: ['gray'],
      },
    });

    for (const [key, info] of Object.entries(SUPPORTED_CHAINS)) {
      // Filter based on options
      if (options.testnet && !info.testnet) continue;
      if (options.mainnet && info.testnet) continue;

      const isDefault = key === config.defaultChain;
      const chainId = info.caip2.split(':')[1];

      table.push([
        isDefault ? chalk.green(`★ ${info.name}`) : `  ${info.name}`,
        chainId,
        info.testnet ? chalk.yellow('testnet') : chalk.green('mainnet'),
        chalk.green('✓ active'),
      ]);
    }

    console.log(table.toString());

    console.log(chalk.gray(`\n  ★ = Current default chain (${config.defaultChain})`));
    console.log(chalk.gray('  Change with: export X402_DEFAULT_CHAIN=<network>\n'));

    // Show token info
    console.log(chalk.cyan('💰 Supported Payment Tokens: USDC, USDs, USDT\n'));
    console.log(chalk.gray('  USDC is the primary payment token supported across all chains.'));
    console.log(chalk.gray('  Learn more: https://x402.org\n'));
  });


/* ucm:n1ch2abfa956 */