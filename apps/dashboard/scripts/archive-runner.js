#!/usr/bin/env node
/**
 * Archive Runner - Local scheduler for archive collection
 * 
 * Runs the archive collection on a configurable interval without requiring
 * GitHub Actions or external cron services.
 * 
 * Usage:
 *   node scripts/archive-runner.js                    # Run once
 *   node scripts/archive-runner.js --watch            # Run hourly
 *   node scripts/archive-runner.js --watch --interval 30  # Run every 30 min
 *   node scripts/archive-runner.js --daemon           # Background daemon mode
 * 
 * Environment Variables:
 *   ARCHIVE_INTERVAL  - Minutes between runs (default: 60)
 *   API_URL           - API base URL (default: http://localhost:3000)
 *   ARCHIVE_DIR       - Archive directory (default: ./archive)
 */

const { spawn, fork } = require('child_process');
const path = require('path');
const fs = require('fs');

// =============================================================================
// Configuration
// =============================================================================

const CONFIG = {
  scriptPath: path.join(__dirname, 'archive', 'collect-enhanced.js'),
  archiveDir: process.env.ARCHIVE_DIR || path.join(__dirname, '..', 'archive'),
  apiUrl: process.env.API_URL || 'http://localhost:3000',
  interval: parseInt(process.env.ARCHIVE_INTERVAL || '60', 10), // minutes
  logFile: path.join(__dirname, '..', 'archive', 'v2', 'meta', 'runner.log'),
  pidFile: path.join(__dirname, '..', '.archive-runner.pid'),
};

// =============================================================================
// Logging
// =============================================================================

function log(level, message) {
  const timestamp = new Date().toISOString();
  const line = `[${timestamp}] [${level.toUpperCase()}] ${message}`;
  console.log(line);
  
  // Also append to log file
  try {
    const logDir = path.dirname(CONFIG.logFile);
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
    fs.appendFileSync(CONFIG.logFile, line + '\n');
  } catch (e) {
    // Ignore log write errors
  }
}

function info(msg) { log('info', msg); }
function error(msg) { log('error', msg); }
function success(msg) { log('success', msg); }

// =============================================================================
// Collection Runner
// =============================================================================

async function runCollection() {
  return new Promise((resolve, reject) => {
    info('Starting archive collection...');
    
    if (!fs.existsSync(CONFIG.scriptPath)) {
      error(`Collection script not found: ${CONFIG.scriptPath}`);
      return reject(new Error('Collection script not found'));
    }
    
    const startTime = Date.now();
    
    const child = spawn('node', [CONFIG.scriptPath], {
      cwd: path.dirname(CONFIG.scriptPath),
      env: {
        ...process.env,
        API_URL: CONFIG.apiUrl,
        ARCHIVE_DIR: CONFIG.archiveDir,
      },
      stdio: 'pipe',
    });
    
    let stdout = '';
    let stderr = '';
    
    child.stdout.on('data', (data) => {
      const text = data.toString();
      stdout += text;
      // Echo key progress messages
      for (const line of text.split('\n')) {
        if (line.includes('PHASE') || line.includes('✅') || line.includes('❌')) {
          console.log(`  ${line.trim()}`);
        }
      }
    });
    
    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    
    child.on('close', (code) => {
      const duration = ((Date.now() - startTime) / 1000).toFixed(1);
      
      if (code === 0) {
        success(`Collection completed in ${duration}s`);
        
        // Parse result from stdout
        const resultMatch = stdout.match(/Result: ({.*})/);
        if (resultMatch) {
          try {
            const result = JSON.parse(resultMatch[1]);
            info(`  Articles: ${result.articles?.new || 0} new, ${result.articles?.updated || 0} updated`);
          } catch (e) {
            // Ignore parse errors
          }
        }
        
        resolve({ success: true, duration });
      } else {
        error(`Collection failed with code ${code}`);
        if (stderr) error(`stderr: ${stderr}`);
        reject(new Error(`Collection failed with code ${code}`));
      }
    });
    
    child.on('error', (err) => {
      error(`Failed to start collection: ${err.message}`);
      reject(err);
    });
  });
}

