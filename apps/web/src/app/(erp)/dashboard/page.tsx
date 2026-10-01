'use client';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  FileText,
  FilePenLine,
  Clock3,
  CircleCheck,
  Factory,
  Zap,
  TriangleAlert,
  CheckCheck,
  Plus,
  ArrowUpRight,
  CalendarDays,
  ArrowRight,
} from 'lucide-react';
import type { Dashboard } from '@ats/types';
import { api } from '@/lib/api';
import { PageHeader } from '@/components/erp-shell';
import { Button } from '@/components/ui/button';
import {
  Card,
  Loading,
  ErrorState,
  Empty,
  PriorityBadge,
  StatusBadge,
} from '@/components/ui/common';
import { OrderTable } from '@/components/work-orders/order-table';
import { useAuth } from '@/components/providers';
import { thaiDate, today } from '@/lib/utils';
const cards = [
  ['total', 'ใบงานทั้งหมด', FileText, 'text-blue-600', 'bg-blue-50', ''],
  ['draft', 'ร่าง', FilePenLine, 'text-slate-600', 'bg-slate-100', 'DRAFT'],
  ['waiting', 'รออนุมัติ', Clock3, 'text-amber-600', 'bg-amber-50', 'WAITING_APPROVAL'],
  ['approved', 'อนุมัติแล้ว', CircleCheck, 'text-emerald-600', 'bg-emerald-50', 'APPROVED'],
  ['inProgress', 'กำลังดำเนินการ', Factory, 'text-blue-600', 'bg-blue-50', 'IN_PROGRESS'],
  ['urgent', 'งานด่วน', Zap, 'text-orange-600', 'bg-orange-50', ''],
  ['overdue', 'เกินกำหนด', TriangleAlert, 'text-red-600', 'bg-red-50', ''],
  ['completed', 'เสร็จแล้ว', CheckCheck, 'text-emerald-600', 'bg-emerald-50', 'COMPLETED'],
] as const;
export default function DashboardPage() {
  const { user } = useAuth();
  const query = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => api<Dashboard>('/work-orders/summary'),
    enabled: !!user,
  });
  if (query.isPending) return <Loading />;
  if (query.error) return <ErrorState error={query.error} retry={() => query.refetch()} />;
  const d = query.data;
  return (
    <>
      <PageHeader
        title="ภาพรวมการผลิต"
        subtitle="Production overview · Temporary Work Order"
        crumb="Dashboard"
        action={
          user?.permissions.includes('work_order.create') && (
            <Button asChild>
              <Link href="/work-orders/new">
                <Plus size={16} />
                สร้างใบสั่งงาน
              </Link>
            </Button>
          )
        }
      />
      <div className="mb-6 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-slate-500">
          สวัสดี, <span className="font-medium text-slate-700">{user?.name}</span>{' '}
          <span className="ml-2 text-xs text-slate-400">ติดตามงานผลิตและเอกสารของทีมได้ที่นี่</span>
        </p>
        <span className="flex items-center gap-2 text-xs text-slate-500">
          <CalendarDays size={14} />
          {thaiDate(today())}
        </span>
      </div>
      <div className="mb-7 grid grid-cols-2 gap-4 xl:grid-cols-4">
        {cards.map(([key, label, Icon, color, bg, status]) => (
          <Link
            href={`/work-orders${['waiting', 'approved', 'urgent', 'overdue'].includes(key) ? `?summary=${key}` : status ? `?status=${status}` : ''}`}
            key={key}
            className="group rounded-xl border border-slate-200/80 bg-white p-5 transition-shadow hover:shadow-md"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500">{label}</span>
              <span
                className={`flex h-9 w-9 items-center justify-center rounded-lg ${bg} ${color}`}
              >
                <Icon size={18} />
              </span>
            </div>
            <div className="mt-3 flex items-end justify-between">
              <strong className="text-[30px] font-semibold leading-none tracking-tight">
                {d[key].toLocaleString()}
              </strong>
              <ArrowUpRight size={15} className="text-slate-300 group-hover:text-slate-500" />
            </div>
          </Link>
        ))}
      </div>
      <div className="mb-7 grid gap-5 xl:grid-cols-[2fr_1fr]">
        <Card
          title="งานที่ต้องทำวันนี้"
          subtitle={`${d.today.length} รายการกำหนดส่งวันนี้`}
          action={<CalendarDays size={17} className="text-slate-400" />}
        >
          {d.today.length ? (
            <div className="space-y-3">
              {d.today.map((order) => (
                <Link
                  key={order.id}
                  href={`/work-orders/${order.id}`}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-100 p-3 hover:border-blue-200"
                >
                  <div className="flex items-center gap-3">
                    <span className="rounded-lg bg-blue-50 p-2 text-blue-600">
                      <Factory size={17} />
                    </span>
                    <div>
                      <p className="text-xs font-semibold">
                        {order.documentNo}{' '}
                        <span className="ml-2 font-normal text-slate-500">{order.productCode}</span>
                      </p>
                      <p className="mt-1 text-[11px] text-slate-400">
                        {order.machineDetails?.map(m => m.machine.name).join(', ')} · {order.dueTime} น.
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <PriorityBadge priority={order.priority} />
                    <StatusBadge status={order.status} />
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <Empty text="ไม่มีงานกำหนดส่งวันนี้" />
          )}
        </Card>
        <Card title="ความคืบหน้างาน" subtitle="สัดส่วนจากใบงานทั้งหมด">
          <div className="flex items-center gap-6 py-3">
            <div
              className="flex h-28 w-28 shrink-0 items-center justify-center rounded-full"
              style={{
                background: `conic-gradient(#2563eb ${(d.total ? d.completed / d.total : 0) * 100}%, #edf1f7 0)`,
              }}
            >
              <div className="flex h-[90px] w-[90px] flex-col items-center justify-center rounded-full bg-white">
                <b className="text-2xl">
                  {d.total ? Math.round((d.completed / d.total) * 100) : 0}%
                </b>
                <span className="text-[10px] text-slate-400">เสร็จแล้ว</span>
              </div>
            </div>
            <div className="space-y-3 text-xs">
              <p className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-blue-600" />
                เสร็จแล้ว <b>{d.completed}</b>
              </p>
              <p className="flex items-center gap-2 text-slate-500">
                <span className="h-2 w-2 rounded-full bg-slate-200" />
                ทั้งหมด <b>{d.total}</b>
              </p>
              <p className="text-[10px] text-slate-400">ติดตามสถานะงานผลิต</p>
            </div>
          </div>
        </Card>
      </div>
      <section className="rounded-xl border border-slate-200/80 bg-white">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div>
            <h2 className="text-[15px] font-semibold">ใบสั่งงานล่าสุด</h2>
            <p className="mt-1 text-[11px] text-slate-400">Recent temporary work orders</p>
          </div>
          <Link href="/work-orders" className="flex items-center gap-2 text-xs text-blue-600">
            ดูทั้งหมด
            <ArrowRight size={14} />
          </Link>
        </div>
        <OrderTable orders={d.recent} compact />
      </section>
    </>
  );
}
