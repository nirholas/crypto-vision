-- Crypto Vision — Embeddings Table Schema
-- 
-- This SQL creates the BigQuery table and vector index for
-- storing and searching document embeddings.
--
-- Run this manually or let the application auto-create via
-- src/lib/bigquery.ts ensureEmbeddingsTable()
--
-- Prerequisites:
--   gcloud services enable aiplatform.googleapis.com bigquery.googleapis.com

-- ─── Create Dataset ──────────────────────────────────────────

CREATE SCHEMA IF NOT EXISTS crypto_vision
  OPTIONS (
    location = 'us-central1',
    description = 'Crypto Vision data warehouse'
  );

-- ─── Create Embeddings Table ─────────────────────────────────

CREATE TABLE IF NOT EXISTS crypto_vision.embeddings (
  id STRING NOT NULL,
  content STRING,
  embedding ARRAY<FLOAT64> NOT NULL,
  metadata STRING,           -- JSON string for flexible metadata
  category STRING,           -- news, protocol, agent, governance
  source STRING,             -- data source identifier
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP()
)
CLUSTER BY category, source;

-- ─── Create Vector Index ─────────────────────────────────────
-- IVF index with cosine distance for fast approximate nearest neighbor search.
-- num_lists = 100 is good for up to ~1M vectors. Increase for larger datasets.

CREATE VECTOR INDEX IF NOT EXISTS idx_embeddings_vector
ON crypto_vision.embeddings(embedding)
OPTIONS (
  index_type = 'IVF',
  distance_type = 'COSINE',
  ivf_options = '{"num_lists": 100}'
);

-- ─── Useful Queries ──────────────────────────────────────────

-- Count embeddings by category
-- SELECT category, COUNT(*) as cnt FROM crypto_vision.embeddings GROUP BY category;

-- Vector search example
-- SELECT base.id, base.content, distance
-- FROM VECTOR_SEARCH(
--   TABLE `crypto_vision.embeddings`,
--   'embedding',
--   (SELECT [0.1, 0.2, ...] AS embedding),  -- your query embedding
--   top_k => 10,
--   distance_type => 'COSINE'
-- )
-- ORDER BY distance ASC;

-- Delete old entries (cleanup)
-- DELETE FROM crypto_vision.embeddings WHERE updated_at < TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 30 DAY);
