/**
 * Development Server Command
 * Local testing environment for x402-enabled APIs
 *
 * @author nich
 * @github github.com/nirholas
 * @license Apache-2.0
 */

import { createServer, type IncomingMessage, type ServerResponse } from 'http';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

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

export interface DevServerOptions {
  /** Port to run the server on */
  port?: number;
  /** Enable mock payment verification */
  mockPayments?: boolean;
  /** Wallet address */
  wallet?: `0x${string}`;
  /** Custom routes configuration */
  routes?: Record<string, string>;
}

interface DevConfig {
  name: string;
  wallet: `0x${string}`;
  facilitator: string;
  network: string;
  routes: Record<string, string>;
}

/**
 * Load configuration from x402.config.json
 */
function loadConfig(): DevConfig {
  const configPath = join(process.cwd(), 'x402.config.json');
  
  if (existsSync(configPath)) {
    const content = readFileSync(configPath, 'utf-8');
    const config = JSON.parse(content);
    return {
      name: config.name || 'x402-api',
      wallet: config.payment?.wallet || '0x40252CFDF8B20Ed757D61ff157719F33Ec332402',
      facilitator: config.payment?.facilitator || 'https://facilitator.x402.org',
      network: config.payment?.network || 'eip155:8453',
      routes: config.pricing?.routes || {
        'GET /hello': '0.001',
        'GET /data/:id': '0.002',
        'POST /data': '0.003',
      },
    };
  }

  // Return defaults
  return {
    name: 'x402-api',
    wallet: '0x40252CFDF8B20Ed757D61ff157719F33Ec332402',
    facilitator: 'https://facilitator.x402.org',
    network: 'eip155:8453',
    routes: {
      'GET /hello': '0.001',
      'GET /data/:id': '0.002',
      'POST /data': '0.003',
    },
  };
}

/**
 * Parse request body
 */
async function parseBody(req: IncomingMessage): Promise<any> {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk.toString();
    });
    req.on('end', () => {
      try {
        resolve(JSON.parse(body));
      } catch {
        resolve(body || null);
      }
    });
  });
}

/**
 * Match route pattern to request path
 */
function matchRoute(pattern: string, path: string): { match: boolean; params: Record<string, string> } {
  const patternParts = pattern.split('/');
  const pathParts = path.split('/');

  if (patternParts.length !== pathParts.length) {
    return { match: false, params: {} };
  }

  const params: Record<string, string> = {};

  for (let i = 0; i < patternParts.length; i++) {
    const patternPart = patternParts[i];
    const pathPart = pathParts[i];

    if (patternPart.startsWith(':')) {
      params[patternPart.slice(1)] = pathPart;
    } else if (patternPart !== pathPart) {
      return { match: false, params: {} };
    }
  }

  return { match: true, params };
}

/**
 * Find matching route and price
 */
function findRoute(
  method: string,
  path: string,
  routes: Record<string, string>
): { price: string; params: Record<string, string> } | null {
  for (const [route, price] of Object.entries(routes)) {
    const [routeMethod, routePath] = route.split(' ');
    
    if (routeMethod !== method) continue;
    
    const result = matchRoute(routePath, path);
    if (result.match) {
      return { price, params: result.params };
    }
  }
  
  return null;
}

/**
 * Verify payment header
 */
