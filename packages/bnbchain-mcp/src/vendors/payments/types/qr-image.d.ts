/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
// Type definitions for qr-image module

declare module 'qr-image' {
  export interface QrImageOptions {
    ec_level?: 'L' | 'M' | 'Q' | 'H';
    type?: 'png' | 'svg' | 'pdf' | 'eps';
    size?: number;
    margin?: number;
    customize?: (qr: any) => void;
  }

  export function image(
    text: string,
    options?: QrImageOptions
  ): NodeJS.ReadableStream;
  export function imageSync(text: string, options?: QrImageOptions): Buffer;
  export function svgObject(text: string, options?: QrImageOptions): any;
}
