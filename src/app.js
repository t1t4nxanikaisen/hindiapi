import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { config } from 'dotenv';
import { rateLimiter } from 'hono-rate-limiter';
import { swaggerUI } from '@hono/swagger-ui';

import hiAnimeRoutes from './routes/routes.js';

import { AppError } from './utils/errors.js';
import { fail } from './utils/response.js';
import hianimeApiDocs from './utils/swaggerUi.js';
import { logger } from 'hono/logger';

config(); // load environment variables

const app = new Hono();

const origins = process.env.ORIGIN ? process.env.ORIGIN.split(',') : '*';

// CORS Middleware
app.use(
  '*',
  cors({
    origin: origins,
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: '*',
  })
);

// Rate Limiting Middleware
app.use(
  rateLimiter({
    windowMs: process.env.RATE_LIMIT_WINDOW_MS || 60000,
    limit: process.env.RATE_LIMIT_LIMIT || 100,
    standardHeaders: 'draft-6',
    keyGenerator: (c) => c.req.ip, // rate limit per IP
  })
);

// Logger for all API routes
app.use('/api/v1/*', logger());

// Health check endpoints
app.get('/', (c) => {
  c.status(200);
  return c.text('Welcome to the Hindi Anime API 🎉. Hit /api/v1 for documentation');
});

app.get('/ping', (c) => c.text('pong'));

// Main API routes
app.route('/api/v1', hiAnimeRoutes);

// Swagger Documentation
app.get('/doc', (c) => c.json(hianimeApiDocs));
app.get('/ui', swaggerUI({ url: '/doc' }));

// Global Error Handler
app.onError((err, c) => {
  if (err instanceof AppError) {
    return fail(c, err.message, err.statusCode, err.details);
  }
  console.error('Unexpected Error: ' + err.message);
  return fail(c, 'Something went wrong on the server', 500);
});

export default app;
