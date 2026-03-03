/**
 * A2A (Agent-to-Agent) Protocol Types
 *
 * Google's protocol for agent messaging and task delegation.
 * @see https://google.github.io/A2A
 */

// ─── Agent Card (Discovery) ────────────────────────────────────────

export interface AgentCard {
  name: string;
  description: string;
  url: string;
  version: string;
  capabilities: AgentCapability;
  skills: AgentSkill[];
  defaultInputModes?: string[];
  defaultOutputModes?: string[];
  provider?: AgentProvider;
  authentication?: AgentAuthentication;
  /** ERC-8004 extension fields */
  erc8004?: {
    agentId: number;
    chain: string;
    agentRegistry: string;
    x402Support: boolean;
    trustModels: string[];
  };
}

export interface AgentCapability {
  streaming?: boolean;
  pushNotifications?: boolean;
  stateTransitionHistory?: boolean;
}

export interface AgentSkill {
  id: string;
  name: string;
  description: string;
  inputModes?: string[];
  outputModes?: string[];
  tags?: string[];
}

export interface AgentProvider {
  organization: string;
  url?: string;
}

export interface AgentAuthentication {
  schemes: string[];
  credentials?: string;
}

// ─── Task Management ───────────────────────────────────────────────

export type TaskState =
  | 'submitted'
  | 'working'
  | 'input-required'
  | 'completed'
  | 'canceled'
  | 'failed'
  | 'unknown';

export interface Task {
  id: string;
  sessionId?: string;
  status: TaskStatus;
  artifacts?: Artifact[];
  history?: Message[];
  metadata?: Record<string, unknown>;
}

export interface TaskStatus {
  state: TaskState;
  message?: Message;
  timestamp?: string;
}

export interface TaskSendParams {
  id: string;
  sessionId?: string;
  message: Message;
  acceptedOutputModes?: string[];
  pushNotification?: PushNotificationConfig;
  metadata?: Record<string, unknown>;
}

export interface TaskQueryParams {
  id: string;
  historyLength?: number;
}

// ─── Messages ──────────────────────────────────────────────────────

export interface Message {
  role: 'user' | 'agent';
  parts: MessagePart[];
  metadata?: Record<string, unknown>;
}

export type MessagePart = TextPart | FilePart | DataPart;

export interface TextPart {
  type: 'text';
  text: string;
}

export interface FilePart {
  type: 'file';
  file: {
    name?: string;
    mimeType?: string;
    bytes?: string; // base64
    uri?: string;
  };
}

export interface DataPart {
  type: 'data';
  data: Record<string, unknown>;
}

// ─── Artifacts ─────────────────────────────────────────────────────

export interface Artifact {
  name?: string;
  description?: string;
  parts: MessagePart[];
  index?: number;
  append?: boolean;
  lastChunk?: boolean;
  metadata?: Record<string, unknown>;
}

// ─── Push Notifications ────────────────────────────────────────────

export interface PushNotificationConfig {
  url: string;
  token?: string;
  authentication?: {
    schemes: string[];
    credentials?: string;
  };
}

// ─── JSON-RPC Envelope ─────────────────────────────────────────────

export interface A2ARequest {
  jsonrpc: '2.0';
  id: string | number;
  method: A2AMethod;
  params?: unknown;
}

export interface A2AResponse {
  jsonrpc: '2.0';
  id: string | number;
  result?: unknown;
  error?: A2AError;
}

export interface A2AError {
  code: number;
  message: string;
  data?: unknown;
}

export type A2AMethod =
  | 'tasks/send'
  | 'tasks/get'
  | 'tasks/cancel'
  | 'tasks/pushNotification/set'
  | 'tasks/pushNotification/get'
  | 'tasks/sendSubscribe'
  | 'tasks/resubscribe';

// ─── Error Codes ───────────────────────────────────────────────────

export const A2A_ERROR_CODES = {
  TASK_NOT_FOUND: -32001,
  TASK_NOT_CANCELABLE: -32002,
  PUSH_NOTIFICATION_NOT_SUPPORTED: -32003,
  UNSUPPORTED_OPERATION: -32004,
  CONTENT_TYPE_NOT_SUPPORTED: -32005,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL_ERROR: -32603,
  PARSE_ERROR: -32700,
} as const;

export type TaskHandler = (
  task: TaskSendParams
) => Promise<{ status: TaskState; result?: unknown; message?: string }>;
