import { randomBytes } from 'node:crypto';
import { readFile, writeFile, access } from 'node:fs/promises';
try {
  await access(new URL('../.env', import.meta.url));
  console.log('.env already exists; preserved.');
} catch {
  let source = await readFile(new URL('../.env.example', import.meta.url), 'utf8');
  for (const name of [
    'JWT_SECRET',
    'JWT_REFRESH_SECRET',
    'ADMIN_INITIAL_PASSWORD',
    'STORAGE_SECRET_KEY',
  ])
    source = source.replace(
      new RegExp(`^${name}=$`, 'm'),
      `${name}=${randomBytes(32).toString('hex')}`,
    );
  source = source.replace('SEED_DEMO=false', 'SEED_DEMO=true');
  await writeFile(new URL('../.env', import.meta.url), source, { mode: 0o600 });
  console.log(
    'Created .env with random development credentials. Read ADMIN_INITIAL_PASSWORD locally to sign in; do not commit .env.',
  );
}
