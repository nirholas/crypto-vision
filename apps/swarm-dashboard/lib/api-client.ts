import { API_V1 } from './constants';

class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public data?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

function getSessionToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('swarm-session-token');
}

function setSessionToken(token: string): void {
  localStorage.setItem('swarm-session-token', token);
}

function clearSessionToken(): void {
  localStorage.removeItem('swarm-session-token');
}

async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = getSessionToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_V1}${path}`, {
    ...options,
    headers,
  });

  if (res.status === 401) {
    clearSessionToken();
    if (typeof window !== 'undefined') {
      window.location.href = '/connect';
    }
    throw new ApiError(401, 'Unauthorized');
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(res.status, body.error || res.statusText, body);
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

// ─── Session ──────────────────────────────────────────────────

export interface SessionResponse {
  sessionId: string;
  token: string;
  walletAddress: string;
  createdAt: number;
  lastActiveAt?: number;
  phase?: string;
  mint?: string;
}

export async function createSession(walletAddress: string): Promise<SessionResponse> {
  const data = await request<SessionResponse>('/session', {
    method: 'POST',
    body: JSON.stringify({ walletAddress }),
  });
  setSessionToken(data.token);
  return data;
}

export async function getSession(): Promise<SessionResponse> {
  return request<SessionResponse>('/session');
}

export async function listSessions(): Promise<{ sessions: SessionResponse[] }> {
  return request('/sessions');
}

export async function resumeSession(sessionId: string): Promise<SessionResponse> {
  const data = await request<SessionResponse>(`/sessions/${encodeURIComponent(sessionId)}/resume`, { method: 'POST' });
  setSessionToken(data.token);
  return data;
}

export async function saveSession(): Promise<void> {
  await request('/session/save', { method: 'PUT' });
}

// ─── Wallets ──────────────────────────────────────────────────

export interface WalletInfo {
  id: string;
  address: string;
  label: string;
  role: string;
  balanceLamports: string;
  tokenBalance: string | null;
  createdAt: number;
  importedAt?: number | null;
}

export async function getWallets(): Promise<{ wallets: WalletInfo[] }> {
  return request('/wallets');
}

export async function generateWallets(count: number, prefix?: string): Promise<{ wallets: WalletInfo[] }> {
  return request('/wallets/generate', {
    method: 'POST',
    body: JSON.stringify({ count, prefix }),
  });
}

export async function importWallets(wallets: Array<{ privateKey: string; label?: string }>): Promise<{ imported: number; wallets: WalletInfo[] }> {
  return request('/wallets/import', {
    method: 'POST',
    body: JSON.stringify({ wallets }),
  });
}

export async function updateWallet(address: string, data: { label?: string; role?: string }): Promise<{ wallet: WalletInfo }> {
  return request(`/wallets/${encodeURIComponent(address)}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function deleteWallet(address: string): Promise<void> {
  await request(`/wallets/${encodeURIComponent(address)}`, { method: 'DELETE' });
}

export async function getWalletBalances(): Promise<{ balances: Array<{ address: string; balanceLamports: string; tokenBalance?: string }> }> {
  return request('/wallets/balances');
}

export async function exportWallets(): Promise<{ wallets: Array<{ address: string; privateKey: string; label: string; role: string }> }> {
  return request('/wallets/export-all', { method: 'POST' });
}

// ─── Funding ──────────────────────────────────────────────────

export interface FundEstimate {
  perWallet: number;
  totalWithFees: number;
  feeEstimate: number;
}

export async function estimateFunding(totalSol: number, walletCount: number, mode: string): Promise<FundEstimate> {
  return request('/wallets/fund/estimate', {
    method: 'POST',
    body: JSON.stringify({ totalSol, walletCount, mode }),
  });
}

