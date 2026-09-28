import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Providers } from '@/components/providers';
import './globals.css';
export const metadata: Metadata = {
  title: { default: 'ATS Company Platform', template: '%s | ATS' },
  description: 'ระบบใบสั่งงานผลิตชั่วคราว · AUTO-TECHSYSTEM',
};
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="th">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