// =============================================================================
// Scheduler
// =============================================================================

class ArchiveScheduler {
  constructor(intervalMinutes) {
    this.interval = intervalMinutes * 60 * 1000;
    this.timer = null;
    this.running = false;
    this.runCount = 0;
    this.lastRun = null;
    this.lastResult = null;
  }
  
  async start() {
    info(`Starting archive scheduler (interval: ${this.interval / 60000} minutes)`);
    
    // Run immediately on start
    await this.run();
    
    // Then schedule recurring runs
    this.timer = setInterval(() => this.run(), this.interval);
    
    // Handle graceful shutdown
    process.on('SIGINT', () => this.stop('SIGINT'));
    process.on('SIGTERM', () => this.stop('SIGTERM'));
    
    info('Scheduler running. Press Ctrl+C to stop.');
    this.printNextRun();
  }
  
  async run() {
    if (this.running) {
      info('Skipping run - previous collection still in progress');
      return;
    }
    
    this.running = true;
    this.runCount++;
    
    console.log('\n' + '='.repeat(60));
    info(`Collection run #${this.runCount}`);
    console.log('='.repeat(60) + '\n');
    
    try {
      this.lastResult = await runCollection();
      this.lastRun = new Date();
    } catch (e) {
      this.lastResult = { success: false, error: e.message };
    } finally {
      this.running = false;
      this.printNextRun();
    }
  }
  
  printNextRun() {
    const nextRun = new Date(Date.now() + this.interval);
    info(`Next run at: ${nextRun.toLocaleTimeString()}`);
  }
  
  stop(signal) {
    console.log('\n');
    info(`Received ${signal}, shutting down...`);
    
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    
    info(`Completed ${this.runCount} runs`);
    process.exit(0);
  }
  
  getStatus() {
    return {
      running: this.running,
      runCount: this.runCount,
      lastRun: this.lastRun,
      lastResult: this.lastResult,
      interval: this.interval / 60000,
    };
  }
}

// =============================================================================
// Daemon Mode
// =============================================================================

function startDaemon() {
  info('Starting archive runner in daemon mode...');
  
  // Check if already running
  if (fs.existsSync(CONFIG.pidFile)) {
    const pid = parseInt(fs.readFileSync(CONFIG.pidFile, 'utf-8'), 10);
    try {
      process.kill(pid, 0); // Check if process exists
      error(`Archive runner already running (PID: ${pid})`);
      process.exit(1);
    } catch (e) {
      // Process doesn't exist, remove stale PID file
      fs.unlinkSync(CONFIG.pidFile);
    }
  }
  
  // Fork to background
  const child = fork(__filename, ['--watch'], {
    detached: true,
    stdio: 'ignore',
  });
  
  // Write PID file
  fs.writeFileSync(CONFIG.pidFile, child.pid.toString());
  
  child.unref();
  
  success(`Archive runner started in background (PID: ${child.pid})`);
  info(`Log file: ${CONFIG.logFile}`);
  info(`To stop: node scripts/archive-runner.js --stop`);
  
  process.exit(0);
}

function stopDaemon() {
  if (!fs.existsSync(CONFIG.pidFile)) {
    info('No archive runner daemon is running');
    process.exit(0);
  }
  
  const pid = parseInt(fs.readFileSync(CONFIG.pidFile, 'utf-8'), 10);
  
  try {
    process.kill(pid, 'SIGTERM');
    fs.unlinkSync(CONFIG.pidFile);
    success(`Stopped archive runner (PID: ${pid})`);
  } catch (e) {
    error(`Failed to stop daemon: ${e.message}`);
    fs.unlinkSync(CONFIG.pidFile);
  }
  
  process.exit(0);
}

