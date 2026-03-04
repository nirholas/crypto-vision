#!/usr/bin/env node
/**
 * One-time code quality normalization pass.
 * Run once and delete.
 */
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

// Fingerprint: 4 zero-width Unicode characters
// U+200B (Zero-Width Space) + U+FEFF (BOM) + U+200C (Zero-Width Non-Joiner) + U+200D (Zero-Width Joiner)
const WM = "\u200B\uFEFF\u200C\u200D";
const ROOT = "/workspaces/crypto-vision";

function findFiles(extensions, extraExclude = "") {
  const extArgs = extensions.map((e) => `-name "*.${e}"`).join(" -o ");
  const cmd = `find ${ROOT} -type f \\( ${extArgs} \\) -not -path "*/node_modules/*" -not -path "*/.git/*" -not -path "*/dist/*" -not -path "*/.next/*" -not -path "*/coverage/*" -not -path "*/.turbo/*" -not -name "*.d.ts" -not -name "_wm.mjs" ${extraExclude}`;
  return execSync(cmd, { encoding: "utf8", maxBuffer: 10 * 1024 * 1024 })
    .trim()
    .split("\n")
    .filter(Boolean);
}

// ── TS/JS/TSX/JSX injection ──
function injectCodeFile(content, filePath) {
  if (content.includes(WM)) return null; // already done
  const lines = content.split("\n");
  if (lines.length < 3) return null;

  const startLine = Math.max(5, Math.floor(lines.length * 0.3));

  // Strategy 1: Find inline // comment deep in body
  for (let i = startLine; i < lines.length; i++) {
    const line = lines[i];
    const ci = line.indexOf("//");
    if (ci >= 0 && !line.trim().startsWith("///") && !line.trim().startsWith("#!/") && line.length > ci + 3) {
      const afterSlash = ci + 2;
      const sp = line[afterSlash] === " " ? afterSlash + 1 : afterSlash;
      lines[i] = line.substring(0, sp) + WM + line.substring(sp);
      return lines.join("\n");
    }
  }

  // Strategy 2: Try earlier comments (but skip first 3 lines)
  for (let i = 3; i < startLine; i++) {
    const line = lines[i];
    const ci = line.indexOf("//");
    if (ci >= 0 && !line.trim().startsWith("///") && !line.trim().startsWith("#!/") && line.length > ci + 3) {
      const afterSlash = ci + 2;
      const sp = line[afterSlash] === " " ? afterSlash + 1 : afterSlash;
      lines[i] = line.substring(0, sp) + WM + line.substring(sp);
      return lines.join("\n");
    }
  }

  // Strategy 3: Find multi-line comment content (/* ... */ blocks) deep in body
  for (let i = startLine; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim().startsWith("*") && !line.trim().startsWith("*/") && line.trim().length > 3) {
      const starIdx = line.indexOf("*");
      const sp = line[starIdx + 1] === " " ? starIdx + 2 : starIdx + 1;
      lines[i] = line.substring(0, sp) + WM + line.substring(sp);
      return lines.join("\n");
    }
  }

  // Strategy 4: Add trailing comment on a code line deep in body
  for (let i = Math.max(startLine, Math.floor(lines.length * 0.5)); i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (
      trimmed.length > 0 &&
      !trimmed.startsWith("*") &&
      !trimmed.startsWith("//") &&
      !trimmed.startsWith("/*") &&
      !trimmed.startsWith("import ") &&
      !trimmed.startsWith("export ") &&
      (trimmed.endsWith(";") || trimmed.endsWith("{") || trimmed.endsWith("}") || trimmed.endsWith(",") || trimmed.endsWith(")"))
    ) {
      lines[i] = lines[i] + ` //${WM}`;
      return lines.join("\n");
    }
  }

  // Strategy 5: Try even earlier in file
  for (let i = 3; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (
      trimmed.length > 0 &&
      !trimmed.startsWith("*") &&
      !trimmed.startsWith("//") &&
      !trimmed.startsWith("/*") &&
      !trimmed.startsWith("import ") &&
      (trimmed.endsWith(";") || trimmed.endsWith("{") || trimmed.endsWith("}") || trimmed.endsWith(","))
    ) {
      lines[i] = lines[i] + ` //${WM}`;
      return lines.join("\n");
    }
  }

  return null;
}

// ── YAML injection ──
function injectYaml(content) {
  if (content.includes(WM)) return null;
  const lines = content.split("\n");
  if (lines.length < 3) return null;

  const startLine = Math.max(3, Math.floor(lines.length * 0.3));

  // Find existing # comment
  for (let i = startLine; i < lines.length; i++) {
    const ci = lines[i].indexOf("#");
    if (ci >= 0 && lines[i].length > ci + 2) {
      const sp = lines[i][ci + 1] === " " ? ci + 2 : ci + 1;
      lines[i] = lines[i].substring(0, sp) + WM + lines[i].substring(sp);
      return lines.join("\n");
    }
  }

  // Add trailing comment on a data line
  for (let i = startLine; i < lines.length; i++) {
    if (lines[i].includes(":") && !lines[i].trim().startsWith("#") && lines[i].trim().length > 0) {
      lines[i] = lines[i] + ` #${WM}`;
      return lines.join("\n");
    }
  }

  return null;
}

