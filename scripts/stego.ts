/**
 * Steganographic message encoder/decoder for source code.
 *
 * Hides encrypted messages inside normal-looking code comments using
 * zero-width Unicode characters. The workflow:
 *
 *   1. Your plaintext is AES-256-GCM encrypted with a passphrase.
 *   2. The ciphertext bytes are converted to binary.
 *   3. Each bit is mapped to an invisible Unicode character:
 *        0 → U+200B  (zero-width space)
 *        1 → U+200C  (zero-width non-joiner)
 *   4. A delimiter U+200D (zero-width joiner) marks start/end.
 *   5. The invisible string is inserted inside a carrier comment.
 *
 * Usage:
 *   tsx scripts/stego.ts encode  --passphrase <key> --message <msg> [--carrier <text>]
 *   tsx scripts/stego.ts decode  --passphrase <key> --input <comment-with-hidden-data>
 *   tsx scripts/stego.ts scan    --passphrase <key> --file <path>
 *   tsx scripts/stego.ts inject  --passphrase <key> --message <msg> --file <path> --line <n> [--carrier <text>]
 */

import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";

// ── Zero-width character alphabet ────────────────────────────────────
const ZW_ZERO = "\u200B"; // zero-width space  → bit 0
const ZW_ONE = "\u200C"; // zero-width non-joiner → bit 1
const ZW_DELIM = "\u200D"; // zero-width joiner → delimiter

// ── Crypto helpers ───────────────────────────────────────────────────

function deriveKey(passphrase: string, salt: Buffer): Buffer {
  return scryptSync(passphrase, salt, 32) as Buffer;
}

function encrypt(plaintext: string, passphrase: string): Buffer {
  const salt = randomBytes(16);
  const key = deriveKey(passphrase, salt);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  // Layout: salt(16) + iv(12) + tag(16) + ciphertext
  return Buffer.concat([salt, iv, tag, encrypted]);
}

function decrypt(packed: Buffer, passphrase: string): string {
  const salt = packed.subarray(0, 16);
  const iv = packed.subarray(16, 28);
  const tag = packed.subarray(28, 44);
  const ciphertext = packed.subarray(44);
  const key = deriveKey(passphrase, salt);
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return decrypted.toString("utf8");
}

// ── Steganography helpers ────────────────────────────────────────────

function bytesToZeroWidth(data: Buffer): string {
  let bits = "";
  for (const byte of data) {
    bits += byte.toString(2).padStart(8, "0");
  }
  return ZW_DELIM + bits.split("").map((b) => (b === "0" ? ZW_ZERO : ZW_ONE)).join("") + ZW_DELIM;
}

function zeroWidthToBytes(hidden: string): Buffer {
  // Strip delimiters
  const inner = hidden.replaceAll(ZW_DELIM, "");
  let bits = "";
  for (const ch of inner) {
    if (ch === ZW_ZERO) bits += "0";
    else if (ch === ZW_ONE) bits += "1";
    // ignore anything else
  }
  // Pad to full byte boundary
  while (bits.length % 8 !== 0) bits += "0";
  const bytes: number[] = [];
  for (let i = 0; i < bits.length; i += 8) {
    bytes.push(parseInt(bits.substring(i, i + 8), 2));
  }
  return Buffer.from(bytes);
}

function embedInCarrier(carrier: string, hiddenPayload: string): string {
  // Insert invisible chars right after the opening "// " of a line comment
  if (carrier.startsWith("// ")) {
    return "// " + hiddenPayload + carrier.slice(3);
  }
  // Or after "/* "
  if (carrier.startsWith("/* ")) {
    return "/* " + hiddenPayload + carrier.slice(3);
  }
  // Fallback: prepend
  return hiddenPayload + carrier;
}

function extractHidden(text: string): string | null {
  const re = new RegExp(`${ZW_DELIM}[${ZW_ZERO}${ZW_ONE}]+${ZW_DELIM}`);
  const match = re.exec(text);
  return match ? match[0] : null;
}

// ── CLI commands ─────────────────────────────────────────────────────

function cmdEncode(passphrase: string, message: string, carrier: string): void {
  const cipherBuf = encrypt(message, passphrase);
  const payload = bytesToZeroWidth(cipherBuf);
  const output = embedInCarrier(carrier, payload);
  console.log("\n📝  Carrier comment (paste this into your code):\n");
  console.log(output);
  console.log(
    `\n🔍  The comment looks like: "${stripZeroWidth(output)}"`,
  );
  console.log(`    Hidden payload: ${cipherBuf.length} encrypted bytes (${payload.length} zero-width chars)`);
}

function cmdDecode(passphrase: string, input: string): void {
  const hidden = extractHidden(input);
  if (!hidden) {
    console.error("❌  No hidden steganographic data found in input.");
    process.exit(1);
  }
  const packed = zeroWidthToBytes(hidden);
  try {
    const plaintext = decrypt(packed, passphrase);
    console.log("\n🔓  Decoded message:\n");
    console.log(plaintext);
  } catch {
    console.error("❌  Decryption failed — wrong passphrase or corrupted data.");
    process.exit(1);
  }
}

