/**
 * Crypto Vision — Training Data Validator
 *
 * Validates JSONL training files for Gemini fine-tuning format compliance.
 * Checks: JSON validity, message structure, assistant JSON output, token counts,
 * and estimates fine-tuning cost.
 *
 * @copyright 2024-2026 nirholas. All rights reserved.
 */

import { readFileSync, existsSync, readdirSync, writeFileSync } from "fs";
import { resolve, basename } from "path";

// ─── Types ───────────────────────────────────────────────────

interface ValidationError {
  line: number;
  error: string;
}

interface TokenStats {
  avgInputTokens: number;
  avgOutputTokens: number;
  maxInputTokens: number;
  maxOutputTokens: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalTokens: number;
  estimatedCostUSD: number;
}

interface ValidationResult {
  file: string;
  totalPairs: number;
  validPairs: number;
  invalidPairs: number;
  errors: ValidationError[];
  stats: TokenStats;
  messageStats: {
    withSystem: number;
    avgMessagesPerPair: number;
    avgUserPromptLength: number;
    avgAssistantLength: number;
  };
  jsonQuality: {
    jsonParseableCount: number;
    jsonParseRate: number;
    avgFieldCount: number;
    emptyFieldCount: number;
  };
}

interface FullReport {
  validatedAt: string;
  totalFiles: number;
  totalPairs: number;
  totalValidPairs: number;
  totalEstimatedCostUSD: number;
  files: ValidationResult[];
  overallHealth: "excellent" | "good" | "needs-attention" | "poor";
}

// ─── Token Estimation ────────────────────────────────────────

/**
 * Rough token count estimation: ~4 characters per token for English text.
 * This is a conservative estimate; actual tokenization varies by model.
 */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

// ─── Validation Logic ────────────────────────────────────────

