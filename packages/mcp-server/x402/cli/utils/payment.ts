/* payment.ts | nich | 14938 */

/**
 * x402 CLI - Payment Utilities
 * @description Parse and format x402 payment information
 */

import type { X402Chain, X402Token, PaymentRequest } from '../../sdk/types.js';

/**
 * Parse x402 payment requirements from HTTP headers
 * Supports multiple header formats:
 * - X-Payment-Required
 * - WWW-Authenticate: x402
 * - JSON body payment info
 */
export function parsePayment(headers: Headers): PaymentRequest | null {
  // Try X-Payment-Required header
  const paymentRequired = headers.get('x-payment-required');
  if (paymentRequired) {
    try {
      return JSON.parse(paymentRequired) as PaymentRequest;
    } catch {
      // Try parsing as simple format: amount token chain recipient
      const parts = paymentRequired.split(' ');
      if (parts.length >= 4) {
        return {
          amount: parts[0],
          token: parts[1] as X402Token,
          chain: parts[2] as X402Chain,
          recipient: parts[3] as `0x${string}`,
        };
      }
    }
  }

  // Try WWW-Authenticate header
  const wwwAuth = headers.get('www-authenticate');
  if (wwwAuth && wwwAuth.startsWith('x402 ')) {
    const params = parseAuthParams(wwwAuth.slice(5));
    if (params.amount && params.recipient) {
      return {
        amount: params.amount,
        token: (params.token as X402Token) || 'USDs',
        chain: (params.chain as X402Chain) || 'arbitrum',
        recipient: params.recipient as `0x${string}`,
        description: params.description,
        deadline: params.deadline ? parseInt(params.deadline) : undefined,
      };
    }
  }

  // Try X-Price header (simple pricing)
  const price = headers.get('x-price');
  const recipient = headers.get('x-recipient');
  if (price && recipient) {
    return {
      amount: price,
      token: (headers.get('x-token') as X402Token) || 'USDs',
      chain: (headers.get('x-chain') as X402Chain) || 'arbitrum',
      recipient: recipient as `0x${string}`,
    };
  }

  return null;
}

/**
 * Parse authentication header parameters
 */
function parseAuthParams(str: string): Record<string, string> {
  const params: Record<string, string> = {};
  const regex = /(\w+)=(?:"([^"]*)"|(\S+))/g;
  let match;

  while ((match = regex.exec(str)) !== null) {
    params[match[1]] = match[2] || match[3];
  }

  return params;
}

/**
 * Format payment for human readability
 */
export function formatPayment(payment: PaymentRequest): string {
  const lines: string[] = [];
  
  lines.push(`Amount:    ${payment.amount} ${payment.token}`);
  lines.push(`Recipient: ${payment.recipient}`);
  lines.push(`Chain:     ${payment.chain}`);
  
  if (payment.description) {
    lines.push(`For:       ${payment.description}`);
  }
  
  if (payment.deadline) {
    const deadline = new Date(payment.deadline * 1000);
    lines.push(`Expires:   ${deadline.toLocaleString()}`);
  }
  
  return lines.join('\n');
}

/**
 * Create x402 payment header
 */
export function createPaymentHeader(payment: PaymentRequest): string {
  return JSON.stringify({
    amount: payment.amount,
    token: payment.token,
    chain: payment.chain,
    recipient: payment.recipient,
    description: payment.description,
    deadline: payment.deadline,
  });
}

/**
 * Validate payment request
 */
export function validatePaymentRequest(payment: PaymentRequest): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Check amount
  const amount = parseFloat(payment.amount);
  if (isNaN(amount) || amount <= 0) {
    errors.push('Invalid amount: must be a positive number');
  }

  // Check recipient address
  if (!payment.recipient?.match(/^0x[a-fA-F0-9]{40}$/)) {
    errors.push('Invalid recipient address');
  }

  // Check token
  const validTokens: X402Token[] = ['USDs', 'USDC', 'USDT', 'DAI', 'ETH'];
  if (!validTokens.includes(payment.token)) {
    errors.push(`Invalid token: ${payment.token}`);
  }

  // Check chain
  const validChains: X402Chain[] = ['arbitrum', 'arbitrum-sepolia', 'base', 'ethereum', 'polygon', 'optimism', 'bsc'];
  if (!validChains.includes(payment.chain)) {
    errors.push(`Invalid chain: ${payment.chain}`);
  }

  // Check deadline
  if (payment.deadline) {
    const now = Math.floor(Date.now() / 1000);
    if (payment.deadline < now) {
      errors.push('Payment deadline has passed');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Calculate total payment including estimated gas
 */
export function estimateTotalCost(payment: PaymentRequest, gasPrice?: bigint): {
  paymentAmount: string;
  estimatedGas: string;
  total: string;
} {
  const paymentAmount = parseFloat(payment.amount);
  
  // Rough gas estimate for ERC-20 transfer
  const gasLimit = 65000n;
  const defaultGasPrice = gasPrice || 100000000n; // 0.1 gwei default
  const gasCostWei = gasLimit * defaultGasPrice;
  const gasCostEth = Number(gasCostWei) / 1e18;
  
  // Convert to USD (rough estimate at $3000/ETH)
  const gasCostUSD = gasCostEth * 3000;
  
  return {
    paymentAmount: paymentAmount.toFixed(6),
    estimatedGas: gasCostUSD.toFixed(6),
    total: (paymentAmount + gasCostUSD).toFixed(6),
  };
}


/* EOF - n1ch0las | dW5pdmVyc2FsLWNyeXB0by1tY3A= */