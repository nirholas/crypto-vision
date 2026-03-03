/**
 * RAG Chat Types
 * 
 * Type definitions for the RAG chat interface
 */

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  isStreaming?: boolean;
  isEdited?: boolean;
  editedAt?: Date;
  originalContent?: string;
  regenerationCount?: number;
  metadata?: MessageMetadata;
}

export interface MessageMetadata {
  sources?: Source[];
  confidence?: ConfidenceScore;
  suggestedQuestions?: SuggestedQuestion[];
  relatedArticles?: RelatedArticle[];
  queryIntent?: string;
  queryComplexity?: string;
  documentsSearched?: number;
  documentsUsed?: number;
  processingTime?: number;
  conversationId?: string;
  timings?: ProcessingTimings;
}

export interface Source {
  id: string;
  title: string;
  source: string;
  url?: string;
  publishedAt?: string | Date;
  score: number;
  snippet?: string;
  content?: string;
  metadata?: {
    date?: string;
    category?: string;
    type?: string;
    source?: string;
    [key: string]: unknown;
  };
}

export interface ConfidenceScore {
  overall: number;
  level: 'high' | 'medium' | 'low' | 'uncertain';
  factors?: {
    sourceQuality: number;
    relevance: number;
    recency: number;
    consistency: number;
  };
  dimensions?: {
    retrieval: number;
    generation: number;
    attribution: number;
    factual: number;
    temporal: number;
  };
  explanation?: string;
  warnings?: string[];
}

export interface SuggestedQuestion {
  text: string;
  question?: string; // alias for text
  type?: 'expansion' | 'detail' | 'comparison' | 'impact' | 'timeline' | 'causal';
  category?: 'market' | 'news' | 'analysis' | 'education' | 'general';
  relevance?: number;
}

export interface RelatedArticle {
  id: string;
  title: string;
  source: string;
  url?: string;
  similarity: number;
  relationship?: string;
}

export interface ProcessingTimings {
  routing?: number;
  search?: number;
  reranking?: number;
  compression?: number;
  generation?: number;
  confidence?: number;
  suggestions?: number;
  related?: number;
}

export interface Conversation {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: Date;
  updatedAt: Date;
  metadata?: {
    messageCount: number;
    topics?: string[];
  };
}

export interface StreamEvent {
  event: 'start' | 'step' | 'query_info' | 'retrieval' | 'reranking' | 'token' | 'complete' | 'error';
  data: unknown;
}

export interface ChatSettings {
  streamingEnabled: boolean;
  showConfidence: boolean;
  showSources: boolean;
  showSuggestions: boolean;
  showTimings: boolean;
  showRelatedArticles: boolean;
  enableVoiceInput: boolean;
  autoScroll: boolean;
  compactMode: boolean;
  theme: 'light' | 'dark' | 'system';
  fontSize: 'small' | 'medium' | 'large';
}

export const DEFAULT_CHAT_SETTINGS: ChatSettings = {
  streamingEnabled: true,
  showConfidence: true,
  showSources: true,
  showSuggestions: true,
  showTimings: false,
  showRelatedArticles: true,
  enableVoiceInput: true,
  autoScroll: true,
  compactMode: false,
  theme: 'dark',
  fontSize: 'medium',
};

export const KEYBOARD_SHORTCUTS = [
  { key: 'Cmd/Ctrl + K', action: 'Toggle chat modal', category: 'navigation' },
  { key: 'Cmd/Ctrl + N', action: 'New conversation', category: 'navigation' },
  { key: 'Cmd/Ctrl + /', action: 'Show keyboard shortcuts', category: 'navigation' },
  { key: 'Enter', action: 'Send message', category: 'input' },
  { key: 'Shift + Enter', action: 'New line', category: 'input' },
  { key: 'Escape', action: 'Stop generation / Close modal', category: 'control' },
  { key: 'Cmd/Ctrl + Shift + C', action: 'Copy last response', category: 'clipboard' },
  { key: 'Cmd/Ctrl + Shift + E', action: 'Export conversation', category: 'clipboard' },
] as const;

export const SUGGESTED_QUERIES: SuggestedQuestion[] = [
  { text: "What's the latest news on Bitcoin ETFs?", category: 'news' },
  { text: "Why is Ethereum moving today?", category: 'market' },
  { text: "What regulatory news came out this week?", category: 'news' },
  { text: "Summarize the crypto market sentiment", category: 'analysis' },
  { text: "Which DeFi protocols are trending?", category: 'market' },
  { text: "Any major hacks or exploits recently?", category: 'news' },
  { text: "What's happening with Solana?", category: 'market' },
  { text: "Bitcoin price analysis for this week", category: 'analysis' },
];

export const CONFIDENCE_COLORS = {
  high: { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-700 dark:text-green-400', border: 'border-green-300 dark:border-green-700' },
  medium: { bg: 'bg-yellow-100 dark:bg-yellow-900/30', text: 'text-yellow-700 dark:text-yellow-400', border: 'border-yellow-300 dark:border-yellow-700' },
  low: { bg: 'bg-orange-100 dark:bg-orange-900/30', text: 'text-orange-700 dark:text-orange-400', border: 'border-orange-300 dark:border-orange-700' },
  uncertain: { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-400', border: 'border-red-300 dark:border-red-700' },
};

export const CONFIDENCE_ICONS = {
  high: '✓',
  medium: '~',
  low: '!',
  uncertain: '?',
};