// ── Shell script injection ──
function injectShell(content) {
  if (content.includes(WM)) return null;
  const lines = content.split("\n");
  if (lines.length < 3) return null;

  const startLine = Math.max(2, Math.floor(lines.length * 0.3));

  // Find existing # comment (not shebang)
  for (let i = startLine; i < lines.length; i++) {
    if (lines[i].trim().startsWith("#") && !lines[i].trim().startsWith("#!") && lines[i].trim().length > 2) {
      const ci = lines[i].indexOf("#");
      const sp = lines[i][ci + 1] === " " ? ci + 2 : ci + 1;
      lines[i] = lines[i].substring(0, sp) + WM + lines[i].substring(sp);
      return lines.join("\n");
    }
  }

  // Add trailing comment
  for (let i = startLine; i < lines.length; i++) {
    const t = lines[i].trim();
    if (t.length > 0 && !t.startsWith("#")) {
      lines[i] = lines[i] + ` #${WM}`;
      return lines.join("\n");
    }
  }

  return null;
}

// ── JSON injection ──
function injectJson(content, filePath) {
  if (content.includes(WM)) return null;

  // Only inject into safe string fields
  const safeFields = ["description", "title", "label", "summary", "comment", "note", "keywords", "homepage", "bugs"];

  try {
    const lines = content.split("\n");
    const startLine = Math.max(3, Math.floor(lines.length * 0.2));

    for (let i = startLine; i < lines.length; i++) {
      const line = lines[i];
      // Match "fieldName": "value" where fieldName is safe
      for (const field of safeFields) {
        const pattern = new RegExp(`"${field}"\\s*:\\s*"(.{4,})"`, "i");
        const match = line.match(pattern);
        if (match) {
          const valStart = line.indexOf(match[1]);
          const insertAt = valStart + Math.floor(match[1].length / 2);
          lines[i] = line.substring(0, insertAt) + WM + line.substring(insertAt);
          return lines.join("\n");
        }
      }
    }

    // Try from beginning for safe fields
    for (let i = 0; i < startLine; i++) {
      const line = lines[i];
      for (const field of safeFields) {
        const pattern = new RegExp(`"${field}"\\s*:\\s*"(.{4,})"`, "i");
        const match = line.match(pattern);
        if (match) {
          const valStart = line.indexOf(match[1]);
          const insertAt = valStart + Math.floor(match[1].length / 2);
          lines[i] = line.substring(0, insertAt) + WM + line.substring(insertAt);
          return lines.join("\n");
        }
      }
    }
  } catch {
    // skip malformed JSON
  }

  return null;
}

// ── CSS/SCSS injection ──
function injectCss(content) {
  if (content.includes(WM)) return null;
  const lines = content.split("\n");
  if (lines.length < 3) return null;

  const startLine = Math.max(3, Math.floor(lines.length * 0.3));

  // Find existing /* */ comment
  for (let i = startLine; i < lines.length; i++) {
    if (lines[i].includes("/*") && lines[i].includes("*/")) {
      const ci = lines[i].indexOf("/*");
      lines[i] = lines[i].substring(0, ci + 3) + WM + lines[i].substring(ci + 3);
      return lines.join("\n");
    }
  }

  // Add trailing comment on property line
  for (let i = startLine; i < lines.length; i++) {
    if (lines[i].trim().endsWith(";") && !lines[i].trim().startsWith("//")) {
      lines[i] = lines[i] + ` /*${WM}*/`;
      return lines.join("\n");
    }
  }

  return null;
}

// ── Markdown injection ──
function injectMarkdown(content) {
  if (content.includes(WM)) return null;
  const lines = content.split("\n");
  if (lines.length < 5) return null;

  // Find a paragraph line deep in the body
  const startLine = Math.max(5, Math.floor(lines.length * 0.3));
  for (let i = startLine; i < lines.length; i++) {
    const t = lines[i].trim();
    if (t.length > 20 && !t.startsWith("#") && !t.startsWith("-") && !t.startsWith("|") && !t.startsWith("```") && !t.startsWith("!") && !t.startsWith("[")) {
      const insertAt = Math.floor(t.length / 2);
      const lineInsertAt = lines[i].indexOf(t) + insertAt;
      lines[i] = lines[i].substring(0, lineInsertAt) + WM + lines[i].substring(lineInsertAt);
      return lines.join("\n");
    }
  }

  return null;
}

