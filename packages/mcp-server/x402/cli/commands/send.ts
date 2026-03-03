/*
 * ═══════════════════════════════════════════════════════════════
 *  universal-crypto-mcp | nich.xbt
 *  ID: n1ch-0las-4e49-4348-786274000000
 * ═══════════════════════════════════════════════════════════════
 */

/**
 * x402 CLI - Send Command
 * @description Send payments to addresses
 */

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import prompts from 'prompts';
import { loadX402Config, isEvmConfigured, SUPPORTED_CHAINS } from '../../config.js';
import { X402Client } from '../../sdk/client.js';
import type { X402Token, X402Chain } from '../../sdk/types.js';
import { formatUSD, formatTxLink } from '../utils/format.js';

interface SendOptions {
  chain?: string;
  memo?: string;
  gasless?: boolean;
  yes?: boolean;
  json?: boolean;
}

export const sendCommand = new Command('send')
  .description('Send payment to an address')
  .argument('[to]', 'Recipient address (0x...)')
  .argument('[amount]', 'Amount to send')
  .argument('[token]', 'Token to send (default: USDC)')
  .option('-c, --chain <chain>', 'Chain to use')
  .option('-m, --memo <memo>', 'Payment memo/note')
  .option('--gasless', 'Use gasless transfer (EIP-3009)')
  .option('-y, --yes', 'Skip confirmation')
  .option('--json', 'Output as JSON')
  .action(async (to: string | undefined, amount: string | undefined, token: string | undefined, options: SendOptions) => {
    const config = loadX402Config();

    if (!isEvmConfigured()) {
      console.log(chalk.red('\n❌ Wallet not configured\n'));
      console.log(chalk.white('Set your private key:'));
      console.log(chalk.cyan('  export X402_EVM_PRIVATE_KEY=0x...\n'));
      process.exit(1);
    }

    // Interactive mode if arguments not provided
    if (!to || !amount) {
      console.log(chalk.cyan('\n💸 Send Payment\n'));

      const response = await prompts([
        {
          type: 'text',
          name: 'to',
          message: 'Recipient address:',
          initial: to || '',
          validate: (value) => {
            if (!value.match(/^0x[a-fA-F0-9]{40}$/)) {
              return 'Please enter a valid Ethereum address (0x...)';
            }
            return true;
          },
        },
        {
          type: 'text',
          name: 'amount',
          message: 'Amount to send:',
          initial: amount || '',
          validate: (value) => {
            const num = parseFloat(value);
            if (isNaN(num) || num <= 0) {
              return 'Please enter a valid positive amount';
            }
            return true;
          },
        },
        {
          type: 'select',
          name: 'token',
          message: 'Select token:',
          choices: [
            { title: 'USDC', value: 'USDC' },
            { title: 'USDT', value: 'USDT' },
            { title: 'USDs (Sperax)', value: 'USDs' },
            { title: 'ETH', value: 'ETH' },
          ],
          initial: 0,
        },
        {
          type: 'text',
          name: 'memo',
          message: 'Memo (optional):',
        },
      ], {
        onCancel: () => {
          console.log(chalk.yellow('\nPayment cancelled.\n'));
          process.exit(0);
        },
      });

      to = response.to;
      amount = response.amount;
      token = response.token;
      options.memo = response.memo;
    }

    token = token || 'USDC';
    const chain = (options.chain || config.defaultChain || 'base-sepolia') as X402Chain;

    // Validate chain
    if (!SUPPORTED_CHAINS[chain as X402Chain]) {
      console.log(chalk.red(`\n❌ Unknown chain: ${chain}\n`));
      process.exit(1);
    }

    const chainConfig = SUPPORTED_CHAINS[chain as X402Chain];

    // Confirmation
    if (!options.yes) {
      console.log(chalk.yellow('\n📝 Payment Summary\n'));
      console.log(chalk.white(`  To:      ${to}`));
      console.log(chalk.white(`  Amount:  ${formatUSD(amount)} ${token}`));
      console.log(chalk.white(`  Chain:   ${chainConfig?.name || chain}`));
      if (options.memo) {
        console.log(chalk.white(`  Memo:    ${options.memo}`));
      }
      console.log();

      const confirm = await prompts({
        type: 'confirm',
        name: 'value',
        message: 'Confirm payment?',
        initial: false,
      });

      if (!confirm.value) {
        console.log(chalk.yellow('\nPayment cancelled.\n'));
        process.exit(0);
      }
    }

    const spinner = ora('Sending payment...').start();

    try {
      const client = new X402Client({
        chain: chain,
        privateKey: config.evmPrivateKey,
        enableGasless: options.gasless ?? config.enableGasless,
      });

      // Check balance first
      spinner.text = 'Checking balance...';
      const address = await client.getAddress();
      const balance = await client.getBalance(address);
      
      if (parseFloat(balance.formatted || '0') < parseFloat(amount!)) {
        spinner.fail('Insufficient balance');
        console.log(chalk.red(`\n❌ Insufficient ${token} balance`));
        console.log(chalk.gray(`   Available: ${balance.formatted || '0'} ${token}`));
        console.log(chalk.gray(`   Required:  ${amount} ${token}\n`));
        process.exit(1);
      }

      // Send payment
      spinner.text = 'Sending transaction...';
      const result = await client.pay(to!, amount!, token as X402Token);

      spinner.succeed('Payment sent!');

      if (options.json) {
        console.log(JSON.stringify(result, null, 2));
        return;
      }

      console.log(chalk.green('\n✅ Payment Successful!\n'));
      console.log(chalk.white(`  Transaction: ${result.hash}`));
      console.log(chalk.white(`  Amount:      ${formatUSD(amount)} ${token}`));
      console.log(chalk.white(`  To:          ${to}`));
      console.log(chalk.cyan(`\n  🔗 ${formatTxLink(result.hash, chain)}\n`));

    } catch (error) {
      spinner.fail('Payment failed');
      console.error(chalk.red(`\nError: ${error instanceof Error ? error.message : error}\n`));
      process.exit(1);
    }
  });


/* ucm:n1ch98c1f9a1 */