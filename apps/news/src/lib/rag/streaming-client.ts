/**
 * RAG Streaming Client
 * 
 * Client-side helpers for consuming the streaming RAG API
 */

export interface StreamEvent {
  type: 'start' | 'step' | 'query_info' | 'retrieval' | 'reranking' | 'token' | 'complete' | 'error';
  data: unknown;
}

export interface RAGStreamCallbacks {
  onStart?: (data: { conversationId: string; timestamp: number }) => void;
  onStep?: (data: { type: string; message: string }) => void;
  onQueryInfo?: (data: {
    original: string;
    contextualized: string;
    intent: string;
    complexity: string;
    isFollowUp: boolean;
  }) => void;
  onRetrieval?: (data: {
    documentsFound: number;
    topSources: { id: string; title: string; source: string; score: number }[];
  }) => void;
  onReranking?: (data: {
    reranked: { id: string; title: string; score: number }[];
  }) => void;
  onToken?: (token: string) => void;
  onComplete?: (data: {
    answer: string;
    sources: {
      id: string;
      title: string;
      source: string;
      url?: string;
      publishedAt?: string;
      score: number;
    }[];
    metadata: Record<string, unknown>;
  }) => void;
  onError?: (error: { message: string }) => void;
}

/**
 * Stream RAG response with callbacks for each event type
 */
export async function streamRAG(
  query: string,
  callbacks: RAGStreamCallbacks,
  options: {
    conversationId?: string;
    useHyDE?: boolean;
    useDecomposition?: boolean;
    baseUrl?: string;
  } = {}
): Promise<void> {
  const { baseUrl = '', ...requestOptions } = options;

  const response = await fetch(`${baseUrl}/api/rag/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query,
      conversationId: requestOptions.conversationId,
      options: {
        useHyDE: requestOptions.useHyDE,
        useDecomposition: requestOptions.useDecomposition,
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error('No response body');

  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    let currentEvent = '';
    let currentData = '';

    for (const line of lines) {
      if (line.startsWith('event: ')) {
        currentEvent = line.slice(7);
      } else if (line.startsWith('data: ')) {
        currentData = line.slice(6);

        try {
          const data = JSON.parse(currentData);

          switch (currentEvent) {
            case 'start':
              callbacks.onStart?.(data);
              break;
            case 'step':
              callbacks.onStep?.(data);
              break;
            case 'query_info':
              callbacks.onQueryInfo?.(data);
              break;
            case 'retrieval':
              callbacks.onRetrieval?.(data);
              break;
            case 'reranking':
              callbacks.onReranking?.(data);
              break;
            case 'token':
              callbacks.onToken?.(data.content);
              break;
            case 'complete':
              callbacks.onComplete?.(data);
              break;
            case 'error':
              callbacks.onError?.(data);
              break;
          }
        } catch {
          // Skip malformed JSON
        }
      }
    }
  }
}

/**
 * Simple hook-style wrapper for React
 */
export function createRAGStreamHandler() {
  let currentResponse = '';
  let isStreaming = false;

  return {
    stream: async (
      query: string,
      onUpdate: (response: string, isComplete: boolean) => void,
      options?: {
        conversationId?: string;
        onStep?: (step: string) => void;
        onSources?: (sources: unknown[]) => void;
      }
    ) => {
      currentResponse = '';
      isStreaming = true;

      await streamRAG(query, {
        onStep: (data) => options?.onStep?.(data.message),
        onToken: (token) => {
          currentResponse += token;
          onUpdate(currentResponse, false);
        },
        onComplete: (data) => {
          currentResponse = data.answer;
          onUpdate(currentResponse, true);
          options?.onSources?.(data.sources);
          isStreaming = false;
        },
        onError: (error) => {
          currentResponse = `Error: ${error.message}`;
          onUpdate(currentResponse, true);
          isStreaming = false;
        },
      }, { conversationId: options?.conversationId });
    },

    get response() {
      return currentResponse;
    },

    get streaming() {
      return isStreaming;
    },
  };
}
