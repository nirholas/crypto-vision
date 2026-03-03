/**
 * RAG Chat Components
 * 
 * Production-ready chat interface for the RAG system
 */

// Main component
export { RAGChat, default } from './RAGChat';

// Modal and Provider
export { RAGChatModal } from './RAGChatModal';
export { RAGChatProvider, useRAGChatModal } from './RAGChatProvider';
export { AskAIButton } from './AskAIButton';

// Sub-components
export { ChatMessage } from './ChatMessage';
export { ChatInput } from './ChatInput';
export { SourcePanel } from './SourcePanel';
export { SuggestedQuestions } from './SuggestedQuestions';
export { ProcessingIndicator } from './ProcessingIndicator';

// Enhanced components
export { ConfidenceBadge } from './ConfidenceBadge';
export { SettingsPanel } from './SettingsPanel';
export { KeyboardShortcuts } from './KeyboardShortcuts';
export { MessageSkeleton, MessageSkeletonGroup, WelcomeSkeleton } from './MessageSkeleton';
export { RelatedArticles } from './RelatedArticles';
export { MessageSearch } from './MessageSearch';
export { ErrorBoundary, ErrorFallback, MessageError, NetworkErrorBanner } from './ErrorBoundary';
export { ToastProvider, useToast } from './Toast';
export { TypingIndicator } from './TypingIndicator';

// Hooks
export { useRAGChat } from './useRAGChat';

// Types
export * from './types';
export type { Article } from './RelatedArticles';
