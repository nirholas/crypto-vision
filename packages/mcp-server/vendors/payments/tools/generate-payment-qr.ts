/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
// MCP tool for generating QR codes for payment addresses and payment URIs

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import type { PaymentService } from '../services/payment-service.js';
import type { CurrencyService } from '../services/currency-service.js';
import type { GeneratePaymentQrOutput } from '../types/index.js';
import { getLogger } from '../utils/logger.js';
import {
  generateOptimizedQrCode,
  type ImageProcessingOptions,
} from '../utils/image-utils.js';
import {
  generateGatewayUrlFromWebUrl,
  type EnvironmentConfig,
} from '../utils/url-utils.js';
import { getQrCache } from '../utils/qr-cache.js';

const logger = getLogger();

export const generatePaymentQrTool: Tool = {
  name: 'generate_payment_qr',
  description:
    'Generate QR codes for payment address and/or payment URI from an existing payment. USE THIS WHEN: User wants QR in different size/style than original, User wants only address QR or only payment URI QR (not both), User created payment without QR (include_qr=false) and now needs it, User wants QR for gateway URL (for redirect payments). EXAMPLES: "Generate bigger QR", "Create QR without branding", "I need QR of 500px", "Generate QR for the payment link"',
  inputSchema: {
    type: 'object',
    properties: {
      identifier: {
        type: 'string',
        format: 'uuid',
        description: 'Payment identifier from create_payment response',
      },
      qr_type: {
        type: 'string',
        enum: ['address', 'payment_uri', 'both', 'gateway_url'],
        default: 'both',
        description:
          'Type of QR to generate: "address": Only crypto address (customer must enter amount manually), "payment_uri": Address + amount included (recommended for specific amounts), "both": Generate both types (recommended), "gateway_url": QR of the payment gateway URL (only for redirect payments)',
      },
      size: {
        type: 'integer',
        minimum: 100,
        maximum: 2000,
        default: 512,
        description:
          'QR code size in pixels. Recommended: 512 for mobile/desktop, 800-1200 for print, 1600-2000 for high-quality print',
      },
      style: {
        type: 'string',
        enum: ['basic', 'branded'],
        default: 'branded',
        description:
          'QR code style: "basic": Plain black and white QR, "branded": Includes cryptocurrency logo in center (more professional)',
      },
      branding: {
        type: 'boolean',
        default: true,
        description: 'Include Bitnovo Pay branding at bottom of QR code',
      },
      gateway_environment: {
        type: 'string',
        enum: ['development', 'testing', 'production'],
        description:
          'Environment for gateway URL generation (auto-detected if not specified)',
      },
    },
    required: ['identifier'],
    additionalProperties: false,
  },
};

export class GeneratePaymentQrHandler {
  constructor(
    private readonly paymentService: PaymentService,
    private readonly currencyService: CurrencyService
  ) {}

