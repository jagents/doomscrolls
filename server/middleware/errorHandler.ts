import type { Context } from 'hono';

export function errorHandler(err: Error, c: Context) {
  console.error('API Error:', err);

  return c.json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined,
  }, 500);
}
