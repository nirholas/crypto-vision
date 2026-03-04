#!/usr/bin/env node
/**
 * Advanced Changelog Generator
 * 
 * Generates comprehensive changelog from git history with:
 * - Conventional commit parsing
 * - Breaking change detection
 * - Scope extraction
 * - Statistics generation
 * - Multiple output formats (markdown, JSON, HTML)
 * 
 * Usage:
 *   node scripts/changelog/changelog-generator.js
 *   node scripts/changelog/changelog-generator.js --since v1.0.0
 *   node scripts/changelog/changelog-generator.js --format json
 *   node scripts/changelog/changelog-generator.js --output CHANGELOG_FULL.md
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// =============================================================================
// CONFIGURATION
// =============================================================================

const CONFIG = {
  // Conventional commit types and their display names
  types: {
    feat: { title: '✨ Features', priority: 1 },
    fix: { title: '🐛 Bug Fixes', priority: 2 },
    perf: { title: '⚡ Performance', priority: 3 },
    refactor: { title: '♻️ Refactoring', priority: 4 },
    docs: { title: '📚 Documentation', priority: 5 },
    style: { title: '💅 Styling', priority: 6 },
    test: { title: '🧪 Tests', priority: 7 },
    chore: { title: '🔧 Chores', priority: 8 },
    ci: { title: '🔄 CI/CD', priority: 9 },
    build: { title: '📦 Build', priority: 10 },
  },
  
  // Breaking change indicators
  breakingIndicators: ['BREAKING CHANGE:', 'BREAKING:', '!:'],
  
  // Scopes to highlight
  highlightScopes: ['api', 'auth', 'x402', 'premium', 'security'],
};

// =============================================================================
// GIT UTILITIES
// =============================================================================

function getGitLog(since = null, until = null) {
  let cmd = 'git log --pretty=format:"%H|%ai|%an|%ae|%s|%b|||END|||" --all';
  
  if (since) {
    cmd += ` ${since}..HEAD`;
  }
  
  if (until) {
    cmd += ` --until="${until}"`;
  }
  
  try {
    const output = execSync(cmd, { 
      encoding: 'utf-8',
      maxBuffer: 50 * 1024 * 1024 // 50MB buffer
    });
    return output;
  } catch (error) {
    console.error('Error getting git log:', error.message);
    return '';
  }
}

function getTags() {
  try {
    const output = execSync('git tag --sort=-v:refname', { encoding: 'utf-8' });
    return output.trim().split('\n').filter(t => t);
  } catch {
    return [];
  }
}

function getRepoInfo() {
  try {
    const remoteUrl = execSync('git config --get remote.origin.url', { encoding: 'utf-8' }).trim();
    const match = remoteUrl.match(/github\.com[:/]([^/]+)\/([^/.]+)/);
    if (match) {
      return { owner: match[1], repo: match[2] };
    }
  } catch {}
  return { owner: 'unknown', repo: 'unknown' };
}

// =============================================================================
// COMMIT PARSING
// =============================================================================

function parseCommit(raw) {
  const parts = raw.split('|');
  if (parts.length < 6) return null;
  
  const [hash, date, author, email, subject, ...bodyParts] = parts;
  const body = bodyParts.join('|').replace(/\|\|\|END\|\|\|/g, '').trim();
  
  // Parse conventional commit format
  const conventionalMatch = subject.match(/^(\w+)(?:\(([^)]+)\))?(!)?:\s*(.+)$/);
  
  let type = 'other';
  let scope = null;
  let breaking = false;
  let description = subject;
  
  if (conventionalMatch) {
    type = conventionalMatch[1].toLowerCase();
    scope = conventionalMatch[2] || null;
    breaking = conventionalMatch[3] === '!';
    description = conventionalMatch[4];
  }
  
  // Check body for breaking changes
  if (!breaking && body) {
    breaking = CONFIG.breakingIndicators.some(indicator => 
      body.includes(indicator)
    );
  }
  
  return {
    hash,
    shortHash: hash.substring(0, 7),
    date: new Date(date),
    dateString: date.substring(0, 10),
    author,
    email,
    type,
    scope,
    breaking,
    subject,
    description,
    body,
  };
}

function parseAllCommits(rawLog) {
  const commitStrings = rawLog.split('|||END|||').filter(s => s.trim());
  const commits = [];
  
  for (const raw of commitStrings) {
    const commit = parseCommit(raw.trim());
    if (commit && commit.hash) {
      commits.push(commit);
    }
  }
  
  return commits;
}

// =============================================================================
// GROUPING & ORGANIZATION
// =============================================================================

function groupByDate(commits) {
  const groups = {};
  
  for (const commit of commits) {
    const date = commit.dateString;
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(commit);
  }
  
  return groups;
}

function groupByType(commits) {
  const groups = {};
  
  for (const commit of commits) {
    const type = CONFIG.types[commit.type] ? commit.type : 'other';
    if (!groups[type]) {
      groups[type] = [];
    }
    groups[type].push(commit);
  }
  
  // Sort groups by priority
  const sortedGroups = {};
  const sortedTypes = Object.keys(groups).sort((a, b) => {
    const priorityA = CONFIG.types[a]?.priority || 99;
    const priorityB = CONFIG.types[b]?.priority || 99;
    return priorityA - priorityB;
  });
  
  for (const type of sortedTypes) {
    sortedGroups[type] = groups[type];
  }
  
  return sortedGroups;
}

function groupByScope(commits) {
  const groups = {};
  
  for (const commit of commits) {
    const scope = commit.scope || 'general';
    if (!groups[scope]) {
      groups[scope] = [];
    }
    groups[scope].push(commit);
  }
  
  return groups;
}

// =============================================================================
// STATISTICS
// =============================================================================

function generateStats(commits) {
  const stats = {
    total: commits.length,
    byType: {},
    byAuthor: {},
    byScope: {},
    breakingChanges: 0,
    dateRange: {
      start: null,
      end: null,
    },
    averagePerDay: 0,
  };
  
  const dates = new Set();
  
  for (const commit of commits) {
    // By type
    stats.byType[commit.type] = (stats.byType[commit.type] || 0) + 1;
    
    // By author
    stats.byAuthor[commit.author] = (stats.byAuthor[commit.author] || 0) + 1;
    
    // By scope
    if (commit.scope) {
      stats.byScope[commit.scope] = (stats.byScope[commit.scope] || 0) + 1;
    }
    
    // Breaking changes
    if (commit.breaking) {
      stats.breakingChanges++;
    }
    
    // Date tracking
    dates.add(commit.dateString);
    if (!stats.dateRange.start || commit.date < stats.dateRange.start) {
      stats.dateRange.start = commit.date;
    }
    if (!stats.dateRange.end || commit.date > stats.dateRange.end) {
      stats.dateRange.end = commit.date;
    }
  }
  
  stats.averagePerDay = (commits.length / dates.size).toFixed(2);
  
  return stats;
}

// =============================================================================
// OUTPUT FORMATTERS
// =============================================================================

function formatMarkdown(commits, options = {}) {
  const { includeStats = true, includeBody = false, repoInfo } = options;
  const lines = [];
  
  lines.push('# Complete Changelog');
  lines.push('');
  lines.push(`> Generated on ${new Date().toISOString()}`);
  lines.push('');
  
  if (includeStats) {
    const stats = generateStats(commits);
    lines.push('## 📊 Statistics');
    lines.push('');
    lines.push(`- **Total Commits:** ${stats.total}`);
    lines.push(`- **Breaking Changes:** ${stats.breakingChanges}`);
    lines.push(`- **Contributors:** ${Object.keys(stats.byAuthor).length}`);
    lines.push(`- **Average Commits/Day:** ${stats.averagePerDay}`);
    lines.push('');
    lines.push('### By Type');
    lines.push('');
    for (const [type, count] of Object.entries(stats.byType).sort((a, b) => b[1] - a[1])) {
      const config = CONFIG.types[type];
      const label = config ? config.title.replace(/^[^ ]+ /, '') : type;
      lines.push(`- ${label}: ${count}`);
    }
    lines.push('');
    lines.push('---');
    lines.push('');
  }
  
  // Group by date
  const byDate = groupByDate(commits);
  
  for (const [date, dateCommits] of Object.entries(byDate)) {
    lines.push(`## ${date}`);
    lines.push('');
    
    // Group this day's commits by type
    const byType = groupByType(dateCommits);
    
    for (const [type, typeCommits] of Object.entries(byType)) {
      const config = CONFIG.types[type] || { title: `📝 ${type}` };
      lines.push(`### ${config.title}`);
      lines.push('');
      
      for (const commit of typeCommits) {
        const scopeStr = commit.scope ? `**${commit.scope}:** ` : '';
        const breakingStr = commit.breaking ? '⚠️ BREAKING: ' : '';
        const hashLink = repoInfo 
          ? `[\`${commit.shortHash}\`](https://github.com/${repoInfo.owner}/${repoInfo.repo}/commit/${commit.hash})`
          : `\`${commit.shortHash}\``;
        
        lines.push(`- ${breakingStr}${scopeStr}${commit.description} (${hashLink})`);
        
        if (includeBody && commit.body) {
          const bodyLines = commit.body.split('\n').filter(l => l.trim());
          for (const bodyLine of bodyLines.slice(0, 3)) {
            lines.push(`  - ${bodyLine}`);
          }
        }
      }
      lines.push('');
    }
  }
  
  return lines.join('\n');
}

function formatJSON(commits, options = {}) {
  const stats = generateStats(commits);
  const repoInfo = getRepoInfo();
  
  return JSON.stringify({
    generated_at: new Date().toISOString(),
    repository: repoInfo,
    statistics: stats,
    commits: commits.map(c => ({
      hash: c.hash,
      short_hash: c.shortHash,
      date: c.date.toISOString(),
      author: c.author,
      type: c.type,
      scope: c.scope,
      breaking: c.breaking,
      subject: c.subject,
      description: c.description,
      body: c.body || null,
    })),
  }, null, 2);
}

function formatHTML(commits, options = {}) {
  const stats = generateStats(commits);
  const byDate = groupByDate(commits);
  
  let html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Changelog</title>
  <style>
    :root {
      --bg: #0a0a0a;
      --text: #e5e5e5;
      --muted: #737373;
      --accent: #3b82f6;
      --border: #262626;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: var(--bg);
      color: var(--text);
      line-height: 1.6;
      padding: 2rem;
    }
    .container { max-width: 900px; margin: 0 auto; }
    h1 { font-size: 2.5rem; margin-bottom: 1rem; }
    h2 { font-size: 1.5rem; margin: 2rem 0 1rem; border-bottom: 1px solid var(--border); padding-bottom: 0.5rem; }
    h3 { font-size: 1.1rem; color: var(--accent); margin: 1rem 0 0.5rem; }
    .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 1rem; margin: 1rem 0; }
    .stat { background: #171717; padding: 1rem; border-radius: 8px; text-align: center; }
    .stat-value { font-size: 2rem; font-weight: bold; color: var(--accent); }
    .stat-label { color: var(--muted); font-size: 0.875rem; }
    ul { list-style: none; }
    li { padding: 0.5rem 0; border-bottom: 1px solid var(--border); }
    .commit-hash { color: var(--accent); font-family: monospace; font-size: 0.875rem; }
    .scope { background: #262626; padding: 0.125rem 0.5rem; border-radius: 4px; font-size: 0.75rem; }
    .breaking { color: #ef4444; font-weight: bold; }
    .generated { color: var(--muted); font-size: 0.875rem; margin-bottom: 2rem; }
  </style>
</head>
<body>
  <div class="container">
    <h1>📋 Complete Changelog</h1>
    <p class="generated">Generated on ${new Date().toISOString()}</p>
    
    <div class="stats">
      <div class="stat">
        <div class="stat-value">${stats.total}</div>
        <div class="stat-label">Total Commits</div>
      </div>
      <div class="stat">
        <div class="stat-value">${Object.keys(stats.byAuthor).length}</div>
        <div class="stat-label">Contributors</div>
      </div>
      <div class="stat">
        <div class="stat-value">${stats.breakingChanges}</div>
        <div class="stat-label">Breaking Changes</div>
      </div>
      <div class="stat">
        <div class="stat-value">${stats.averagePerDay}</div>
        <div class="stat-label">Commits/Day</div>
      </div>
    </div>
`;

  for (const [date, dateCommits] of Object.entries(byDate)) {
    html += `\n    <h2>${date}</h2>\n    <ul>\n`;
    
    for (const commit of dateCommits) {
      const breakingClass = commit.breaking ? ' class="breaking"' : '';
      const scopeHtml = commit.scope ? `<span class="scope">${commit.scope}</span> ` : '';
      const breakingHtml = commit.breaking ? '⚠️ ' : '';
      
      html += `      <li${breakingClass}>${breakingHtml}${scopeHtml}${commit.description} <span class="commit-hash">${commit.shortHash}</span></li>\n`;
    }
    
    html += `    </ul>\n`;
  }

  html += `  </div>
</body>
</html>`;

  return html;
}

// =============================================================================
// MAIN
// =============================================================================

function main() {
  const args = process.argv.slice(2);
  
  // Parse arguments
  let since = null;
  let format = 'markdown';
  let output = null;
  let includeStats = true;
  let includeBody = false;
  
  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--since':
        since = args[++i];
        break;
      case '--format':
        format = args[++i];
        break;
      case '--output':
      case '-o':
        output = args[++i];
        break;
      case '--no-stats':
        includeStats = false;
        break;
      case '--body':
        includeBody = true;
        break;
      case '--help':
      case '-h':
        console.log(`
Changelog Generator

Usage:
  node changelog-generator.js [options]

Options:
  --since <ref>     Start from tag/commit (e.g., v1.0.0)
  --format <fmt>    Output format: markdown, json, html (default: markdown)
  --output <file>   Write to file instead of stdout
  --no-stats        Don't include statistics
  --body            Include commit body text
  --help            Show this help
`);
        process.exit(0);
    }
  }
  
  console.error('🔍 Fetching git history...');
  
  const rawLog = getGitLog(since);
  const commits = parseAllCommits(rawLog);
  
  console.error(`📝 Found ${commits.length} commits`);
  
  const repoInfo = getRepoInfo();
  const options = { includeStats, includeBody, repoInfo };
  
  let result;
  switch (format) {
    case 'json':
      result = formatJSON(commits, options);
      break;
    case 'html':
      result = formatHTML(commits, options);
      break;
    default:
      result = formatMarkdown(commits, options);
  }
  
  if (output) {
    fs.writeFileSync(output, result);
    console.error(`✅ Written to ${output}`);
  } else {
    console.log(result);
  }
}

main();
