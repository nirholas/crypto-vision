/**
 * Crypto Vision — Gemini Fine-Tuning Pipeline
 *
 * Uploads training data to GCS and submits Gemini fine-tuning jobs
 * via the Vertex AI Tuning API. Monitors job status and records
 * fine-tuned model endpoints for integration.
 *
 * Prerequisites:
 *   - GCP_PROJECT_ID env var set
 *   - Application Default Credentials configured
 *   - @google-cloud/aiplatform and @google-cloud/storage installed
 *   - Training data generated and validated in data/training/
 *
 * @copyright 2024-2026 nirholas. All rights reserved.
 */

import { Storage } from "@google-cloud/storage";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { resolve, basename } from "path";

// ─── Configuration ───────────────────────────────────────────

const PROJECT_ID = process.env.GCP_PROJECT_ID;
const REGION = process.env.GCP_REGION ?? "us-central1";
const BUCKET_NAME = `${PROJECT_ID}-crypto-vision-training`;
const API_ENDPOINT = `https://${REGION}-aiplatform.googleapis.com/v1beta1`;

if (!PROJECT_ID) {
  console.error("ERROR: GCP_PROJECT_ID environment variable is required");
  process.exit(1);
}

// ─── Types ───────────────────────────────────────────────────

interface FineTuneConfig {
  displayName: string;
  baseModel: string;
  trainingDataFile: string;
  validationSplit: number;
  hyperParams: {
    epochCount: number;
    learningRateMultiplier: number;
    adapterSize: "1" | "4" | "8" | "16";
  };
  description: string;
}

interface TuningJob {
  name: string;
  displayName: string;
  state: string;
  createTime: string;
  tunedModel?: {
    model: string;
    endpoint: string;
  };
  error?: {
    code: number;
    message: string;
  };
}

interface PipelineResult {
  displayName: string;
  gcsTrainingUri: string;
  gcsValidationUri?: string;
  jobName: string;
  status: "submitted" | "failed";
  error?: string;
}

// ─── Model Configurations ────────────────────────────────────

const MODELS_TO_TRAIN: FineTuneConfig[] = [
  {
    displayName: "crypto-vision-sentiment-v1",
    baseModel: "gemini-2.0-flash-001",
    trainingDataFile: "data/training/sentiment-pairs.jsonl",
    validationSplit: 0.1,
    hyperParams: {
      epochCount: 5,
      learningRateMultiplier: 1.0,
      adapterSize: "4",
    },
    description: "Crypto sentiment analysis fine-tuned on market data + AI-labeled pairs",
  },
  {
    displayName: "crypto-vision-signals-v1",
    baseModel: "gemini-2.0-flash-001",
    trainingDataFile: "data/training/signals-pairs.jsonl",
    validationSplit: 0.1,
    hyperParams: {
      epochCount: 3,
      learningRateMultiplier: 0.5,
      adapterSize: "4",
    },
    description: "Crypto trading signal generation with entry/target/stop-loss",
  },
  {
    displayName: "crypto-vision-digest-v1",
    baseModel: "gemini-2.0-flash-001",
    trainingDataFile: "data/training/digest-pairs.jsonl",
    validationSplit: 0.1,
    hyperParams: {
      epochCount: 5,
      learningRateMultiplier: 1.0,
      adapterSize: "8",
    },
    description: "Daily crypto market digest generation from comprehensive market data",
  },
  {
    displayName: "crypto-vision-risk-v1",
    baseModel: "gemini-2.0-flash-001",
    trainingDataFile: "data/training/risk-pairs.jsonl",
    validationSplit: 0.1,
    hyperParams: {
      epochCount: 4,
      learningRateMultiplier: 0.8,
      adapterSize: "4",
    },
    description: "DeFi protocol risk assessment with multi-factor scoring",
  },
  {
    displayName: "crypto-vision-yield-v1",
    baseModel: "gemini-2.0-flash-001",
    trainingDataFile: "data/training/yield-pairs.jsonl",
    validationSplit: 0.1,
    hyperParams: {
      epochCount: 4,
      learningRateMultiplier: 0.8,
      adapterSize: "4",
    },
    description: "DeFi yield opportunity analysis across chains",
  },
  {
    displayName: "crypto-vision-whale-v1",
    baseModel: "gemini-2.0-flash-001",
    trainingDataFile: "data/training/whale-pairs.jsonl",
    validationSplit: 0.1,
    hyperParams: {
      epochCount: 4,
      learningRateMultiplier: 0.8,
      adapterSize: "4",
    },
    description: "Whale activity and large transaction pattern analysis",
  },
  {
    displayName: "crypto-vision-narrative-v1",
    baseModel: "gemini-2.0-flash-001",
    trainingDataFile: "data/training/narrative-pairs.jsonl",
    validationSplit: 0.1,
    hyperParams: {
      epochCount: 5,
      learningRateMultiplier: 1.0,
      adapterSize: "8",
    },
    description: "Market narrative and sector rotation detection",
  },
];