export async function fundWallets(body: {
  sourceWallet: string;
  distributions: Array<{ address: string; amountLamports: string }>;
  mode: string;
}): Promise<{ transactions: Array<{ tx: string; wallets: string[] }> }> {
  return request('/wallets/fund', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function collectSol(walletAddresses: string[], destinationAddress: string): Promise<{ transactions: Array<{ signature: string; amount: string }> }> {
  return request('/wallets/collect', {
    method: 'POST',
    body: JSON.stringify({ walletAddresses, destinationAddress }),
  });
}

// ─── Agents ───────────────────────────────────────────────────

export interface AgentInfo {
  id: string;
  sessionId: string;
  name: string;
  role: string;
  walletAddress: string;
  config: Record<string, unknown>;
  status: 'active' | 'paused' | 'idle' | 'error' | 'stopped';
  totalBuys: number;
  totalSells: number;
  solSpent: string;
  solReceived: string;
  tokensHeld: string;
  createdAt: number;
  updatedAt: number;
}

export async function getAgents(): Promise<{ agents: AgentInfo[] }> {
  return request('/agents');
}

export async function getAgent(id: string): Promise<AgentInfo> {
  return request(`/agents/${encodeURIComponent(id)}`);
}

export async function createAgent(data: {
  role: string;
  name: string;
  walletAddress: string;
  config: Record<string, unknown>;
}): Promise<AgentInfo> {
  return request('/agents', { method: 'POST', body: JSON.stringify(data) });
}

export async function updateAgentConfig(id: string, config: Record<string, unknown>): Promise<AgentInfo> {
  return request(`/agents/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify({ config }),
  });
}

export async function startAgent(id: string): Promise<void> {
  await request(`/agents/${encodeURIComponent(id)}/start`, { method: 'POST' });
}

export async function pauseAgent(id: string): Promise<void> {
  await request(`/agents/${encodeURIComponent(id)}/pause`, { method: 'POST' });
}

export async function resumeAgent(id: string): Promise<void> {
  await request(`/agents/${encodeURIComponent(id)}/resume`, { method: 'POST' });
}

export async function stopAgent(id: string): Promise<void> {
  await request(`/agents/${encodeURIComponent(id)}/stop`, { method: 'POST' });
}

export async function getAgentTrades(id: string): Promise<{ trades: TradeInfo[] }> {
  return request(`/agents/${encodeURIComponent(id)}/trades`);
}

// ─── Swarm ────────────────────────────────────────────────────

export interface SwarmStatus {
  phase: string;
  mint: string | null;
  agentCount: number;
  activeAgentCount: number;
  totalTrades: number;
  uptime: number;
  solSpent: string;
  solReceived: string;
  tokensHeld: string;
  pnl: { realized: string; unrealized: string; total: string };
}

export async function getSwarmStatus(): Promise<SwarmStatus> {
  return request('/swarm/status');
}

export async function deploySwarm(config: Record<string, unknown>): Promise<SwarmStatus> {
  return request('/swarm/deploy', { method: 'POST', body: JSON.stringify(config) });
}

export async function startSwarm(): Promise<void> {
  await request('/swarm/start', { method: 'POST' });
}

export async function pauseSwarm(): Promise<void> {
  await request('/swarm/pause', { method: 'POST' });
}

export async function resumeSwarm(): Promise<void> {
  await request('/swarm/resume', { method: 'POST' });
}

export async function stopSwarm(): Promise<void> {
  await request('/swarm/stop', { method: 'POST' });
}

export async function emergencyStop(): Promise<void> {
  await request('/swarm/emergency-stop', { method: 'POST' });
}

export async function getPhaseHistory(): Promise<Array<{ from: string; to: string; timestamp: number; reason: string }>> {
  return request('/swarm/phase-history');
}

// ─── Trading ──────────────────────────────────────────────────

export interface TradeInfo {
  id: string;
  agentId: string;
  walletAddress: string;
  mint: string;
  direction: 'buy' | 'sell';
  solAmount: string;
  tokenAmount: string;
  price: string;
  slippageBps: number;
  signature: string;
  status: 'pending' | 'confirmed' | 'failed';
  error?: string;
  executedAt: number;
  confirmedAt?: number;
}

export async function manualTrade(data: {
  wallet: string;
  direction: 'buy' | 'sell';
  lamports: string;
  opts?: { slippageBps?: number; priorityFee?: number };
}): Promise<TradeInfo> {
  return request('/trading/manual', { method: 'POST', body: JSON.stringify(data) });
}

export async function multiTrade(data: {
  wallets: string[];
  direction: 'buy' | 'sell';
  amounts: string[];
  staggerMs?: number;
}): Promise<{ trades: TradeInfo[] }> {
  return request('/trading/multi', { method: 'POST', body: JSON.stringify(data) });
}

export async function burstBuy(data: {
  wallets: string[];
  amountPerWallet: string;
  simultaneous: boolean;
}): Promise<{ trades: TradeInfo[] }> {
  return request('/trading/burst', { method: 'POST', body: JSON.stringify(data) });
}

export async function getCostEstimate(volumeSol: number, durationMin: number): Promise<{
  totalCost: number;
  gasFees: number;
  jitoTips: number;
  capital: number;
}> {
  return request(`/trading/cost-estimate?volumeSol=${volumeSol}&durationMin=${durationMin}`);
}

// ─── Analytics ────────────────────────────────────────────────

export interface AnalyticsOverview {
  totalTrades: number;
  totalVolumeSol: string;
  realizedPnl: string;
  unrealizedPnl: string;
  totalGasFees: string;
  totalJitoTips: string;
  uniqueWallets: number;
  avgTradeSize: string;
}

export async function getAnalyticsOverview(): Promise<AnalyticsOverview> {
  return request('/analytics');
}

export async function getPnlData(): Promise<{
  realized: string;
  unrealized: string;
  total: string;
  byAgent: Array<{ agentId: string; realized: string; unrealized: string }>;
}> {
  return request('/analytics/pnl');
}

export async function getPnlTimeseries(): Promise<Array<{
  timestamp: number;
  realized: string;
  unrealized: string;
  total: string;
}>> {
  return request('/analytics/pnl/timeseries');
}

export async function getVolumeData(): Promise<Array<{
  hour: number;
  buyVolume: string;
  sellVolume: string;
  tradeCount: number;
}>> {
  return request('/analytics/volume');
}

export async function getCostBreakdown(): Promise<{
  gasFees: string;
  jitoTips: string;
  capital: string;
  total: string;
}> {
  return request('/analytics/costs');
}

export async function getAgentAnalytics(): Promise<Array<{
  agentId: string;
  name: string;
  role: string;
  trades: number;
  pnl: string;
  volume: string;
}>> {
  return request('/analytics/agents');
}

// ─── Charts ───────────────────────────────────────────────────

export interface OhlcvCandle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export async function getOhlcv(mint: string, resolution = 60): Promise<{ candles: OhlcvCandle[] }> {
  return request(`/charts/ohlcv?mint=${encodeURIComponent(mint)}&resolution=${resolution}`);
}

export async function getLatestPrice(mint: string): Promise<{
  price: number;
  marketCap: number;
  volume24h: number;
}> {
  return request(`/charts/latest?mint=${encodeURIComponent(mint)}`);
}

export async function getTradeMarkers(): Promise<Array<{
  time: number;
  direction: 'buy' | 'sell';
  amount: string;
  wallet: string;
}>> {
  return request('/charts/trades');
}

// ─── Templates ────────────────────────────────────────────────

export interface Template {
  id: string;
  name: string;
  description: string;
  category: string;
  config: Record<string, unknown>;
  createdAt: number;
  updatedAt: number;
}

export async function getTemplates(): Promise<{ templates: Template[] }> {
  return request('/templates');
}

export async function createTemplate(data: {
  name: string;
  description: string;
  config: Record<string, unknown>;
}): Promise<Template> {
  return request('/templates', { method: 'POST', body: JSON.stringify(data) });
}

export async function getTemplate(id: string): Promise<Template> {
  return request(`/templates/${encodeURIComponent(id)}`);
}

export async function deleteTemplate(id: string): Promise<void> {
  await request(`/templates/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

// ─── Tracking ─────────────────────────────────────────────────

export interface TrackedWallet {
  id: string;
  address: string;
  label: string;
  color: string;
  source: 'manual' | 'gmgn';
  addedAt: number;
}

export async function getTrackedWallets(): Promise<{ wallets: TrackedWallet[] }> {
  return request('/tracking/wallets');
}

export async function trackWallet(address: string, label: string): Promise<TrackedWallet> {
  return request('/tracking/wallets', {
    method: 'POST',
    body: JSON.stringify({ address, label }),
  });
}

export async function untrackWallet(address: string): Promise<void> {
  await request(`/tracking/wallets/${encodeURIComponent(address)}`, { method: 'DELETE' });
}

// ─── Export ───────────────────────────────────────────────────

export async function exportAll(): Promise<Blob> {
  const token = getSessionToken();
  const res = await fetch(`${API_V1}/export/all`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  return res.blob();
}

export async function exportTrades(): Promise<Blob> {
  const token = getSessionToken();
  const res = await fetch(`${API_V1}/export/trades`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  return res.blob();
}

export async function exportAnalytics(): Promise<Blob> {
  const token = getSessionToken();
  const res = await fetch(`${API_V1}/export/analytics`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  return res.blob();
}

export { getSessionToken, setSessionToken, clearSessionToken, ApiError };
