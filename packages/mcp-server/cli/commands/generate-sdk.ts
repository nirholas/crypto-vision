/**
 * SDK Generation CLI Command
 * Generates client SDKs for x402-enabled APIs
 *
 * @author nich
 * @github github.com/nirholas
 * @license Apache-2.0
 */

import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import {
  type SDKConfig,
  generateTypeScriptSDK,
  generatePythonSDK,
  generateGoSDK,
} from '../../sdk-generator/index.js';

// ANSI colors
const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  red: '\x1b[31m',
  magenta: '\x1b[35m',
};

const c = (color: keyof typeof colors, text: string) =>
  `${colors[color]}${text}${colors.reset}`;

export interface GenerateSDKOptions {
  /** Language to generate: typescript, python, go, or all */
  language: 'typescript' | 'python' | 'go' | 'all';
  /** Output directory */
  output?: string;
  /** API name */
  name?: string;
  /** API URL */
  url?: string;
  /** Wallet address */
  wallet?: `0x${string}`;
  /** Facilitator URL */
  facilitator?: string;
  /** Route pricing configuration */
  routes?: Record<string, string>;
}

/**
 * Load configuration from x402.config.json or environment
 */
async function loadConfig(): Promise<{
  name: string;
  url: string;
  payment: {
    wallet: `0x${string}`;
    facilitator: string;
    network?: string;
  };
  pricing: {
    routes: Record<string, string>;
  };
  description?: string;
}> {
  // Try to load from config file
  const configPath = join(process.cwd(), 'x402.config.json');
  
  if (existsSync(configPath)) {
    const { readFileSync } = await import('fs');
    const configContent = readFileSync(configPath, 'utf-8');
    return JSON.parse(configContent);
  }

  // Return defaults if no config file
  return {
    name: process.env.X402_API_NAME || 'my-api',
    url: process.env.X402_API_URL || 'https://api.example.com',
    payment: {
      wallet: (process.env.X402_WALLET || '0x40252CFDF8B20Ed757D61ff157719F33Ec332402') as `0x${string}`,
      facilitator: process.env.X402_FACILITATOR || 'https://facilitator.x402.org',
      network: process.env.X402_NETWORK || 'eip155:8453',
    },
    pricing: {
      routes: {
        'GET /data': '0.001',
        'POST /data': '0.002',
      }
    }
  };
}

/**
 * Ensure directory exists
 */
function ensureDir(dirPath: string): void {
  if (!existsSync(dirPath)) {
    mkdirSync(dirPath, { recursive: true });
  }
}

/**
 * Simple spinner for CLI feedback
 */
function createSpinner(text: string) {
  const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
  let i = 0;
  let intervalId: NodeJS.Timeout | null = null;

  return {
    start: () => {
      process.stdout.write(`${frames[0]} ${text}`);
      intervalId = setInterval(() => {
        i = (i + 1) % frames.length;
        process.stdout.write(`\r${frames[i]} ${text}`);
      }, 80);
    },
    succeed: (msg: string) => {
      if (intervalId) clearInterval(intervalId);
      process.stdout.write(`\r${c('green', '✓')} ${msg}\n`);
    },
    fail: (msg: string) => {
      if (intervalId) clearInterval(intervalId);
      process.stdout.write(`\r${c('red', '✗')} ${msg}\n`);
    },
    update: (msg: string) => {
      process.stdout.write(`\r${frames[i]} ${msg}`);
    }
  };
}

/**
 * Generate SDK command
 */
export async function generateSDKCommand(options: GenerateSDKOptions): Promise<void> {
  console.log(c('bold', c('cyan', '\n🔧 Generating SDK...\n')));

  const spinner = createSpinner('Loading configuration...');
  spinner.start();

  let config: Awaited<ReturnType<typeof loadConfig>>;
  try {
    config = await loadConfig();
  } catch (error) {
    spinner.fail('Failed to load configuration');
    console.error(c('red', `Error: ${error}`));
    return;
  }

  spinner.succeed('Configuration loaded');

  // Build SDK config from loaded config and options
  const sdkConfig: SDKConfig = {
    apiName: options.name || config.name,
    apiUrl: options.url || config.url,
    wallet: options.wallet || config.payment.wallet,
    facilitator: options.facilitator || config.payment.facilitator,
    routes: options.routes || config.pricing.routes,
  };

  const generators = {
    typescript: { generate: generateTypeScriptSDK, ext: 'ts', dir: 'typescript' },
    python: { generate: generatePythonSDK, ext: 'py', dir: 'python' },
    go: { generate: generateGoSDK, ext: 'go', dir: 'go' },
  };

  const languages = options.language === 'all'
    ? (['typescript', 'python', 'go'] as const)
    : [options.language];

  const baseOutputDir = options.output || './sdk';

  for (const lang of languages) {
    const langSpinner = createSpinner(`Generating ${lang} SDK...`);
    langSpinner.start();

    try {
      const { generate, ext, dir } = generators[lang];
      const result = generate(sdkConfig);

      const outputDir = join(baseOutputDir, dir);
      ensureDir(outputDir);

      const outputPath = join(outputDir, `client.${ext}`);
      writeFileSync(outputPath, result.code);

      langSpinner.succeed(`Generated ${lang} SDK: ${outputPath}`);
    } catch (error) {
      langSpinner.fail(`Failed to generate ${lang} SDK: ${error}`);
    }
  }

  console.log(c('green', '\n✓ SDK generation complete!\n'));
  console.log(c('dim', 'Usage examples:'));

  if (languages.includes('typescript')) {
    console.log(c('cyan', '\nTypeScript:'));
    console.log(c('dim', `  import { ${sdkConfig.apiName.replace(/[-_\s]+(.)?/g, (_, char) => char ? char.toUpperCase() : '').replace(/^./, char => char.toUpperCase())}Client } from './sdk/typescript/client';
  const client = new ${sdkConfig.apiName.replace(/[-_\s]+(.)?/g, (_, char) => char ? char.toUpperCase() : '').replace(/^./, char => char.toUpperCase())}Client({ payerPrivateKey: '0x...' });
  const result = await client.getData();`));
  }

  if (languages.includes('python')) {
    console.log(c('cyan', '\nPython:'));
    console.log(c('dim', `  from sdk.python.client import ${sdkConfig.apiName.replace(/[-_\s]+(.)?/g, (_, char) => char ? char.toUpperCase() : '').replace(/^./, char => char.toUpperCase())}Client
  client = ${sdkConfig.apiName.replace(/[-_\s]+(.)?/g, (_, char) => char ? char.toUpperCase() : '').replace(/^./, char => char.toUpperCase())}Client(payer_private_key='0x...')
  result = client.get_data()`));
  }

  if (languages.includes('go')) {
    const packageName = sdkConfig.apiName.toLowerCase().replace(/[^a-z0-9]/g, '');
    console.log(c('cyan', '\nGo:'));
    console.log(c('dim', `  import "${packageName}/sdk/go"
  client := ${packageName}.NewClient(${packageName}.WithPayerKey("0x..."))
  result, err := client.GetData()`));
  }

  console.log();
}

export default generateSDKCommand;
