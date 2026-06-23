import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import * as schema from './schema';

const connectionString = process.env.DATABASE_URL || 'mysql://root:password@127.0.0.1:3306/driftpark_management';

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