function verifyPayment(
  paymentHeader: string | undefined,
  mockPayments: boolean
): { valid: boolean; payer?: string; error?: string } {
  if (!paymentHeader) {
    return { valid: false, error: 'Missing x-payment header' };
  }

  if (mockPayments) {
    console.log(c('dim', '  [MOCK] Payment verified ✓'));
    return { valid: true, payer: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb' };
  }

  // In production, this would verify the actual payment proof
  // For dev server, we accept any non-empty payment header
  if (paymentHeader === 'mock' || paymentHeader.startsWith('0x')) {
    return { valid: true, payer: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb' };
  }

  return { valid: false, error: 'Invalid payment proof' };
}

/**
 * Generate x402 discovery document
 */
function generateDiscovery(config: DevConfig, port: number): object {
  return {
    version: '1.0',
    name: config.name,
    payment: {
      wallet: config.wallet,
      network: config.network,
      facilitator: config.facilitator,
    },
    routes: Object.entries(config.routes).map(([route, price]) => {
      const [method, path] = route.split(' ');
      return { method, path, price };
    }),
    discovery: `http://localhost:${port}/.well-known/x402`,
  };
}

/**
 * Start the development server
 */
export async function devCommand(options: DevServerOptions): Promise<void> {
  const port = options.port || 3402;
  const mockPayments = options.mockPayments ?? true;

  console.log(c('bold', c('cyan', '\n🚀 Starting x402-deploy dev server...\n')));

  const config = loadConfig();
  
  // Override wallet if provided
  if (options.wallet) {
    config.wallet = options.wallet;
  }
  
  // Override routes if provided
  if (options.routes) {
    config.routes = options.routes;
  }

  console.log(c('green', '✓ Configuration loaded'));

  const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    const method = req.method || 'GET';
    const url = new URL(req.url || '/', `http://localhost:${port}`);
    const path = url.pathname;

    // Log request
    console.log(c('dim', `  ${method} ${path}`));

    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-payment');

    // Handle preflight
    if (method === 'OPTIONS') {
      res.writeHead(200);
      res.end();
      return;
    }

    // Handle discovery endpoint
    if (path === '/.well-known/x402') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(generateDiscovery(config, port), null, 2));
      return;
    }

    // Find matching route
    const routeMatch = findRoute(method, path, config.routes);

    if (!routeMatch) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Not found', path }));
      return;
    }

    // Verify payment
    const paymentHeader = req.headers['x-payment'] as string | undefined;
    const paymentResult = verifyPayment(paymentHeader, mockPayments);

    if (!paymentResult.valid) {
      // Return 402 Payment Required with payment info
      res.writeHead(402, { 
        'Content-Type': 'application/json',
        'x-payment-required': JSON.stringify({
          price: routeMatch.price,
          wallet: config.wallet,
          network: config.network,
          facilitator: config.facilitator,
        }),
      });
      res.end(JSON.stringify({
        error: 'Payment Required',
        message: paymentResult.error,
        price: routeMatch.price,
        wallet: config.wallet,
        facilitator: config.facilitator,
      }));
      return;
    }

    // Parse body for POST/PUT/PATCH
    let body = null;
    if (['POST', 'PUT', 'PATCH'].includes(method)) {
      body = await parseBody(req);
    }

    // Return success response based on route
    const response = {
      success: true,
      route: `${method} ${path}`,
      price: routeMatch.price,
      params: routeMatch.params,
      payer: paymentResult.payer,
      timestamp: new Date().toISOString(),
      ...(body && { body }),
      // Add route-specific mock data
      data: generateMockData(path, routeMatch.params),
    };

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(response, null, 2));
  });

  server.listen(port, () => {
    console.log(c('green', `\n✓ Dev server running!\n`));
    
    console.log(c('bold', 'Local API:'));
    console.log(c('cyan', `  http://localhost:${port}`));

    console.log(c('bold', '\nTest it:'));
    if (mockPayments) {
      console.log(c('dim', `  curl -H "x-payment: mock" http://localhost:${port}/hello`));
    } else {
      console.log(c('dim', `  curl -H "x-payment: <proof>" http://localhost:${port}/hello`));
    }

    console.log(c('bold', '\nEndpoints:'));
    for (const [route, price] of Object.entries(config.routes)) {
      const [method, path] = route.split(' ');
      console.log(c('dim', `  ${method.padEnd(6)} ${path.padEnd(15)} $${price}`));
    }
    console.log(c('dim', `  GET    /.well-known/x402  (discovery)`));

    console.log(c('bold', '\nOptions:'));
    console.log(c('dim', `  Mock payments: ${mockPayments ? c('green', 'enabled') : c('yellow', 'disabled')}`));
    console.log(c('dim', `  Wallet: ${config.wallet.slice(0, 10)}...`));

    console.log(c('dim', '\nPress Ctrl+C to stop the server\n'));
  });

  // Handle graceful shutdown
  process.on('SIGINT', () => {
    console.log(c('yellow', '\n\nShutting down dev server...'));
    server.close(() => {
      console.log(c('green', '✓ Server stopped\n'));
      process.exit(0);
    });
  });
}

/**
 * Generate mock data based on route
 */
function generateMockData(path: string, params: Record<string, string>): any {
  if (path.includes('hello')) {
    return { message: 'Hello from paid API!' };
  }
  
  if (path.includes('data')) {
    return {
      id: params.id || 'sample-123',
      content: 'Some valuable data',
      created: new Date().toISOString(),
      metadata: {
        source: 'x402-dev-server',
        version: '1.0.0',
      },
    };
  }

  return {
    path,
    params,
    mock: true,
  };
}

export default devCommand;
