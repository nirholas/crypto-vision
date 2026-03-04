/**
 * postinstall — patch @pump-fun/pump-sdk for correct ESM resolution.
 *
 * The published SDK has an exports map pointing ESM entry to `./dist/esm/index.js`,
 * but the actual built file is `index.mjs`. Since the SDK package lacks `"type": "module"`,
 * Node treats `.js` files as CommonJS, breaking named imports. We patch the exports map
 * to reference `.mjs` directly.
 *
 * Also attempts to build type declarations from SDK source (non-fatal).
 */
'use strict';

const { execSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const sdkDir = path.join(__dirname, '..', 'node_modules', '@pump-fun', 'pump-sdk');

if (!fs.existsSync(sdkDir)) {
  // SDK not installed (e.g. CI with --ignore-scripts) — nothing to do.
  process.exit(0);
}

// ── 1. Patch exports map to use .mjs entry ──────────────────────────────────
const pkgPath = path.join(sdkDir, 'package.json');
try {
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  let patched = false;

  if (pkg.exports && pkg.exports['.']) {
    const entry = pkg.exports['.'];
    if (entry.import === './dist/esm/index.js') {
      entry.import = './dist/esm/index.mjs';
      patched = true;
    }
  }

  if (pkg.module === './dist/esm/index.js') {
    pkg.module = './dist/esm/index.mjs';
    patched = true;
  }

  if (patched) {
    fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
    console.log('pump-sdk postinstall: patched exports map to use .mjs entry');
  }
} catch (err) {
  console.warn('pump-sdk postinstall: exports patch failed (non-fatal):', err.message);
}

// ── 2. Ensure dist/index.d.ts exists for TypeScript ─────────────────────────
const dtsPath = path.join(sdkDir, 'dist', 'index.d.ts');
if (!fs.existsSync(dtsPath)) {
  const dmtsPath = path.join(sdkDir, 'dist', 'esm', 'index.d.mts');
  if (fs.existsSync(dmtsPath)) {
    fs.copyFileSync(dmtsPath, dtsPath);
    console.log('pump-sdk postinstall: copied ESM types to dist/index.d.ts');
  }
}

// ── 3. Attempt to build declarations from source (non-fatal) ────────────────
try {
  execSync(
    'npx tsc --declaration --emitDeclarationOnly --outDir dist ' +
    '--target ES2020 --module ES2020 --moduleResolution node ' +
    '--esModuleInterop --skipLibCheck --strict --resolveJsonModule ' +
    'src/*.ts src/idl/*.ts',
    { cwd: sdkDir, stdio: 'inherit', timeout: 60_000 },
  );
} catch {
  // Non-fatal — the swarm ships its own .d.ts shim for the SDK.
  // Build failures here just mean IDE auto-complete inside the SDK
  // source won't work, but the swarm itself compiles fine.
}

// ── 4. Clean up stale .js copy from old postinstall ─────────────────────────
const staleJs = path.join(sdkDir, 'dist', 'esm', 'index.js');
const mjsFile = path.join(sdkDir, 'dist', 'esm', 'index.mjs');
if (fs.existsSync(staleJs) && fs.existsSync(mjsFile)) {
  const jsStats = fs.statSync(staleJs);
  const mjsStats = fs.statSync(mjsFile);
  if (jsStats.size === mjsStats.size) {
    fs.unlinkSync(staleJs);
    console.log('pump-sdk postinstall: removed stale dist/esm/index.js copy');
  }
}
