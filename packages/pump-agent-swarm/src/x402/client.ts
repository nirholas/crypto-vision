/**
 * Solana x402 Payment Client — Pure Solana, No EVM
 *
 * When an API returns HTTP 402, this client:
 * 1. Reads the X-PAYMENT-REQUIRED header (amount, payTo ATA, challenge nonce)
 * 2. Builds a Solana transaction with:
 *    a. SPL USDC transfer (payer ATA → server ATA)
 *    b. Memo instruction containing the challenge nonce
 * 3. Signs and sends the transaction
 * 4. Waits for confirmation (~400ms on Solana)
 * 5. Retries the original request with X-PAYMENT proof header
 *
 * The payment is invisible to the consuming agent — it just gets data back.
 *
 * Settlement: Direct on-chain. No facilitator. Solana is fast enough.
 * Cost: ~0.000005 SOL per tx fee + the USDC payment amount.
 * Verification: Server checks the tx via RPC (transfer + memo + amount).
 */

import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  TransactionInstruction,
  ComputeBudgetProgram,
  sendAndConfirmTransaction,
} from '@solana/web3.js';
import {
  getAssociatedTokenAddressSync,
  createTransferInstruction,
  getAccount,
} from '@solana/spl-token';
import { EventEmitter } from 'eventemitter3';
import bs58 from 'bs58';
import type { TokenAnalytics, BondingCurveState } from '../types.js';
import {
  USDC_MINT_MAINNET,
  USDC_MINT_DEVNET,
  MEMO_PROGRAM_ID,
  USDC_DECIMALS,
  CAIP2_SOLANA_MAINNET,
  CAIP2_SOLANA_DEVNET,
} from './types.js';
import type {
  SolanaX402PaymentRequired,
  SolanaPaymentScheme,
  SolanaX402PaymentProof,
  SolanaX402ClientConfig,
  SolanaX402ClientEvents,
} from './types.js';

// ─── Solana x402 Client ───────────────────────────────────────

export class SolanaX402Client extends EventEmitter<SolanaX402ClientEvents> {
  private readonly config: SolanaX402ClientConfig;
  private readonly connection: Connection;
  private readonly payer: Keypair | undefined;
  private readonly usdcMint: PublicKey;
  private readonly caip2Network: string;
  private totalSpentUsdc = 0;
  private requestCount = 0;
  private paymentCount = 0;

  constructor(config: SolanaX402ClientConfig) {
    super();
    this.config = config;

    this.connection = new Connection(config.rpcUrl, {
      commitment: config.commitment ?? 'confirmed',
      wsEndpoint: config.wsUrl,
    });

    // Derive keypair from base58 private key
    if (config.solanaPrivateKey) {
      this.payer = Keypair.fromSecretKey(bs58.decode(config.solanaPrivateKey));
    }

    // Set USDC mint based on network
    const isDevnet = config.network === 'devnet';
    this.usdcMint = new PublicKey(isDevnet ? USDC_MINT_DEVNET : USDC_MINT_MAINNET);
    this.caip2Network = isDevnet ? CAIP2_SOLANA_DEVNET : CAIP2_SOLANA_MAINNET;
  }

  /**
   * Get the payer's public key (base58).
   * Useful for logging and display.
   */
  getPayerAddress(): string | undefined {
    return this.payer?.publicKey.toBase58();
  }

  /**
   * Get the payer's USDC ATA address.
   */
  getPayerUsdcAddress(): string | undefined {
    if (!this.payer) return undefined;
    return getAssociatedTokenAddressSync(
      this.usdcMint,
      this.payer.publicKey,
    ).toBase58();
  }

  /**
   * Check the payer's USDC balance.
   *
   * @returns USDC balance in human-readable format (e.g. "12.50")
   */
  async getUsdcBalance(): Promise<string> {
    if (!this.payer) return '0';

    const payerAta = getAssociatedTokenAddressSync(this.usdcMint, this.payer.publicKey);

    try {
      const account = await getAccount(this.connection, payerAta);
      const balance = Number(account.amount) / 10 ** USDC_DECIMALS;
      return balance.toFixed(USDC_DECIMALS);
    } catch {
      // Account doesn't exist = 0 balance
      return '0.000000';
    }
  }

