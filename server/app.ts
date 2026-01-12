import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { serveStatic } from '@hono/node-server/serve-static';
import { routes } from './routes';
import { errorHandler } from './middleware/errorHandler';
import { rateLimit } from './middleware/rateLimit';
import { testConnection } from './db/client';

export const app = new Hono();

// Global middleware
app.use('*', logger());
app.use('*', cors({
  origin: ['http://localhost:5173', 'http://localhost:4800', 'http://127.0.0.1:5173'],
  credentials: true,
}));
app.use('/api/*', rateLimit);
app.onError(errorHandler);

// Health check
app.get('/health', async (c) => {
  try {
    const dbInfo = await testConnection();
    return c.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      database: {
        connected: true,
        name: dbInfo.db,
        serverTime: dbInfo.now
      }
    });
  } catch (error) {
    return c.json({
      status: 'error',
      timestamp: new Date().toISOString(),
      database: {
        connected: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }, 500);
  }
});

// API routes
app.route('/api', routes);

// Serve static webapp files from webapp/dist
app.use('/*', serveStatic({ root: '../webapp/dist' }));

// SPA fallback - serve index.html for client-side routing
app.get('*', serveStatic({ path: '../webapp/dist/index.html' }));

export default app;
