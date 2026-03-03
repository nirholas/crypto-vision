/**
 * Embedding Service
 * 
 * Adapted from crypto-news-rag NormilizingEmbeddingModel.java
 * Generates text embeddings for news articles using various providers.
 * 
 * Supported providers:
 * - OpenAI (text-embedding-3-small)
 * - Hugging Face Inference API (all-MiniLM-L6-v2)
 * - Groq (when embedding endpoint available)
 * 
 * The original Java project used all-MiniLM-L6-v2 with 384 dimensions.
 */

import type { EmbeddingConfig } from './types';

// Default configuration matching original Java project
const DEFAULT_CONFIG: EmbeddingConfig = {
  provider: 'huggingface',
  model: 'sentence-transformers/all-MiniLM-L6-v2',
  dimensions: 384,
  normalize: true,
};

// API endpoints
const OPENAI_EMBEDDING_URL = 'https://api.openai.com/v1/embeddings';
const HUGGINGFACE_INFERENCE_URL = 'https://api-inference.huggingface.co/pipeline/feature-extraction';

/**
 * Normalize a vector to unit length (L2 norm)
 * This is important for dot product similarity
 */
export function normalizeVector(vector: number[]): number[] {
  const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
  if (magnitude === 0) return vector;
  return vector.map(val => val / magnitude);
}

/**
 * Calculate dot product similarity between two vectors
 */
export function dotProduct(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error('Vectors must have the same length');
  }
  return a.reduce((sum, val, i) => sum + val * b[i], 0);
}

/**
 * Calculate cosine similarity between two vectors
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  const dotProd = dotProduct(a, b);
  const magnitudeA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
  const magnitudeB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
  if (magnitudeA === 0 || magnitudeB === 0) return 0;
  return dotProd / (magnitudeA * magnitudeB);
}

/**
 * Generate embeddings using OpenAI API
 */
async function generateOpenAIEmbedding(
  text: string,
  model: string = 'text-embedding-3-small'
): Promise<number[]> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY not configured');
  }

  const response = await fetch(OPENAI_EMBEDDING_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      input: text,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenAI embedding error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  return data.data[0].embedding;
}

/**
 * Generate embeddings using Hugging Face Inference API
 */
async function generateHuggingFaceEmbedding(
  text: string,
  model: string = 'sentence-transformers/all-MiniLM-L6-v2'
): Promise<number[]> {
  const apiKey = process.env.HUGGINGFACE_API_KEY;
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  
  if (apiKey) {
    headers['Authorization'] = `Bearer ${apiKey}`;
  }

  const response = await fetch(`${HUGGINGFACE_INFERENCE_URL}/${model}`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      inputs: text,
      options: {
        wait_for_model: true,
      },
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Hugging Face embedding error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  
  // Hugging Face returns nested array for sentence-transformers models
  if (Array.isArray(data) && Array.isArray(data[0])) {
    // Mean pooling for token embeddings
    const tokenEmbeddings = data as number[][];
    const meanPooled = tokenEmbeddings[0].map((_, i) => 
      tokenEmbeddings.reduce((sum, embedding) => sum + embedding[i], 0) / tokenEmbeddings.length
    );
    return meanPooled;
  }
  
  return data as number[];
}

/**
 * Generate a simple hash-based embedding (for testing/fallback)
 * NOT for production use - only for testing the pipeline
 */
function generateSimpleEmbedding(text: string, dimensions: number = 384): number[] {
  const embedding = new Array(dimensions).fill(0);
  const normalizedText = text.toLowerCase().trim();
  
  // Simple hash-based approach for testing
  for (let i = 0; i < normalizedText.length; i++) {
    const charCode = normalizedText.charCodeAt(i);
    const idx = (charCode * (i + 1)) % dimensions;
    embedding[idx] += Math.sin(charCode * (i + 1) * 0.01);
  }
  
  return normalizeVector(embedding);
}

/**
 * Main embedding generation function
 */
export async function generateEmbedding(
  text: string,
  config: Partial<EmbeddingConfig> = {}
): Promise<number[]> {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };
  
  try {
    let embedding: number[];

    switch (finalConfig.provider) {
      case 'openai':
        embedding = await generateOpenAIEmbedding(text, finalConfig.model);
        break;
      
      case 'huggingface':
        embedding = await generateHuggingFaceEmbedding(text, finalConfig.model);
        break;
      
      case 'local':
      default:
        // Fallback to simple embedding for testing
        console.warn('Using simple embedding - not recommended for production');
        embedding = generateSimpleEmbedding(text, finalConfig.dimensions);
        break;
    }

    // Normalize if requested (important for dot product similarity)
    if (finalConfig.normalize) {
      embedding = normalizeVector(embedding);
    }

    return embedding;
  } catch (error) {
    console.error('Embedding generation failed:', error);
    // Return simple embedding as fallback
    console.warn('Falling back to simple embedding');
    return generateSimpleEmbedding(text, finalConfig.dimensions);
  }
}

/**
 * Generate embeddings for multiple texts in batch
 */
export async function generateEmbeddings(
  texts: string[],
  config: Partial<EmbeddingConfig> = {}
): Promise<number[][]> {
  // Process in batches to avoid rate limits
  const batchSize = 20;
  const embeddings: number[][] = [];
  
  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      batch.map(text => generateEmbedding(text, config))
    );
    embeddings.push(...batchResults);
    
    // Add delay between batches to respect rate limits
    if (i + batchSize < texts.length) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  
  return embeddings;
}

/**
 * Get the embedding configuration based on environment
 */
export function getEmbeddingConfig(): EmbeddingConfig {
  if (process.env.OPENAI_API_KEY) {
    return {
      provider: 'openai',
      model: 'text-embedding-3-small',
      dimensions: 1536,
      normalize: true,
    };
  }
  
  if (process.env.HUGGINGFACE_API_KEY) {
    return {
      provider: 'huggingface',
      model: 'sentence-transformers/all-MiniLM-L6-v2',
      dimensions: 384,
      normalize: true,
    };
  }
  
  // Fallback to local (testing only)
  return {
    provider: 'local',
    model: 'simple-hash',
    dimensions: 384,
    normalize: true,
  };
}
