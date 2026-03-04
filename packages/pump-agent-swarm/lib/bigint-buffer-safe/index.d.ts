/**
 * Pure-JS drop-in replacement for bigint-buffer.
 * Eliminates GHSA-3gc7-fjrx-p6mg (native C++ buffer overflow).
 */

/** Convert a little-endian buffer into a BigInt. */
export function toBigIntLE(buf: Buffer): bigint;

/** Convert a big-endian buffer into a BigInt. */
export function toBigIntBE(buf: Buffer): bigint;

/** Convert a BigInt to a little-endian buffer. */
export function toBufferLE(num: bigint, width: number): Buffer;

/** Convert a BigInt to a big-endian buffer. */
export function toBufferBE(num: bigint, width: number): Buffer;
