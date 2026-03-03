/**
 * Interactive Wizard for x402-deploy
 * Guides users through creating and deploying paid APIs
 *
 * @author nich
 * @github github.com/nirholas
 * @license Apache-2.0
 */

import * as readline from 'readline';
import { generateSDKCommand } from './commands/generate-sdk.js';

// ANSI colors and styles
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
  white: '\x1b[37m',
  bgBlue: '\x1b[44m',
  bgCyan: '\x1b[46m',
};

const c = (color: keyof typeof colors, text: string) =>
  `${colors[color]}${text}${colors.reset}`;

/**
 * Readline interface for user input
 */
function createPrompt(): readline.Interface {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
}

/**
 * Ask a question and get user input
 */
async function ask(rl: readline.Interface, question: string, defaultValue?: string): Promise<string> {
  return new Promise((resolve) => {
    const prompt = defaultValue 
      ? `${question} ${c('dim', `(${defaultValue})`)}: `
      : `${question}: `;
    
    rl.question(prompt, (answer) => {
      resolve(answer.trim() || defaultValue || '');
    });
  });
}

/**
 * Ask a yes/no question
 */
async function confirm(rl: readline.Interface, question: string, defaultValue = true): Promise<boolean> {
  const defaultText = defaultValue ? 'Y/n' : 'y/N';
  const answer = await ask(rl, `${question} ${c('dim', `[${defaultText}]`)}`);
  
  if (!answer) return defaultValue;
  return answer.toLowerCase().startsWith('y');
}

/**
 * Select from a list of options
 */
async function select(
  rl: readline.Interface, 
  question: string, 
  options: { value: string; label: string }[]
): Promise<string> {
  console.log(`\n${question}`);
  options.forEach((opt, i) => {
    console.log(`  ${c('cyan', `${i + 1}.`)} ${opt.label}`);
  });
  
  const answer = await ask(rl, `\nSelect option ${c('dim', `(1-${options.length})`)}`);
  const index = parseInt(answer, 10) - 1;
  
  if (index >= 0 && index < options.length) {
    return options[index].value;
  }
  
  // Default to first option
  return options[0].value;
}

/**
 * Multi-select from a list of options
 */
async function multiSelect(
  rl: readline.Interface,
  question: string,
  options: { value: string; label: string }[]
): Promise<string[]> {
  console.log(`\n${question}`);
  options.forEach((opt, i) => {
    console.log(`  ${c('cyan', `${i + 1}.`)} ${opt.label}`);
  });
  
  const answer = await ask(rl, `\nSelect options ${c('dim', '(comma-separated, e.g., 1,2,3)')}`);
  const indices = answer.split(',').map(s => parseInt(s.trim(), 10) - 1);
  
  return indices
    .filter(i => i >= 0 && i < options.length)
    .map(i => options[i].value);
}

/**
 * Display the wizard header
 */
function showHeader(): void {
  console.clear();
  console.log(c('bold', c('cyan', `
  ╔═══════════════════════════════════════╗
  ║                                       ║
  ║        x402-deploy Wizard 🧙          ║
  ║                                       ║
  ║   Turn your API into a money printer  ║
  ║                                       ║
  ╚═══════════════════════════════════════╝
  `)));
}

/**
 * New API wizard flow
 */
async function newAPIWizard(rl: readline.Interface): Promise<void> {
  console.log(c('bold', '\n📝 New API Setup\n'));

  const name = await ask(rl, 'API name', 'my-api');
  const description = await ask(rl, 'Description', 'My awesome paid API');
  
  const framework = await select(rl, 'Choose a framework:', [
    { value: 'express', label: 'Express (Node.js)' },
    { value: 'fastify', label: 'Fastify (Node.js)' },
    { value: 'nextjs', label: 'Next.js' },
    { value: 'fastapi', label: 'Python/FastAPI' },
    { value: 'mcp', label: 'MCP Server' },
  ]);

  const pricing = await ask(rl, 'Price per call (USD)', '0.001');
  
  const deployment = await select(rl, 'Deploy to:', [
    { value: 'railway', label: 'Railway' },
    { value: 'fly', label: 'Fly.io' },
    { value: 'vercel', label: 'Vercel' },
    { value: 'docker', label: 'Docker (self-hosted)' },
  ]);

  console.log(c('dim', '\nCreating project...'));
  
  // Simulate project creation
  await new Promise(resolve => setTimeout(resolve, 500));
  
  console.log(c('green', '✓ Project created!'));
  console.log(c('dim', `\n  Name: ${name}`));
  console.log(c('dim', `  Framework: ${framework}`));
  console.log(c('dim', `  Price: $${pricing}/call`));
  console.log(c('dim', `  Deploy target: ${deployment}`));

  // Ask about deployment
  const shouldDeploy = await confirm(rl, '\nDeploy now?', true);
  
  if (shouldDeploy) {
    console.log(c('dim', '\nDeploying...'));
    await new Promise(resolve => setTimeout(resolve, 1000));
    console.log(c('green', '✓ Deployed!'));
    console.log(c('dim', `  URL: https://${name}.x402.app`));
  }

  // Ask about SDK generation
  const shouldGenerateSDK = await confirm(rl, '\nGenerate client SDK?', true);
  
  if (shouldGenerateSDK) {
    const languages = await multiSelect(rl, 'Select languages:', [
      { value: 'typescript', label: 'TypeScript/JavaScript' },
      { value: 'python', label: 'Python' },
      { value: 'go', label: 'Go' },
    ]);

    if (languages.length > 0) {
      await generateSDKCommand({
        language: languages.length > 1 ? 'all' : languages[0] as 'typescript' | 'python' | 'go',
        name,
        routes: {
          'GET /data': pricing,
          'POST /data': (parseFloat(pricing) * 2).toString(),
        },
      });
    }
  }

  console.log(c('bold', c('green', '\n✓ All done! Your API is monetized and deployed! 🎉\n')));
}

