/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
// Utility to format MCP responses for better display in Claude Desktop

import type { QrCodeData } from '../types/index.js';

/**
 * MCP Content Block types
 */
interface TextContentBlock {
  type: 'text';
  text: string;
}

interface ImageContentBlock {
  type: 'image';
  data: string; // base64 encoded
  mimeType: string;
}

export type ContentBlock = TextContentBlock | ImageContentBlock;

interface PaymentResponse {
  identifier: string;
  address?: string;
  payment_uri?: string;
  web_url?: string;
  qr_address?: QrCodeData;
  qr_payment_uri?: QrCodeData;
  qr_web_url?: QrCodeData;
  qr_gateway_url?: QrCodeData;
  [key: string]: any;
}

/**
 * Format QR code data for Claude Desktop display
 * Truncates base64 data to prevent overwhelming the UI
 */
function formatQrCodeData(qrData: QrCodeData): any {
  if (!qrData || !qrData.data) {
    return qrData;
  }

  const base64Data = qrData.data;
  const isBase64DataUrl = base64Data.startsWith('data:image/');

  if (isBase64DataUrl && base64Data.length > 100) {
    // Extract just the prefix and show truncated version
    const [prefix, base64Part] = base64Data.split(',');
    const truncatedBase64 = base64Part
      ? base64Part.substring(0, 32) + '...'
      : '';

    return {
      ...qrData,
      data: `${prefix},${truncatedBase64}`,
      data_size: `${Math.round(base64Data.length / 1024)}KB`,
      note: '✅ QR code generated successfully (data truncated for display)',
    };
  }

  return qrData;
}

/**
 * Format payment response for Claude Desktop
 * Makes responses more readable by summarizing large data
 */
export function formatPaymentResponse(response: PaymentResponse): any {
  const formatted = { ...response };

  // Format QR codes if present
  if (formatted.qr_address) {
    formatted.qr_address = formatQrCodeData(formatted.qr_address);
  }

  if (formatted.qr_payment_uri) {
    formatted.qr_payment_uri = formatQrCodeData(formatted.qr_payment_uri);
  }

  if (formatted.qr_web_url) {
    formatted.qr_web_url = formatQrCodeData(formatted.qr_web_url);
  }

  if (formatted.qr_gateway_url) {
    formatted.qr_gateway_url = formatQrCodeData(formatted.qr_gateway_url);
  }

  // Add helpful summary for Claude Desktop
  const qrCount = [
    formatted.qr_address,
    formatted.qr_payment_uri,
    formatted.qr_web_url,
    formatted.qr_gateway_url,
  ].filter(Boolean).length;

  if (qrCount > 0) {
    formatted._summary = {
      payment_id: formatted.identifier,
      qr_codes_generated: qrCount,
      has_address: !!formatted.address,
      has_payment_uri: !!formatted.payment_uri,
      has_web_url: !!formatted.web_url,
      status: '✅ Payment created successfully with QR codes',
      note: 'QR codes are ready to display to customer. Base64 data truncated for readability.',
    };
  }

  return formatted;
}

/**
 * Format any response with potential large data
 */
export function formatMcpResponse(response: any): any {
  if (!response || typeof response !== 'object') {
    return response;
  }

  // Check if this looks like a payment response
  if (
    response.identifier &&
    (response.qr_address || response.qr_payment_uri || response.qr_web_url)
  ) {
    return formatPaymentResponse(response as PaymentResponse);
  }

  // Handle other response types
  return response;
}

/**
 * Extract QR codes from response and convert to image content blocks
 */
