/**
 * Training Data Preparation — Merge, Deduplicate, Shuffle & Split
 *
 * Reads all *-pairs.jsonl files from data/training/, deduplicates by
 * content hash, shuffles deterministically, and splits into train/eval
 * JSONL files ready for the Python training script.
 *
 * Usage:
 *   npx tsx scripts/training/opensource/prepare-data.ts
 *
 * Output:
 *   data/training/prepared/train.jsonl
 *   data/training/prepared/eval.jsonl
 *   data/training/prepared/stats.json
 *
 * @copyright 2024-2026 nirholas. All rights reserved.
 */

import {
  readFileSync,
  writeFileSync,
  readdirSync,
  mkdirSync,
  existsSync,
  statSync,
} from "fs";
import { createHash } from "crypto";
import { join, basename } from "path";

// ─── Configuration ───────────────────────────────────────────

const DATA_DIR = "data/training";
const OUTPUT_DIR = "data/training/prepared";
const EVAL_SPLIT_RATIO = 0.05; // 5% for evaluation
const MIN_EVAL_EXAMPLES = 10;
const SEED = 42; // For deterministic shuffling

// ─── Types ───────────────────────────────────────────────────

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface TrainingExample {
  messages: ChatMessage[];
}

interface FileStats {
  filename: string;
  totalLines: number;
  validLines: number;
  duplicates: number;
  errors: number;
  avgMessageLength: number;
}

interface PrepStats {
  files: FileStats[];
  totalExamples: number;
  uniqueExamples: number;
  duplicatesRemoved: number;
  trainExamples: number;
  evalExamples: number;
  avgMessagesPerExample: number;
  avgTokenEstimate: number;
  timestamp: string;
}

// ─── Seeded Random (Mulberry32) ──────────────────────────────

function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ─── Validation ──────────────────────────────────────────────

function validateExample(line: string, lineNum: number, filename: string): TrainingExample | null {
  let obj: Record<string, unknown>;
  try {
    obj = JSON.parse(line);
  } catch {
    console.warn(`  [WARN] ${filename}:${lineNum} — invalid JSON, skipping`);
    return null;
  }

  if (!Array.isArray(obj.messages)) {
    console.warn(`  [WARN] ${filename}:${lineNum} — missing or invalid 'messages' array`);
    return null;
  }

  const messages = obj.messages as ChatMessage[];

  if (messages.length < 2) {
    console.warn(`  [WARN] ${filename}:${lineNum} — need at least 2 messages (system+user or user+assistant)`);
    return null;
  }

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    if (!msg.role || !msg.content) {
      console.warn(`  [WARN] ${filename}:${lineNum} — message ${i} missing role or content`);
      return null;
    }
    if (!["system", "user", "assistant"].includes(msg.role)) {
      console.warn(`  [WARN] ${filename}:${lineNum} — message ${i} has invalid role: ${msg.role}`);
      return null;
    }
    if (typeof msg.content !== "string" || msg.content.trim().length === 0) {
      console.warn(`  [WARN] ${filename}:${lineNum} — message ${i} has empty content`);
      return null;
    }
  }

  return { messages };
}

// ─── Main ────────────────────────────────────────────────────

