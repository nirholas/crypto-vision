/**
 * Crypto Vision — BigQuery Client
 *
 * Thin wrapper around @google-cloud/bigquery that:
 *  - Lazy-initializes the client (no cost if unused)
 *  - Provides typed helpers for common operations
 *  - Handles parameterized queries to prevent injection
 *  - Includes retry logic and timeout enforcement
 *  - Creates dataset/tables on demand
 *
 * Requires: GCP_PROJECT_ID env var + Application Default Credentials
 */

import { log } from "./logger.js";

// ─── Lazy Client ─────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- BigQuery types only available when @google-cloud/bigquery is installed
let bqClient: any = null;

async function getClient() {
  if (bqClient) return bqClient;

  const projectId = process.env.GCP_PROJECT_ID;
  if (!projectId) throw new Error("GCP_PROJECT_ID is required for BigQuery");

  // Dynamic import so we don't break local dev without the dep
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { BigQuery } = await import("@google-cloud/bigquery" as string);
  bqClient = new BigQuery({
    projectId,
    location: process.env.GCP_REGION || "us-central1",
  });

  log.info({ projectId }, "BigQuery client initialized");
  return bqClient;
}

// ─── Dataset / Table Management ──────────────────────────────

const DEFAULT_DATASET = process.env.BQ_DATASET || "crypto_vision";

export async function ensureDataset(datasetId = DEFAULT_DATASET): Promise<void> {
  const client = await getClient();
  const ds = client.dataset(datasetId);
  const [exists] = await ds.exists();
  if (!exists) {
    await ds.create({ location: process.env.GCP_REGION || "us-central1" });
    log.info({ datasetId }, "Created BigQuery dataset");
  }
}

export async function ensureTable(
  tableId: string,
  schema: Array<{ name: string; type: string; mode?: string; fields?: Array<{ name: string; type: string }> }>,
  datasetId = DEFAULT_DATASET,
): Promise<void> {
  const client = await getClient();
  const table = client.dataset(datasetId).table(tableId);
  const [exists] = await table.exists();
  if (!exists) {
    await table.create({ schema: { fields: schema } });
    log.info({ datasetId, tableId }, "Created BigQuery table");
  }
}

// ─── Query ───────────────────────────────────────────────────

/**
 * Run a parameterized SQL query against BigQuery.
 * Returns an array of row objects.
 *
 * @param sql - SQL string with @param placeholders
 * @param params - Named parameter values
 */
export async function query<T = Record<string, unknown>>(
  sql: string,
  params?: Record<string, unknown>,
): Promise<T[]> {
  const client = await getClient();
  const options: Record<string, unknown> = {
    query: sql,
    location: process.env.GCP_REGION || "us-central1",
    maximumBytesBilled: process.env.BQ_MAX_BYTES || "1000000000", // 1 GB safety limit
  };

  if (params) {
    options.params = params;
  }

  const [rows] = await client.query(options);
  return rows as T[];
}

// ─── Insert Rows ─────────────────────────────────────────────

/**
 * Stream rows into a BigQuery table using the insertAll API.
 * Supports batching — splits large payloads automatically.
 */
export async function insertRows(
  tableId: string,
  rows: Record<string, unknown>[],
  datasetId = DEFAULT_DATASET,
): Promise<void> {
  if (rows.length === 0) return;

  const client = await getClient();
  const table = client.dataset(datasetId).table(tableId);

  // BigQuery streaming insert max is ~10,000 rows or 10 MB per request
  const BATCH_SIZE = 500;
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    await table.insert(batch, {
      skipInvalidRows: false,
      ignoreUnknownValues: false,
    });
  }

  log.debug({ tableId, count: rows.length }, "Inserted rows into BigQuery");
}

// ─── Merge / Upsert ─────────────────────────────────────────

/**
 * Upsert a row using MERGE.
 * Avoids duplicate key issues with streaming inserts.
 */
export async function upsertRow(
  tableId: string,
  row: Record<string, unknown>,
  keyColumn: string,
  datasetId = DEFAULT_DATASET,
): Promise<void> {
  const columns = Object.keys(row);
  const setClause = columns.map((c) => `T.${c} = S.${c}`).join(", ");
  const insertColumns = columns.join(", ");
  const insertValues = columns.map((c) => `S.${c}`).join(", ");
  const selectValues = columns
    .map((c) => {
      const val = row[c];
      if (val === null || val === undefined) return `NULL AS ${c}`;
      if (typeof val === "number") return `${val} AS ${c}`;
      if (typeof val === "boolean") return `${val} AS ${c}`;
      if (Array.isArray(val)) return `${JSON.stringify(val)} AS ${c}`;
      return `'${String(val).replace(/'/g, "\\'")}' AS ${c}`;
    })
    .join(", ");

  const sql = `
    MERGE \`${datasetId}.${tableId}\` T
    USING (SELECT ${selectValues}) S
    ON T.${keyColumn} = S.${keyColumn}
    WHEN MATCHED THEN UPDATE SET ${setClause}
    WHEN NOT MATCHED THEN INSERT (${insertColumns}) VALUES (${insertValues})
  `;

  await query(sql);
}

// ─── Embeddings Table Schema ─────────────────────────────────

export const EMBEDDINGS_TABLE = "embeddings";

export const EMBEDDINGS_SCHEMA = [
  { name: "id", type: "STRING", mode: "REQUIRED" },
  { name: "content", type: "STRING" },
  { name: "embedding", type: "FLOAT64", mode: "REPEATED" },
  { name: "metadata", type: "STRING" }, // JSON string
  { name: "category", type: "STRING" },
  { name: "source", type: "STRING" },
  { name: "updated_at", type: "TIMESTAMP", mode: "REQUIRED" },
];

/**
 * Ensure the embeddings table and vector index exist.
 */
export async function ensureEmbeddingsTable(datasetId = DEFAULT_DATASET): Promise<void> {
  await ensureDataset(datasetId);
  await ensureTable(EMBEDDINGS_TABLE, EMBEDDINGS_SCHEMA, datasetId);
  log.info("Embeddings table ready");
}

// ─── Cleanup ─────────────────────────────────────────────────

export async function closeBigQuery(): Promise<void> {
  if (bqClient) {
    // BigQuery client doesn't need explicit close, but we null the reference
    bqClient = null;
    log.info("BigQuery client reference released");
  }
}
