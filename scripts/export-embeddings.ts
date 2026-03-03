/**
 * Crypto Vision — Embeddings Export Script
 *
 * Exports all embeddings from the vector store to portable formats:
 *  - embeddings-metadata.jsonl: Document metadata (id, content, category)
 *  - embeddings.bin: Raw float32 binary (NumPy-compatible)
 *  - embeddings-manifest.json: Export manifest with dimensions and count
 *
 * The exported data can be imported into:
 *  - pgvector (PostgreSQL)
 *  - Qdrant
 *  - Pinecone
 *  - Weaviate
 *  - Milvus
 *  - Any vector DB that accepts float32 arrays
 *
 * Usage:
 *   npx tsx scripts/export-embeddings.ts [--output-dir exports]
 */

import { writeFileSync, mkdirSync, existsSync, createWriteStream } from "fs";
import { join } from "path";

async function exportEmbeddings(): Promise<void> {
  const outputDir = process.argv.includes("--output-dir")
    ? process.argv[process.argv.indexOf("--output-dir") + 1]
    : join(process.cwd(), "exports");

  console.log(`Exporting embeddings to: ${outputDir}`);

  // Ensure output directory exists
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }

  // Determine export source
  const hasBigQuery = !!process.env.GCP_PROJECT_ID;

  if (hasBigQuery) {
    await exportFromBigQuery(outputDir);
  } else {
    console.log("No GCP_PROJECT_ID set — exporting from in-memory store");
    console.log("For a full export, set GCP_PROJECT_ID and run against BigQuery");
    await exportFromInMemory(outputDir);
  }
}

async function exportFromBigQuery(outputDir: string): Promise<void> {
  const { query } = await import("../src/lib/bigquery.js");

  console.log("Querying BigQuery for all embeddings...");

  const rows = await query<{
    id: string;
    content: string;
    embedding: number[];
    metadata: string;
    category: string;
    source: string;
  }>("SELECT id, content, embedding, metadata, category, source FROM crypto_vision.embeddings ORDER BY updated_at DESC");

  if (rows.length === 0) {
    console.log("No embeddings found in BigQuery");
    return;
  }

  writeExportFiles(outputDir, rows);
}

async function exportFromInMemory(outputDir: string): Promise<void> {
  // Import the vector store to access in-memory data
  const { vectorStore } = await import("../src/lib/vector-store.js");

  const count = await vectorStore.count();
  if (count === 0) {
    console.log("No embeddings in vector store");
    console.log("Run the indexing workers first to populate the store");
    return;
  }

  console.log(`Found ${count} embeddings in memory store`);

  // For in-memory store, we need to access the internal entries
  // This is a limitation — in production, always export from BigQuery
  console.log("Note: In-memory export includes all stored vectors");
  console.log("For production exports, use BigQuery backend (set GCP_PROJECT_ID)");

  // We can't directly iterate the in-memory store from here
  // without exposing internals, so we provide a search-based approach
  // Generate a broad query to get all results
  const dummyEmbedding = new Array(768).fill(0);
  dummyEmbedding[0] = 1; // Unit vector
  const results = await vectorStore.search(dummyEmbedding, count);

  const rows = results.map((r) => ({
    id: r.id,
    content: r.content,
    embedding: [] as number[], // We don't have raw embeddings from search results
    metadata: JSON.stringify(r.metadata),
    category: (r.metadata.category as string) || "general",
    source: (r.metadata.source as string) || "unknown",
  }));

  // Write metadata only (embeddings not available from search interface)
  const metadataPath = join(outputDir, "embeddings-metadata.jsonl");
  const metaStream = createWriteStream(metadataPath);

  for (const row of rows) {
    metaStream.write(
      JSON.stringify({
        id: row.id,
        content: row.content?.slice(0, 500),
        category: row.category,
        source: row.source,
        metadata: row.metadata,
      }) + "\n",
    );
  }
  metaStream.end();

  const manifest = {
    exportedAt: new Date().toISOString(),
    count: rows.length,
    dimension: 768,
    format: "jsonl-only",
    note: "Binary embeddings not available from in-memory store. Use BigQuery for full export.",
    files: {
      metadata: "embeddings-metadata.jsonl",
    },
  };
  writeFileSync(join(outputDir, "embeddings-manifest.json"), JSON.stringify(manifest, null, 2));

  console.log(`Exported ${rows.length} metadata entries (no binary embeddings from in-memory)`);
  console.log(`  Metadata: ${metadataPath}`);
}