  /**
   * Check the payer's SOL balance (needed for tx fees).
   *
   * @returns SOL balance in human-readable format
   */
  async getSolBalance(): Promise<string> {
    if (!this.payer) return '0';
    const lamports = await this.connection.getBalance(this.payer.publicKey);
    return (lamports / 1e9).toFixed(9);
  }

  // ─── Core: Fetch with x402 auto-payment ─────────────────────

  /**
   * Make an HTTP request with automatic x402 payment handling.
   *
   * 1. Sends the request normally
   * 2. If 402 → reads requirements → pays on Solana → retries
   * 3. Returns the response data
   *
   * The calling code never sees the payment — it's fully transparent.
   */
  async fetchWithPayment<T>(endpoint: string, init?: RequestInit): Promise<T> {
    const url = `${this.config.apiBaseUrl}${endpoint}`;
    const startTime = Date.now();

    // ─── First attempt ────────────────────────────────────
    const response = await fetch(url, {
      ...init,
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'PumpAgentSwarm/1.0 SolanaX402/2.0',
        ...init?.headers,
      },
    });

    // Not 402 → handle normally
    if (response.status !== 402) {
      if (!response.ok) {
        const body = await response.text().catch(() => '');
        throw new Error(
          `API error: ${response.status} ${response.statusText}${body ? ` — ${body}` : ''}`,
        );
      }
      const data = await response.json() as T;
      this.requestCount++;
      this.emit('request:success', endpoint, Date.now() - startTime, false);
      return data;
    }

    // ─── Handle 402 Payment Required ──────────────────────

    if (this.config.devMode) {
      throw new Error(
        `[x402] Payment required for ${endpoint} but client is in devMode. ` +
        'Set devMode: false and provide a solanaPrivateKey to enable payments.',
      );
    }

    if (!this.payer) {
      throw new Error(
        `[x402] Payment required for ${endpoint} but no solanaPrivateKey configured. ` +
        'The agent needs a Solana wallet with USDC to pay for premium data.',
      );
    }

    // Parse the payment requirements
    const paymentHeader = response.headers.get('X-PAYMENT-REQUIRED');
    if (!paymentHeader) {
      throw new Error('[x402] 402 response but no X-PAYMENT-REQUIRED header');
    }

    const requirements: SolanaX402PaymentRequired = JSON.parse(
      Buffer.from(paymentHeader, 'base64').toString('utf-8'),
    );

    this.emit('payment:required', requirements);

    // Find a compatible Solana payment scheme
    const scheme = requirements.accepts.find(
      (s) => s.scheme === 'exact-solana' && s.network === this.caip2Network,
    );
    if (!scheme) {
      throw new Error(
        `[x402] No compatible Solana payment scheme. ` +
        `Server accepts: ${requirements.accepts.map((s) => `${s.scheme}@${s.network}`).join(', ')}. ` +
        `Client network: ${this.caip2Network}`,
      );
    }

    // Validate challenge hasn't expired
    if (scheme.challengeExpiresAt < Math.floor(Date.now() / 1000)) {
      throw new Error('[x402] Payment challenge has expired. Retry the request for a fresh challenge.');
    }

    // Budget checks
    const paymentAmountRaw = BigInt(scheme.maxAmountRequired);
    const paymentAmountUsdc = Number(paymentAmountRaw) / 10 ** USDC_DECIMALS;

    const maxPerRequest = parseFloat(this.config.maxPaymentPerRequest ?? '0.10');
    if (paymentAmountUsdc > maxPerRequest) {
      throw new Error(
        `[x402] Payment $${paymentAmountUsdc.toFixed(6)} exceeds maxPaymentPerRequest $${maxPerRequest.toFixed(2)}`,
      );
    }