  async handle(args: unknown): Promise<GeneratePaymentQrOutput> {
    const startTime = Date.now();

    logger.info('Processing generate_payment_qr request', {
      operation: 'generate_payment_qr',
      timestamp: new Date().toISOString(),
    });

    try {
      // Validate input
      const validation = this.validateInput(args);
      if (!validation.success) {
        throw new Error(`Invalid input: ${validation.error}`);
      }

      const {
        identifier,
        qr_type = 'both',
        size = 300,
        style = 'branded',
        branding = true,
        gateway_environment,
      } = validation.data;

      // Get payment status to retrieve address and payment_uri
      const paymentStatus = await this.paymentService.getPaymentStatus({
        identifier,
      });

      // Get original payment data to access address and payment_uri
      const paymentData =
        await this.paymentService.getPaymentDetails(identifier);

      const cache = getQrCache();
      const response: GeneratePaymentQrOutput = {
        identifier,
      };

      // Get currency information for image URL
      const currency = paymentData.currency
        ? await this.currencyService.findCurrency(paymentData.currency)
        : null;

      const qrOptions: ImageProcessingOptions = {
        size,
        includeBranding: branding,
        style,
        currencySymbol: paymentData.currency,
        currencyImageUrl: currency?.network_image || undefined,
        useCache: true,
      };

      // Generate QR codes based on requested type
      if (
        (qr_type === 'address' || qr_type === 'both') &&
        paymentData.address
      ) {
        const cachedAddress = cache.get(
          identifier,
          'address',
          size,
          style,
          branding
        );
        if (cachedAddress) {
          response.qr_address = cachedAddress;
        } else {
          const addressQr = await generateOptimizedQrCode(
            paymentData.address,
            qrOptions
          );
          response.qr_address = {
            data: `data:image/png;base64,${addressQr.buffer.toString('base64')}`,
            format: 'png',
            style,
            dimensions: `${addressQr.width}x${addressQr.height}`,
          };
          cache.set(
            identifier,
            'address',
            size,
            style,
            branding,
            response.qr_address
          );
        }

        logger.debug('Generated optimized address QR code', {
          paymentId: identifier,
          hasAddress: !!paymentData.address,
          style,
          branding,
          size,
          operation: 'generate_qr_address',
        });
      }

      if (
        (qr_type === 'payment_uri' || qr_type === 'both') &&
        paymentData.paymentUri
      ) {
        const cachedPaymentUri = cache.get(
          identifier,
          'payment_uri',
          size,
          style,
          branding
        );
        if (cachedPaymentUri) {
          response.qr_payment_uri = cachedPaymentUri;
        } else {
          const paymentUriQr = await generateOptimizedQrCode(
            paymentData.paymentUri,
            qrOptions
          );
          response.qr_payment_uri = {
            data: `data:image/png;base64,${paymentUriQr.buffer.toString('base64')}`,
            format: 'png',
            style,
            dimensions: `${paymentUriQr.width}x${paymentUriQr.height}`,
          };
          cache.set(
            identifier,
            'payment_uri',
            size,
            style,
            branding,
            response.qr_payment_uri
          );
        }

        logger.debug('Generated optimized payment URI QR code', {
          paymentId: identifier,
          hasPaymentUri: !!paymentData.paymentUri,
          style,
          branding,
          size,
          operation: 'generate_qr_payment_uri',
        });
      }

      // Generate gateway URL QR if requested
      if (qr_type === 'gateway_url') {
        // For gateway URL, we need the web_url from a redirect payment
        if (!paymentData.webUrl) {
          throw new Error(
            'Gateway URL QR generation requires a redirect payment with web_url'
          );
        }

        const gatewayUrl = generateGatewayUrlFromWebUrl(
          paymentData.webUrl,
          gateway_environment as keyof EnvironmentConfig
        );

        if (!gatewayUrl) {
          throw new Error(
            'Failed to generate gateway URL from payment web_url'
          );
        }

        const cachedGatewayUrl = cache.get(
          identifier,
          'gateway_url',
          size,
          style,
          branding
        );
        if (cachedGatewayUrl) {
          response.qr_gateway_url = cachedGatewayUrl;
        } else {
          const gatewayQrOptions: ImageProcessingOptions = {
            size,
            includeBranding: branding,
            style,
            currencySymbol: undefined,
            isGatewayUrl: true,
            useCache: true,
          };

          const gatewayUrlQr = await generateOptimizedQrCode(
            gatewayUrl,
            gatewayQrOptions
          );
          response.qr_gateway_url = {
            data: `data:image/png;base64,${gatewayUrlQr.buffer.toString('base64')}`,
            format: 'png',
            style,
            dimensions: `${gatewayUrlQr.width}x${gatewayUrlQr.height}`,
          };
          cache.set(
            identifier,
            'gateway_url',
            size,
            style,
            branding,
            response.qr_gateway_url
          );
        }

        logger.debug('Generated optimized gateway URL QR code', {
          paymentId: identifier,
          gatewayUrl,
          style,
          branding,
          size,
          gateway_environment,
          operation: 'generate_qr_gateway_url',
        });
      }

      // Validate that we have at least one QR code
      if (
        !response.qr_address &&
        !response.qr_payment_uri &&
        !response.qr_gateway_url
      ) {
        throw new Error(
          'No QR codes could be generated - payment may not have required data (address, payment_uri, or web_url)'
        );
      }

      const duration = Date.now() - startTime;

      logger.info('generate_payment_qr completed successfully', {
        operation: 'generate_payment_qr_success',
        paymentId: identifier,
        qrType: qr_type,
        style,
        branding,
        hasAddressQr: !!response.qr_address,
        hasPaymentUriQr: !!response.qr_payment_uri,
        hasGatewayUrlQr: !!response.qr_gateway_url,
        qrSize: size,
        hasLogo: false, // Logos now come from preloaded assets
        gateway_environment,
        duration,
        timestamp: new Date().toISOString(),
      });

      return response;
    } catch (error) {
      const duration = Date.now() - startTime;

      logger.error('generate_payment_qr failed', error as Error, {
        operation: 'generate_payment_qr_error',
        duration,
        timestamp: new Date().toISOString(),
      });

      // Re-throw the error to be handled by MCP framework
      throw error;
    }
  }