// ─── GCS Upload ──────────────────────────────────────────────

async function ensureBucket(storage: Storage): Promise<void> {
  const [exists] = await storage.bucket(BUCKET_NAME).exists();
  if (!exists) {
    console.log(`  Creating GCS bucket: ${BUCKET_NAME}`);
    await storage.createBucket(BUCKET_NAME, {
      location: REGION,
      storageClass: "STANDARD",
      versioning: { enabled: true },
      lifecycle: {
        rule: [{ action: { type: "Delete" }, condition: { age: 365 } }],
      },
    });
  }
}

async function splitAndUpload(
  storage: Storage,
  localPath: string,
  validationSplit: number,
): Promise<{ trainingUri: string; validationUri?: string }> {
  const fileName = basename(localPath, ".jsonl");
  const content = readFileSync(localPath, "utf-8").trim();
  const lines = content.split("\n");

  if (lines.length === 0) {
    throw new Error(`No data in ${localPath}`);
  }

  // Shuffle lines for random split
  const shuffled = [...lines].sort(() => Math.random() - 0.5);
  const splitIdx = Math.max(1, Math.floor(shuffled.length * (1 - validationSplit)));

  const trainingLines = shuffled.slice(0, splitIdx);
  const validationLines = shuffled.slice(splitIdx);

  const bucket = storage.bucket(BUCKET_NAME);

  // Upload training data
  const trainingGcsPath = `training/${fileName}-train.jsonl`;
  await bucket.file(trainingGcsPath).save(trainingLines.join("\n"), {
    contentType: "application/jsonl",
    metadata: {
      pairCount: String(trainingLines.length),
      source: localPath,
      createdAt: new Date().toISOString(),
    },
  });
  console.log(`  Uploaded ${trainingLines.length} training pairs → gs://${BUCKET_NAME}/${trainingGcsPath}`);

  let validationUri: string | undefined;
  if (validationLines.length >= 5) {
    const validationGcsPath = `validation/${fileName}-val.jsonl`;
    await bucket.file(validationGcsPath).save(validationLines.join("\n"), {
      contentType: "application/jsonl",
      metadata: {
        pairCount: String(validationLines.length),
        source: localPath,
        createdAt: new Date().toISOString(),
      },
    });
    validationUri = `gs://${BUCKET_NAME}/${validationGcsPath}`;
    console.log(`  Uploaded ${validationLines.length} validation pairs → ${validationUri}`);
  }

  return {
    trainingUri: `gs://${BUCKET_NAME}/${trainingGcsPath}`,
    validationUri,
  };
}

// ─── Vertex AI Tuning API ────────────────────────────────────

async function getAccessToken(): Promise<string> {
  // Use Google Auth Library for ADC
  const { GoogleAuth } = await import("google-auth-library");
  const auth = new GoogleAuth({
    scopes: ["https://www.googleapis.com/auth/cloud-platform"],
  });
  const client = await auth.getClient();
  const tokenResponse = await client.getAccessToken();
  if (!tokenResponse.token) {
    throw new Error("Failed to obtain access token. Ensure ADC is configured.");
  }
  return tokenResponse.token;
}

