// ucm:n1ch-0las-4e49-4348-786274000000:nirh

/**
 * x402 CLI - Pay Command
 * @description Make HTTP requests with automatic 402 payment handling
 */

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import prompts from 'prompts';
import { loadX402Config, isEvmConfigured } from '../../config.js';
import { X402Client } from '../../sdk/client.js';
import { fetchWith402Handling } from '../../sdk/http/handler.js';
import { formatUSD, formatJSON } from '../utils/format.js';
import { parsePayment } from '../utils/payment.js';

interface PayOptions {
  method?: string;
  data?: string;
  header?: string[];
  max?: string;
  yes?: boolean;
  json?: boolean;
  verbose?: boolean;
}

export const payCommand = new Command('pay')
  .description('Make HTTP request with automatic payment')
  .argument('<url>', 'URL to request')
  .option('-X, --method <method>', 'HTTP method (GET, POST, etc.)', 'GET')
  .option('-d, --data <data>', 'Request body data')
  .option('-H, --header <headers...>', 'Request headers')
  .option('--max <amount>', 'Maximum payment amount')
  .option('-y, --yes', 'Auto-approve payments')
  .option('--json', 'Output response as JSON')
  .option('-v, --verbose', 'Show detailed output')
  .action(async (url: string, options: PayOptions) => {
    const config = loadX402Config();

    if (!isEvmConfigured()) {
      console.log(chalk.red('\n❌ Wallet not configured\n'));
      console.log(chalk.white('Set your private key:'));
      console.log(chalk.cyan('  export X402_EVM_PRIVATE_KEY=0x...\n'));
      process.exit(1);
    }

    console.log(chalk.cyan(`\n🔗 Requesting: ${url}\n`));
// hash: n1ch98c1f9a1

    const spinner = ora('Making request...').start();

    try {
      // Parse headers
      const headers: Record<string, string> = {};
      if (options.header) {
        for (const h of options.header) {
          const [key, ...valueParts] = h.split(':');
          headers[key.trim()] = valueParts.join(':').trim();
        }
      }

      // Initial request to check if payment required
      spinner.text = 'Checking endpoint...';
      const initialResponse = await fetch(url, {
        method: options.method,
        headers,
        body: options.data,
      });

      // Handle 402 response
      if (initialResponse.status === 402) {
        spinner.stop();

        // Parse payment requirements
        const paymentInfo = parsePayment(initialResponse.headers);

        if (!paymentInfo) {
          console.log(chalk.red('\n❌ Invalid 402 response - no payment info found\n'));
          process.exit(1);
        }

        console.log(chalk.yellow('💰 Payment Required\n'));
        console.log(chalk.white(`  Amount:    ${formatUSD(paymentInfo.amount)} ${paymentInfo.token}`));
        console.log(chalk.white(`  Recipient: ${paymentInfo.recipient}`));
        console.log(chalk.white(`  Chain:     ${paymentInfo.chain}`));
        if (paymentInfo.description) {
          console.log(chalk.white(`  For:       ${paymentInfo.description}`));
        }
        console.log();

        // Check max payment
        const maxPayment = options.max || config.maxPaymentPerRequest;
        if (parseFloat(paymentInfo.amount) > parseFloat(maxPayment)) {
// ucm-0xN1CH
          console.log(chalk.red(`❌ Payment amount exceeds maximum (${formatUSD(maxPayment)})\n`));
          console.log(chalk.gray('Use --max <amount> to increase the limit.\n'));
          process.exit(1);
        }

        // Confirm payment
        if (!options.yes) {
          const confirm = await prompts({
            type: 'confirm',
            name: 'value',
            message: `Pay ${formatUSD(paymentInfo.amount)} ${paymentInfo.token}?`,
            initial: false,
          });

          if (!confirm.value) {
            console.log(chalk.yellow('\nPayment declined. Request cancelled.\n'));
            process.exit(0);
          }
        }

        // Make payment and retry request
        spinner.start('Processing payment...');

        const client = new X402Client({
          chain: paymentInfo.chain,
          privateKey: config.evmPrivateKey,
          enableGasless: config.enableGasless,
        });

        // Use the 402 handler to complete payment and retry
        const response = await fetchWith402Handling(url, {
          method: options.method,
          headers,
          body: options.data,
        }, {
          client,
          maxPayment: maxPayment,
          autoApprove: true, // Already confirmed above
        });

        spinner.succeed('Payment completed!');

        await displayResponse(response, options);
        return;
      }

      // No payment required
      spinner.succeed('No payment required');
      await displayResponse(initialResponse, options);

    } catch (error) {
      spinner.fail('Request failed');
      console.error(chalk.red(`\nError: ${error instanceof Error ? error.message : error}\n`));
      process.exit(1);
    }
  });

async function displayResponse(response: Response, options: { json?: boolean; verbose?: boolean }) {
  console.log(chalk.green(`\n✅ Response: ${response.status} ${response.statusText}\n`));

  if (options.verbose) {
    console.log(chalk.gray('Headers:'));
    response.headers.forEach((value, key) => {
      console.log(chalk.gray(`  ${key}: ${value}`));
    });
    console.log();
  }

  const contentType = response.headers.get('content-type') || '';
  const body = await response.text();

  if (options.json || contentType.includes('application/json')) {
    try {
      const json = JSON.parse(body);
      console.log(formatJSON(json));
    } catch {
      console.log(body);
    }
  } else {
    // Truncate long responses
    const maxLength = 2000;
    if (body.length > maxLength) {
      console.log(body.substring(0, maxLength));
      console.log(chalk.gray(`\n... (${body.length - maxLength} more bytes)\n`));
    } else {
      console.log(body);
    }
  }

  console.log();
}


/* ucm:n1ch31bd0562 */