  /**
   * Validate input parameters
   */
  private validateInput(
    args: unknown
  ): { success: true; data: any } | { success: false; error: string } {
    if (!args || typeof args !== 'object') {
      return { success: false, error: 'Input must be an object' };
    }

    const input = args as any;

    // Validate identifier
    if (!input.identifier || typeof input.identifier !== 'string') {
      return {
        success: false,
        error: 'identifier is required and must be a string',
      };
    }

    // Validate UUID format
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(input.identifier)) {
      return { success: false, error: 'identifier must be a valid UUID' };
    }

    // Validate qr_type
    if (
      input.qr_type &&
      !['address', 'payment_uri', 'both', 'gateway_url'].includes(input.qr_type)
    ) {
      return {
        success: false,
        error:
          'qr_type must be one of: address, payment_uri, both, gateway_url',
      };
    }

    // Validate size
    if (input.size !== undefined) {
      if (
        typeof input.size !== 'number' ||
        input.size < 100 ||
        input.size > 1000
      ) {
        return {
          success: false,
          error: 'size must be a number between 100 and 1000',
        };
      }
    }

    // Validate style
    if (input.style && !['basic', 'branded'].includes(input.style)) {
      return { success: false, error: 'style must be one of: basic, branded' };
    }

    // Validate branding
    if (input.branding !== undefined && typeof input.branding !== 'boolean') {
      return { success: false, error: 'branding must be a boolean' };
    }

    // Validate gateway_environment
    if (
      input.gateway_environment &&
      !['development', 'testing', 'production'].includes(
        input.gateway_environment
      )
    ) {
      return {
        success: false,
        error:
          'gateway_environment must be one of: development, testing, production',
      };
    }

    return { success: true, data: input };
  }

  /**
   * Validate that the tool response matches the expected schema
   */
  private validateResponse(response: any): boolean {
    if (!response || typeof response !== 'object') {
      return false;
    }

    if (!response.identifier || typeof response.identifier !== 'string') {
      return false;
    }

    // Validate UUID format for identifier
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(response.identifier)) {
      logger.warn('Invalid identifier format in response', {
        identifier: response.identifier,
        operation: 'validate_response',
      });
      return false;
    }

    // Validate that at least one QR code is present
    if (
      !response.qr_address &&
      !response.qr_payment_uri &&
      !response.qr_gateway_url
    ) {
      logger.warn('No QR codes present in response', {
        operation: 'validate_response',
      });
      return false;
    }

    // Validate QR code data structure if present
    if (response.qr_address && !this.validateQrCodeData(response.qr_address)) {
      return false;
    }

    if (
      response.qr_payment_uri &&
      !this.validateQrCodeData(response.qr_payment_uri)
    ) {
      return false;
    }

    if (
      response.qr_gateway_url &&
      !this.validateQrCodeData(response.qr_gateway_url)
    ) {
      return false;
    }

    return true;
  }

  /**
   * Validate QR code data structure
   */
  private validateQrCodeData(qrData: any): boolean {
    if (!qrData || typeof qrData !== 'object') {
      return false;
    }

    if (!qrData.data || typeof qrData.data !== 'string') {
      return false;
    }

    if (qrData.format !== 'png') {
      return false;
    }

    // Validate base64 data URL format
    if (!qrData.data.startsWith('data:image/png;base64,')) {
      logger.warn('Invalid QR code data format', {
        operation: 'validate_qr_code_data',
      });
      return false;
    }

    return true;
  }
}

// Factory function for creating the handler
export function generatePaymentQrHandler(
  paymentService: PaymentService,
  currencyService: CurrencyService
): GeneratePaymentQrHandler {
  return new GeneratePaymentQrHandler(paymentService, currencyService);
}