function prepareData(): void {
  console.log("═══════════════════════════════════════════════════════");
  console.log("  Crypto Vision — Training Data Preparation");
  console.log("═══════════════════════════════════════════════════════\n");

  // Check data directory exists
  if (!existsSync(DATA_DIR)) {
    console.error(`ERROR: Data directory not found: ${DATA_DIR}`);
    console.error("Run the data generation pipeline first (Prompt 04).");
    process.exit(1);
  }

  // Find all JSONL pair files
  const files = readdirSync(DATA_DIR)
    .filter((f) => f.endsWith("-pairs.jsonl") || f.endsWith("-pairs.jsonl"))
    .sort();

  if (files.length === 0) {
    console.error(`ERROR: No *-pairs.jsonl files found in ${DATA_DIR}`);
    console.error("Run the data generation pipeline first (Prompt 04).");
    process.exit(1);
  }

  console.log(`Found ${files.length} data files:\n`);

  const allPairs: string[] = [];
  const seen = new Set<string>();
  const fileStats: FileStats[] = [];

  for (const file of files) {
    const filePath = join(DATA_DIR, file);
    const stat = statSync(filePath);
    const lines = readFileSync(filePath, "utf-8").trim().split("\n");

    let validLines = 0;
    let duplicates = 0;
    let errors = 0;
    let totalMsgLength = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      // Validate the example
      const example = validateExample(line, i + 1, file);
      if (!example) {
        errors++;
        continue;
      }

      // Deduplicate by content hash
      const hash = createHash("sha256").update(line).digest("hex");
      if (seen.has(hash)) {
        duplicates++;
        continue;
      }

      seen.add(hash);
      allPairs.push(line);
      validLines++;

      // Track message lengths for stats
      for (const msg of example.messages) {
        totalMsgLength += msg.content.length;
      }
    }

    const stats: FileStats = {
      filename: file,
      totalLines: lines.length,
      validLines,
      duplicates,
      errors,
      avgMessageLength: validLines > 0 ? Math.round(totalMsgLength / validLines) : 0,
    };
    fileStats.push(stats);

    const sizeKB = (stat.size / 1024).toFixed(1);
    console.log(
      `  ${file} (${sizeKB} KB): ${validLines} valid, ${duplicates} dupes, ${errors} errors`,
    );
  }

  console.log(`\nTotal unique examples: ${allPairs.length}`);

  if (allPairs.length === 0) {
    console.error("\nERROR: No valid training examples found. Check your data files.");
    process.exit(1);
  }

  // Deterministic shuffle using seeded PRNG
  console.log(`\nShuffling with seed ${SEED}...`);
  const rng = mulberry32(SEED);
  for (let i = allPairs.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [allPairs[i], allPairs[j]] = [allPairs[j], allPairs[i]];
  }

  // Split into train/eval
  const evalSize = Math.max(MIN_EVAL_EXAMPLES, Math.floor(allPairs.length * EVAL_SPLIT_RATIO));
  const evalPairs = allPairs.slice(0, evalSize);
  const trainPairs = allPairs.slice(evalSize);

  console.log(`Split: ${trainPairs.length} train, ${evalPairs.length} eval`);

  // Calculate aggregate stats
  let totalMessages = 0;
  let totalChars = 0;
  for (const line of allPairs) {
    try {
      const obj = JSON.parse(line) as TrainingExample;
      totalMessages += obj.messages.length;
      for (const msg of obj.messages) {
        totalChars += msg.content.length;
      }
    } catch {
      // Already validated, skip
    }
  }

  // Write output files
  mkdirSync(OUTPUT_DIR, { recursive: true });
  writeFileSync(join(OUTPUT_DIR, "train.jsonl"), trainPairs.join("\n") + "\n", "utf-8");
  writeFileSync(join(OUTPUT_DIR, "eval.jsonl"), evalPairs.join("\n") + "\n", "utf-8");

  // Write stats
  const prepStats: PrepStats = {
    files: fileStats,
    totalExamples: allPairs.length + fileStats.reduce((sum, f) => sum + f.duplicates, 0),
    uniqueExamples: allPairs.length,
    duplicatesRemoved: fileStats.reduce((sum, f) => sum + f.duplicates, 0),
    trainExamples: trainPairs.length,
    evalExamples: evalPairs.length,
    avgMessagesPerExample: allPairs.length > 0 ? +(totalMessages / allPairs.length).toFixed(1) : 0,
    avgTokenEstimate: allPairs.length > 0 ? Math.round(totalChars / allPairs.length / 4) : 0, // ~4 chars per token
    timestamp: new Date().toISOString(),
  };

  writeFileSync(join(OUTPUT_DIR, "stats.json"), JSON.stringify(prepStats, null, 2) + "\n", "utf-8");

  // Summary
  console.log("\n═══════════════════════════════════════════════════════");
  console.log("  PREPARATION COMPLETE");
  console.log("═══════════════════════════════════════════════════════");
  console.log(`  Train file:    ${OUTPUT_DIR}/train.jsonl (${trainPairs.length} examples)`);
  console.log(`  Eval file:     ${OUTPUT_DIR}/eval.jsonl (${evalPairs.length} examples)`);
  console.log(`  Stats file:    ${OUTPUT_DIR}/stats.json`);
  console.log(`  Avg messages:  ${prepStats.avgMessagesPerExample} per example`);
  console.log(`  Avg tokens:    ~${prepStats.avgTokenEstimate} per example`);
  console.log(`  Duplicates:    ${prepStats.duplicatesRemoved} removed`);
  console.log("═══════════════════════════════════════════════════════\n");
}

prepareData();
