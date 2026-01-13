import bcrypt from 'bcrypt';
import { SignJWT, jwtVerify } from 'jose';
import { sql } from '../db/client';

const SALT_ROUNDS = 12;
const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_EXPIRY = '7d';

// Get secrets from environment
function getJwtSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('JWT_SECRET must be set and at least 32 characters');
  }
  return new TextEncoder().encode(secret);
}

function getRefreshSecret(): Uint8Array {
  const secret = process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('JWT_REFRESH_SECRET must be set and at least 32 characters');
  }
  return new TextEncoder().encode(secret + '_refresh');
}

// Password hashing
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// JWT tokens
export interface TokenPayload {
  userId: string;
  email: string;
  displayName?: string;
}

export async function generateAccessToken(user: TokenPayload): Promise<string> {
  return new SignJWT({
    userId: user.userId,
    email: user.email,
    displayName: user.displayName,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime(ACCESS_TOKEN_EXPIRY)
    .setIssuedAt()
    .sign(getJwtSecret());
}

export async function generateRefreshToken(userId: string): Promise<string> {
  const token = await new SignJWT({
    userId,
    type: 'refresh',
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime(REFRESH_TOKEN_EXPIRY)
    .setIssuedAt()
    .sign(getRefreshSecret());

  // Store hash in database for revocation capability
  const tokenHash = await hashPassword(token);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  await sql`
    INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
    VALUES (${userId}, ${tokenHash}, ${expiresAt})
  `;

  return token;
}

export async function verifyAccessToken(token: string): Promise<TokenPayload> {
  const { payload } = await jwtVerify(token, getJwtSecret());
  return {
    userId: payload.userId as string,
    email: payload.email as string,
    displayName: payload.displayName as string | undefined,
  };
}

export async function verifyRefreshToken(token: string): Promise<{ userId: string } | null> {
  try {
    const { payload } = await jwtVerify(token, getRefreshSecret());

    if (payload.type !== 'refresh') {
      return null;
    }

    const userId = payload.userId as string;

    // Check if token exists and is not revoked
    const tokens = await sql`
      SELECT id, token_hash FROM refresh_tokens
      WHERE user_id = ${userId}
        AND revoked_at IS NULL
        AND expires_at > NOW()
    `;

    // Verify against stored hashes
    for (const t of tokens) {
      const valid = await verifyPassword(token, t.token_hash);
      if (valid) {
        return { userId };
      }
    }

    return null;
  } catch {
    return null;
  }
}

export async function revokeRefreshToken(userId: string, token: string): Promise<void> {
  const tokens = await sql`
    SELECT id, token_hash FROM refresh_tokens
    WHERE user_id = ${userId}
      AND revoked_at IS NULL
  `;

  for (const t of tokens) {
    const valid = await verifyPassword(token, t.token_hash);
    if (valid) {
      await sql`
        UPDATE refresh_tokens
        SET revoked_at = NOW()
        WHERE id = ${t.id}
      `;
      return;
    }
  }
}

export async function revokeAllRefreshTokens(userId: string): Promise<void> {
  await sql`
    UPDATE refresh_tokens
    SET revoked_at = NOW()
    WHERE user_id = ${userId}
      AND revoked_at IS NULL
  `;
}

// User management
export interface User {
  id: string;
  email: string;
  displayName: string | null;
  avatarUrl: string | null;
  createdAt: Date;
  emailVerified: boolean;
}

export async function createUser(
  email: string,
  password: string,
  displayName?: string
): Promise<User> {
  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    throw new Error('Invalid email format');
  }

  // Validate password strength
  if (password.length < 8) {
    throw new Error('Password must be at least 8 characters');
  }
  if (!/[a-z]/.test(password)) {
    throw new Error('Password must contain at least one lowercase letter');
  }
  if (!/[A-Z]/.test(password)) {
    throw new Error('Password must contain at least one uppercase letter');
  }
  if (!/[0-9]/.test(password)) {
    throw new Error('Password must contain at least one number');
  }

  // Check if email already exists
  const [existing] = await sql`
    SELECT id FROM users WHERE LOWER(email) = LOWER(${email})
  `;

  if (existing) {
    throw new Error('Email already registered');
  }

  const passwordHash = await hashPassword(password);

  const [user] = await sql`
    INSERT INTO users (email, password_hash, display_name)
    VALUES (${email.toLowerCase()}, ${passwordHash}, ${displayName || null})
    RETURNING id, email, display_name, avatar_url, created_at, email_verified
  `;

  // Create initial user stats record
  await sql`
    INSERT INTO user_stats (user_id)
    VALUES (${user.id})
  `;

  return {
    id: user.id,
    email: user.email,
    displayName: user.display_name,
    avatarUrl: user.avatar_url,
    createdAt: user.created_at,
    emailVerified: user.email_verified,
  };
}

export async function authenticateUser(
  email: string,
  password: string
): Promise<User | null> {
  const [user] = await sql`
    SELECT id, email, password_hash, display_name, avatar_url, created_at, email_verified
    FROM users
    WHERE LOWER(email) = LOWER(${email})
  `;

  if (!user) {
    return null;
  }

  const valid = await verifyPassword(password, user.password_hash);
  if (!valid) {
    return null;
  }

  // Update last login
  await sql`
    UPDATE users SET last_login_at = NOW() WHERE id = ${user.id}
  `;

  return {
    id: user.id,
    email: user.email,
    displayName: user.display_name,
    avatarUrl: user.avatar_url,
    createdAt: user.created_at,
    emailVerified: user.email_verified,
  };
}

export async function getUserById(userId: string): Promise<User | null> {
  const [user] = await sql`
    SELECT id, email, display_name, avatar_url, created_at, email_verified
    FROM users
    WHERE id = ${userId}
  `;

  if (!user) {
    return null;
  }

  return {
    id: user.id,
    email: user.email,
    displayName: user.display_name,
    avatarUrl: user.avatar_url,
    createdAt: user.created_at,
    emailVerified: user.email_verified,
  };
}

export async function updateUser(
  userId: string,
  updates: { displayName?: string; avatarUrl?: string }
): Promise<User | null> {
  const setClauses = [];
  const values: any[] = [];

  if (updates.displayName !== undefined) {
    setClauses.push('display_name = $' + (values.length + 1));
    values.push(updates.displayName);
  }

  if (updates.avatarUrl !== undefined) {
    setClauses.push('avatar_url = $' + (values.length + 1));
    values.push(updates.avatarUrl);
  }

  if (setClauses.length === 0) {
    return getUserById(userId);
  }

  const [user] = await sql`
    UPDATE users
    SET display_name = COALESCE(${updates.displayName}, display_name),
        avatar_url = COALESCE(${updates.avatarUrl}, avatar_url),
        updated_at = NOW()
    WHERE id = ${userId}
    RETURNING id, email, display_name, avatar_url, created_at, email_verified
  `;

  if (!user) {
    return null;
  }

  return {
    id: user.id,
    email: user.email,
    displayName: user.display_name,
    avatarUrl: user.avatar_url,
    createdAt: user.created_at,
    emailVerified: user.email_verified,
  };
}

export async function changePassword(
  userId: string,
  currentPassword: string,
  newPassword: string
): Promise<boolean> {
  const [user] = await sql`
    SELECT password_hash FROM users WHERE id = ${userId}
  `;

  if (!user) {
    return false;
  }

  const valid = await verifyPassword(currentPassword, user.password_hash);
  if (!valid) {
    return false;
  }

  // Validate new password
  if (newPassword.length < 8) {
    throw new Error('Password must be at least 8 characters');
  }
  if (!/[a-z]/.test(newPassword)) {
    throw new Error('Password must contain at least one lowercase letter');
  }
  if (!/[A-Z]/.test(newPassword)) {
    throw new Error('Password must contain at least one uppercase letter');
  }
  if (!/[0-9]/.test(newPassword)) {
    throw new Error('Password must contain at least one number');
  }

  const newHash = await hashPassword(newPassword);

  await sql`
    UPDATE users
    SET password_hash = ${newHash}, updated_at = NOW()
    WHERE id = ${userId}
  `;

  // Revoke all refresh tokens on password change
  await revokeAllRefreshTokens(userId);

  return true;
}

// Delete user account and all associated data
export async function deleteUser(userId: string): Promise<void> {
  // Delete in order to handle any tables without CASCADE
  // user_taste_vectors - may not exist yet
  try {
    await sql`DELETE FROM user_taste_vectors WHERE user_id = ${userId}`;
  } catch {
    // Table may not exist
  }

  // user_stats - may not exist
  try {
    await sql`DELETE FROM user_stats WHERE user_id = ${userId}`;
  } catch {
    // Table may not exist
  }

  // reading_progress
  await sql`DELETE FROM reading_progress WHERE user_id = ${userId}`;

  // list_chunks for user's lists, then lists
  await sql`DELETE FROM list_chunks WHERE list_id IN (SELECT id FROM lists WHERE user_id = ${userId})`;
  await sql`DELETE FROM lists WHERE user_id = ${userId}`;

  // user_follows
  await sql`DELETE FROM user_follows WHERE user_id = ${userId}`;

  // user_bookmarks
  await sql`DELETE FROM user_bookmarks WHERE user_id = ${userId}`;

  // user_likes
  await sql`DELETE FROM user_likes WHERE user_id = ${userId}`;

  // refresh_tokens
  await sql`DELETE FROM refresh_tokens WHERE user_id = ${userId}`;

  // Finally delete the user
  await sql`DELETE FROM users WHERE id = ${userId}`;
}