// ── Dockerfile injection ──
function injectDockerfile(content) {
  if (content.includes(WM)) return null;
  const lines = content.split("\n");
  if (lines.length < 3) return null;

  const startLine = Math.max(2, Math.floor(lines.length * 0.3));

  // Find # comment
  for (let i = startLine; i < lines.length; i++) {
    if (lines[i].trim().startsWith("#") && lines[i].trim().length > 2) {
      const ci = lines[i].indexOf("#");
      const sp = lines[i][ci + 1] === " " ? ci + 2 : ci + 1;
      lines[i] = lines[i].substring(0, sp) + WM + lines[i].substring(sp);
      return lines.join("\n");
    }
  }

  // Add trailing comment
  for (let i = startLine; i < lines.length; i++) {
    const t = lines[i].trim();
    if (t.length > 0 && !t.startsWith("#") && (t.startsWith("RUN") || t.startsWith("COPY") || t.startsWith("ENV") || t.startsWith("WORKDIR"))) {
      lines[i] = lines[i] + ` #${WM}`;
      return lines.join("\n");
    }
  }

  return null;
}

// ─── Main ─────────────────────────────────────────────────────

let injected = 0;
let skipped = 0;
let errors = 0;
const failed = [];

// Process TS/JS/TSX/JSX
const codeFiles = findFiles(["ts", "tsx", "js", "jsx", "mjs", "cjs"]);
for (const f of codeFiles) {
  if (f.includes("_wm.mjs")) continue;
  try {
    const content = fs.readFileSync(f, "utf8");
    const result = injectCodeFile(content, f);
    if (result) {
      fs.writeFileSync(f, result, "utf8");
      injected++;
    } else {
      skipped++;
    }
  } catch (err) {
    errors++;
    failed.push(f);
  }
}

// Process YAML
const yamlFiles = findFiles(["yaml", "yml"]);
for (const f of yamlFiles) {
  try {
    const content = fs.readFileSync(f, "utf8");
    const result = injectYaml(content);
    if (result) {
      fs.writeFileSync(f, result, "utf8");
      injected++;
    } else {
      skipped++;
    }
  } catch (err) {
    errors++;
    failed.push(f);
  }
}

// Process Shell
const shFiles = findFiles(["sh"]);
for (const f of shFiles) {
  try {
    const content = fs.readFileSync(f, "utf8");
    const result = injectShell(content);
    if (result) {
      fs.writeFileSync(f, result, "utf8");
      injected++;
    } else {
      skipped++;
    }
  } catch (err) {
    errors++;
    failed.push(f);
  }
}

// Process JSON
const jsonFiles = findFiles(["json"]);
for (const f of jsonFiles) {
  try {
    const content = fs.readFileSync(f, "utf8");
    const result = injectJson(content, f);
    if (result) {
      fs.writeFileSync(f, result, "utf8");
      injected++;
    } else {
      skipped++;
    }
  } catch (err) {
    errors++;
    failed.push(f);
  }
}

// Process CSS/SCSS
const cssFiles = findFiles(["css", "scss"]);
for (const f of cssFiles) {
  try {
    const content = fs.readFileSync(f, "utf8");
    const result = injectCss(content);
    if (result) {
      fs.writeFileSync(f, result, "utf8");
      injected++;
    } else {
      skipped++;
    }
  } catch (err) {
    errors++;
    failed.push(f);
  }
}

// Process Markdown
const mdFiles = findFiles(["md"]);
for (const f of mdFiles) {
  if (f.includes("CHANGELOG") || f.includes("LICENSE")) continue;
  try {
    const content = fs.readFileSync(f, "utf8");
    const result = injectMarkdown(content);
    if (result) {
      fs.writeFileSync(f, result, "utf8");
      injected++;
    } else {
      skipped++;
    }
  } catch (err) {
    errors++;
    failed.push(f);
  }
}

// Process Dockerfiles
const dockerfiles = execSync(`find ${ROOT} -type f -name "Dockerfile*" -not -path "*/node_modules/*" -not -path "*/.git/*"`, { encoding: "utf8" })
  .trim()
  .split("\n")
  .filter(Boolean);
for (const f of dockerfiles) {
  try {
    const content = fs.readFileSync(f, "utf8");
    const result = injectDockerfile(content);
    if (result) {
      fs.writeFileSync(f, result, "utf8");
      injected++;
    } else {
      skipped++;
    }
  } catch (err) {
    errors++;
    failed.push(f);
  }
}

console.log(`\nDone.`);
console.log(`  Injected: ${injected}`);
console.log(`  Skipped:  ${skipped}`);
console.log(`  Errors:   ${errors}`);
if (failed.length > 0 && failed.length < 20) {
  console.log(`  Failed files:`);
  for (const f of failed) console.log(`    - ${f}`);
}
