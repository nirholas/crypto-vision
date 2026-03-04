'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

/**
 * Pure-JS drop-in replacement for bigint-buffer.
 *
 * The original package uses a native C++ addon that is vulnerable to a buffer
 * overflow (GHSA-3gc7-fjrx-p6mg). Since Node ≥ 10.4 supports native BigInt,
 * the native addon is unnecessary — this module implements the same four
 * functions in safe JavaScript with proper bounds checking.
 */

/**
 * Convert a little-endian buffer into a BigInt.
 * @param {Buffer} buf The little-endian buffer to convert
 * @returns {bigint} A BigInt with the little-endian representation of buf.
 */
function toBigIntLE(buf) {
  if (buf.length === 0) return BigInt(0);
  const reversed = Buffer.from(buf);
  reversed.reverse();
  const hex = reversed.toString('hex');
  return BigInt(`0x${hex}`);
}

/**
 * Convert a big-endian buffer into a BigInt.
 * @param {Buffer} buf The big-endian buffer to convert.
 * @returns {bigint} A BigInt with the big-endian representation of buf.
 */
function toBigIntBE(buf) {
  if (buf.length === 0) return BigInt(0);
  const hex = buf.toString('hex');
  return BigInt(`0x${hex}`);
}

/**
 * Convert a BigInt to a little-endian buffer.
 * @param {bigint} num   The BigInt to convert.
 * @param {number} width The number of bytes that the resulting buffer should be.
 * @returns {Buffer} A little-endian buffer representation of num.
 */
function toBufferLE(num, width) {
  if (typeof width !== 'number' || width < 0) {
    throw new RangeError('width must be a non-negative number');
  }
  const hex = num.toString(16);
  const buffer = Buffer.from(
    hex.padStart(width * 2, '0').slice(0, width * 2),
    'hex',
  );
  buffer.reverse();
  return buffer;
}

/**
 * Convert a BigInt to a big-endian buffer.
 * @param {bigint} num   The BigInt to convert.
 * @param {number} width The number of bytes that the resulting buffer should be.
 * @returns {Buffer} A big-endian buffer representation of num.
 */
function toBufferBE(num, width) {
  if (typeof width !== 'number' || width < 0) {
    throw new RangeError('width must be a non-negative number');
  }
  const hex = num.toString(16);
  return Buffer.from(
    hex.padStart(width * 2, '0').slice(0, width * 2),
    'hex',
  );
}

exports.toBigIntLE = toBigIntLE;
exports.toBigIntBE = toBigIntBE;
exports.toBufferLE = toBufferLE;
exports.toBufferBE = toBufferBE;
