import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'mysql', // mysql dialect is compatible with MariaDB
  dbCredentials: {
    url: process.env.DATABASE_URL || 'mysql://root:password@127.0.0.1:3306/driftpark_management',
  },
});