async function createTuningJob(
  config: FineTuneConfig,
  trainingUri: string,
  validationUri: string | undefined,
  accessToken: string,
): Promise<string> {
  const parent = `projects/${PROJECT_ID}/locations/${REGION}`;
  const url = `${API_ENDPOINT}/${parent}/tuningJobs`;

  interface TuningJobRequest {
    displayName: string;
    description: string;
    baseModel: string;
    supervisedTuningSpec: {
      trainingDatasetUri: string;
      validationDatasetUri?: string;
      hyperParameters: {
        epochCount: number;
        learningRateMultiplier: number;
        adapterSize: string;
      };
    };
  }

  const body: TuningJobRequest = {
    displayName: config.displayName,
    description: config.description,
    baseModel: config.baseModel,
    supervisedTuningSpec: {
      trainingDatasetUri: trainingUri,
      hyperParameters: {
        epochCount: config.hyperParams.epochCount,
        learningRateMultiplier: config.hyperParams.learningRateMultiplier,
        adapterSize: config.hyperParams.adapterSize,
      },
    },
  };

  if (validationUri) {
    body.supervisedTuningSpec.validationDatasetUri = validationUri;
  }

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Tuning API error ${response.status}: ${errorBody}`);
  }

  const result = (await response.json()) as TuningJob;
  return result.name;
}

async function getTuningJobStatus(jobName: string, accessToken: string): Promise<TuningJob> {
  const url = `${API_ENDPOINT}/${jobName}`;

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Status check failed ${response.status}: ${errorBody}`);
  }

  return (await response.json()) as TuningJob;
}

async function listTuningJobs(accessToken: string): Promise<TuningJob[]> {
  const parent = `projects/${PROJECT_ID}/locations/${REGION}`;
  const url = `${API_ENDPOINT}/${parent}/tuningJobs?pageSize=50`;

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`List jobs failed ${response.status}: ${errorBody}`);
  }

  const result = (await response.json()) as { tuningJobs?: TuningJob[] };
  return result.tuningJobs ?? [];
}

// ─── Main Pipeline ───────────────────────────────────────────

