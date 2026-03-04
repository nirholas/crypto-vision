#!/usr/bin/env node
/**
 * Sync Changelog with Git History
 * 
 * Compares the existing CHANGELOG.md with git history and:
 * - Identifies missing commits
 * - Suggests additions
 * - Can auto-update the changelog
 * 
 * Usage:
 *   node scripts/changelog/sync-changelog.js           # Show diff
 *   node scripts/changelog/sync-changelog.js --update  # Auto-update
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const CHANGELOG_PATH = path.join(__dirname, '../../docs/CHANGELOG.md');

// =============================================================================
// GIT UTILITIES
// =============================================================================

function getCommits() {
  const cmd = 'git log --pretty=format:"%H|%ai|%s" --all';
  const output = execSync(cmd, { encoding: 'utf-8' });
  
  return output.split('\n').filter(l => l).map(line => {
    const [hash, date, ...subjectParts] = line.split('|');
    return {
      hash: hash.trim(),
      shortHash: hash.trim().substring(0, 7),
      date: date.trim().substring(0, 10),
      subject: subjectParts.join('|').trim(),
    };
  });
}

// =============================================================================
// CHANGELOG PARSING
// =============================================================================

function parseChangelog(content) {
  const mentioned = new Set();
  
  // Find all commit hashes mentioned (7-char short hashes)
  const hashMatches = content.match(/[`\(]([a-f0-9]{7})[`\)]/g) || [];
  for (const match of hashMatches) {
    const hash = match.replace(/[`\(\)]/g, '');
    mentioned.add(hash);
  }
  
  // Find feature/fix descriptions that might match commit subjects
  const descriptions = [];
  const lines = content.split('\n');
  for (const line of lines) {
    if (line.startsWith('- ') || line.startsWith('  - ')) {
      descriptions.push(line.replace(/^[-\s]+/, '').toLowerCase());
    }
  }
  
  return { mentioned, descriptions };
}

// =============================================================================
// MATCHING & ANALYSIS
// =============================================================================

function findMissingCommits(commits, changelog) {
  const missing = [];
  
  for (const commit of commits) {
    // Skip if hash is mentioned
    if (changelog.mentioned.has(commit.shortHash)) {
      continue;
    }
    
    // Check if subject is roughly mentioned
    const subjectLower = commit.subject.toLowerCase();
    const isDescribed = changelog.descriptions.some(desc => {
      // Check for significant word overlap
      const subjectWords = subjectLower.split(/\s+/).filter(w => w.length > 3);
      const matchingWords = subjectWords.filter(w => desc.includes(w));
      return matchingWords.length >= Math.min(3, subjectWords.length * 0.5);
    });
    
    if (!isDescribed) {
      missing.push(commit);
    }
  }
  
  return missing;
}

function categorizeCommit(subject) {
  if (subject.match(/^feat/i)) return 'Added';
  if (subject.match(/^fix/i)) return 'Fixed';
  if (subject.match(/^docs/i)) return 'Documentation';
  if (subject.match(/^refactor/i)) return 'Changed';
  if (subject.match(/^style/i)) return 'Changed';
  if (subject.match(/^perf/i)) return 'Performance';
  if (subject.match(/^chore/i)) return 'Maintenance';
  if (subject.match(/^test/i)) return 'Testing';
  return 'Other';
}

// =============================================================================
// REPORT GENERATION
// =============================================================================

function generateReport(commits, missing) {
  const lines = [];
  
  lines.push('# Changelog Sync Report');
  lines.push('');
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push('');
  lines.push('## Summary');
  lines.push('');
  lines.push(`- Total commits in git: ${commits.length}`);
  lines.push(`- Commits not in changelog: ${missing.length}`);
  lines.push(`- Coverage: ${((commits.length - missing.length) / commits.length * 100).toFixed(1)}%`);
  lines.push('');
  
  if (missing.length === 0) {
    lines.push('✅ **Changelog is complete!** All commits are documented.');
    return lines.join('\n');
  }
  
  lines.push('## Missing Commits');
  lines.push('');
  lines.push('The following commits are not documented in CHANGELOG.md:');
  lines.push('');
  
  // Group by category
  const byCategory = {};
  for (const commit of missing) {
    const category = categorizeCommit(commit.subject);
    if (!byCategory[category]) {
      byCategory[category] = [];
    }
    byCategory[category].push(commit);
  }
  
  for (const [category, categoryCommits] of Object.entries(byCategory)) {
    lines.push(`### ${category}`);
    lines.push('');
    for (const commit of categoryCommits) {
      lines.push(`- \`${commit.shortHash}\` (${commit.date}): ${commit.subject}`);
    }
    lines.push('');
  }
  
  lines.push('## Suggested Additions');
  lines.push('');
  lines.push('Add the following to your CHANGELOG.md under the appropriate version:');
  lines.push('');
  lines.push('```markdown');
  
  // Group by date for suggestions
  const byDate = {};
  for (const commit of missing) {
    if (!byDate[commit.date]) {
      byDate[commit.date] = [];
    }
    byDate[commit.date].push(commit);
  }
  
  for (const [date, dateCommits] of Object.entries(byDate).sort((a, b) => b[0].localeCompare(a[0]))) {
    lines.push(`### ${date}`);
    lines.push('');
    
    const categorized = {};
    for (const commit of dateCommits) {
      const cat = categorizeCommit(commit.subject);
      if (!categorized[cat]) categorized[cat] = [];
      categorized[cat].push(commit);
    }
    
    for (const [cat, commits] of Object.entries(categorized)) {
      lines.push(`#### ${cat}`);
      lines.push('');
      for (const c of commits) {
        const desc = c.subject
          .replace(/^(feat|fix|docs|refactor|style|chore|test|perf)(\([^)]+\))?:\s*/i, '')
          .trim();
        lines.push(`- ${desc} (\`${c.shortHash}\`)`);
      }
      lines.push('');
    }
  }
  
  lines.push('```');
  
  return lines.join('\n');
}

