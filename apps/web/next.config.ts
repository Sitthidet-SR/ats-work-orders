import type { NextConfig } from 'next';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
const envPath = resolve(process.cwd(), '../../.env');
if (existsSync(envPath)) process.loadEnvFile(envPath);
const nextConfig: NextConfig = { transpilePackages: ['@ats/types'], poweredByHeader: false };
export default nextConfig;
