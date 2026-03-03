/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
// URL utilities for payment gateway URL processing

import { getLogger } from './logger.js';

const logger = getLogger();

/**
 * Configuration for different environments and their base domains
 */
export interface EnvironmentConfig {
  development: string;
  testing: string;
  production: string;
}

/**
 * Default base domains for Bitnovo Pay gateway URLs
 */
export const DEFAULT_GATEWAY_DOMAINS: EnvironmentConfig = {
  development: 'dev-paytest.bitnovo.com',
  testing: 'paytest.bitnovo.com',
  production: 'pay.bitnovo.com',
};

/**
 * Extract short identifier from a Bitnovo payment web URL
 *
 * Examples:
 * - "https://pay.bitnovo.com/abcd1234/" -> "abcd1234"
 * - "https://dev-paytest.bitnovo.com/xyz789/" -> "xyz789"
 *
 * @param webUrl - The full web URL from payment response
 * @returns The extracted short identifier or null if not found
 */
export function extractShortIdentifierFromUrl(webUrl: string): string | null {
  try {
    const url = new URL(webUrl);
    const pathSegments = url.pathname
      .split('/')
      .filter(segment => segment.length > 0);

    if (pathSegments.length === 0) {
      logger.warn('No path segments found in web URL', {
        webUrl,
        operation: 'extract_short_identifier',
      });
      return null;
    }

    // The short identifier should be the first (and typically only) path segment
    const shortIdentifier = pathSegments[0];

    // Additional safety check - should not happen due to length check above
    if (!shortIdentifier) {
      logger.warn('Empty short identifier from path segments', {
        webUrl,
        operation: 'extract_short_identifier_empty',
      });
      return null;
    }

    // Basic validation: short identifier should be alphanumeric and reasonable length
    if (
      !/^[a-zA-Z0-9]+$/.test(shortIdentifier) ||
      shortIdentifier.length < 4 ||
      shortIdentifier.length > 20
    ) {
      logger.warn('Invalid short identifier format', {
        shortIdentifier,
        webUrl,
        operation: 'extract_short_identifier_validation',
      });
      return null;
    }

    logger.debug('Successfully extracted short identifier', {
      shortIdentifier,
      webUrl,
      operation: 'extract_short_identifier_success',
    });

    return shortIdentifier;
  } catch (error) {
    logger.error(
      'Failed to parse web URL for short identifier extraction',
      error as Error,
      {
        webUrl,
        operation: 'extract_short_identifier_error',
      }
    );
    return null;
  }
}

/**
 * Determine the appropriate environment based on the base URL configuration
 *
 * @param baseUrl - The base URL from configuration (e.g., UNIVERSAL_CRYPTO_BASE_URL)
 * @returns The environment type
 */
export function determineEnvironment(baseUrl: string): keyof EnvironmentConfig {
  const url = baseUrl.toLowerCase();

  if (url.includes('dev') || url.includes('development')) {
    return 'development';
  } else if (url.includes('test') || url.includes('staging')) {
    return 'testing';
  } else {
    return 'production';
  }
}

/**
 * Generate a payment gateway URL using short identifier
 *
 * @param shortIdentifier - The short identifier extracted from payment
 * @param environment - The target environment (defaults to auto-detect from process.env)
 * @param customDomains - Optional custom domain configuration
 * @returns The complete gateway URL
 */
export function generateGatewayUrl(
  shortIdentifier: string,
  environment?: keyof EnvironmentConfig,
  customDomains?: Partial<EnvironmentConfig>
): string {
  // Auto-detect environment if not provided
  if (!environment) {
    const baseUrl = process.env.UNIVERSAL_CRYPTO_BASE_URL || '';
    environment = determineEnvironment(baseUrl);
  }

  // Use custom domains or fall back to defaults
  const domains = { ...DEFAULT_GATEWAY_DOMAINS, ...customDomains };
  const baseDomain = domains[environment];

  const gatewayUrl = `https://${baseDomain}/${shortIdentifier}`;

  logger.debug('Generated gateway URL', {
    shortIdentifier,
    environment,
    baseDomain,
    gatewayUrl,
    operation: 'generate_gateway_url',
  });

  return gatewayUrl;
}

/**
 * Generate gateway URL directly from payment web URL
 *
 * This is a convenience function that combines extraction and generation
 *
 * @param webUrl - The original web URL from payment response
 * @param environment - Optional environment override
 * @param customDomains - Optional custom domain configuration
 * @returns The gateway URL or null if extraction fails
 */
export function generateGatewayUrlFromWebUrl(
  webUrl: string,
  environment?: keyof EnvironmentConfig,
  customDomains?: Partial<EnvironmentConfig>
): string | null {
  const shortIdentifier = extractShortIdentifierFromUrl(webUrl);

  if (!shortIdentifier) {
    logger.warn('Could not extract short identifier from web URL', {
      webUrl,
      operation: 'generate_gateway_url_from_web_url',
    });
    return null;
  }

  return generateGatewayUrl(shortIdentifier, environment, customDomains);
}

/**
 * Validate that a URL appears to be a valid Bitnovo payment gateway URL
 *
 * @param url - The URL to validate
 * @returns True if the URL appears to be a valid gateway URL
 */
export function isValidGatewayUrl(url: string): boolean {
  try {
    const urlObj = new URL(url);

    // Check if domain matches known Bitnovo domains
    const isKnownDomain = Object.values(DEFAULT_GATEWAY_DOMAINS).some(domain =>
      urlObj.hostname.includes(domain.replace('https://', ''))
    );

    if (!isKnownDomain) {
      return false;
    }

    // Check path structure
    const pathSegments = urlObj.pathname
      .split('/')
      .filter(segment => segment.length > 0);
    if (pathSegments.length !== 1) {
      return false;
    }

    // Validate short identifier format
    const shortIdentifier = pathSegments[0];
    if (!shortIdentifier) {
      return false;
    }

    return (
      /^[a-zA-Z0-9]+$/.test(shortIdentifier) &&
      shortIdentifier.length >= 4 &&
      shortIdentifier.length <= 20
    );
  } catch {
    return false;
  }
}

/**
 * Get the base domain for the current environment
 *
 * @param customDomains - Optional custom domain configuration
 * @returns The base domain string
 */
export function getCurrentEnvironmentDomain(
  customDomains?: Partial<EnvironmentConfig>
): string {
  const baseUrl = process.env.UNIVERSAL_CRYPTO_BASE_URL || '';
  const environment = determineEnvironment(baseUrl);
  const domains = { ...DEFAULT_GATEWAY_DOMAINS, ...customDomains };

  return domains[environment];
}

/**
 * Create a short URL for sharing (for display purposes)
 *
 * @param gatewayUrl - The full gateway URL
 * @returns A shortened version for display
 */
export function createDisplayUrl(gatewayUrl: string): string {
  try {
    const url = new URL(gatewayUrl);
    return `${url.hostname}${url.pathname}`;
  } catch {
    return gatewayUrl;
  }
}
