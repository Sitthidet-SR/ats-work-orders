'use client';
import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import {
  Search,
  Plus,
  SlidersHorizontal,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  Files,
} from 'lucide-react';
import {
  statuses,
  priorities,
  statusLabels,
  priorityLabels,
  type Page,
  type WorkOrder,
  type Master,
  type Person,
} from '@ats/types';
import { api } from '@/lib/api';
import { useAuth } from '@/components/providers';
import { PageHeader } from '@/components/erp-shell';
import { Button } from '@/components/ui/button';
import { Loading, ErrorState } from '@/components/ui/common';
import { DateInput } from '@/components/ui/date-input';
import { OrderTable } from './order-table';
export function OrderList() {
  const params = useSearchParams();
  const { user } = useAuth();
  const [filters, setFilters] = useState<Record<string, string>>({
    search: params.get('search') ?? '',
    status: params.get('status') ?? '',
    priority: params.get('priority') ?? '',
    dueTo: params.get('dueTo') ?? '',
    summary: params.get('summary') ?? '',
  });
  const [search, setSearch] = useState(filters.search);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [advanced, setAdvanced] = useState(false);
  const [sort, setSort] = useState({ sortBy: 'createdAt', sortOrder: 'desc' });
  useEffect(() => {
    const timer = setTimeout(() => {
      setFilters((f) => ({ ...f, search }));
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);
  const queryString = new URLSearchParams({
    ...Object.fromEntries(Object.entries(filters).filter(([, v]) => v)),
    ...sort,
    page: String(page),
    limit: String(limit),
  }).toString();
  const orders = useQuery({
    queryKey: ['orders', queryString],
    queryFn: () => api<Page<WorkOrder>>(`/work-orders?${queryString}`),
    enabled: !!user,
    placeholderData: keepPreviousData,
  });
  const machines = useQuery({
    queryKey: ['machines'],
    queryFn: () => api<Master[]>('/machines'),
    enabled: !!user,
  });
  const departments = useQuery({
    queryKey: ['departments'],
    queryFn: () => api<Master[]>('/departments'),
    enabled: !!user,
  });
  const people = useQuery({
    queryKey: ['users'],
    queryFn: () => api<Person[]>('/users'),
    enabled: !!user,
  });
  const change = (key: string, value: string) => {
    setFilters((f) => ({
      ...f,
      [key]: value,
      ...(['status', 'priority'].includes(key) ? { summary: '' } : {}),
    }));
    setPage(1);
  };
  return (
    <>
      <PageHeader
        title="ใบสั่งงานผลิตชั่วคราว"
        subtitle="Temporary Work Orders · จัดการและติดตามเอกสารงานผลิต"
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
      <section className="rounded-xl border border-slate-200/80 bg-white">
        <div className="flex gap-6 overflow-x-auto border-b border-slate-100 px-6">
          {[
            ['', 'ทั้งหมด'],
            ['DRAFT', 'ร่าง'],
            ['WAITING_APPROVAL', 'รออนุมัติ'],
            ['IN_PROGRESS', 'กำลังผลิต'],
            ['COMPLETED', 'เสร็จแล้ว'],
          ].map(([value, label]) => (
            <button
              key={value}
              onClick={() => change('status', value)}
              className={`whitespace-nowrap border-b-2 py-4 text-xs ${filters.status === value ? 'border-[#c62836] font-semibold text-[#c62836]' : 'border-transparent text-slate-400'}`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-3 p-5">
          <div className="flex min-w-[200px] flex-1 items-center rounded-lg border border-slate-200 px-3">
            <Search className="text-slate-400" size={16} />
            <input
              aria-label="ค้นหาใบสั่งงาน"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ค้นหาเลขที่เอกสาร รหัสชิ้นงาน ชื่อสินค้า..."
              style={{ border: 0, boxShadow: 'none' }}
            />
          </div>
          <select
            aria-label="สถานะ"
            className="max-w-40"
            value={filters.status ?? ''}
            onChange={(e) => change('status', e.target.value)}
          >
            <option value="">ทุกสถานะ</option>
            {statuses.map((s) => (
              <option key={s} value={s}>
                {statusLabels[s]}
              </option>
            ))}
          </select>
          <select
            aria-label="ความสำคัญ"
            className="max-w-36"
            value={filters.priority ?? ''}
            onChange={(e) => change('priority', e.target.value)}
          >
            <option value="">ทุกความสำคัญ</option>
            {priorities.map((p) => (
              <option key={p} value={p}>
                {priorityLabels[p]}
              </option>
            ))}
          </select>
          <Button variant="secondary" onClick={() => setAdvanced(!advanced)}>
            <SlidersHorizontal size={15} />
            ตัวกรอง
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="ล้างตัวกรอง"
            onClick={() => {
              setFilters({});
              setSearch('');
              setPage(1);
            }}
          >
            <RotateCcw size={15} />
          </Button>
        </div>
        {advanced && (
          <div className="grid gap-3 border-t border-slate-100 bg-slate-50/50 p-5 sm:grid-cols-3 xl:grid-cols-4">
            {[
              ['machineId', 'เครื่องจักร', machines.data],
              ['departmentId', 'แผนก', departments.data],
              ['issuerId', 'ผู้สั่งงาน', people.data],
            ].map(([key, label, data]) => (
              <div key={key as string}>
                <label className="field">{label as string}</label>
                <select
                  aria-label={label as string}
                  value={filters[key as string] ?? ''}
                  onChange={(e) => change(key as string, e.target.value)}
                >
                  <option value="">ทั้งหมด</option>
                  {(data as Master[] | undefined)?.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </div>
            ))}
            {[
              ['dateFrom', 'วันที่สั่งการ ตั้งแต่'],
              ['dateTo', 'วันที่สั่งการ ถึง'],
              ['dueFrom', 'กำหนดส่ง ตั้งแต่'],
              ['dueTo', 'กำหนดส่ง ถึง'],
            ].map(([key, label]) => (
              <div key={key}>
                <label className="field">{label}</label>
                <DateInput
                  label={label}
                  value={filters[key] ?? ''}
                  onChange={(value) => change(key, value)}
                />
              </div>
            ))}
          </div>
        )}
        <div className="flex items-center justify-between border-t border-slate-100 px-5 py-3 text-[11px] text-slate-400">
          <span className="flex items-center gap-2">
            <Files size={14} />
            {orders.data?.total ?? 0} เอกสาร
            {filters.summary && (
              <span className="rounded bg-blue-50 px-2 py-1 text-blue-600">
                จากภาพรวม:{' '}
                {
                  (
                    {
                      waiting: 'รออนุมัติ',
                      approved: 'อนุมัติแล้ว',
                      urgent: 'งานด่วน',
                      overdue: 'เกินกำหนด',
                    } as Record<string, string>
                  )[filters.summary]
                }
              </span>
            )}
          </span>
          <span>{orders.isFetching ? 'กำลังอัปเดต...' : 'ข้อมูลใบสั่งงานล่าสุด'}</span>
        </div>
        {orders.isPending ? (
          <div className="p-5">
            <Loading />
          </div>
        ) : orders.error ? (
          <ErrorState error={orders.error} retry={() => orders.refetch()} />
        ) : (
          <OrderTable
            orders={orders.data.items}
            onSort={(field) => {
              setSort({
                sortBy: field,
                sortOrder: sort.sortBy === field && sort.sortOrder === 'asc' ? 'desc' : 'asc',
              });
              setPage(1);
            }}
          />
        )}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-5 py-4 text-xs text-slate-500">
          <div className="flex items-center gap-2">
            แสดง
            <select
              aria-label="จำนวนต่อหน้า"
              style={{ width: 65, padding: '5px' }}
              value={limit}
              onChange={(e) => {
                setLimit(Number(e.target.value));
                setPage(1);
              }}
            >
              {[10, 20, 50, 100].map((n) => (
                <option key={n}>{n}</option>
              ))}
            </select>
            รายการต่อหน้า
          </div>
          <div className="flex items-center gap-3">
            <span>
              หน้า {page} / {Math.max(1, orders.data?.pages ?? 1)}
            </span>
            <Button
              variant="secondary"
              size="icon"
              aria-label="หน้าก่อน"
              disabled={page <= 1 || orders.isFetching}
              onClick={() => setPage((p) => p - 1)}
            >
              <ChevronLeft size={16} />
            </Button>
            <Button
              variant="secondary"
              size="icon"
              aria-label="หน้าถัดไป"
              disabled={page >= (orders.data?.pages ?? 1) || orders.isFetching}
              onClick={() => setPage((p) => p + 1)}
            >
              <ChevronRight size={16} />
            </Button>
          </div>
        </div>
      </section>
    </>
  );
}
