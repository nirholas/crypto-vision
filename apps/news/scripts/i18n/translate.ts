#!/usr/bin/env npx tsx
/**
 * Automated i18n Translation Script using Groq (FREE)
 * 
 * Translates messages/en.json to all supported locales using Groq's free API.
 * Based on patterns from plugin.delivery and defi-agents but using Groq instead of OpenAI.
 * 
 * Usage:
 *   GROQ_API_KEY=your-key npx tsx scripts/i18n/translate.ts
 *   GROQ_API_KEY=your-key npx tsx scripts/i18n/translate.ts --locale es
 *   GROQ_API_KEY=your-key npx tsx scripts/i18n/translate.ts --force
 * 
 * Get your FREE Groq API key at: https://console.groq.com/keys
 */

import * as fs from 'fs';
import * as path from 'path';

// Configuration
const CONFIG = {
  entryLocale: 'en',
  outputLocales: [
    'es',      // Spanish
    'fr',      // French
    'de',      // German
    'pt',      // Portuguese
    'ja',      // Japanese
    'zh-CN',   // Simplified Chinese
    'zh-TW',   // Traditional Chinese
    'ko',      // Korean
    'ar',      // Arabic
    'ru',      // Russian
    'it',      // Italian
    'nl',      // Dutch
    'pl',      // Polish
    'tr',      // Turkish
    'vi',      // Vietnamese
    'th',      // Thai
    'id',      // Indonesian
  ],
  model: 'llama-3.3-70b-versatile',
  temperature: 0.3,
  maxRetries: 3,
  retryDelay: 2000,
  concurrency: 3, // Groq has rate limits, keep this reasonable
  chunkSize: 50,  // Translate in chunks to avoid token limits
};

const LOCALE_NAMES: Record<string, string> = {
  en: 'English',
  es: 'Spanish',
  fr: 'French',
  de: 'German',
  pt: 'Portuguese',
  ja: 'Japanese',
  'zh-CN': 'Simplified Chinese',
  'zh-TW': 'Traditional Chinese',
  ko: 'Korean',
  ar: 'Arabic',
  ru: 'Russian',
  it: 'Italian',
  nl: 'Dutch',
  pl: 'Polish',
  tr: 'Turkish',
  vi: 'Vietnamese',
  th: 'Thai',
  id: 'Indonesian',
};

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';

// Determine which API to use based on environment variables
function getApiConfig(): { apiUrl: string; apiKey: string; model: string; provider: string } {
  if (process.env.OPENAI_API_KEY) {
    return {
      apiUrl: OPENAI_API_URL,
      apiKey: process.env.OPENAI_API_KEY,
      model: 'gpt-4o-mini',
      provider: 'OpenAI',
    };
  }
  if (process.env.GROQ_API_KEY) {
    return {
      apiUrl: GROQ_API_URL,
      apiKey: process.env.GROQ_API_KEY,
      model: CONFIG.model,
      provider: 'Groq',
    };
  }
  throw new Error(
    '\n\n🔑 No API key set!\n\n' +
    'Set either OPENAI_API_KEY or GROQ_API_KEY:\n' +
    '  OPENAI_API_KEY=sk-... npx tsx scripts/i18n/translate.ts\n' +
    '  GROQ_API_KEY=gsk_... npx tsx scripts/i18n/translate.ts\n\n' +
    'Get your FREE Groq API key at: https://console.groq.com/keys\n'
  );
}

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m',
};

function log(emoji: string, message: string, detail?: string) {
  const detailStr = detail ? ` ${colors.dim}${detail}${colors.reset}` : '';
  console.log(`${emoji} ${message}${detailStr}`);
}

function logSuccess(message: string, detail?: string) {
  log('✅', `${colors.green}${message}${colors.reset}`, detail);
}

function logError(message: string, detail?: string) {
  log('❌', `${colors.red}${message}${colors.reset}`, detail);
}

function logInfo(message: string, detail?: string) {
  log('ℹ️', `${colors.blue}${message}${colors.reset}`, detail);
}

function logProgress(current: number, total: number, message: string) {
  const percentage = Math.round((current / total) * 100);
  const bar = '█'.repeat(Math.floor(percentage / 5)) + '░'.repeat(20 - Math.floor(percentage / 5));
  console.log(`\r${colors.cyan}[${bar}] ${percentage}%${colors.reset} ${message}    `);
}

/**
 * Call API (Groq or OpenAI) with retry logic
 */
