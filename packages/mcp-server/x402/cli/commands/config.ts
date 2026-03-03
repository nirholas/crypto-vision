/* config.ts | nichxbt | 6e696368-786274-4d43-5000-000000000000 */

/**
 * x402 CLI - Config Command
 * @description Configure x402 wallets and settings
 */

import { Command } from 'commander';
import chalk from 'chalk';
import prompts from 'prompts';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { loadX402Config, isEvmConfigured, isSvmConfigured, validateX402Config, SUPPORTED_CHAINS, type X402Network } from '../../config.js';
import { generateWallet } from '../utils/wallet.js';
import { shortenAddress } from '../utils/format.js';

const CONFIG_FILE = path.join(os.homedir(), '.x402', 'config.json');

export const configCommand = new Command('config')
  .description('Configure x402 wallets and settings')
  .action(async () => {
    console.log(chalk.cyan('\n⚙️  x402 Configuration\n'));

    const config = loadX402Config();
    const validation = validateX402Config(config);

    // Show current status
    console.log(chalk.white('Current Status:'));
    console.log(chalk.gray('─'.repeat(40)));
    
    if (isEvmConfigured()) {
      console.log(chalk.green('  ✓ EVM Wallet configured'));
    } else {
      console.log(chalk.yellow('  ✗ EVM Wallet not configured'));
    }
    
    if (isSvmConfigured()) {
      console.log(chalk.green('  ✓ SVM (Solana) Wallet configured'));
    } else {
      console.log(chalk.yellow('  ✗ SVM (Solana) Wallet not configured'));
    }
    
    const chainConfig = SUPPORTED_CHAINS[config.defaultChain as X402Network];
    console.log(chalk.gray(`    Default Chain: ${chainConfig?.name || config.defaultChain}`));
    console.log(chalk.gray(`    Gasless: ${config.enableGasless ? 'enabled' : 'disabled'}`));
    console.log(chalk.gray(`    Max Payment: $${config.maxPaymentPerRequest}`));

    if (!validation.valid) {
      console.log(chalk.yellow('\n  Warnings:'));
      validation.errors.forEach(err => {
        console.log(chalk.yellow(`    - ${err}`));
      });
    }

    console.log();

    // Menu
    const action = await prompts({
      type: 'select',
      name: 'value',
      message: 'What would you like to do?',
      choices: [
        { title: '🔑 Set EVM Private Key', value: 'set-key' },
        { title: '🌐 Change Default Chain', value: 'set-chain' },
        { title: '💰 Set Max Payment', value: 'set-max' },
        { title: '⚡ Toggle Gasless Payments', value: 'toggle-gasless' },
        { title: '🆕 Generate New Wallet', value: 'generate' },
        { title: '📋 Show Environment Setup', value: 'show-env' },
        { title: '🔍 Validate Configuration', value: 'validate' },
        { title: '❌ Exit', value: 'exit' },
      ],
    });

    switch (action.value) {
      case 'set-key':
        await setPrivateKey();
        break;
      case 'set-chain':
        await setChain();
        break;
      case 'set-max':
        await setMaxPayment();
        break;
      case 'toggle-gasless':
        toggleGasless(config);
        break;
      case 'generate':
        await generateNewWallet();
        break;
      case 'show-env':
        showEnvSetup(config);
        break;
      case 'validate':
        validateConfig(config);
        break;
      case 'exit':
        process.exit(0);
    }
  });

