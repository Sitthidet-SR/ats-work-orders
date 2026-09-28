import { AlertCircle, Inbox, Loader2 } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from './button';
import { statusLabels, priorityLabels, type WorkOrderStatus, type priorities } from '@ats/types';
export function Card({
  title,
  subtitle,
  action,
  children,
  className = '',
}: {
  title?: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-xl border border-slate-200/80 bg-white shadow-[0_2px_8px_#1e293b03] ${className}`}
    >
      {title && (
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-6 py-4">
          <div>
            <h2 className="text-[15px] font-semibold text-slate-800">{title}</h2>
            {subtitle && <p className="mt-1 text-xs text-slate-400">{subtitle}</p>}
          </div>
          {action}
        </div>
      )}
      <div className="p-6">{children}</div>
    </section>
  );
}
export function StatusBadge({ status }: { status: WorkOrderStatus }) {
  const style =
    status === 'COMPLETED' || status === 'APPROVED'
      ? 'bg-emerald-50 text-emerald-700'
      : status === 'REJECTED' || status === 'CANCELLED'
        ? 'bg-red-50 text-red-700'
        : status === 'IN_PROGRESS' || status === 'ISSUED'
          ? 'bg-blue-50 text-blue-700'
          : status === 'DRAFT'
            ? 'bg-slate-100 text-slate-500'
            : 'bg-amber-50 text-amber-700';
  return (
    <span
      className={`inline-flex whitespace-nowrap items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-medium ${style}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {statusLabels[status]}
    </span>
  );
}
export function PriorityBadge({ priority }: { priority: (typeof priorities)[number] }) {
  return (
    <span
      className={`whitespace-nowrap rounded-md px-2 py-1 text-[11px] font-medium ${priority === 'NORMAL' ? 'bg-slate-100 text-slate-500' : priority === 'URGENT' ? 'bg-orange-50 text-orange-700' : 'bg-red-50 text-red-700'}`}
    >
      {priorityLabels[priority]}
    </span>
  );
}
export function Loading() {
  return (
    <div className="space-y-5" aria-label="กำลังโหลด">
      <div className="h-14 w-2/5 animate-pulse rounded-lg bg-slate-200" />
      <div className="grid gap-4 sm:grid-cols-4">
        {[1, 2, 3, 4].map((n) => (
          <div key={n} className="h-28 animate-pulse rounded-xl bg-slate-200/70" />
        ))}
      </div>
      <div className="h-72 animate-pulse rounded-xl bg-slate-200/70" />
    </div>
  );
}
export function ErrorState({ error, retry }: { error: Error; retry?: () => void }) {
  return (
    <div role="alert" className="rounded-xl border border-red-100 bg-red-50 p-8 text-center">
      <AlertCircle className="mx-auto mb-3 text-red-500" />
      <p>{error.message}</p>
      {retry && (
        <Button className="mt-4" variant="secondary" onClick={retry}>
          ลองอีกครั้ง
        </Button>
      )}
    </div>
  );
}
export function Empty({ text = 'ยังไม่มีใบสั่งงาน' }: { text?: string }) {
  return (
    <div className="py-12 text-center text-slate-400">
      <Inbox size={36} className="mx-auto mb-3 opacity-50" />
      <p className="text-sm">{text}</p>
    </div>
  );
}
export function Spinner() {
  return <Loader2 size={16} className="animate-spin" />;
}
