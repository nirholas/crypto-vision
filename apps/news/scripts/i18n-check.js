#!/usr/bin/env node
/**
 * i18n Translation Checker
 * 
 * Validates that all translation files have the same keys as en.json
 * 
 * Usage:
 *   node scripts/i18n-check.js           # Check all languages
 *   node scripts/i18n-check.js --fix     # Show which keys need translation
 *   node scripts/i18n-check.js --verbose # Show detailed diff
 */

const fs = require('fs');
const path = require('path');

const MESSAGES_DIR = path.join(__dirname, '..', 'messages');
const BASE_LOCALE = 'en';

// Parse args
const args = process.argv.slice(2);
const FIX_MODE = args.includes('--fix');
const VERBOSE = args.includes('--verbose');

/**
 * Recursively get all keys from a nested object
 */
function getAllKeys(obj, prefix = '') {
  const keys = [];
  for (const key of Object.keys(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
      keys.push(...getAllKeys(obj[key], fullKey));
    } else {
      keys.push(fullKey);
    }
  }
  return keys;
}

/**
 * Get value at nested key path
 */
function getNestedValue(obj, keyPath) {
  return keyPath.split('.').reduce((acc, key) => acc?.[key], obj);
}

/**
 * Main check function
 */
function checkTranslations() {
  // Load base locale
  const baseFile = path.join(MESSAGES_DIR, `${BASE_LOCALE}.json`);
  if (!fs.existsSync(baseFile)) {
    console.error(`❌ Base locale file not found: ${baseFile}`);
    process.exit(1);
  }

  const baseContent = JSON.parse(fs.readFileSync(baseFile, 'utf-8'));
  const baseKeys = getAllKeys(baseContent);
  
  console.log(`📋 Base locale (${BASE_LOCALE}): ${baseKeys.length} keys\n`);

  // Get all locale files
  const localeFiles = fs.readdirSync(MESSAGES_DIR)
    .filter(f => f.endsWith('.json') && f !== `${BASE_LOCALE}.json`);

  let totalMissing = 0;
  let totalExtra = 0;
  const results = [];

  for (const file of localeFiles) {
    const locale = file.replace('.json', '');
    const filePath = path.join(MESSAGES_DIR, file);
    const content = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    const localeKeys = getAllKeys(content);

    const missing = baseKeys.filter(k => !localeKeys.includes(k));
    const extra = localeKeys.filter(k => !baseKeys.includes(k));

    results.push({ locale, missing, extra, total: localeKeys.length });
    totalMissing += missing.length;
    totalExtra += extra.length;
  }

  // Sort by number of missing keys
  results.sort((a, b) => b.missing.length - a.missing.length);

  // Display results
  console.log('┌─────────┬────────┬─────────┬─────────┐');
  console.log('│ Locale  │ Keys   │ Missing │ Extra   │');
  console.log('├─────────┼────────┼─────────┼─────────┤');

  for (const { locale, missing, extra, total } of results) {
    const status = missing.length === 0 ? '✅' : '⚠️';
    console.log(
      `│ ${status} ${locale.padEnd(4)} │ ${total.toString().padStart(6)} │ ${missing.length.toString().padStart(7)} │ ${extra.length.toString().padStart(7)} │`
    );

    if (VERBOSE && missing.length > 0) {
      console.log(`│         │ Missing: ${missing.slice(0, 5).join(', ')}${missing.length > 5 ? '...' : ''}`);
    }
  }

  console.log('└─────────┴────────┴─────────┴─────────┘');
  console.log('');

  // Summary
  if (totalMissing === 0) {
    console.log('✅ All translations are complete!');
  } else {
    console.log(`⚠️  ${totalMissing} missing translations across ${results.filter(r => r.missing.length > 0).length} locales`);
    
    if (FIX_MODE) {
      console.log('\n📝 Keys that need translation:\n');
      
      // Find most commonly missing keys
      const missingCount = {};
      for (const { missing } of results) {
        for (const key of missing) {
          missingCount[key] = (missingCount[key] || 0) + 1;
        }
      }
      
      const sortedMissing = Object.entries(missingCount)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 20);
      
      for (const [key, count] of sortedMissing) {
        const value = getNestedValue(baseContent, key);
        console.log(`  ${key} (missing in ${count} locales)`);
        console.log(`    en: "${typeof value === 'string' ? value.slice(0, 60) : JSON.stringify(value)}${typeof value === 'string' && value.length > 60 ? '...' : ''}"`);
        console.log('');
      }
    }
  }

  if (totalExtra > 0) {
    console.log(`ℹ️  ${totalExtra} extra keys (may be unused)`);
  }

  // Exit with error if missing translations
  process.exit(totalMissing > 0 ? 1 : 0);
}

checkTranslations();