// @see https://github.com/nirholas/universal-crypto-mcp
// Subcommands
configCommand
  .command('show')
  .description('Show current configuration')
  .option('--json', 'Output as JSON')
  .action((options: { json?: boolean }) => {
    const config = loadX402Config();
    
    if (options.json) {
      // Don't show private key in JSON output
      const safeConfig = {
        ...config,
        evmPrivateKey: config.evmPrivateKey ? '****' : undefined,
        svmPrivateKey: config.svmPrivateKey ? '****' : undefined,
      };
      console.log(JSON.stringify(safeConfig, null, 2));
      return;
    }

    const chainConfig = SUPPORTED_CHAINS[config.defaultChain as X402Network];
    console.log(chalk.cyan('\n⚙️  Current Configuration\n'));
    console.log(chalk.white(`  Chain:       ${chainConfig?.name || config.defaultChain}`));
    console.log(chalk.white(`  EVM Wallet:  ${isEvmConfigured() ? 'Configured ✓' : 'Not set'}`));
    console.log(chalk.white(`  SVM Wallet:  ${isSvmConfigured() ? 'Configured ✓' : 'Not set'}`));
    console.log(chalk.white(`  Gasless:     ${config.enableGasless ? 'Enabled' : 'Disabled'}`));
    console.log(chalk.white(`  Max Payment: $${config.maxPaymentPerRequest}`));
    console.log(chalk.white(`  Debug:       ${config.debug ? 'Enabled' : 'Disabled'}`));
    console.log();
  });

configCommand
  .command('generate')
  .description('Generate a new wallet')
  .action(generateNewWallet);

async function setPrivateKey() {
  console.log(chalk.yellow('\n⚠️  Security Warning:'));
  console.log(chalk.gray('  Never share your private key with anyone.'));
  console.log(chalk.gray('  Store it securely and never commit it to version control.\n'));

  const response = await prompts({
    type: 'password',
    name: 'key',
    message: 'Enter your EVM private key (0x...):',
    validate: (value) => {
      if (!value.startsWith('0x') || value.length !== 66) {
        return 'Private key must be a 66-character hex string starting with 0x';
      }
      return true;
    },
  });

  if (!response.key) {
    console.log(chalk.yellow('\nCancelled.\n'));
    return;
  }

  console.log(chalk.green('\n✓ Private key validated\n'));
  console.log(chalk.white('Add this to your environment:\n'));
  console.log(chalk.cyan(`  export X402_EVM_PRIVATE_KEY=${response.key}\n`));
  console.log(chalk.gray('Or add to your .env file:'));
  console.log(chalk.gray(`  X402_EVM_PRIVATE_KEY=${response.key}\n`));
}

async function setChain() {
  const chains = Object.entries(SUPPORTED_CHAINS).map(([key, info]) => ({
    title: `${info.name}${info.testnet ? ' (testnet)' : ''}`,
    value: key,
  }));

  const response = await prompts({
    type: 'select',
    name: 'chain',
    message: 'Select default chain:',
    choices: chains,
  });

  if (!response.chain) {
    console.log(chalk.yellow('\nCancelled.\n'));
    return;
  }

  console.log(chalk.green(`\n✓ Chain set to ${SUPPORTED_CHAINS[response.chain as X402Network]?.name || response.chain}\n`));
  console.log(chalk.white('Add this to your environment:\n'));
  console.log(chalk.cyan(`  export X402_DEFAULT_CHAIN=${response.chain}\n`));
}

async function setMaxPayment() {
  const response = await prompts({
    type: 'text',
    name: 'max',
    message: 'Maximum payment per request (USD):',
    initial: '10.00',
    validate: (value) => {
      const num = parseFloat(value);
      if (isNaN(num) || num <= 0) {
        return 'Please enter a valid positive number';
      }
      return true;
    },
  });

  if (!response.max) {
    console.log(chalk.yellow('\nCancelled.\n'));
    return;
  }

  console.log(chalk.green(`\n✓ Max payment set to $${response.max}\n`));
  console.log(chalk.white('Add this to your environment:\n'));
  console.log(chalk.cyan(`  export X402_MAX_PAYMENT=${response.max}\n`));
}

function toggleGasless(config: ReturnType<typeof loadX402Config>) {
  const newValue = !config.enableGasless;
  console.log(chalk.green(`\n✓ Gasless payments ${newValue ? 'enabled' : 'disabled'}\n`));
  console.log(chalk.white('Add this to your environment:\n'));
  console.log(chalk.cyan(`  export X402_ENABLE_GASLESS=${newValue}\n`));
}