function validateJSONL(filePath: string): ValidationResult {
  const content = readFileSync(filePath, "utf-8").trim();
  const lines = content ? content.split("\n") : [];

  const result: ValidationResult = {
    file: basename(filePath),
    totalPairs: lines.length,
    validPairs: 0,
    invalidPairs: 0,
    errors: [],
    stats: {
      avgInputTokens: 0,
      avgOutputTokens: 0,
      maxInputTokens: 0,
      maxOutputTokens: 0,
      totalInputTokens: 0,
      totalOutputTokens: 0,
      totalTokens: 0,
      estimatedCostUSD: 0,
    },
    messageStats: {
      withSystem: 0,
      avgMessagesPerPair: 0,
      avgUserPromptLength: 0,
      avgAssistantLength: 0,
    },
    jsonQuality: {
      jsonParseableCount: 0,
      jsonParseRate: 0,
      avgFieldCount: 0,
      emptyFieldCount: 0,
    },
  };

  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let maxInputTokens = 0;
  let maxOutputTokens = 0;
  let totalMessages = 0;
  let totalUserLength = 0;
  let totalAssistantLength = 0;
  let totalFields = 0;
  let emptyFields = 0;

  for (let i = 0; i < lines.length; i++) {
    const lineNum = i + 1;
    const line = lines[i].trim();

    if (!line) {
      result.errors.push({ line: lineNum, error: "Empty line" });
      result.invalidPairs++;
      continue;
    }

    // 1. Parse line as JSON
    let pair: { messages?: Array<{ role: string; content: string }> };
    try {
      pair = JSON.parse(line);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      result.errors.push({ line: lineNum, error: `Invalid JSON: ${msg}` });
      result.invalidPairs++;
      continue;
    }

    // 2. Validate top-level structure
    if (!pair.messages || !Array.isArray(pair.messages)) {
      result.errors.push({ line: lineNum, error: "Missing or invalid 'messages' array" });
      result.invalidPairs++;
      continue;
    }

    if (pair.messages.length < 2) {
      result.errors.push({ line: lineNum, error: `Only ${pair.messages.length} message(s); need at least 2 (user + assistant)` });
      result.invalidPairs++;
      continue;
    }

    // 3. Validate message roles
    const roles = pair.messages.map((m) => m.role);
    const validRoles = new Set(["system", "user", "assistant"]);
    const invalidRoles = roles.filter((r) => !validRoles.has(r));
    if (invalidRoles.length > 0) {
      result.errors.push({ line: lineNum, error: `Invalid role(s): ${invalidRoles.join(", ")}` });
      result.invalidPairs++;
      continue;
    }

    const hasUser = roles.includes("user");
    const hasAssistant = roles.includes("assistant");
    const hasSystem = roles.includes("system");

    if (!hasUser || !hasAssistant) {
      result.errors.push({ line: lineNum, error: "Must have both user and assistant messages" });
      result.invalidPairs++;
      continue;
    }

    // 4. Validate content is non-empty
    const emptyContent = pair.messages.filter((m) => !m.content || m.content.trim().length === 0);
    if (emptyContent.length > 0) {
      result.errors.push({ line: lineNum, error: `${emptyContent.length} message(s) with empty content` });
      result.invalidPairs++;
      continue;
    }

    // 5. Validate assistant response
    const assistantMsg = pair.messages.find((m) => m.role === "assistant");
    if (!assistantMsg) {
      result.errors.push({ line: lineNum, error: "No assistant message found" });
      result.invalidPairs++;
      continue;
    }

    // 6. Try parsing JSON from assistant output
    const jsonMatch = assistantMsg.content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        result.jsonQuality.jsonParseableCount++;

        // Count fields
        const fieldCount = Object.keys(parsed).length;
        totalFields += fieldCount;

        // Check for empty/null fields
        for (const value of Object.values(parsed)) {
          if (value === null || value === undefined || value === "" ||
              (Array.isArray(value) && value.length === 0)) {
            emptyFields++;
          }
        }
      } catch {
        result.errors.push({ line: lineNum, error: "Assistant response contains malformed JSON" });
        // Don't invalidate the pair — malformed JSON is a quality issue, not a format issue
      }
    }

    // 7. Count tokens
    const inputTokens = pair.messages
      .filter((m) => m.role !== "assistant")
      .reduce((sum, m) => sum + estimateTokens(m.content), 0);
    const outputTokens = estimateTokens(assistantMsg.content);

    totalInputTokens += inputTokens;
    totalOutputTokens += outputTokens;
    maxInputTokens = Math.max(maxInputTokens, inputTokens);
    maxOutputTokens = Math.max(maxOutputTokens, outputTokens);

    // 8. Message stats
    totalMessages += pair.messages.length;
    if (hasSystem) result.messageStats.withSystem++;

    const userMsg = pair.messages.find((m) => m.role === "user");
    if (userMsg) totalUserLength += userMsg.content.length;
    totalAssistantLength += assistantMsg.content.length;

    // Valid pair!
    result.validPairs++;
  }

  // Compute aggregate statistics
  const validCount = result.validPairs || 1; // Avoid division by zero

  result.stats = {
    avgInputTokens: Math.round(totalInputTokens / validCount),
    avgOutputTokens: Math.round(totalOutputTokens / validCount),
    maxInputTokens,
    maxOutputTokens,
    totalInputTokens,
    totalOutputTokens,
    totalTokens: totalInputTokens + totalOutputTokens,
    // Gemini fine-tuning cost: ~$10/M input tokens + ~$20/M output tokens
    estimatedCostUSD:
      (totalInputTokens * 10) / 1_000_000 +
      (totalOutputTokens * 20) / 1_000_000,
  };

  result.invalidPairs = result.totalPairs - result.validPairs;

  result.messageStats = {
    ...result.messageStats,
    avgMessagesPerPair: parseFloat((totalMessages / validCount).toFixed(1)),
    avgUserPromptLength: Math.round(totalUserLength / validCount),
    avgAssistantLength: Math.round(totalAssistantLength / validCount),
  };

  const jsonAttempted = result.totalPairs; // All pairs are expected to have JSON output
  result.jsonQuality = {
    ...result.jsonQuality,
    jsonParseRate: jsonAttempted > 0
      ? Math.round((result.jsonQuality.jsonParseableCount / jsonAttempted) * 100)
      : 0,
    avgFieldCount: result.jsonQuality.jsonParseableCount > 0
      ? parseFloat((totalFields / result.jsonQuality.jsonParseableCount).toFixed(1))
      : 0,
    emptyFieldCount: emptyFields,
  };

  return result;
}

// ─── Report Generation ───────────────────────────────────────

function printResult(result: ValidationResult): void {
  const passRate = result.totalPairs > 0
    ? ((result.validPairs / result.totalPairs) * 100).toFixed(1)
    : "0";

  console.log(`\n┌─────────────────────────────────────────────────────┐`);
  console.log(`│  ${result.file.padEnd(49)}│`);
  console.log(`├─────────────────────────────────────────────────────┤`);
  console.log(`│  Pairs: ${String(result.validPairs).padStart(5)} valid / ${String(result.totalPairs).padStart(5)} total (${passRate}%)${" ".repeat(Math.max(0, 11 - passRate.length))}│`);
  console.log(`│  JSON Parse Rate: ${String(result.jsonQuality.jsonParseRate).padStart(3)}%                              │`);
  console.log(`│  Avg Input Tokens:  ${String(result.stats.avgInputTokens).padStart(6)}                        │`);
  console.log(`│  Avg Output Tokens: ${String(result.stats.avgOutputTokens).padStart(6)}                        │`);
  console.log(`│  Max Input Tokens:  ${String(result.stats.maxInputTokens).padStart(6)}                        │`);
  console.log(`│  Max Output Tokens: ${String(result.stats.maxOutputTokens).padStart(6)}                        │`);
  console.log(`│  Total Tokens:      ${String(result.stats.totalTokens.toLocaleString()).padStart(10)}                    │`);
  console.log(`│  Est. Training Cost: $${result.stats.estimatedCostUSD.toFixed(2).padStart(8)}                    │`);
  console.log(`│  System messages: ${String(result.messageStats.withSystem).padStart(5)} / ${String(result.totalPairs).padStart(5)}                    │`);
  console.log(`│  Avg fields/response: ${String(result.jsonQuality.avgFieldCount).padStart(5)}                       │`);

  if (result.errors.length > 0) {
    console.log(`├─────────────────────────────────────────────────────┤`);
    console.log(`│  Errors (showing first 10):                         │`);
    for (const e of result.errors.slice(0, 10)) {
      const msg = `    Line ${e.line}: ${e.error}`.slice(0, 49);
      console.log(`│  ${msg.padEnd(49)}│`);
    }
    if (result.errors.length > 10) {
      console.log(`│  ... and ${result.errors.length - 10} more errors                         │`);
    }
  }
  console.log(`└─────────────────────────────────────────────────────┘`);
}

