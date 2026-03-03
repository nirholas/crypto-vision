#!/usr/bin/env npx tsx
/**
 * i18n Watch Mode - Auto-translate on file changes
 * 
 * Watches messages/en.json and automatically triggers translation
 * when changes are detected. Perfect for development workflow.
 * 
 * Usage:
 *   GROQ_API_KEY=your-key npx tsx scripts/i18n/watch.ts
 * 
 * Get your FREE Groq API key at: https://console.groq.com/keys
 */

import * as fs from 'fs';
import * as path from 'path';
import { spawn } from 'child_process';

const MESSAGES_DIR = path.resolve(process.cwd(), 'messages');
const SOURCE_FILE = path.join(MESSAGES_DIR, 'en.json');
const DEBOUNCE_MS = 2000; // Wait 2 seconds after last change

let debounceTimer: NodeJS.Timeout | null = null;
let isTranslating = false;

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m',
};

function log(emoji: string, message: string) {
  const time = new Date().toLocaleTimeString();
  console.log(`${colors.dim}[${time}]${colors.reset} ${emoji} ${message}`);
}

function runTranslation() {
  if (isTranslating) {
    log('⏳', 'Translation already in progress, skipping...');
    return;
  }

  isTranslating = true;
  log('🌍', `${colors.cyan}Starting translation...${colors.reset}`);

  const child = spawn('npx', ['tsx', 'scripts/i18n/translate.ts'], {
    stdio: 'inherit',
    env: process.env,
    cwd: process.cwd(),
  });

  child.on('close', (code) => {
    isTranslating = false;
    if (code === 0) {
      log('✅', `${colors.green}Translation complete!${colors.reset}`);
    } else {
      log('❌', `Translation failed with code ${code}`);
    }
    log('👀', 'Watching for changes...');
  });

  child.on('error', (error) => {
    isTranslating = false;
    log('❌', `Error: ${error.message}`);
  });
}

function handleFileChange(eventType: string, filename: string | null) {
  if (filename !== 'en.json') return;
  
  log('📝', `${colors.yellow}Detected change in en.json${colors.reset}`);
  
  // Debounce - wait for changes to settle
  if (debounceTimer) {
    clearTimeout(debounceTimer);
  }
  
  debounceTimer = setTimeout(() => {
    debounceTimer = null;
    runTranslation();
  }, DEBOUNCE_MS);
}

function main() {
  console.log('\n' + '='.repeat(50));
  console.log('🌍 i18n Watch Mode (Groq - FREE)');
  console.log('='.repeat(50) + '\n');

  // Check API key
  if (!process.env.GROQ_API_KEY) {
    console.log(`${colors.yellow}⚠️  GROQ_API_KEY not set${colors.reset}`);
    console.log('   Get your FREE key at: https://console.groq.com/keys\n');
    console.log('   Run with: GROQ_API_KEY=your-key npx tsx scripts/i18n/watch.ts\n');
    process.exit(1);
  }

  // Check source file exists
  if (!fs.existsSync(SOURCE_FILE)) {
    console.log(`${colors.yellow}⚠️  Source file not found: ${SOURCE_FILE}${colors.reset}`);
    console.log('   Create messages/en.json first\n');
    process.exit(1);
  }

  log('👀', `Watching ${colors.cyan}messages/en.json${colors.reset} for changes...`);
  log('ℹ️', 'Press Ctrl+C to stop\n');

  // Watch for changes
  fs.watch(MESSAGES_DIR, (eventType, filename) => {
    handleFileChange(eventType, filename);
  });

  // Keep process running
  process.on('SIGINT', () => {
    console.log('\n\n👋 Stopping watch mode...\n');
    process.exit(0);
  });
}

main();