function showStatus() {
  console.log('\n📊 Archive Runner Status\n');
  
  // Check daemon
  if (fs.existsSync(CONFIG.pidFile)) {
    const pid = parseInt(fs.readFileSync(CONFIG.pidFile, 'utf-8'), 10);
    try {
      process.kill(pid, 0);
      console.log(`  🟢 Daemon running (PID: ${pid})`);
    } catch (e) {
      console.log('  🔴 Daemon not running (stale PID file)');
    }
  } else {
    console.log('  ⚪ No daemon running');
  }
  
  // Check last stats
  const statsPath = path.join(CONFIG.archiveDir, 'v2', 'meta', 'stats.json');
  if (fs.existsSync(statsPath)) {
    try {
      const stats = JSON.parse(fs.readFileSync(statsPath, 'utf-8'));
      console.log(`\n  📁 Archive Stats:`);
      console.log(`     Total articles: ${stats.total_articles || 0}`);
      console.log(`     Sources: ${Object.keys(stats.by_source || {}).length}`);
      console.log(`     Tickers tracked: ${stats.unique_tickers || 0}`);
      console.log(`     Last fetch: ${stats.last_fetch || 'never'}`);
      
      if (stats.latest_market) {
        console.log(`\n  📈 Latest Market:`);
        console.log(`     BTC: $${stats.latest_market.btc_price?.toLocaleString() || 'N/A'}`);
        console.log(`     ETH: $${stats.latest_market.eth_price?.toLocaleString() || 'N/A'}`);
        console.log(`     Fear/Greed: ${stats.latest_market.fear_greed || 'N/A'}`);
      }
    } catch (e) {
      console.log('  ⚠️ Could not read stats');
    }
  } else {
    console.log('\n  ⚠️ No archive stats found');
  }
  
  // Check log
  if (fs.existsSync(CONFIG.logFile)) {
    const log = fs.readFileSync(CONFIG.logFile, 'utf-8');
    const lines = log.trim().split('\n');
    const lastLines = lines.slice(-5);
    console.log('\n  📜 Recent log entries:');
    for (const line of lastLines) {
      console.log(`     ${line}`);
    }
  }
  
  console.log('\n');
}

// =============================================================================
// CLI
// =============================================================================

async function main() {
  const args = process.argv.slice(2);
  
  console.log('\n🗄️  Archive Runner\n');
  
  // Parse arguments
  const flags = {
    watch: args.includes('--watch') || args.includes('-w'),
    daemon: args.includes('--daemon') || args.includes('-d'),
    stop: args.includes('--stop'),
    status: args.includes('--status') || args.includes('-s'),
    help: args.includes('--help') || args.includes('-h'),
  };
  
  // Parse interval
  const intervalIdx = args.findIndex(a => a === '--interval' || a === '-i');
  const interval = intervalIdx !== -1 && args[intervalIdx + 1] 
    ? parseInt(args[intervalIdx + 1], 10) 
    : CONFIG.interval;
  
  if (flags.help) {
    console.log(`
Usage: node scripts/archive-runner.js [options]

Options:
  --watch, -w          Run continuously on interval
  --daemon, -d         Run as background daemon
  --stop               Stop background daemon
  --status, -s         Show archive status
  --interval N, -i N   Set interval in minutes (default: 60)
  --help, -h           Show this help

Environment Variables:
  API_URL              API base URL (default: http://localhost:3000)
  ARCHIVE_DIR          Archive directory (default: ./archive)
  ARCHIVE_INTERVAL     Minutes between runs (default: 60)

Examples:
  node scripts/archive-runner.js                    # Run once
  node scripts/archive-runner.js --watch            # Run hourly
  node scripts/archive-runner.js --watch -i 30      # Run every 30 min
  node scripts/archive-runner.js --daemon           # Run in background
  node scripts/archive-runner.js --stop             # Stop daemon
  node scripts/archive-runner.js --status           # Show status
`);
    process.exit(0);
  }
  
  if (flags.stop) {
    stopDaemon();
    return;
  }
  
  if (flags.status) {
    showStatus();
    return;
  }
  
  if (flags.daemon) {
    startDaemon();
    return;
  }
  
  if (flags.watch) {
    const scheduler = new ArchiveScheduler(interval);
    await scheduler.start();
    
    // Keep the process running
    await new Promise(() => {});
  } else {
    // Single run mode
    try {
      await runCollection();
      process.exit(0);
    } catch (e) {
      error(e.message);
      process.exit(1);
    }
  }
}

main().catch((e) => {
  error(`Fatal error: ${e.message}`);
  process.exit(1);
});
