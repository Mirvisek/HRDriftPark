import { defineConfig } from 'drizzle-kit';

const url = process.env.DATABASE_URL;
if (!url && process.env.NODE_ENV === 'production') {
  throw new Error('DATABASE_URL must be set for drizzle-kit in production.');
}

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'mysql', // mysql dialect is compatible with MariaDB
  dbCredentials: {
    url: url || 'mysql://root:password@127.0.0.1:3306/driftpark_management',
  },
});
