import { config } from 'dotenv';
import { resolve } from 'node:path';
config({ path: resolve(__dirname, '../../../../.env'), quiet: true });
config({ quiet: true });
export function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable: ${name}`);
  return value;
}
export function validateEnvironment() {
  required('DATABASE_URL');
  for (const key of ['JWT_SECRET', 'JWT_REFRESH_SECRET']) {
    if (required(key).length < 32) throw new Error(`${key} must contain at least 32 characters`);
  }
  if (required('JWT_SECRET') === required('JWT_REFRESH_SECRET'))
    throw new Error('JWT secrets must differ');
  const origins = required('FRONTEND_URL').split(',');
  for (const origin of origins) {
    const url = new URL(origin);
    if (
      url.origin !== origin ||
      (process.env.NODE_ENV === 'production' && url.protocol !== 'https:')
    )
      throw new Error('FRONTEND_URL must contain exact origins');
  }
}
