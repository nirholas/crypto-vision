/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
// MCP tool for creating web redirect payments

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import type { PaymentService } from '../services/payment-service.js';
import type {
  CreatePaymentRedirectOutput,
  QrCodeData,
} from '../types/index.js';
import { getLogger } from '../utils/logger.js';
import {
  generateOptimizedQrCode,
  type ImageProcessingOptions,
} from '../utils/image-utils.js';
import { getQrCache } from '../utils/qr-cache.js';

const logger = getLogger();

export const createPaymentLinkTool: Tool = {
  name: 'create_payment_link',
  description:
    'Create payment link/URL where customer chooses cryptocurrency. USE AS DEFAULT WHEN: User requests payment without specifying crypto. Customer clicks link and selects their preferred cryptocurrency from available options. RESULT: Returns a web_url that you share with your customer. EXAMPLES: "Payment for 50 euros", "Create payment", "Generate QR", "Payment link", "dame el qr para un pago de 24 euros". PREFERRED for all generic payment requests. NOTE: Customer can choose ANY available cryptocurrency in the gateway. IMPORTANT: Only provide url_ok and url_ko if user explicitly requests redirect URLs - DO NOT invent or assume redirect URLs.',
  inputSchema: {
    type: 'object',
    properties: {
      amount_eur: {
        type: 'number',
        minimum: 0.01,
        description: 'Payment amount in EUR (must be positive)',
      },
      url_ok: {
        type: 'string',
        format: 'uri',
        description:
          'SUCCESS redirect URL where customer returns after successful payment. ONLY provide if user explicitly requests redirect functionality. DO NOT use example.com or invent URLs.',
      },
      url_ko: {
        type: 'string',
        format: 'uri',
        description:
          'FAILURE redirect URL where customer returns after payment failure or cancellation. ONLY provide if user explicitly requests redirect functionality. DO NOT use example.com or invent URLs.',
      },
      fiat: {
        type: 'string',
        pattern: '^[A-Z]{3}$',
        description:
          'ISO 4217 currency code for the fiat amount (supports EUR, USD, and other major currencies)',
        default: 'EUR',
      },
      notes: {
        type: 'string',
        maxLength: 256,
        description: 'Optional payment description or reference',
      },
      include_qr: {
        type: 'boolean',
        default: true,
        description:
          'If true, includes QR code for the web URL in the response (RECOMMENDED: always true for immediate use)',
      },
    },
    required: ['amount_eur'],
    additionalProperties: false,
  },
};

export class CreatePaymentLinkHandler {
  constructor(private readonly paymentService: PaymentService) {}

  async handle(args: unknown): Promise<{
    identifier: string;
    web_url: string;
    expires_at?: string;
    qr_web_url?: QrCodeData;
  }> {
    const startTime = Date.now();

    logger.info('Processing create_payment_link request', {
      operation: 'create_payment_link',
      timestamp: new Date().toISOString(),
    });

    try {
      // Validate URLs format before processing (additional validation)
      this.validateInputUrls(args);

      // Create payment through service
      const payment = await this.paymentService.createRedirectPayment(args);

      const response: CreatePaymentRedirectOutput & { expires_at?: string } = {
        identifier: payment.identifier,
        web_url: payment.webUrl!,
        expires_at: payment.expiresAt?.toISOString(),
      };

      // Generate QR code if requested
      const inputArgs = args as { include_qr?: boolean };
      if (inputArgs?.include_qr === true && payment.webUrl) {
        const cache = getQrCache();

        const cachedWebUrl = cache.get(
          payment.identifier,
          'web_url',
          512,
          'branded',
          true
        );
        if (cachedWebUrl) {
          response.qr_web_url = cachedWebUrl;
        } else {
          const qrOptions: ImageProcessingOptions = {
            size: 512,
            includeBranding: true,
            style: 'branded', // Include UniversalCrypto logo for payment links
            currencySymbol: undefined,
            isGatewayUrl: true,
            useCache: true,
          };

          const webUrlQr = await generateOptimizedQrCode(
            payment.webUrl,
            qrOptions
          );
          response.qr_web_url = {
            data: `data:image/png;base64,${webUrlQr.buffer.toString('base64')}`,
            format: 'png',
            style: 'branded',
            dimensions: `${webUrlQr.width}x${webUrlQr.height}`,
          };
          cache.set(
            payment.identifier,
            'web_url',
            512,
            'branded',
            true,
            response.qr_web_url
          );
        }

        logger.debug('Generated optimized QR code for payment link', {
          paymentId: payment.identifier,
          hasWebUrlQr: !!response.qr_web_url,
          operation: 'create_payment_link_qr',
        });
      }

      const duration = Date.now() - startTime;

      logger.info('create_payment_link completed successfully', {
        operation: 'create_payment_link_success',
        paymentId: payment.identifier,
        hasWebUrl: !!payment.webUrl,
        hasExpiration: !!payment.expiresAt,
        duration,
        timestamp: new Date().toISOString(),
      });

      return response;
    } catch (error) {
      const duration = Date.now() - startTime;

      logger.error('create_payment_link failed', error as Error, {
        operation: 'create_payment_link_error',
        duration,
        timestamp: new Date().toISOString(),
      });

      // Re-throw the error to be handled by MCP framework
      throw error;
    }
  }

  /**
   * Additional validation for input URLs
   */
  private validateInputUrls(args: unknown): void {
    if (!args || typeof args !== 'object') {
      return; // Will be caught by main validation
    }

    const input = args as any;

    // Check URL accessibility (basic validation)
    if (input.url_ok && input.url_ko) {
      try {
        const okUrl = new URL(input.url_ok);
        const koUrl = new URL(input.url_ko);

        // Ensure HTTPS for production security
        if (process.env.NODE_ENV === 'production') {
          if (okUrl.protocol !== 'https:') {
            logger.warn('Success URL should use HTTPS in production', {
              url: input.url_ok,
              operation: 'validate_input_urls',
            });
          }

          if (koUrl.protocol !== 'https:') {
            logger.warn('Failure URL should use HTTPS in production', {
              url: input.url_ko,
              operation: 'validate_input_urls',
            });
          }
        }

        // Ensure URLs are different
        if (input.url_ok === input.url_ko) {
          throw new Error('Success and failure URLs must be different');
        }

        // Basic domain validation
        if (okUrl.hostname === 'localhost' || koUrl.hostname === 'localhost') {
          if (process.env.NODE_ENV === 'production') {
            throw new Error('Localhost URLs not allowed in production');
          }
        }
      } catch (error) {
        logger.error('URL validation failed', error as Error, {
          operation: 'validate_input_urls_error',
        });
        throw new Error(`Invalid redirect URLs: ${(error as Error).message}`);
      }
    }
  }
}

// Factory function for creating the handler
export function createPaymentLinkHandler(
  paymentService: PaymentService
): CreatePaymentLinkHandler {
  return new CreatePaymentLinkHandler(paymentService);
}
