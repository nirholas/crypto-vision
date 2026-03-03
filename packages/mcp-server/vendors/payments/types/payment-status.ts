/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
// Payment status enumeration with user-friendly descriptions and business logic

import type { PaymentStatusCode } from './index.js';

export const PaymentStatus = {
  NR: 'NR',
  PE: 'PE',
  AC: 'AC',
  IA: 'IA',
  OC: 'OC',
  CO: 'CO',
  CA: 'CA',
  EX: 'EX',
  FA: 'FA',
} as const;

export interface PaymentStatusInfo {
  code: PaymentStatusCode;
  name: string;
  description: string;
  userMessage: string;
  actionRequired: string;
  isTerminal: boolean;
  isSuccessful: boolean;
}

export const PaymentStatusMap: Record<PaymentStatusCode, PaymentStatusInfo> = {
  NR: {
    code: 'NR',
    name: 'Not Ready',
    description: 'Payment created, crypto not assigned',
    userMessage: 'Preparing payment...',
    actionRequired:
      'Wait for crypto assignment or allow choosing crypto/network',
    isTerminal: false,
    isSuccessful: false,
  },
  PE: {
    code: 'PE',
    name: 'Pending',
    description: 'Waiting for customer payment',
    userMessage: 'Waiting for payment from customer',
    actionRequired: 'Show QR code/address and keep payment interface open',
    isTerminal: false,
    isSuccessful: false,
  },
  AC: {
    code: 'AC',
    name: 'Awaiting Completion',
    description: 'Payment detected, awaiting confirmation',
    userMessage: 'Payment detected, awaiting confirmation',
    actionRequired: 'Maintain view and show optional countdown to expiration',
    isTerminal: false,
    isSuccessful: false,
  },
  IA: {
    code: 'IA',
    name: 'Insufficient Amount',
    description: 'Partial payment received',
    userMessage: 'Payment incomplete: additional amount needed',
    actionRequired: 'Guide customer to send remaining amount to same address',
    isTerminal: false,
    isSuccessful: false,
  },
  OC: {
    code: 'OC',
    name: 'Out of Condition',
    description: 'Payment conditions not met',
    userMessage: 'Payment incomplete: conditions not met',
    actionRequired: 'Review payment conditions and guide customer or cancel',
    isTerminal: false,
    isSuccessful: false,
  },
  CO: {
    code: 'CO',
    name: 'Completed',
    description: 'Payment confirmed (minimum 1 blockchain confirmation)',
    userMessage: 'Payment completed successfully',
    actionRequired: 'Close payment flow and issue receipt/confirmation',
    isTerminal: true,
    isSuccessful: true,
  },
  CA: {
    code: 'CA',
    name: 'Cancelled',
    description: 'Payment cancelled by user or system',
    userMessage: 'Payment cancelled',
    actionRequired: 'Allow user to recreate payment if needed',
    isTerminal: true,
    isSuccessful: false,
  },
  EX: {
    code: 'EX',
    name: 'Expired',
    description: 'Payment window expired without valid payment',
    userMessage: 'Payment expired',
    actionRequired: 'Allow user to recreate payment',
    isTerminal: true,
    isSuccessful: false,
  },
  FA: {
    code: 'FA',
    name: 'Failed',
    description: 'Transaction failed or was invalid',
    userMessage: 'Payment failed',
    actionRequired: 'Recreate payment and investigate if recurring',
    isTerminal: true,
    isSuccessful: false,
  },
};

export function getPaymentStatusInfo(
  status: PaymentStatusCode
): PaymentStatusInfo {
  return PaymentStatusMap[status];
}

export function isTerminalStatus(status: PaymentStatusCode): boolean {
  return PaymentStatusMap[status].isTerminal;
}

export function isSuccessfulStatus(status: PaymentStatusCode): boolean {
  return PaymentStatusMap[status].isSuccessful;
}

export function requiresUserAction(status: PaymentStatusCode): boolean {
  return ['IA', 'OC', 'CA', 'EX', 'FA'].includes(status);
}

export function canTransitionTo(
  fromStatus: PaymentStatusCode,
  toStatus: PaymentStatusCode
): boolean {
  // Define valid state transitions
  const validTransitions: Record<PaymentStatusCode, PaymentStatusCode[]> = {
    NR: ['PE', 'CA', 'EX', 'FA'],
    PE: ['AC', 'IA', 'OC', 'CO', 'CA', 'EX', 'FA'],
    AC: ['CO', 'IA', 'OC', 'CA', 'EX', 'FA'],
    IA: ['AC', 'CO', 'CA', 'EX', 'FA'],
    OC: ['AC', 'CO', 'CA', 'EX', 'FA'],
    CO: [], // Terminal state
    CA: [], // Terminal state
    EX: [], // Terminal state
    FA: [], // Terminal state
  };

  return validTransitions[fromStatus]?.includes(toStatus) ?? false;
}

export function getStatusPriority(status: PaymentStatusCode): number {
  // Priority for displaying multiple statuses (higher = more important)
  const priorities: Record<PaymentStatusCode, number> = {
    CO: 10, // Success
    FA: 9, // Failure
    EX: 8, // Expired
    CA: 7, // Cancelled
    IA: 6, // Needs action
    OC: 5, // Needs action
    AC: 4, // In progress
    PE: 3, // Waiting
    NR: 2, // Preparing
  };

  return priorities[status] ?? 0;
}