function determineHealth(results: ValidationResult[]): "excellent" | "good" | "needs-attention" | "poor" {
  const totalPairs = results.reduce((s, r) => s + r.totalPairs, 0);
  const totalValid = results.reduce((s, r) => s + r.validPairs, 0);

  if (totalPairs === 0) return "poor";

  const validRate = totalValid / totalPairs;
  const avgJsonRate = results.reduce((s, r) => s + r.jsonQuality.jsonParseRate, 0) / results.length;

  if (validRate >= 0.95 && avgJsonRate >= 95) return "excellent";
  if (validRate >= 0.85 && avgJsonRate >= 85) return "good";
  if (validRate >= 0.70 && avgJsonRate >= 70) return "needs-attention";
  return "poor";
}

// ─── Main ────────────────────────────────────────────────────

function main(): void {
  const dataDir = resolve(process.cwd(), "data/training");

  console.log("╔══════════════════════════════════════════════════════╗");
  console.log("║      Crypto Vision — Training Data Validator        ║");
  console.log("╚══════════════════════════════════════════════════════╝");

  if (!existsSync(dataDir)) {
    console.error(`\n  Data directory not found: ${dataDir}`);
    console.error("  Run generate-training-data.ts first.\n");
    process.exit(1);
  }

  // Find all JSONL files
  const jsonlFiles = readdirSync(dataDir)
    .filter((f) => f.endsWith(".jsonl"))
    .sort();

  if (jsonlFiles.length === 0) {
    console.log("\n  No .jsonl files found in data/training/");
    console.log("  Run generate-training-data.ts first.\n");
    process.exit(1);
  }

  console.log(`\n  Found ${jsonlFiles.length} training file(s) in ${dataDir}\n`);

  const results: ValidationResult[] = [];

  for (const file of jsonlFiles) {
    const filePath = resolve(dataDir, file);
    try {
      const result = validateJSONL(filePath);
      results.push(result);
      printResult(result);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`\n  Failed to validate ${file}: ${msg}`);
    }
  }

  // Generate full report
  const report: FullReport = {
    validatedAt: new Date().toISOString(),
    totalFiles: results.length,
    totalPairs: results.reduce((s, r) => s + r.totalPairs, 0),
    totalValidPairs: results.reduce((s, r) => s + r.validPairs, 0),
    totalEstimatedCostUSD: results.reduce((s, r) => s + r.stats.estimatedCostUSD, 0),
    files: results,
    overallHealth: determineHealth(results),
  };

  // Summary
  console.log("\n╔══════════════════════════════════════════════════════╗");
  console.log("║                   Summary                           ║");
  console.log("╠══════════════════════════════════════════════════════╣");
  console.log(`║  Files validated:    ${String(report.totalFiles).padStart(5)}                          ║`);
  console.log(`║  Total pairs:        ${String(report.totalPairs).padStart(5)}                          ║`);
  console.log(`║  Valid pairs:        ${String(report.totalValidPairs).padStart(5)}                          ║`);
  console.log(`║  Valid rate:         ${((report.totalValidPairs / Math.max(report.totalPairs, 1)) * 100).toFixed(1).padStart(5)}%                         ║`);
  console.log(`║  Est. total cost:    $${report.totalEstimatedCostUSD.toFixed(2).padStart(8)}                       ║`);
  console.log(`║  Health:             ${report.overallHealth.padEnd(20)}             ║`);
  console.log("╚══════════════════════════════════════════════════════╝");

  // Save report
  const reportPath = resolve(dataDir, "validation-report.json");
  writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`\n  Report saved to: ${reportPath}\n`);

  // Exit with error if health is poor
  if (report.overallHealth === "poor") {
    process.exit(1);
  }
}

main();
