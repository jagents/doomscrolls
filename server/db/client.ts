import postgres from 'postgres';

const connectionString = process.env.NEON_DATABASE_URL;

if (!connectionString) {
  throw new Error('NEON_DATABASE_URL environment variable is required');
}

export const sql = postgres(connectionString, {
  max: 10,
  idle_timeout: 20,
  connect_timeout: 10,
});

export async function testConnection() {
  try {
    const result = await sql`SELECT NOW() as now, current_database() as db`;
    return result[0];
  } catch (error) {
    console.error('Database connection failed:', error);
    throw error;
  }
}