    const maxBudget = parseFloat(this.config.maxTotalBudget ?? '10.00');
    if (this.totalSpentUsdc + paymentAmountUsdc > maxBudget) {
      this.emit('budget:exhausted', this.totalSpentUsdc, maxBudget);
      throw new Error(
        `[x402] Would exceed budget. Spent: $${this.totalSpentUsdc.toFixed(6)}, ` +
        `Request: $${paymentAmountUsdc.toFixed(6)}, Budget: $${maxBudget.toFixed(2)}`,
      );
    }

    // ─── Execute Solana Payment ───────────────────────────

    this.emit('payment:sending', scheme.challenge, scheme.maxAmountRequired);
    const paymentStart = Date.now();

    const txSignature = await this.executePayment(scheme);

    const paymentLatency = Date.now() - paymentStart;
    this.emit('payment:confirmed', txSignature, scheme.maxAmountRequired, paymentLatency);

    // ─── Build proof and retry ────────────────────────────

    const proof: SolanaX402PaymentProof = {
      x402Version: 2,
      scheme: 'exact-solana',
      network: this.caip2Network,
      payload: {
        signature: txSignature,
        challenge: scheme.challenge,
        payer: this.payer.publicKey.toBase58(),
        amount: scheme.maxAmountRequired,
        paidAt: Math.floor(Date.now() / 1000),
      },
    };

    const proofHeader = Buffer.from(JSON.stringify(proof)).toString('base64');

