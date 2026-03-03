/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
// Ultra-fast QR code generation with Sharp overlay (~10ms total)

import QRCodeGenerator from 'qrcode-generator';
import sharp from 'sharp';
import axios from 'axios';
import { readFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { getLogger } from './logger.js';
import { getQrCache } from './qr-cache.js';

const logger = getLogger();

// Get current file directory for resolving asset paths
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export interface ImageProcessingOptions {
  size: number;
  includeBranding: boolean;
  style: 'basic' | 'branded';
  currencySymbol?: string;
  currencyImageUrl?: string;
  isGatewayUrl?: boolean;
  useCache?: boolean;
}

export interface ProcessedQrResult {
  buffer: Buffer;
  width: number;
  height: number;
}

// Cached Bitnovo Pay logo for payment links
let bitnovoLogo: Buffer | null = null;

// Cache for downloaded cryptocurrency logos
const logoCache = new Map<string, Buffer>();

/**
 * Download and cache cryptocurrency logo from URL
 */
async function downloadCryptoLogo(
  imageUrl: string,
  currencySymbol?: string
): Promise<Buffer | null> {
  const startTime = process.hrtime.bigint();

  try {
    // Check cache first
    const cacheKey = currencySymbol || imageUrl;
    if (logoCache.has(cacheKey)) {
      logger.debug('Using cached crypto logo', {
        currency: currencySymbol,
        cacheKey,
        operation: 'download_crypto_logo_cache_hit',
      });
      return logoCache.get(cacheKey)!;
    }

    logger.debug('Downloading crypto logo', {
      imageUrl,
      currency: currencySymbol,
      operation: 'download_crypto_logo_start',
    });

    // Download image with timeout
    const response = await axios.get(imageUrl, {
      responseType: 'arraybuffer',
      timeout: 5000,
      headers: {
        'User-Agent': 'MCP-Bitnovo-Pay/1.0.0',
        Accept: 'image/*',
      },
    });

    if (response.status !== 200) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    let buffer = Buffer.from(response.data);

    // Optimize image with Sharp (resize to 100x100 for logo use)
    try {
      const optimizedBuffer = await sharp(buffer)
        .resize(100, 100, {
          fit: 'contain',
          kernel: 'lanczos3',
          background: { r: 0, g: 0, b: 0, alpha: 0 },
        })
        .png({
          compressionLevel: 6,
          quality: 100,
          adaptiveFiltering: true,
        })
        .toBuffer();

      buffer = optimizedBuffer;
    } catch (optimizeError) {
      logger.warn('Failed to optimize crypto logo, using original', {
        currency: currencySymbol,
        error: (optimizeError as Error).message,
        operation: 'download_crypto_logo_optimize_fallback',
      });
    }

    // Cache the result
    logoCache.set(cacheKey, buffer);

    const endTime = process.hrtime.bigint();
    const durationMs = Number(endTime - startTime) / 1_000_000;

    logger.debug('Crypto logo downloaded and cached', {
      currency: currencySymbol,
      imageUrl,
      size: buffer.length,
      duration: durationMs,
      operation: 'download_crypto_logo_success',
    });

    return buffer;
  } catch (error) {
    const endTime = process.hrtime.bigint();
    const durationMs = Number(endTime - startTime) / 1_000_000;

    logger.warn('Failed to download crypto logo', {
      currency: currencySymbol,
      imageUrl,
      error: (error as Error).message,
      duration: durationMs,
      operation: 'download_crypto_logo_error',
    });

    return null;
  }
}

/**
 * Initialize Bitnovo logo for payment links from SVG asset file
 */
async function initializeBitnovoLogo(): Promise<void> {
  try {
    // Resolve path to UniversalCrypto.svg asset
    // When running from src/ (dev): ../assets/UniversalCrypto.svg
    // When running from dist/ (prod): ../assets/UniversalCrypto.svg
    const logoPath = join(__dirname, '..', 'assets', 'UniversalCrypto.svg');

    logger.debug('Loading Bitnovo logo from file', {
      logoPath,
      operation: 'init_bitnovo_logo_load',
    });

    // Read SVG file from filesystem
    const svgBuffer = await readFile(logoPath);

    // Convert SVG to PNG buffer using Sharp (resize to 100x100 for QR overlay)
    bitnovoLogo = await sharp(svgBuffer)
      .resize(100, 100, {
        fit: 'contain',
        kernel: 'lanczos3',
        background: { r: 255, g: 255, b: 255, alpha: 0 },
      })
      .png({
        compressionLevel: 6,
        quality: 100,
        adaptiveFiltering: true,
      })
      .toBuffer();

    logger.debug('Bitnovo logo initialized from SVG file', {
      logoSize: bitnovoLogo.length,
      logoPath,
      operation: 'init_bitnovo_logo',
    });
  } catch (error) {
    logger.warn('Failed to initialize Bitnovo logo from file', {
      error: (error as Error).message,
      operation: 'init_bitnovo_logo_error',
    });

    // Fallback: create a simple logo if file read fails
    try {
      const fallbackSvg = `
        <svg width="100" height="100" xmlns="http://www.w3.org/2000/svg">
          <circle cx="50" cy="50" r="50" fill="#0066cc"/>
          <text x="50" y="60" font-family="Arial, sans-serif" font-size="28" font-weight="bold"
                fill="white" text-anchor="middle">B</text>
        </svg>`;

      bitnovoLogo = await sharp(Buffer.from(fallbackSvg))
        .resize(100, 100, {
          kernel: 'lanczos3',
        })
        .png({
          compressionLevel: 6,
          quality: 100,
          adaptiveFiltering: true,
        })
        .toBuffer();

      logger.debug('Bitnovo logo initialized with fallback SVG', {
        logoSize: bitnovoLogo.length,
        operation: 'init_bitnovo_logo_fallback',
      });
    } catch (fallbackError) {
      logger.error('Failed to initialize fallback logo', fallbackError as Error, {
        operation: 'init_bitnovo_logo_fallback_error',
      });
    }
  }
}

/**
 * Generate ultra-fast QR code using Sharp-compatible method (~5ms)
 */
async function generateUltraFastQR(
  data: string,
  size: number = 300
): Promise<Buffer> {
  const startTime = process.hrtime.bigint();

  try {
    // Create QR matrix with qrcode-generator - Version 0 (auto-detect)
    const qr = QRCodeGenerator(0, 'M'); // Version 0 (auto), Error Correction M
    qr.addData(data);
    qr.make();

    // Get the module count for calculating pixels
    const moduleCount = qr.getModuleCount();
    const pixelSize = Math.floor(size / moduleCount);
    const actualSize = pixelSize * moduleCount;

    // Create SVG for Sharp compatibility
    let svg = `<svg width="${actualSize}" height="${actualSize}" xmlns="http://www.w3.org/2000/svg">`;

    for (let row = 0; row < moduleCount; row++) {
      for (let col = 0; col < moduleCount; col++) {
        if (qr.isDark(row, col)) {
          const x = col * pixelSize;
          const y = row * pixelSize;
          svg += `<rect x="${x}" y="${y}" width="${pixelSize}" height="${pixelSize}" fill="black"/>`;
        }
      }
    }

    svg += '</svg>';

    // Convert SVG to PNG buffer using Sharp with high quality settings
    const buffer = await sharp(Buffer.from(svg))
      .resize(size, size, {
        kernel: 'nearest', // No interpolation for sharp QR edges
        fit: 'fill',
      })
      .png({
        compressionLevel: 6, // Balance between size and quality
        quality: 100, // Maximum quality
        adaptiveFiltering: true,
      })
      .toBuffer();

    const endTime = process.hrtime.bigint();
    const durationMs = Number(endTime - startTime) / 1_000_000;

    logger.debug('Ultra-fast QR generated with Sharp', {
      dataLength: data.length,
      size,
      duration: durationMs,
      moduleCount,
      pixelSize,
      operation: 'generate_ultra_fast_qr',
    });

    return buffer;
  } catch (error) {
    logger.error('Ultra-fast QR generation failed', error as Error, {
      operation: 'generate_ultra_fast_qr_error',
    });
    throw error;
  }
}

/**
 * Add logo overlay to QR code using Sharp (~5ms)
 */
async function addLogoOverlay(
  qrBuffer: Buffer,
  logoBuffer: Buffer,
  size: number
): Promise<ProcessedQrResult> {
  const startTime = process.hrtime.bigint();

  try {
    // Calculate logo dimensions (15% of QR size)
    const logoSize = Math.floor(size * 0.15);
    const logoPosition = Math.floor((size - logoSize) / 2);

    // Create circular white background for logo
    const backgroundSize = logoSize + 8; // 4px padding on each side
    const backgroundPosition = Math.floor((size - backgroundSize) / 2);

    const circleBackground = Buffer.from(
      `<svg width="${backgroundSize}" height="${backgroundSize}">
        <circle cx="${backgroundSize / 2}" cy="${backgroundSize / 2}" r="${backgroundSize / 2}" fill="white"/>
      </svg>`
    );

    // Resize logo to fit with high quality
    const resizedLogo = await sharp(logoBuffer)
      .resize(logoSize, logoSize, {
        kernel: 'lanczos3', // High quality resize for logos
        fit: 'contain',
      })
      .png({
        compressionLevel: 6,
        quality: 100,
        adaptiveFiltering: true,
      })
      .toBuffer();

    // Composite: QR (already PNG from generateUltraFastQR) + circular background + logo
    const resultBuffer = await sharp(qrBuffer)
      .composite([
        {
          input: circleBackground,
          top: backgroundPosition,
          left: backgroundPosition,
        },
        {
          input: resizedLogo,
          top: logoPosition,
          left: logoPosition,
        },
      ])
      .png({
        compressionLevel: 6,
        quality: 100,
        adaptiveFiltering: true,
      })
      .toBuffer();

    const endTime = process.hrtime.bigint();
    const durationMs = Number(endTime - startTime) / 1_000_000;

    logger.debug('Logo overlay completed with Sharp', {
      qrSize: size,
      logoSize,
      duration: durationMs,
      operation: 'add_logo_overlay',
    });

    return {
      buffer: resultBuffer,
      width: size,
      height: size,
    };
  } catch (error) {
    logger.error('Logo overlay failed', error as Error, {
      operation: 'add_logo_overlay_error',
    });

    // Fallback: return QR without logo
    return {
      buffer: qrBuffer,
      width: size,
      height: size,
    };
  }
}

/**
 * Generate optimized QR with logo - ULTRA FAST VERSION (~5.2ms total)
 */
export async function generateOptimizedQrCode(
  data: string,
  options: ImageProcessingOptions
): Promise<ProcessedQrResult> {
  const startTime = process.hrtime.bigint();

  logger.info('Starting ultra-fast QR generation', {
    dataLength: data.length,
    size: options.size,
    style: options.style,
    currencySymbol: options.currencySymbol,
    isGatewayUrl: options.isGatewayUrl,
    operation: 'generate_optimized_qr_start',
  });

  try {
    // STEP 1: Generate ultra-fast base QR (~5ms)
    const baseQR = await generateUltraFastQR(data, options.size);

    // STEP 2: Determine logo type
    let logoBuffer: Buffer | null = null;

    if (options.isGatewayUrl) {
      // Payment link -> Bitnovo logo
      if (!bitnovoLogo) {
        await initializeBitnovoLogo();
      }
      logoBuffer = bitnovoLogo;
    } else if (options.currencyImageUrl) {
      // Onchain payment -> Download crypto logo from API URL
      logoBuffer = await downloadCryptoLogo(
        options.currencyImageUrl,
        options.currencySymbol
      );
    }

    // STEP 3: Add logo overlay (~5ms) or return base QR
    let result: ProcessedQrResult;

    if (logoBuffer && options.style === 'branded') {
      result = await addLogoOverlay(baseQR, logoBuffer, options.size);
    } else {
      result = {
        buffer: baseQR,
        width: options.size,
        height: options.size,
      };
    }

    const endTime = process.hrtime.bigint();
    const totalDuration = Number(endTime - startTime) / 1_000_000;

    logger.info('Ultra-fast QR generation completed', {
      dataLength: data.length,
      size: options.size,
      style: options.style,
      branding: options.includeBranding,
      hasLogo: !!logoBuffer,
      duration: totalDuration,
      operation: 'generate_optimized_qr_success',
    });

    return result;
  } catch (error) {
    const endTime = process.hrtime.bigint();
    const totalDuration = Number(endTime - startTime) / 1_000_000;

    logger.error('Ultra-fast QR generation failed', error as Error, {
      dataLength: data.length,
      size: options.size,
      duration: totalDuration,
      operation: 'generate_optimized_qr_error',
    });

    // Fallback: generate basic QR without logo
    const fallbackQR = await generateUltraFastQR(data, options.size);
    return {
      buffer: fallbackQR,
      width: options.size,
      height: options.size,
    };
  }
}

/**
 * Generate fast QR code (alias for compatibility) - ~5ms
 */
export async function generateFastQrCode(
  data: string,
  size: number,
  errorCorrectionLevel: 'L' | 'M' | 'Q' | 'H' = 'M'
): Promise<Buffer> {
  return await generateUltraFastQR(data, size);
}

/**
 * Initialize fast image processing system
 */
export async function initializeFastImageProcessing(): Promise<void> {
  logger.info('Initializing ultra-fast image processing system', {
    operation: 'init_fast_image_processing',
  });

  await initializeBitnovoLogo();

  logger.info('Ultra-fast image processing system ready', {
    bitnovoLogoReady: !!bitnovoLogo,
    operation: 'init_fast_image_processing_complete',
  });
}