function writeExportFiles(
  outputDir: string,
  rows: Array<{
    id: string;
    content: string;
    embedding: number[];
    metadata: string;
    category: string;
    source: string;
  }>,
): void {
  if (rows.length === 0) return;

  const dimension = rows[0].embedding.length;

  // 1. Write metadata as JSONL
  const metadataPath = join(outputDir, "embeddings-metadata.jsonl");
  const metaStream = createWriteStream(metadataPath);

  for (const row of rows) {
    metaStream.write(
      JSON.stringify({
        id: row.id,
        content: row.content?.slice(0, 500),
        category: row.category,
        source: row.source,
        metadata: row.metadata,
      }) + "\n",
    );
  }
  metaStream.end();

  // 2. Write embeddings as raw float32 binary (NumPy-compatible)
  const binaryPath = join(outputDir, "embeddings.bin");
  const buffer = Buffer.alloc(rows.length * dimension * 4); // 4 bytes per float32
  let offset = 0;

  for (const row of rows) {
    for (const val of row.embedding) {
      buffer.writeFloatLE(val, offset);
      offset += 4;
    }
  }
  writeFileSync(binaryPath, buffer);

  // 3. Write NumPy-compatible header for easy loading
  const npyHeaderPath = join(outputDir, "embeddings.npy.header");
  const npyHeader = {
    shape: [rows.length, dimension],
    dtype: "<f4", // little-endian float32
    fortranOrder: false,
    description: "Load with: np.frombuffer(open('embeddings.bin','rb').read(), dtype=np.float32).reshape(shape)",
  };
  writeFileSync(npyHeaderPath, JSON.stringify(npyHeader, null, 2));

  // 4. Write manifest
  const manifest = {
    exportedAt: new Date().toISOString(),
    count: rows.length,
    dimension,
    format: "float32-le",
    files: {
      embeddings: "embeddings.bin",
      metadata: "embeddings-metadata.jsonl",
      npyHeader: "embeddings.npy.header",
    },
    sizeBytes: {
      embeddings: buffer.length,
      total: buffer.length,
    },
    importInstructions: {
      numpy: "embeddings = np.frombuffer(open('embeddings.bin','rb').read(), dtype=np.float32).reshape(-1, " + dimension + ")",
      pgvector: "Use COPY with binary format or insert via psycopg2 with pgvector extension",
      qdrant: "Use qdrant_client.upload_collection with vectors from numpy array",
      pinecone: "Use pinecone.upsert with vectors from numpy array and metadata from JSONL",
    },
  };
  writeFileSync(join(outputDir, "embeddings-manifest.json"), JSON.stringify(manifest, null, 2));

  const sizeMB = (buffer.length / 1024 / 1024).toFixed(2);
  console.log(`\nExport complete!`);
  console.log(`  Count: ${rows.length} embeddings (${dimension}d)`);
  console.log(`  Binary: ${binaryPath} (${sizeMB} MB)`);
  console.log(`  Metadata: ${metadataPath}`);
  console.log(`  Manifest: ${join(outputDir, "embeddings-manifest.json")}`);
}

// ─── Run ─────────────────────────────────────────────────────

exportEmbeddings()
  .then(() => {
    console.log("\nDone.");
    process.exit(0);
  })
  .catch((err) => {
    console.error("Export failed:", err);
    process.exit(1);
  });
