#!/usr/bin/env node
/**
 * x402 CLI - Command Line Interface for x402 Payment Protocol
 * @description Beautiful CLI for interacting with x402 payments
 * @author nirholas
 * @license Apache-2.0
 * 
 * @example
 * ```bash
 * # Get help
 * npx @nirholas/universal-crypto-mcp x402 --help
 * 
 * # Check balance
 * x402 balance
 * 
 * # Send payment
 * x402 send 0x... 1.00 USDs
 * 
 * # Make paid request
 * x402 pay https://api.example.com/data
 * ```
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { balanceCommand } from './commands/balance.js';
import { sendCommand } from './commands/send.js';
import { payCommand } from './commands/pay.js';
import { configCommand } from './commands/config.js';
import { historyCommand } from './commands/history.js';
import { networksCommand } from './commands/networks.js';

const VERSION = '1.0.0';

// ASCII art banner
const banner = chalk.cyan(`
 ██╗  ██╗██╗  ██╗ ██████╗ ██████╗ 
 ╚██╗██╔╝██║  ██║██╔═████╗╚════██╗
  ╚███╔╝ ███████║██║██╔██║ █████╔╝
  ██╔██╗ ╚════██║████╔╝██║██╔═══╝ 
 ██╔╝ ██╗     ██║╚██████╔╝███████╗
 ╚═╝  ╚═╝     ╚═╝ ╚═════╝ ╚══════╝
`) + chalk.gray('  HTTP 402 Payment Protocol CLI\n');

const program = new Command();

program
  .name('x402')
  .description(banner + chalk.white('CLI tools for x402 payment protocol - make and receive crypto payments'))
  .version(VERSION, '-v, --version', 'Display version number')
  .addHelpText('after', `
${chalk.yellow('Examples:')}
  ${chalk.gray('$')} x402 balance              ${chalk.gray('# Check wallet balances')}
  ${chalk.gray('$')} x402 send <to> <amount>   ${chalk.gray('# Send payment')}
  ${chalk.gray('$')} x402 pay <url>            ${chalk.gray('# Make paid HTTP request')}
  ${chalk.gray('$')} x402 history              ${chalk.gray('# View payment history')}
  ${chalk.gray('$')} x402 config               ${chalk.gray('# Configure wallets')}
  ${chalk.gray('$')} x402 testnet              ${chalk.gray('# Switch to testnet')}
  ${chalk.gray('$')} x402 mainnet              ${chalk.gray('# Switch to mainnet')}

${chalk.yellow('Environment Variables:')}
  ${chalk.green('X402_PRIVATE_KEY')}     EVM private key for payments
  ${chalk.green('X402_CHAIN')}           Default chain (arbitrum, base, etc.)
  ${chalk.green('X402_MAX_PAYMENT')}     Maximum payment per request
  ${chalk.green('X402_ENABLE_GASLESS')}  Enable gasless payments (true/false)

${chalk.yellow('Documentation:')}
  ${chalk.blue('https://x402.org/docs')}
`);

// Register commands
program.addCommand(balanceCommand);
program.addCommand(sendCommand);
program.addCommand(payCommand);
program.addCommand(configCommand);
program.addCommand(historyCommand);
program.addCommand(networksCommand);

// Testnet shortcut
program
  .command('testnet')
  .description('Switch to testnet (Arbitrum Sepolia)')
  .action(() => {
    console.log(chalk.yellow('\n🔧 Switching to testnet...\n'));
    console.log(chalk.white('Set the following environment variable:\n'));
    console.log(chalk.cyan('  export X402_CHAIN=arbitrum-sepolia\n'));
    console.log(chalk.gray('Or add to your .env file:'));
    console.log(chalk.gray('  X402_CHAIN=arbitrum-sepolia\n'));
    console.log(chalk.green('✓ Testnet configuration ready'));
    console.log(chalk.gray('\n  Get testnet tokens: https://faucet.arbitrum.io\n'));
  });

// Mainnet shortcut
program
  .command('mainnet')
  .description('Switch to mainnet (Arbitrum One)')
  .action(() => {
    console.log(chalk.yellow('\n🚀 Switching to mainnet...\n'));
    console.log(chalk.white('Set the following environment variable:\n'));
    console.log(chalk.cyan('  export X402_CHAIN=arbitrum\n'));
    console.log(chalk.gray('Or add to your .env file:'));
    console.log(chalk.gray('  X402_CHAIN=arbitrum\n'));
    console.log(chalk.green('✓ Mainnet configuration ready'));
    console.log(chalk.red('\n  ⚠️  Warning: Real funds will be used on mainnet!\n'));
  });

// Parse arguments
program.parse(process.argv);

// Show help if no command provided
if (!process.argv.slice(2).length) {
  program.outputHelp();
}