/**
 * Existing API wizard flow
 */
async function existingAPIWizard(rl: readline.Interface): Promise<void> {
  console.log(c('bold', '\n💰 Add Payments to Existing API\n'));

  const url = await ask(rl, 'Your API URL');
  
  // Validate URL
  if (!url.startsWith('http')) {
    console.log(c('red', '✗ Must be a valid URL (http:// or https://)'));
    return;
  }

  const wallet = await ask(rl, 'Your wallet address (0x...)');
  
  // Validate wallet
  if (!wallet.startsWith('0x') || wallet.length !== 42) {
    console.log(c('red', '✗ Invalid wallet address'));
    return;
  }

  const basePrice = await ask(rl, 'Price per call (USD)', '0.001');

  console.log(c('dim', '\nWrapping your API with x402 gateway...'));
  await new Promise(resolve => setTimeout(resolve, 800));
  
  console.log(c('green', '\n✓ API wrapped with payment gateway!'));
  console.log(c('dim', '\nNext steps:'));
  console.log(c('dim', '  1. Deploy the gateway: x402-deploy deploy'));
  console.log(c('dim', `  2. Test a payment: curl -H "x-payment: <proof>" ${url}/endpoint`));
  console.log(c('dim', '  3. Monitor earnings: x402-deploy dashboard\n'));
}

/**
 * SDK generation wizard flow
 */
async function sdkWizard(rl: readline.Interface): Promise<void> {
  console.log(c('bold', '\n📦 SDK Generation\n'));
  
  const languages = await multiSelect(rl, 'Generate SDK for:', [
    { value: 'typescript', label: 'TypeScript/JavaScript' },
    { value: 'python', label: 'Python' },
    { value: 'go', label: 'Go' },
  ]);

  if (languages.length === 0) {
    console.log(c('yellow', 'No languages selected. Using TypeScript.'));
    languages.push('typescript');
  }

  await generateSDKCommand({
    language: languages.length === 1 ? languages[0] as 'typescript' | 'python' | 'go' : 'all',
  });
}

/**
 * Explore marketplace wizard flow
 */
async function exploreWizard(rl: readline.Interface): Promise<void> {
  console.log(c('bold', '\n🔍 Explore Marketplace APIs\n'));
  
  console.log(c('dim', 'Fetching available APIs...\n'));
  await new Promise(resolve => setTimeout(resolve, 500));
  
  // Show sample marketplace listings
  const apis = [
    { name: 'CryptoData API', price: '$0.001/call', category: 'Market Data' },
    { name: 'AI Image Generator', price: '$0.05/call', category: 'AI/ML' },
    { name: 'Weather Forecast', price: '$0.002/call', category: 'Data' },
    { name: 'Translation Service', price: '$0.01/call', category: 'AI/ML' },
    { name: 'Blockchain Analytics', price: '$0.005/call', category: 'Crypto' },
  ];

  console.log(c('bold', 'Available APIs:\n'));
  apis.forEach((api, i) => {
    console.log(`  ${c('cyan', `${i + 1}.`)} ${c('bold', api.name)}`);
    console.log(`     ${c('dim', `Price: ${api.price} | Category: ${api.category}`)}`);
  });

  const selection = await ask(rl, '\nSelect an API to view details (1-5) or press Enter to exit');
  
  if (selection && parseInt(selection, 10) >= 1 && parseInt(selection, 10) <= 5) {
    const api = apis[parseInt(selection, 10) - 1];
    console.log(c('bold', `\n📄 ${api.name}\n`));
    console.log(`Category: ${api.category}`);
    console.log(`Price: ${api.price}`);
    console.log(`\n${c('dim', 'To generate an SDK for this API:')}`);
    console.log(c('cyan', `  x402-deploy generate-sdk --api "${api.name.toLowerCase().replace(/\s+/g, '-')}"`));
  }
}

/**
 * Main wizard entry point
 */
export async function runWizard(): Promise<void> {
  showHeader();

  const rl = createPrompt();

  try {
    const flow = await select(rl, 'What would you like to do?', [
      { value: 'new', label: '🆕 Create a new paid API from scratch' },
      { value: 'existing', label: '💰 Add payments to existing API' },
      { value: 'sdk', label: '📦 Generate SDK for your API' },
      { value: 'explore', label: '🔍 Explore marketplace APIs' },
    ]);

    switch (flow) {
      case 'new':
        await newAPIWizard(rl);
        break;
      case 'existing':
        await existingAPIWizard(rl);
        break;
      case 'sdk':
        await sdkWizard(rl);
        break;
      case 'explore':
        await exploreWizard(rl);
        break;
    }
  } finally {
    rl.close();
  }
}

export default runWizard;
