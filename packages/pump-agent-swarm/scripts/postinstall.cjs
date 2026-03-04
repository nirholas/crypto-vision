/**
 * postinstall — patch @pump-fun SDKs for correct ESM resolution.
 *
 * Both pump-sdk and pump-swap-sdk ship ESM code in `dist/esm/index.js` but
 * lack `"type": "module"` in their package.json. Node.js therefore treats
 * `.js` files as CommonJS, which breaks `export {}` syntax and named imports.
 *
 * This script:
 *  1. Renames `.js` ESM entry files to `.mjs` where needed
 *  2. Updates the exports map / module field to reference `.mjs`
 *  3. Ensures TypeScript declarations exist
 */
'use strict';

const { execSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const nodeModules = path.join(__dirname, '..', 'node_modules');

/**
 * Patch a single @pump-fun package's ESM entry to use `.mjs`.
 * @param {string} pkgName — scoped package name (e.g. "pump-sdk")
 */
function patchEsmEntry(pkgName) {
  const pkgDir = path.join(nodeModules, '@pump-fun', pkgName);
  if (!fs.existsSync(pkgDir)) return;

  const pkgPath = path.join(pkgDir, 'package.json');
  try {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    let patched = false;

    // ── Rename dist/esm/index.js → dist/esm/index.mjs if needed ──────────
    const esmDir = path.join(pkgDir, 'dist', 'esm');
    const esmJs = path.join(esmDir, 'index.js');
    const esmMjs = path.join(esmDir, 'index.mjs');
    if (fs.existsSync(esmJs) && !fs.existsSync(esmMjs)) {
      fs.renameSync(esmJs, esmMjs);
      console.log(`${pkgName} postinstall: renamed dist/esm/index.js → index.mjs`);
    }

    // ── Patch exports map ─────────────────────────────────────────────────
    if (pkg.exports && pkg.exports['.']) {
      const entry = pkg.exports['.'];
      if (entry.import === './dist/esm/index.js') {
        entry.import = './dist/esm/index.mjs';
        patched = true;
      }
    }

    // ── Patch module field ────────────────────────────────────────────────
    if (pkg.module === './dist/esm/index.js') {
      pkg.module = './dist/esm/index.mjs';
      patched = true;
    }

    if (patched) {
      fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
      console.log(`${pkgName} postinstall: patched exports/module to use .mjs`);
    }
  } catch (err) {
    console.warn(`${pkgName} postinstall: patch failed (non-fatal):`, err.message);
  }
}

// ── Patch both SDKs ─────────────────────────────────────────────────────────
patchEsmEntry('pump-sdk');
patchEsmEntry('pump-swap-sdk');

// Also patch pump-swap-sdk nested inside pump-sdk's own node_modules
const nestedSwapDir = path.join(nodeModules, '@pump-fun', 'pump-sdk', 'node_modules', '@pump-fun', 'pump-swap-sdk');
if (fs.existsSync(nestedSwapDir)) {
  const nestedPkgName = 'pump-sdk/node_modules/pump-swap-sdk';
  const pkgPath = path.join(nestedSwapDir, 'package.json');
  try {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    let patched = false;
    const esmDir = path.join(nestedSwapDir, 'dist', 'esm');
    const esmJs = path.join(esmDir, 'index.js');
    const esmMjs = path.join(esmDir, 'index.mjs');
    if (fs.existsSync(esmJs) && !fs.existsSync(esmMjs)) {
      fs.renameSync(esmJs, esmMjs);
      console.log(`${nestedPkgName} postinstall: renamed dist/esm/index.js → index.mjs`);
    }
    if (pkg.exports && pkg.exports['.'] && pkg.exports['.'].import === './dist/esm/index.js') {
      pkg.exports['.'].import = './dist/esm/index.mjs';
      patched = true;
    }
    if (pkg.module === './dist/esm/index.js') {
      pkg.module = './dist/esm/index.mjs';
      patched = true;
    }
    if (patched) {
      fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
      console.log(`${nestedPkgName} postinstall: patched exports/module to use .mjs`);
    }
  } catch (err) {
    console.warn(`${nestedPkgName} postinstall: patch failed (non-fatal):`, err.message);
  }
}

// ── Ensure pump-sdk dist/index.d.ts exists for TypeScript ───────────────────
const sdkDir = path.join(nodeModules, '@pump-fun', 'pump-sdk');
if (fs.existsSync(sdkDir)) {
  const dtsPath = path.join(sdkDir, 'dist', 'index.d.ts');
  if (!fs.existsSync(dtsPath)) {
    const dmtsPath = path.join(sdkDir, 'dist', 'esm', 'index.d.mts');
    if (fs.existsSync(dmtsPath)) {
      fs.copyFileSync(dmtsPath, dtsPath);
      console.log('pump-sdk postinstall: copied ESM types to dist/index.d.ts');
    }
  }

  // Attempt to build declarations from source (non-fatal)
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
  }
}
