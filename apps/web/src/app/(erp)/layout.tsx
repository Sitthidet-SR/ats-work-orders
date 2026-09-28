import type { ReactNode } from 'react';
import { ErpShell } from '@/components/erp-shell';
export default function Layout({ children }: { children: ReactNode }) {
  return <ErpShell>{children}</ErpShell>;
}