function cmdScan(passphrase: string, filePath: string): void {
  const content = readFileSync(filePath, "utf8");
  const lines = content.split("\n");
  let found = 0;

  for (let i = 0; i < lines.length; i++) {
    const hidden = extractHidden(lines[i]);
    if (hidden) {
      found++;
      const packed = zeroWidthToBytes(hidden);
      try {
        const plaintext = decrypt(packed, passphrase);
        console.log(`\n📍  Line ${i + 1}: "${stripZeroWidth(lines[i]).trim()}"`);
        console.log(`    🔓  ${plaintext}`);
      } catch {
        console.log(`\n📍  Line ${i + 1}: "${stripZeroWidth(lines[i]).trim()}"`);
        console.log(`    ❌  Could not decrypt (wrong passphrase?)`);
      }
    }
  }

  if (found === 0) {
    console.log("🔍  No hidden messages found in this file.");
  } else {
    console.log(`\n✅  Found ${found} hidden message(s).`);
  }
}

function cmdInject(
  passphrase: string,
  message: string,
  filePath: string,
  lineNum: number,
  carrier: string,
): void {
  const content = readFileSync(filePath, "utf8");
  const lines = content.split("\n");

  if (lineNum < 1 || lineNum > lines.length + 1) {
    console.error(`❌  Line ${lineNum} is out of range (file has ${lines.length} lines).`);
    process.exit(1);
  }

  const cipherBuf = encrypt(message, passphrase);
  const payload = bytesToZeroWidth(cipherBuf);
  const commentLine = embedInCarrier(carrier, payload);

  // Detect indentation from surrounding lines
  const nearbyLine = lines[Math.min(lineNum - 1, lines.length - 1)];
  const indent = nearbyLine.match(/^(\s*)/)?.[1] ?? "";

  lines.splice(lineNum - 1, 0, indent + commentLine);
  writeFileSync(filePath, lines.join("\n"), "utf8");

  console.log(`✅  Injected hidden message at line ${lineNum} of ${filePath}`);
  console.log(`    Visible as: "${indent}${stripZeroWidth(commentLine)}"`);
}

function stripZeroWidth(s: string): string {
  return s.replaceAll(ZW_ZERO, "").replaceAll(ZW_ONE, "").replaceAll(ZW_DELIM, "");
}

// ── Argument parsing ─────────────────────────────────────────────────

function parseArgs(): {
  command: string;
  passphrase: string;
  message: string;
  carrier: string;
  input: string;
  file: string;
  line: number;
} {
  const args = process.argv.slice(2);
  const command = args[0] ?? "help";
  let passphrase = "";
  let message = "";
  let carrier = "// internal reference";
  let input = "";
  let file = "";
  let line = 1;

  for (let i = 1; i < args.length; i++) {
    switch (args[i]) {
      case "--passphrase":
      case "-p":
        passphrase = args[++i] ?? "";
        break;
      case "--message":
      case "-m":
        message = args[++i] ?? "";
        break;
      case "--carrier":
      case "-c":
        carrier = args[++i] ?? carrier;
        break;
      case "--input":
      case "-i":
        input = args[++i] ?? "";
        break;
      case "--file":
      case "-f":
        file = args[++i] ?? "";
        break;
      case "--line":
      case "-l":
        line = parseInt(args[++i] ?? "1", 10);
        break;
    }
  }

  return { command, passphrase, message, carrier, input, file, line };
}

function printHelp(): void {
  console.log(`
Steganographic Message Tool
============================

Hides AES-256-GCM encrypted messages inside normal-looking code comments
using invisible zero-width Unicode characters.

Commands:

  encode   Encrypt & encode a message into a carrier comment
           tsx scripts/stego.ts encode -p <passphrase> -m <message> [-c <carrier>]

  decode   Decode & decrypt a hidden message from a string
           tsx scripts/stego.ts decode -p <passphrase> -i <string-with-hidden-data>

  scan     Scan a file for hidden messages and decrypt them
           tsx scripts/stego.ts scan -p <passphrase> -f <filepath>

  inject   Inject a hidden message into a file at a specific line
           tsx scripts/stego.ts inject -p <passphrase> -m <message> -f <filepath> -l <line> [-c <carrier>]

Options:
  -p, --passphrase   Encryption passphrase (required)
  -m, --message      Message to hide (encode/inject)
  -c, --carrier      Visible comment text (default: "// internal reference")
  -i, --input        String containing hidden data (decode)
  -f, --file         File path (scan/inject)
  -l, --line         Line number to inject at (inject, default: 1)
`);
}

// ── Main ─────────────────────────────────────────────────────────────

const opts = parseArgs();

switch (opts.command) {
  case "encode":
    if (!opts.passphrase || !opts.message) {
      console.error("❌  --passphrase and --message are required for encode.");
      process.exit(1);
    }
    cmdEncode(opts.passphrase, opts.message, opts.carrier);
    break;

  case "decode":
    if (!opts.passphrase || !opts.input) {
      console.error("❌  --passphrase and --input are required for decode.");
      process.exit(1);
    }
    cmdDecode(opts.passphrase, opts.input);
    break;

  case "scan":
    if (!opts.passphrase || !opts.file) {
      console.error("❌  --passphrase and --file are required for scan.");
      process.exit(1);
    }
    cmdScan(opts.passphrase, opts.file);
    break;

  case "inject":
    if (!opts.passphrase || !opts.message || !opts.file) {
      console.error("❌  --passphrase, --message, and --file are required for inject.");
      process.exit(1);
    }
    cmdInject(opts.passphrase, opts.message, opts.file, opts.line, opts.carrier);
    break;

  default:
    printHelp();
    break;
}
