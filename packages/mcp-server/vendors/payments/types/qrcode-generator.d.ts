/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
// Type definitions for qrcode-generator module

declare module 'qrcode-generator' {
  interface QRCode {
    addData(data: string): void;
    make(): void;
    createDataURL(cellSize?: number, margin?: number): string;
    createImgTag(cellSize?: number, margin?: number, alt?: string): string;
    createSvgTag(cellSize?: number, margin?: number): string;
    getModuleCount(): number;
    isDark(row: number, col: number): boolean;
  }

  type ErrorCorrectionLevel = 'L' | 'M' | 'Q' | 'H';

  function qrcode(
    typeNumber: number,
    errorCorrectionLevel: ErrorCorrectionLevel
  ): QRCode;

  export = qrcode;
}