async function main(): Promise<void> {
  console.log("╔══════════════════════════════════════════════════════╗");
  console.log("║     Crypto Vision — Gemini Fine-Tuning Pipeline     ║");
  console.log("╚══════════════════════════════════════════════════════╝\n");
  console.log(`  Project: ${PROJECT_ID}`);
  console.log(`  Region:  ${REGION}`);
  console.log(`  Bucket:  ${BUCKET_NAME}`);
  console.log(`  Models:  ${MODELS_TO_TRAIN.length}\n`);

  const command = process.argv[2] ?? "submit";

  if (command === "status") {
    await checkStatus();
    return;
  }

  if (command === "list") {
    await listJobs();
    return;
  }

  // Default: submit training jobs
  const storage = new Storage({ projectId: PROJECT_ID });
  const accessToken = await getAccessToken();

  // Step 1: Ensure bucket exists
  console.log("Step 1: Ensuring GCS bucket...");
  await ensureBucket(storage);

  // Step 2: Upload and split training data
  console.log("\nStep 2: Uploading training data...\n");
  const uploadResults = new Map<string, { trainingUri: string; validationUri?: string }>();

  for (const config of MODELS_TO_TRAIN) {
    const localPath = resolve(process.cwd(), config.trainingDataFile);
    if (!existsSync(localPath)) {
      console.warn(`  SKIP: ${config.trainingDataFile} not found`);
      continue;
    }

    try {
      const uris = await splitAndUpload(storage, localPath, config.validationSplit);
      uploadResults.set(config.displayName, uris);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`  ERROR uploading ${config.trainingDataFile}: ${msg}`);
    }
  }

  // Step 3: Submit fine-tuning jobs
  console.log("\nStep 3: Submitting fine-tuning jobs...\n");
  const results: PipelineResult[] = [];

  for (const config of MODELS_TO_TRAIN) {
    const uris = uploadResults.get(config.displayName);
    if (!uris) {
      results.push({
        displayName: config.displayName,
        gcsTrainingUri: "",
        jobName: "",
        status: "failed",
        error: "No training data uploaded",
      });
      continue;
    }

    try {
      const jobName = await createTuningJob(config, uris.trainingUri, uris.validationUri, accessToken);

      results.push({
        displayName: config.displayName,
        gcsTrainingUri: uris.trainingUri,
        gcsValidationUri: uris.validationUri,
        jobName,
        status: "submitted",
      });

      console.log(`  ✓ ${config.displayName}: ${jobName}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      results.push({
        displayName: config.displayName,
        gcsTrainingUri: uris.trainingUri,
        gcsValidationUri: uris.validationUri,
        jobName: "",
        status: "failed",
        error: msg,
      });
      console.error(`  ✗ ${config.displayName}: ${msg}`);
    }
  }

  // Step 4: Save results
  const manifest = {
    submittedAt: new Date().toISOString(),
    project: PROJECT_ID,
    region: REGION,
    bucket: BUCKET_NAME,
    jobs: results,
  };

  const manifestPath = resolve(process.cwd(), "data/training/finetune-manifest.json");
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

  // Summary
  const submitted = results.filter((r) => r.status === "submitted").length;
  const failed = results.filter((r) => r.status === "failed").length;

  console.log("\n╔══════════════════════════════════════════════════════╗");
  console.log("║              Fine-Tuning Jobs Summary                ║");
  console.log("╠══════════════════════════════════════════════════════╣");
  console.log(`║  Submitted: ${String(submitted).padStart(3)}                                    ║`);
  console.log(`║  Failed:    ${String(failed).padStart(3)}                                    ║`);
  console.log("╠──────────────────────────────────────────────────────╣");
  console.log("║  Monitor:                                            ║");
  for (const r of results.filter((r) => r.status === "submitted")) {
    console.log(`║    gcloud ai tuning-jobs describe \\                  ║`);
    console.log(`║      ${r.jobName.slice(0, 46).padEnd(46)}  ║`);
    console.log(`║      --region=${REGION}${" ".repeat(Math.max(0, 31 - REGION.length))}║`);
  }
  console.log("╚══════════════════════════════════════════════════════╝");
  console.log(`\n  Manifest: ${manifestPath}\n`);
}

async function checkStatus(): Promise<void> {
  const manifestPath = resolve(process.cwd(), "data/training/finetune-manifest.json");
  if (!existsSync(manifestPath)) {
    console.error("No finetune-manifest.json found. Run without arguments first.");
    process.exit(1);
  }

  const manifest = JSON.parse(readFileSync(manifestPath, "utf-8")) as {
    jobs: PipelineResult[];
  };
  const accessToken = await getAccessToken();

  console.log("Checking fine-tuning job status...\n");

  for (const job of manifest.jobs) {
    if (job.status !== "submitted" || !job.jobName) continue;

    try {
      const status = await getTuningJobStatus(job.jobName, accessToken);
      console.log(`  ${job.displayName}:`);
      console.log(`    State: ${status.state}`);
      console.log(`    Created: ${status.createTime}`);
      if (status.tunedModel) {
        console.log(`    Model: ${status.tunedModel.model}`);
        console.log(`    Endpoint: ${status.tunedModel.endpoint}`);
      }
      if (status.error) {
        console.log(`    Error: ${status.error.message}`);
      }
      console.log();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`  ${job.displayName}: ERROR — ${msg}\n`);
    }
  }
}

async function listJobs(): Promise<void> {
  const accessToken = await getAccessToken();
  const jobs = await listTuningJobs(accessToken);

  console.log(`Found ${jobs.length} tuning job(s):\n`);
  for (const job of jobs) {
    console.log(`  ${job.displayName ?? "unnamed"}`);
    console.log(`    Name: ${job.name}`);
    console.log(`    State: ${job.state}`);
    console.log(`    Created: ${job.createTime}`);
    if (job.tunedModel) {
      console.log(`    Model: ${job.tunedModel.model}`);
    }
    console.log();
  }
}

main().catch(console.error);
