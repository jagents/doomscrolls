import type { Context, Next } from 'hono';

// Simple in-memory rate limiting (replace with Redis for production)
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();
const DAILY_LIMIT = 1000; // Generous for Phase 1

export async function rateLimit(c: Context, next: Next) {
  const deviceId = c.req.header('X-Device-ID') || 'anonymous';
  const today = new Date().toISOString().split('T')[0];
  const key = `${deviceId}:${today}`;

  const now = Date.now();
  const record = rateLimitStore.get(key);

  if (!record || record.resetAt < now) {
    rateLimitStore.set(key, { count: 1, resetAt: now + 86400000 });
  } else if (record.count >= DAILY_LIMIT) {
    return c.json({
      error: 'Daily limit exceeded',
      limit: DAILY_LIMIT,
      resetAt: new Date(record.resetAt).toISOString(),
    }, 429);
  } else {
    record.count++;
  }

  c.header('X-RateLimit-Remaining', String(DAILY_LIMIT - (rateLimitStore.get(key)?.count || 1)));
  await next();
}
