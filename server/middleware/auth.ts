import { Context, Next } from 'hono';
import { verifyAccessToken, TokenPayload } from '../services/auth';

// Extend Hono's context to include user
declare module 'hono' {
  interface ContextVariableMap {
    user: TokenPayload | null;
  }
}

/**
 * Required auth middleware - returns 401 if not authenticated
 */
export async function requireAuth(c: Context, next: Next) {
  const authHeader = c.req.header('Authorization');

  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ error: 'Authorization required' }, 401);
  }

  try {
    const token = authHeader.slice(7);
    const user = await verifyAccessToken(token);
    c.set('user', user);
    await next();
  } catch (error) {
    return c.json({ error: 'Invalid or expired token' }, 401);
  }
}

/**
 * Optional auth middleware - attaches user if token present, continues either way
 * Use this for endpoints that work for both anonymous and authenticated users
 */
export async function optionalAuth(c: Context, next: Next) {
  const authHeader = c.req.header('Authorization');

  if (authHeader?.startsWith('Bearer ')) {
    try {
      const token = authHeader.slice(7);
      const user = await verifyAccessToken(token);
      c.set('user', user);
    } catch {
      // Invalid token, continue as anonymous
      c.set('user', null);
    }
  } else {
    c.set('user', null);
  }

  await next();
}

/**
 * Get current user from context (may be null)
 */
export function getCurrentUser(c: Context): TokenPayload | null {
  return c.get('user') || null;
}

/**
 * Get current user ID from context (throws if not authenticated)
 */
export function requireUserId(c: Context): string {
  const user = c.get('user');
  if (!user) {
    throw new Error('User not authenticated');
  }
  return user.userId;
}