async function callApiWithRetry(
  messages: Array<{ role: string; content: string }>,
  options: { temperature?: number; jsonMode?: boolean } = {}
): Promise<string> {
  const { apiUrl, apiKey, model, provider } = getApiConfig();

  for (let attempt = 1; attempt <= CONFIG.maxRetries; attempt++) {
    try {
      const body: Record<string, unknown> = {
        model,
        messages,
        temperature: options.temperature ?? CONFIG.temperature,
        max_tokens: 4096,
      };

      if (options.jsonMode) {
        body.response_format = { type: 'json_object' };
      }

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify(body),
      });

      if (response.status === 429) {
        // Rate limited - wait and retry
        const waitTime = CONFIG.retryDelay * attempt;
        log('⏳', `Rate limited, waiting ${waitTime}ms...`);
        await sleep(waitTime);
        continue;
      }

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`${provider} API error: ${response.status} - ${error}`);
      }

      const data = await response.json();
      return data.choices?.[0]?.message?.content || '';
    } catch (error) {
      if (attempt === CONFIG.maxRetries) {
        throw error;
      }
      log('🔄', `Retry ${attempt}/${CONFIG.maxRetries}...`, (error as Error).message);
      await sleep(CONFIG.retryDelay * attempt);
    }
  }

  throw new Error('Max retries exceeded');
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Parse JSON from response (handles markdown code blocks)
 */
function parseJsonResponse(content: string): Record<string, unknown> {
  let cleaned = content.trim();
  
  // Remove markdown code blocks
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.slice(7);
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.slice(3);
  }
  if (cleaned.endsWith('```')) {
    cleaned = cleaned.slice(0, -3);
  }
  
  cleaned = cleaned.trim();
  
  try {
    return JSON.parse(cleaned);
  } catch {
    // Try dirty JSON parsing - fix common issues
    cleaned = cleaned
      .replace(/,\s*}/g, '}')  // Remove trailing commas
      .replace(/,\s*]/g, ']')  // Remove trailing commas in arrays
      .replace(/'/g, '"');     // Replace single quotes
    
    return JSON.parse(cleaned);
  }
}

/**
 * Flatten nested object to dot-notation keys
 */
function flattenObject(obj: Record<string, unknown>, prefix = ''): Record<string, string> {
  const result: Record<string, string> = {};
  
  for (const [key, value] of Object.entries(obj)) {
    const newKey = prefix ? `${prefix}.${key}` : key;
    
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      Object.assign(result, flattenObject(value as Record<string, unknown>, newKey));
    } else if (typeof value === 'string') {
      result[newKey] = value;
    }
  }
  
  return result;
}

/**
 * Unflatten dot-notation keys back to nested object
 */
function unflattenObject(obj: Record<string, string>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  
  for (const [key, value] of Object.entries(obj)) {
    const parts = key.split('.');
    let current = result;
    
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (!(part in current)) {
        current[part] = {};
      }
      current = current[part] as Record<string, unknown>;
    }
    
    current[parts[parts.length - 1]] = value;
  }
  
  return result;
}

/**
 * Translate a chunk of strings
 */
