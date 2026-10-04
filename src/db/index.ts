import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import * as schema from './schema';

function resolveDatabaseUrl(): string {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;

  if (process.env.NODE_ENV === 'production') {
    throw new Error('DATABASE_URL must be set in production.');
  }

  // Local development fallback only.
  console.warn(
    '[db] DATABASE_URL is not set. Falling back to local mysql://root:***@127.0.0.1:3306/driftpark_management'
  );
  return 'mysql://root:password@127.0.0.1:3306/driftpark_management';
}

const connectionString = resolveDatabaseUrl();

const globalForDb = globalThis as unknown as {
  conn: mysql.Pool | undefined;
};

const conn = globalForDb.conn ?? mysql.createPool({
  uri: connectionString,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

if (process.env.NODE_ENV !== 'production') globalForDb.conn = conn;

export const db = drizzle(conn, { schema, mode: 'default' });
export * as schema from './schema';
export type DbType = typeof db;
export type SchemaType = typeof schema;
