/**
 * Agent Connection
 *
 * Connect to another ERC-8004 agent and make A2A calls with x402 payments.
 */

import { v4 as uuidv4 } from 'uuid';
import type { AgentCard, Task, TaskSendParams, A2ARequest, A2AResponse } from '../protocols/a2a/types.js';
import type { X402PaymentHeader } from '../protocols/x402/types.js';
import { signPaymentHeader, generateNonce, privateKeyToAddress } from '../utils/crypto.js';
import { fetchAgentCard } from './search.js';

export interface AgentConnection {
  agentId: number;
  name: string;
  endpoint: string;
  card: AgentCard;
}

export interface CallOptions {
  /** Task type / skill to invoke */
  task: string;
  /** Data payload */
  data: Record<string, unknown>;
  /** Session ID for multi-turn conversations */
  sessionId?: string;
  /** Timeout in milliseconds */
  timeout?: number;
}

/**
 * Connect to a remote ERC-8004 agent.
 */
export async function connectToAgent(
  endpoint: string,
  agentId?: number
): Promise<AgentConnection> {
  const card = await fetchAgentCard(endpoint);
  if (!card) {
    throw new Error(`Failed to fetch agent card from ${endpoint}`);
  }

  return {
    agentId: agentId ?? card.erc8004?.agentId ?? 0,
    name: card.name,
    endpoint,
    card,
  };
}

/**
 * Call a remote agent via A2A with optional x402 payment.
 */
export async function callAgent(
  connection: AgentConnection,
  options: CallOptions,
  callerConfig?: {
    privateKey: string;
    chainId: number;
  }
): Promise<Task> {
  const taskId = uuidv4();
  const sessionId = options.sessionId ?? uuidv4();

  // Build A2A request
  const sendParams: TaskSendParams = {
    id: taskId,
    sessionId,
    message: {
      role: 'user',
      parts: [
        {
          type: 'data',
          data: {
            task: options.task,
            ...options.data,
          },
        },
      ],
    },
    metadata: {
      skill: options.task,
    },
  };

  const a2aRequest: A2ARequest = {
    jsonrpc: '2.0',
    id: taskId,
    method: 'tasks/send',
    params: sendParams,
  };

  // Build headers
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  // Add x402 payment header if the target requires it and we have credentials
  if (connection.card.erc8004?.x402Support && callerConfig?.privateKey) {
    const paymentHeader = await buildPaymentHeader(
      connection,
      options.task,
      callerConfig
    );
    if (paymentHeader) {
      headers['X-PAYMENT'] = Buffer.from(
        JSON.stringify(paymentHeader)
      ).toString('base64');
    }
  }

  // Make the A2A call
  const a2aUrl = `${connection.endpoint}/a2a`;
  const response = await fetch(a2aUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify(a2aRequest),
    signal: AbortSignal.timeout(options.timeout ?? 30000),
  });

  if (response.status === 402) {
    const paymentRequired = await response.json();
    throw new PaymentRequiredError(
      'Payment required',
      paymentRequired as Record<string, unknown>
    );
  }

  if (!response.ok) {
    throw new Error(`A2A call failed: ${response.status} ${response.statusText}`);
  }

  const a2aResponse = (await response.json()) as A2AResponse;

  if (a2aResponse.error) {
    throw new A2ACallError(
      a2aResponse.error.message,
      a2aResponse.error.code
    );
  }

  return a2aResponse.result as Task;
}

/**
 * Build an x402 payment header for a request.
 */
async function buildPaymentHeader(
  connection: AgentConnection,
  taskRoute: string,
  callerConfig: { privateKey: string; chainId: number }
): Promise<X402PaymentHeader | null> {
  // Try to get pricing from the agent card
  const skill = connection.card.skills.find((s) => s.id === taskRoute);
  if (!skill?.description) return null;

  // Parse price from skill description (e.g., "trading/execute (0.001 USDC/request)")
  const priceMatch = skill.description.match(/\(([0-9.]+)\s+(\w+)/);
  if (!priceMatch) return null;

  const price = priceMatch[1];
  const _token = priceMatch[2];

  const payer = privateKeyToAddress(callerConfig.privateKey);
  const payee = connection.card.erc8004?.agentId
    ? connection.endpoint // Use endpoint as payee reference
    : connection.endpoint;

  const nonce = generateNonce();
  const expiry = Math.floor(Date.now() / 1000) + 300; // 5 minutes

  const paymentData = {
    payer,
    payee,
    amount: price,
    token: _token,
    chainId: callerConfig.chainId,
    nonce,
    expiry,
  };

  const signature = await signPaymentHeader(
    callerConfig.privateKey,
    paymentData
  );

  return {
    version: '1',
    ...paymentData,
    signature,
  };
}

/**
 * Error thrown when agent requires payment.
 */
export class PaymentRequiredError extends Error {
  readonly paymentDetails: Record<string, unknown>;

  constructor(message: string, details: Record<string, unknown>) {
    super(message);
    this.name = 'PaymentRequiredError';
    this.paymentDetails = details;
  }
}

/**
 * Error thrown when an A2A call fails.
 */
export class A2ACallError extends Error {
  readonly code: number;

  constructor(message: string, code: number) {
    super(message);
    this.name = 'A2ACallError';
    this.code = code;
  }
}