async function generateNewWallet() {
  console.log(chalk.cyan('\n🔑 Generating New Wallet\n'));

  const confirm = await prompts({
    type: 'confirm',
    name: 'value',
    message: 'Generate a new random wallet?',
    initial: true,
  });

  if (!confirm.value) {
    console.log(chalk.yellow('\nCancelled.\n'));
    return;
  }

  const wallet = generateWallet();

  console.log(chalk.green('\n✅ New Wallet Generated!\n'));
  console.log(chalk.red('⚠️  SAVE THIS INFORMATION SECURELY - IT WILL NOT BE SHOWN AGAIN!\n'));
  
  console.log(chalk.gray('─'.repeat(60)));
  console.log(chalk.white(`  Address:     ${wallet.address}`));
  console.log(chalk.white(`  Private Key: ${wallet.privateKey}`));
  console.log(chalk.gray('─'.repeat(60)));
  
  console.log(chalk.yellow('\n📋 To use this wallet, set the environment variable:\n'));
  console.log(chalk.cyan(`  export X402_EVM_PRIVATE_KEY=${wallet.privateKey}\n`));
  
  console.log(chalk.gray('Security tips:'));
  console.log(chalk.gray('  • Store the private key in a secure password manager'));
  console.log(chalk.gray('  • Never commit private keys to version control'));
  console.log(chalk.gray('  • Use environment variables or secure vaults\n'));
}

function showEnvSetup(config: ReturnType<typeof loadX402Config>) {
  console.log(chalk.cyan('\n📋 Environment Setup\n'));
  console.log(chalk.white('Add these to your shell profile or .env file:\n'));
  console.log(chalk.gray('─'.repeat(50)));
  console.log(chalk.green('# x402 Payment Configuration'));
  console.log(chalk.cyan(`export X402_EVM_PRIVATE_KEY="${config.evmPrivateKey || '0x...'}"  # Required for EVM`));
  console.log(chalk.cyan(`export X402_SVM_PRIVATE_KEY="${config.svmPrivateKey || '...'}"    # Required for Solana`));
  console.log(chalk.cyan(`export X402_DEFAULT_CHAIN="${config.defaultChain}"               # Optional`));
  console.log(chalk.cyan(`export X402_MAX_PAYMENT="${config.maxPaymentPerRequest}"         # Optional`));
  console.log(chalk.cyan(`export X402_ENABLE_GASLESS="${config.enableGasless}"             # Optional`));
  console.log(chalk.cyan(`export X402_DEBUG="false"                                        # Optional`));
  console.log(chalk.gray('─'.repeat(50)));
  console.log();
}

function validateConfig(config: ReturnType<typeof loadX402Config>) {
  console.log(chalk.cyan('\n🔍 Validating Configuration\n'));

  const validation = validateX402Config(config);

  if (validation.valid) {
    console.log(chalk.green('✅ Configuration is valid!\n'));
  } else {
    console.log(chalk.yellow('⚠️  Configuration issues:\n'));
    validation.errors.forEach(err => {
      console.log(chalk.yellow(`  • ${err}`));
    });
    console.log();
  }

  const chainConfig = SUPPORTED_CHAINS[config.defaultChain as X402Network];
  
  // Additional checks
  console.log(chalk.white('Detailed Status:'));
  console.log(chalk.gray('─'.repeat(40)));
  console.log(`  EVM Key:      ${isEvmConfigured() ? chalk.green('✓ Set') : chalk.red('✗ Not set')}`);
  console.log(`  SVM Key:      ${isSvmConfigured() ? chalk.green('✓ Set') : chalk.red('✗ Not set')}`);
  console.log(`  Chain:        ${chainConfig ? chalk.green('✓ Valid') : chalk.red('✗ Invalid')}`);
  console.log(`  Max Payment:  ${parseFloat(config.maxPaymentPerRequest) > 0 ? chalk.green('✓ Valid') : chalk.red('✗ Invalid')}`);
  console.log();
}


/* ucm:n1cha97aeed9 */