// =============================================================================
// CHANGELOG UPDATE
// =============================================================================

function updateChangelog(changelogContent, missing) {
  // Find the [Unreleased] section
  const unreleasedMatch = changelogContent.match(/## \[Unreleased\]\n\n(### Added\n)?/);
  
  if (!unreleasedMatch) {
    console.error('Could not find [Unreleased] section in changelog');
    return changelogContent;
  }
  
  // Group missing commits
  const additions = [];
  const fixes = [];
  const changes = [];
  const docs = [];
  
  for (const commit of missing) {
    const desc = commit.subject
      .replace(/^(feat|fix|docs|refactor|style|chore|test|perf)(\([^)]+\))?:\s*/i, '')
      .trim();
    const entry = `- ${desc} (\`${commit.shortHash}\`)`;
    
    const cat = categorizeCommit(commit.subject);
    switch (cat) {
      case 'Added':
        additions.push(entry);
        break;
      case 'Fixed':
        fixes.push(entry);
        break;
      case 'Documentation':
        docs.push(entry);
        break;
      default:
        changes.push(entry);
    }
  }
  
  // Build new content
  let newContent = '';
  
  if (additions.length > 0) {
    newContent += '\n#### Recent Additions (Auto-synced)\n\n';
    newContent += additions.join('\n') + '\n';
  }
  
  if (fixes.length > 0) {
    newContent += '\n#### Recent Fixes (Auto-synced)\n\n';
    newContent += fixes.join('\n') + '\n';
  }
  
  if (changes.length > 0) {
    newContent += '\n#### Recent Changes (Auto-synced)\n\n';
    newContent += changes.join('\n') + '\n';
  }
  
  // Insert after [Unreleased] section header
  const insertPos = unreleasedMatch.index + unreleasedMatch[0].length;
  return changelogContent.slice(0, insertPos) + newContent + changelogContent.slice(insertPos);
}

// =============================================================================
// MAIN
// =============================================================================

function main() {
  const args = process.argv.slice(2);
  const shouldUpdate = args.includes('--update');
  const outputFile = args.find((a, i) => args[i - 1] === '--output') || null;
  
  console.error('🔍 Analyzing git history and changelog...');
  
  // Get commits and parse changelog
  const commits = getCommits();
  const changelogContent = fs.readFileSync(CHANGELOG_PATH, 'utf-8');
  const changelog = parseChangelog(changelogContent);
  
  console.error(`📊 Found ${commits.length} commits in git history`);
  console.error(`📝 Found ${changelog.mentioned.size} commit hashes in changelog`);
  
  // Find missing commits
  const missing = findMissingCommits(commits, changelog);
  
  console.error(`❓ ${missing.length} commits may be missing from changelog`);
  
  // Generate report
  const report = generateReport(commits, missing);
  
  if (outputFile) {
    fs.writeFileSync(outputFile, report);
    console.error(`✅ Report written to ${outputFile}`);
  } else if (!shouldUpdate) {
    console.log(report);
  }
  
  // Update changelog if requested
  if (shouldUpdate && missing.length > 0) {
    console.error('\n📝 Updating CHANGELOG.md...');
    const updated = updateChangelog(changelogContent, missing);
    fs.writeFileSync(CHANGELOG_PATH, updated);
    console.error('✅ CHANGELOG.md updated!');
  }
}

main();
