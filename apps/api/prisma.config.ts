import './src/common/env';
import { defineConfig } from 'prisma/config';

const pooledUrl = process.env.DATABASE_URL!;
const migrationUrl = process.env.DIRECT_URL || (() => {
  try {
    const url = new URL(pooledUrl);
    // Neon marks pooled endpoints with "-pooler". Migrations use the matching
    // direct endpoint so session advisory locks stay on one connection.
    url.hostname = url.hostname.replace(/-pooler(?=\.)/, '');
    return url.toString();
  } catch {
    return pooledUrl;
  }
})();

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations', seed: 'tsx prisma/seed.ts' },
  datasource: { url: migrationUrl },
});