    const paidResponse = await fetch(url, {
      ...init,
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'PumpAgentSwarm/1.0 SolanaX402/2.0',
        'X-PAYMENT': proofHeader,
        ...init?.headers,
      },
    });

    if (!paidResponse.ok) {
      const errorBody = await paidResponse.text().catch(() => '');
      throw new Error(
        `[x402] Paid request failed: ${paidResponse.status} ${paidResponse.statusText}` +
        `${errorBody ? ` — ${errorBody}` : ''}. ` +
        `Payment tx: ${txSignature}`,
      );
    }

    // Track spending
    this.totalSpentUsdc += paymentAmountUsdc;
    this.requestCount++;
    this.paymentCount++;
    this.emit('request:success', endpoint, Date.now() - startTime, true);

    // Budget warning at 80% usage
    const remaining = maxBudget - this.totalSpentUsdc;
    if (remaining < maxBudget * 0.2) {
      this.emit('budget:warning', this.totalSpentUsdc, remaining);
    }

    return paidResponse.json() as Promise<T>;
  }

  // ─── Core: Execute Solana USDC Payment ──────────────────────

  /**
   * Build, sign, and send a USDC SPL transfer + Memo on Solana.
   *
   * Transaction contains:
   * 1. (Optional) Compute budget instruction for priority fees
   * 2. (Optional) Create ATA for server if it doesn't exist
   * 3. SPL token transfer: payer ATA → server ATA
   * 4. Memo instruction with the x402 challenge nonce
   *
   * @returns Transaction signature (base58)
   */
  private async executePayment(scheme: SolanaPaymentScheme): Promise<string> {
    if (!this.payer) throw new Error('[x402] No payer keypair');

    const serverAta = new PublicKey(scheme.payTo);
    const payerAta = getAssociatedTokenAddressSync(this.usdcMint, this.payer.publicKey);
    const amount = BigInt(scheme.maxAmountRequired);

    // Verify payer has sufficient USDC
    let payerAccount;
    try {
      payerAccount = await getAccount(this.connection, payerAta);
    } catch {
      throw new Error(
        `[x402] Payer USDC account not found. ` +
        `Wallet ${this.payer.publicKey.toBase58()} does not have a USDC token account. ` +
        `Fund it with USDC first.`,
      );
    }

    if (payerAccount.amount < amount) {
      const has = Number(payerAccount.amount) / 10 ** USDC_DECIMALS;
      const needs = Number(amount) / 10 ** USDC_DECIMALS;
      throw new Error(
        `[x402] Insufficient USDC. Has: $${has.toFixed(6)}, Needs: $${needs.toFixed(6)}`,
      );
    }

    // Build the transaction
    const tx = new Transaction();

    // 1. Priority fee (ComputeBudget)
    const priorityFee = this.config.priorityFeeMicroLamports ?? 50_000;
    if (priorityFee > 0) {
      tx.add(
        ComputeBudgetProgram.setComputeUnitPrice({
          microLamports: priorityFee,
        }),
        ComputeBudgetProgram.setComputeUnitLimit({
          units: 100_000, // USDC transfer + memo needs ~30k CU, allocate 100k for safety
        }),
      );
    }

    // 2. Check if server ATA exists; create it if not (payer pays rent)
    const serverAtaExists = await this.accountExists(serverAta);
    if (!serverAtaExists) {
      // Derive the owner of the server ATA — this is a bit tricky since we
      // only have the ATA address. We need to find who owns it.
      // In practice, the server should always have its ATA initialized.
      // We'll still handle the edge case for robustness.
      //
      // Since we don't know the server wallet's pubkey from just the ATA,
      // we skip auto-creation and throw a clear error.
      throw new Error(
        `[x402] Server's USDC token account ${scheme.payTo} does not exist or is not initialized. ` +
        `The server operator needs to initialize their USDC ATA before accepting payments.`,
      );
    }

    // 3. SPL USDC transfer
    tx.add(
      createTransferInstruction(
        payerAta,         // source
        serverAta,        // destination
        this.payer.publicKey, // owner (signer)
        amount,           // amount in raw USDC units
      ),
    );

    // 4. Memo instruction with x402 challenge
    // The memo proves this specific transfer was made in response to this specific 402 challenge.
    // Format: "x402:<challenge>" — simple, verifiable, replay-proof.
    const memoData = `x402:${scheme.challenge}`;
    tx.add(
      new TransactionInstruction({
        keys: [{ pubkey: this.payer.publicKey, isSigner: true, isWritable: false }],
        programId: new PublicKey(MEMO_PROGRAM_ID),
        data: Buffer.from(memoData, 'utf-8'),
      }),
    );

    // Sign and send
    const signature = await sendAndConfirmTransaction(
      this.connection,
      tx,
      [this.payer],
      {
        commitment: this.config.commitment ?? 'confirmed',
        maxRetries: 3,
      },
    );

    return signature;
  }

  /**
   * Check if a Solana account exists (has lamports).
   */
  private async accountExists(address: PublicKey): Promise<boolean> {
    const info = await this.connection.getAccountInfo(address);
    return info !== null;
  }

  // ─── Public API: Premium Pump.fun Analytics ─────────────────

  /**
   * Get comprehensive token analytics (x402-gated).
   *
   * Includes bonding curve state, holder distribution, trade volume,
   * rug risk score, and creator analysis.
   *
   * @param mint Token mint address (Solana base58)
   * @returns Full token analytics
   * @price $0.02 per request
   */
  async getTokenAnalytics(mint: string): Promise<TokenAnalytics> {
    return this.fetchWithPayment<TokenAnalytics>(`/api/premium/pump/analytics?mint=${mint}`);
  }

  /**
   * Get bonding curve state (x402-gated).
   *
   * @param mint Token mint address
   * @returns Current bonding curve reserves and graduation progress
   * @price $0.005 per request
   */
  async getBondingCurveState(mint: string): Promise<BondingCurveState> {
    return this.fetchWithPayment<BondingCurveState>(`/api/premium/pump/curve?mint=${mint}`);
  }

  /**
   * Get new token launches in the last N minutes (x402-gated).
   *
   * @param minutes Lookback window (default: 60)
   * @param minMarketCapSol Minimum market cap filter
   * @returns Array of recently launched tokens with analytics
   * @price $0.01 per request
   */
  async getNewLaunches(minutes = 60, minMarketCapSol?: number): Promise<TokenAnalytics[]> {
    let endpoint = `/api/premium/pump/launches?minutes=${minutes}`;
    if (minMarketCapSol !== undefined) {
      endpoint += `&minMarketCapSol=${minMarketCapSol}`;
    }
    return this.fetchWithPayment<TokenAnalytics[]>(endpoint);
  }

  /**
   * Get trading signals for a token (x402-gated).
   *
   * AI-generated buy/sell signals based on bonding curve dynamics,
   * holder behavior, and volume patterns.
   *
   * @param mint Token mint address
   * @returns Trading signals with confidence scores
   * @price $0.03 per request
   */
  async getTradingSignals(mint: string): Promise<TradingSignalResponse> {
    return this.fetchWithPayment<TradingSignalResponse>(`/api/premium/pump/signals?mint=${mint}`);
  }

  /**
   * Get whale and sniper detection for a token (x402-gated).
   *
   * Identifies wallets that sniped the launch, whale accumulation patterns,
   * and potential coordinated trading activity.
   *
   * @param mint Token mint address
   * @returns Whale and sniper analysis
   * @price $0.025 per request
   */
  async getWhaleAnalysis(mint: string): Promise<WhaleAnalysisResponse> {
    return this.fetchWithPayment<WhaleAnalysisResponse>(`/api/premium/pump/whales?mint=${mint}`);
  }

  /**
   * Get graduation odds for a token (x402-gated).
   *
   * ML-based prediction of whether the token will graduate from
   * bonding curve to AMM.
   *
   * @param mint Token mint address
   * @returns Graduation probability and contributing factors
   * @price $0.015 per request
   */
  async getGraduationOdds(mint: string): Promise<GraduationOddsResponse> {
    return this.fetchWithPayment<GraduationOddsResponse>(`/api/premium/pump/graduation?mint=${mint}`);
  }

  // ─── Budget & Stats ─────────────────────────────────────────

  getTotalSpentUsdc(): number {
    return this.totalSpentUsdc;
  }

  getRequestCount(): number {
    return this.requestCount;
  }

  getPaymentCount(): number {
    return this.paymentCount;
  }

  getRemainingBudget(): number {
    const maxBudget = parseFloat(this.config.maxTotalBudget ?? '10.00');
    return maxBudget - this.totalSpentUsdc;
  }

  getStats(): X402ClientStats {
    const maxBudget = parseFloat(this.config.maxTotalBudget ?? '10.00');
    return {
      totalSpentUsdc: this.totalSpentUsdc,
      remainingBudget: maxBudget - this.totalSpentUsdc,
      maxBudget,
      requestCount: this.requestCount,
      paymentCount: this.paymentCount,
      avgCostPerRequest: this.requestCount > 0 ? this.totalSpentUsdc / this.requestCount : 0,
      payerAddress: this.payer?.publicKey.toBase58(),
      network: this.config.network ?? 'mainnet-beta',
    };
  }
}