async function translateChunk(
  strings: Record<string, string>,
  targetLocale: string
): Promise<Record<string, string>> {
  const targetLanguage = LOCALE_NAMES[targetLocale] || targetLocale;
  
  const systemPrompt = `You are a professional translator specializing in software localization.
Translate the following JSON object from English to ${targetLanguage}.

CRITICAL RULES:
1. Keep all JSON keys EXACTLY as they are (do not translate keys)
2. Only translate the string VALUES
3. Preserve all {placeholders} like {count}, {name}, {time} exactly as-is
4. Keep technical terms like "DeFi", "NFT", "API" unchanged
5. Maintain the same tone and formality level
6. For ${targetLanguage}, use appropriate formal/informal register for a news app
7. Output ONLY valid JSON, no explanations or markdown

Example input: {"greeting": "Hello {name}", "items": "{count} items"}
Example output: {"greeting": "Hola {name}", "items": "{count} elementos"}`;

  const userPrompt = JSON.stringify(strings, null, 2);
  
  const response = await callApiWithRetry(
    [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    { jsonMode: true, temperature: 0.2 }
  );
  
  return parseJsonResponse(response) as Record<string, string>;
}

/**
 * Translate entire messages file to a target locale
 */
async function translateToLocale(
  sourceMessages: Record<string, unknown>,
  targetLocale: string,
  existingTranslations?: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const targetLanguage = LOCALE_NAMES[targetLocale] || targetLocale;
  logInfo(`Translating to ${targetLanguage}...`, targetLocale);
  
  // Flatten source messages
  const flatSource = flattenObject(sourceMessages);
  const sourceKeys = Object.keys(flatSource);
  
  // Check what needs translating
  let keysToTranslate: string[];
  const existingFlat = existingTranslations ? flattenObject(existingTranslations) : {};
  
  if (existingTranslations) {
    // Only translate missing keys (incremental translation)
    keysToTranslate = sourceKeys.filter(key => !(key in existingFlat));
    if (keysToTranslate.length === 0) {
      logSuccess(`Already up to date`, targetLocale);
      return existingTranslations;
    }
    logInfo(`Translating ${keysToTranslate.length} new keys...`, `(${sourceKeys.length - keysToTranslate.length} existing)`);
  } else {
    keysToTranslate = sourceKeys;
  }
  
  // Translate in chunks
  const chunks: Record<string, string>[] = [];
  const chunkSize = CONFIG.chunkSize;
  
  for (let i = 0; i < keysToTranslate.length; i += chunkSize) {
    const chunkKeys = keysToTranslate.slice(i, i + chunkSize);
    const chunk: Record<string, string> = {};
    for (const key of chunkKeys) {
      chunk[key] = flatSource[key];
    }
    chunks.push(chunk);
  }
  
  // Process chunks
  const translatedFlat: Record<string, string> = { ...existingFlat };
  
  for (let i = 0; i < chunks.length; i++) {
    logProgress(i + 1, chunks.length, `Chunk ${i + 1}/${chunks.length} for ${targetLocale}`);
    
    try {
      const translated = await translateChunk(chunks[i], targetLocale);
      Object.assign(translatedFlat, translated);
    } catch (error) {
      logError(`Failed to translate chunk ${i + 1}`, (error as Error).message);
      // Keep original English for failed chunks
      Object.assign(translatedFlat, chunks[i]);
    }
    
    // Rate limit protection
    if (i < chunks.length - 1) {
      await sleep(500);
    }
  }
  
  console.log(''); // New line after progress
  
  // Unflatten back to nested object
  return unflattenObject(translatedFlat);
}

/**
 * Main translation function
 */
async function main() {
  console.log('\n' + '='.repeat(60));
  console.log('🌍 Free Crypto News - Automated i18n Translation (Groq)');
  console.log('='.repeat(60) + '\n');
  
  // Parse CLI arguments
  const args = process.argv.slice(2);
  const forceAll = args.includes('--force');
  const specificLocale = args.find(arg => arg.startsWith('--locale='))?.split('=')[1]
    || args[args.indexOf('--locale') + 1];
  
  // Paths
  const messagesDir = path.resolve(process.cwd(), 'messages');
  const sourceFile = path.join(messagesDir, 'en.json');
  
  // Check source file exists
  if (!fs.existsSync(sourceFile)) {
    logError('Source file not found!', sourceFile);
    logInfo('Run this from the project root with messages/en.json present');
    process.exit(1);
  }
  
  // Load source messages
  const sourceMessages = JSON.parse(fs.readFileSync(sourceFile, 'utf-8'));
  const totalKeys = Object.keys(flattenObject(sourceMessages)).length;
  logSuccess(`Loaded source messages`, `${totalKeys} strings from en.json`);
  
  // Determine which locales to translate
  const localesToTranslate = specificLocale 
    ? [specificLocale]
    : CONFIG.outputLocales;
  
  logInfo(`Translating to ${localesToTranslate.length} locale(s)...`);
  if (forceAll) {
    log('⚠️', `${colors.yellow}Force mode: re-translating all strings${colors.reset}`);
  }
  
  // Track results
  const results: { locale: string; status: 'success' | 'error'; message: string }[] = [];
  
  // Process locales with concurrency limit
  for (let i = 0; i < localesToTranslate.length; i += CONFIG.concurrency) {
    const batch = localesToTranslate.slice(i, i + CONFIG.concurrency);
    
    await Promise.all(batch.map(async (locale) => {
      const outputFile = path.join(messagesDir, `${locale}.json`);
      
      try {
        // Load existing translations (if any and not forcing)
        let existingTranslations: Record<string, unknown> | undefined;
        if (!forceAll && fs.existsSync(outputFile)) {
          existingTranslations = JSON.parse(fs.readFileSync(outputFile, 'utf-8'));
        }
        
        // Translate
        const translated = await translateToLocale(
          sourceMessages,
          locale,
          existingTranslations
        );
        
        // Write output
        fs.writeFileSync(outputFile, JSON.stringify(translated, null, 2) + '\n');
        logSuccess(`Saved ${locale}.json`);
        
        results.push({ locale, status: 'success', message: 'Translated successfully' });
      } catch (error) {
        logError(`Failed to translate ${locale}`, (error as Error).message);
        results.push({ locale, status: 'error', message: (error as Error).message });
      }
    }));
    
    // Small delay between batches
    if (i + CONFIG.concurrency < localesToTranslate.length) {
      await sleep(1000);
    }
  }
  
  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 Translation Summary');
  console.log('='.repeat(60) + '\n');
  
  const successful = results.filter(r => r.status === 'success').length;
  const failed = results.filter(r => r.status === 'error').length;
  
  logSuccess(`Successful: ${successful}/${results.length}`);
  if (failed > 0) {
    logError(`Failed: ${failed}/${results.length}`);
    results.filter(r => r.status === 'error').forEach(r => {
      log('  ', `${r.locale}: ${r.message}`);
    });
  }
  
  console.log('\n');
}

// Run
main().catch(error => {
  logError('Fatal error', error.message);
  process.exit(1);
});
