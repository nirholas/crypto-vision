import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { secureHeaders } from 'hono/secure-headers';
import { bodyLimit } from 'hono/body-limit';

import { Facilitator } from './core/facilitator.js';
import { loadConfig } from './config/env.js';
import { createVerifyRoute } from './routes/verify.js';
import { createSettleRoute } from './routes/settle.js';
import { createHealthRoute } from './routes/health.js';
import { createInfoRoute } from './routes/info.js';
import { createSupportedRoute } from './routes/supported.js';
import { corsMiddleware } from './middleware/cors.js';
import { rateLimitMiddleware } from './middleware/rateLimit.js';
import { logger } from './utils/logger.js';

const config = loadConfig();
const facilitator = new Facilitator(config);

const app = new Hono();

// Global middleware
app.use('*', secureHeaders());
app.use('*', corsMiddleware(config.corsOrigins));
app.use('/verify', bodyLimit({ maxSize: 10 * 1024 }));
app.use('/settle', bodyLimit({ maxSize: 10 * 1024 }));
app.use('/verify', rateLimitMiddleware());
app.use('/settle', rateLimitMiddleware());

// Routes
app.route('/verify', createVerifyRoute(facilitator));
app.route('/settle', createSettleRoute(facilitator));
app.route('/health', createHealthRoute(config));
app.route('/info', createInfoRoute(facilitator, config));
app.route('/supported', createSupportedRoute(config));

// Root redirect
app.get('/', (c) => c.json({
  name: 'SperaxOS x402 Facilitator',
  docs: 'https://github.com/nirholas/x402-facilitator',
  endpoints: ['/verify', '/settle', '/health', '/info', '/supported'],
}));

// 404
app.notFound((c) => c.json({ error: 'Not found' }, 404));

// Error handler
app.onError((err, c) => {
  logger.error({ error: err.message }, 'Unhandled error');
  return c.json({ error: 'Internal server error' }, 500);
});

logger.info({ port: config.port, host: config.host }, 'Starting x402 facilitator');

serve({
  fetch: app.fetch,
  port: config.port,
  hostname: config.host,
});

logger.info(
  { address: facilitator.getAddress() },
  `x402 facilitator running at http://${config.host}:${config.port}`,
);