// ─── Response Types ───────────────────────────────────────────

export interface TradingSignalResponse {
  signal: 'buy' | 'sell' | 'hold';
  confidence: number;
  reasoning: string;
  metrics: {
    volumeTrend: 'increasing' | 'decreasing' | 'stable';
    holderGrowth: number;
    priceChange1h: number;
    graduationEta: string;
  };
}

export interface WhaleAnalysisResponse {
  mint: string;
  whales: Array<{
    address: string;
    balance: string;
    percentage: number;
    isSniperBot: boolean;
    firstBuySlot: number;
    totalBuySol: number;
  }>;
  sniperCount: number;
  whaleConcentration: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  analyzedAt: number;
}

export interface GraduationOddsResponse {
  mint: string;
  probability: number;
  confidence: number;
  factors: {
    volumeMomentum: number;
    holderGrowthRate: number;
    creatorReputation: number;
    socialSignals: number;
    bondingCurveProgress: number;
  };
  estimatedTimeToGraduation: string;
  analyzedAt: number;
}

export interface X402ClientStats {
  totalSpentUsdc: number;
  remainingBudget: number;
  maxBudget: number;
  requestCount: number;
  paymentCount: number;
  avgCostPerRequest: number;
  payerAddress: string | undefined;
  network: string;
}
