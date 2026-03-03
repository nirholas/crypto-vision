/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
// MCP Tool: get_webhook_events
// Retrieves webhook events stored in the event store

import { z } from 'zod';
import { getEventStore } from '../storage/webhook-events.js';
import { getLogger } from '../utils/logger.js';
import type {
  GetWebhookEventsInput,
  GetWebhookEventsOutput,
} from '../types/index.js';

const logger = getLogger();

/**
 * Tool definition for MCP
 */
export const getWebhookEventsTool = {
  name: 'get_webhook_events',
  description:
    'Retrieve webhook events received from Bitnovo Pay. ' +
    'Useful for checking payment status updates in real-time. ' +
    'Can filter by payment identifier or retrieve recent events. ' +
    'Only available when webhook server is enabled.',
  inputSchema: {
    type: 'object',
    properties: {
      identifier: {
        type: 'string',
        description:
          'Optional: Filter events by payment identifier (UUID). ' +
          'If provided, returns only events for this specific payment.',
      },
      limit: {
        type: 'number',
        description:
          'Maximum number of events to return (default: 50, max: 500)',
        minimum: 1,
        maximum: 500,
      },
      validated_only: {
        type: 'boolean',
        description:
          'Optional: If true, returns only events with valid HMAC signatures (default: false)',
      },
    },
  },
} as const;

/**
 * Input validation schema
 */
const GetWebhookEventsInputSchema = z.object({
  identifier: z.string().uuid().optional(),
  limit: z.number().int().min(1).max(500).default(50).optional(),
  validated_only: z.boolean().default(false).optional(),
});

/**
 * Tool handler implementation
 */
export class GetWebhookEventsHandler {
  constructor() {
    logger.debug('GetWebhookEventsHandler initialized', {
      operation: 'get_webhook_events_handler_init',
    });
  }

  /**
   * Handle get_webhook_events tool call
   */
  async handle(args: unknown): Promise<GetWebhookEventsOutput> {
    const startTime = Date.now();

    logger.info('Processing get_webhook_events request', {
      operation: 'get_webhook_events_start',
    });

    try {
      // Validate input
      const input = GetWebhookEventsInputSchema.parse(
        args
      ) as GetWebhookEventsInput;

      logger.debug('Input validated', {
        hasIdentifier: !!input.identifier,
        limit: input.limit,
        validatedOnly: input.validated_only,
        operation: 'get_webhook_events_validated',
      });

      // Get event store
      const eventStore = getEventStore();

      // Retrieve events based on filters
      let events;

      if (input.identifier) {
        // Get events for specific payment
        events = eventStore.getByIdentifier(input.identifier);
      } else if (input.validated_only) {
        // Get only validated events
        events = eventStore.getValidated(input.limit || 50);
      } else {
        // Get recent events
        events = eventStore.getRecent(input.limit || 50);
      }

      // Format response
      const output: GetWebhookEventsOutput = {
        events: events.map(event => ({
          event_id: event.eventId,
          identifier: event.identifier,
          status: event.status as import('../types/index.js').PaymentStatusCode,
          received_at: event.receivedAt.toISOString(),
          validated: event.validated,
          payload: event.payload,
        })),
        total_count: events.length,
      };

      const duration = Date.now() - startTime;

      logger.info('Webhook events retrieved successfully', {
        eventsCount: output.total_count,
        hasIdentifier: !!input.identifier,
        validatedOnly: input.validated_only,
        duration,
        operation: 'get_webhook_events_success',
      });

      return output;
    } catch (error) {
      const duration = Date.now() - startTime;

      if (error instanceof z.ZodError) {
        logger.warn('Invalid input for get_webhook_events', {
          errors: error.errors,
          duration,
          operation: 'get_webhook_events_invalid_input',
        });

        throw new Error(
          `Invalid input: ${error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')}`
        );
      }

      if (error instanceof Error && error.message.includes('not initialized')) {
        logger.error('Event store not initialized', error, {
          duration,
          operation: 'get_webhook_events_store_not_initialized',
        });

        throw new Error(
          'Webhook event store not initialized. Ensure webhooks are enabled (WEBHOOK_ENABLED=true).'
        );
      }

      logger.error('Error retrieving webhook events', error as Error, {
        duration,
        operation: 'get_webhook_events_error',
      });

      throw new Error(
        `Failed to retrieve webhook events: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }
}

/**
 * Create handler instance
 */
export function getWebhookEventsHandler(): GetWebhookEventsHandler {
  return new GetWebhookEventsHandler();
}