export function extractQrImages(response: any): ImageContentBlock[] {
  const images: ImageContentBlock[] = [];

  // Helper function to process QR code data
  const processQrCode = (qrData: QrCodeData, name: string) => {
    if (!qrData || !qrData.data) return;

    // Extract base64 data from data URL
    const dataUrl = qrData.data;
    if (dataUrl.startsWith('data:image/')) {
      const [header, base64Data] = dataUrl.split(',');
      if (header && base64Data) {
        const mimeType = header.match(/data:([^;]+)/)?.[1] || 'image/png';

        images.push({
          type: 'image',
          data: base64Data,
          mimeType: mimeType,
        });
      }
    }
  };

  // Check all possible QR code fields
  if (response.qr_address) {
    processQrCode(response.qr_address, 'Address QR');
  }
  if (response.qr_payment_uri) {
    processQrCode(response.qr_payment_uri, 'Payment URI QR');
  }
  if (response.qr_web_url) {
    processQrCode(response.qr_web_url, 'Web URL QR');
  }
  if (response.qr_gateway_url) {
    processQrCode(response.qr_gateway_url, 'Gateway URL QR');
  }

  return images;
}

/**
 * Create content blocks for MCP response with separate image blocks
 */
export function createMcpContentBlocks(
  response: any,
  toolName: string
): ContentBlock[] {
  const contentBlocks: ContentBlock[] = [];

  // Add summary text (without trying to embed images in markdown)
  const summary = createResponseSummary(response, toolName);
  contentBlocks.push({
    type: 'text',
    text: summary,
  });

  // Extract QR images and add them as separate image content blocks
  const qrImages = extractQrImages(response);

  if (qrImages.length > 0) {
    // Add each QR code as its own image block for proper rendering
    qrImages.forEach((image) => {
      contentBlocks.push(image);
    });
  }

  // Add formatted JSON response (without the base64 QR data to avoid duplication)
  const formattedResponse = formatMcpResponse(response);
  contentBlocks.push({
    type: 'text',
    text: `\`\`\`json\n${JSON.stringify(formattedResponse, null, 2)}\n\`\`\``,
  });

  return contentBlocks;
}

/**
 * Create a user-friendly summary for Claude Desktop
 */
export function createResponseSummary(response: any, toolName: string): string {
  const formatted = formatMcpResponse(response);

  switch (toolName) {
    case 'create_payment_onchain':
      return `✅ **Crypto Payment Created Successfully**

💰 **Payment ID**: ${formatted.identifier}
🏦 **Address**: ${formatted.address || 'Generated'}
💳 **Payment URI**: ${formatted.payment_uri ? '✅ Available' : '❌ Not available'}
📱 **QR Codes**: ${formatted._summary?.qr_codes_generated || 0} generated

${formatted.qr_address ? '📸 **QR with Address**: Ready for customer scan' : ''}
${formatted.qr_payment_uri ? '📸 **QR with Amount**: Ready for customer scan (includes amount)' : ''}

🎯 **Next Steps**: Show the QR code(s) to your customer for payment.

---
*Full payment data available in JSON below (QR base64 truncated for display)*`;

    case 'create_payment_link':
      return `✅ **Payment Link Created Successfully**

💰 **Payment ID**: ${formatted.identifier}
🔗 **Payment Link**: ${formatted.web_url}
📱 **QR Code**: ${formatted.qr_web_url ? '✅ Generated' : '❌ Not requested'}

🎯 **Next Steps**: Share the payment link with your customer via WhatsApp, email, or social media.

---
*Full payment data available in JSON below*`;

    case 'generate_payment_qr':
      return `✅ **QR Codes Generated Successfully**

💰 **Payment ID**: ${formatted.identifier}
📱 **QR Codes Generated**: ${formatted._summary?.qr_codes_generated || 0}

${formatted.qr_address ? '📸 **Address QR**: Ready for scan' : ''}
${formatted.qr_payment_uri ? '📸 **Payment URI QR**: Ready for scan (with amount)' : ''}
${formatted.qr_gateway_url ? '📸 **Gateway URL QR**: Ready for scan' : ''}

🎯 **Next Steps**: Display the QR code(s) to your customer.

---
*Full QR data available in JSON below (base64 truncated for display)*`;

    default:
      return `✅ **${toolName} completed successfully**

---
*Response data available in JSON below*`;
  }
}
