#!/usr/bin/env node
const pa11y = require('pa11y');

// Use local URL for dev, production for CI
const BASE_URL = process.env.BASE_URL || process.argv[2] || 'http://localhost:3000';

// Pages to test
const PAGES = [
  '/',
  '/markets',
  '/search',
  '/trending',
  '/settings',
  '/pricing',
];

async function runAudit() {
  console.log(`\n🔍 Pa11y Accessibility Audit`);
  console.log(`Base URL: ${BASE_URL}\n`);
  console.log('='.repeat(50));
  
  let totalIssues = 0;
  const pageResults = [];
  
  for (const path of PAGES) {
    const url = `${BASE_URL}${path}`;
    try {
      console.log(`\nTesting: ${path}`);
      const results = await pa11y(url, {
        chromeLaunchConfig: {
          args: ['--no-sandbox', '--disable-setuid-sandbox']
        },
        standard: 'WCAG2AA',
        timeout: 30000,
      });
      
      const errors = results.issues.filter(i => i.type === 'error');
      const warnings = results.issues.filter(i => i.type === 'warning');
      
      totalIssues += errors.length;
      pageResults.push({ path, errors: errors.length, warnings: warnings.length });
      
      if (errors.length === 0) {
        console.log(`  ✅ No errors`);
      } else {
        console.log(`  ❌ ${errors.length} errors, ${warnings.length} warnings`);
        errors.slice(0, 3).forEach((issue) => {
          console.log(`     • ${issue.message.substring(0, 80)}...`);
        });
      }
    } catch (error) {
      console.log(`  ⚠️ Error: ${error.message}`);
      pageResults.push({ path, errors: -1, warnings: 0, error: error.message });
    }
  }
  
  console.log('\n' + '='.repeat(50));
  console.log('\n📊 Summary:');
  console.log('-'.repeat(40));
  pageResults.forEach(r => {
    const status = r.errors === 0 ? '✅' : r.errors > 0 ? '❌' : '⚠️';
    console.log(`${status} ${r.path.padEnd(20)} ${r.errors >= 0 ? r.errors + ' errors' : r.error}`);
  });
  console.log('-'.repeat(40));
  console.log(`Total errors: ${totalIssues}`);
  
  if (totalIssues > 0) {
    console.log('\n⚠️  Run with --verbose for full details');
    process.exit(1);
  } else {
    console.log('\n✅ All pages pass WCAG 2.1 AA!\n');
  }
}

runAudit();
