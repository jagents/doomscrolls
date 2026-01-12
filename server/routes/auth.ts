import { Hono } from 'hono';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import {
  createUser,
  authenticateUser,
  getUserById,
  updateUser,
  changePassword,
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
  revokeRefreshToken,
  revokeAllRefreshTokens,
} from '../services/auth';
import { requireAuth, getCurrentUser } from '../middleware/auth';

const auth = new Hono();

// POST /api/auth/signup - Create new account
auth.post('/signup', async (c) => {
  try {
    const body = await c.req.json();
    const { email, password, displayName } = body;

    if (!email || !password) {
      return c.json({ error: 'Email and password are required' }, 400);
    }

    const user = await createUser(email, password, displayName);

    // Generate tokens
    const accessToken = await generateAccessToken({
      userId: user.id,
      email: user.email,
      displayName: user.displayName || undefined,
    });
    const refreshToken = await generateRefreshToken(user.id);

    // Set refresh token as httpOnly cookie
    setCookie(c, 'refresh_token', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'Lax',
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: '/',
    });

    return c.json({
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
      },
      accessToken,
      expiresIn: 900, // 15 minutes in seconds
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Signup failed';
    return c.json({ error: message }, 400);
  }
});

// POST /api/auth/login - Login with email/password
auth.post('/login', async (c) => {
  try {
    const body = await c.req.json();
    const { email, password } = body;

    if (!email || !password) {
      return c.json({ error: 'Email and password are required' }, 400);
    }

    const user = await authenticateUser(email, password);

    if (!user) {
      return c.json({ error: 'Invalid email or password' }, 401);
    }

    // Generate tokens
    const accessToken = await generateAccessToken({
      userId: user.id,
      email: user.email,
      displayName: user.displayName || undefined,
    });
    const refreshToken = await generateRefreshToken(user.id);

    // Set refresh token as httpOnly cookie
    setCookie(c, 'refresh_token', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'Lax',
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: '/',
    });

    return c.json({
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
      },
      accessToken,
      expiresIn: 900, // 15 minutes in seconds
    });
  } catch (error) {
    console.error('Login error:', error);
    return c.json({ error: 'Login failed' }, 500);
  }
});

// POST /api/auth/logout - Logout and revoke refresh token
auth.post('/logout', requireAuth, async (c) => {
  try {
    const user = getCurrentUser(c);
    const refreshToken = getCookie(c, 'refresh_token');

    if (refreshToken && user) {
      await revokeRefreshToken(user.userId, refreshToken);
    }

    // Clear cookie
    deleteCookie(c, 'refresh_token', { path: '/' });

    return c.json({ success: true });
  } catch (error) {
    console.error('Logout error:', error);
    return c.json({ success: true }); // Still succeed even if revocation fails
  }
});

// POST /api/auth/logout-all - Logout from all devices
auth.post('/logout-all', requireAuth, async (c) => {
  try {
    const user = getCurrentUser(c);
    if (user) {
      await revokeAllRefreshTokens(user.userId);
    }

    deleteCookie(c, 'refresh_token', { path: '/' });

    return c.json({ success: true });
  } catch (error) {
    console.error('Logout all error:', error);
    return c.json({ error: 'Failed to logout from all devices' }, 500);
  }
});

// POST /api/auth/refresh - Get new access token using refresh token
auth.post('/refresh', async (c) => {
  try {
    const refreshToken = getCookie(c, 'refresh_token');

    if (!refreshToken) {
      return c.json({ error: 'No refresh token' }, 401);
    }

    const result = await verifyRefreshToken(refreshToken);

    if (!result) {
      deleteCookie(c, 'refresh_token', { path: '/' });
      return c.json({ error: 'Invalid or expired refresh token' }, 401);
    }

    const user = await getUserById(result.userId);

    if (!user) {
      deleteCookie(c, 'refresh_token', { path: '/' });
      return c.json({ error: 'User not found' }, 401);
    }

    // Generate new access token
    const accessToken = await generateAccessToken({
      userId: user.id,
      email: user.email,
      displayName: user.displayName || undefined,
    });

    return c.json({
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
      },
      accessToken,
      expiresIn: 900,
    });
  } catch (error) {
    console.error('Refresh error:', error);
    return c.json({ error: 'Failed to refresh token' }, 500);
  }
});

// GET /api/auth/me - Get current user
auth.get('/me', requireAuth, async (c) => {
  try {
    const tokenUser = getCurrentUser(c);
    if (!tokenUser) {
      return c.json({ error: 'Not authenticated' }, 401);
    }

    const user = await getUserById(tokenUser.userId);

    if (!user) {
      return c.json({ error: 'User not found' }, 404);
    }

    return c.json({
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
        createdAt: user.createdAt,
        emailVerified: user.emailVerified,
      },
    });
  } catch (error) {
    console.error('Get me error:', error);
    return c.json({ error: 'Failed to get user' }, 500);
  }
});

// PUT /api/auth/me - Update current user profile
auth.put('/me', requireAuth, async (c) => {
  try {
    const tokenUser = getCurrentUser(c);
    if (!tokenUser) {
      return c.json({ error: 'Not authenticated' }, 401);
    }

    const body = await c.req.json();
    const { displayName, avatarUrl } = body;

    const user = await updateUser(tokenUser.userId, { displayName, avatarUrl });

    if (!user) {
      return c.json({ error: 'User not found' }, 404);
    }

    return c.json({
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
      },
    });
  } catch (error) {
    console.error('Update me error:', error);
    return c.json({ error: 'Failed to update user' }, 500);
  }
});

// POST /api/auth/change-password - Change password
auth.post('/change-password', requireAuth, async (c) => {
  try {
    const tokenUser = getCurrentUser(c);
    if (!tokenUser) {
      return c.json({ error: 'Not authenticated' }, 401);
    }

    const body = await c.req.json();
    const { currentPassword, newPassword } = body;

    if (!currentPassword || !newPassword) {
      return c.json({ error: 'Current and new password are required' }, 400);
    }

    const success = await changePassword(tokenUser.userId, currentPassword, newPassword);

    if (!success) {
      return c.json({ error: 'Current password is incorrect' }, 400);
    }

    // Clear refresh token cookie since all sessions are revoked
    deleteCookie(c, 'refresh_token', { path: '/' });

    return c.json({
      success: true,
      message: 'Password changed. Please login again.',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to change password';
    return c.json({ error: message }, 400);
  }
});

export { auth };
