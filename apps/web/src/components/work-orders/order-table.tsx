'use client';
import Link from 'next/link';
import { MoreHorizontal, Eye, Pencil, Copy, Printer, Download, ArrowUpDown, X } from 'lucide-react';
import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { WorkOrder } from '@ats/types';
import { PriorityBadge, StatusBadge, Empty } from '@/components/ui/common';
import { useAuth } from '@/components/providers';
import { thaiDate } from '@/lib/utils';
import { api, openPdf } from '@/lib/api';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
export function OrderTable({
  orders,
  onSort,
  compact = false,
}: {
  orders: WorkOrder[];
  onSort?: (field: string) => void;
  compact?: boolean;
}) {
  const { user } = useAuth();
  const client = useQueryClient();
  const [cancel, setCancel] = useState<WorkOrder | null>(null);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  if (!orders.length) return <Empty />;
  const print = async (id: string, mode: boolean) => {
    try {
      await openPdf(id, mode);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };
  async function cancelOrder() {
    if (!cancel) return;
    setBusy(true);
    try {
      await api(`/work-orders/${cancel.id}/cancel`, {
        method: 'POST',
        body: JSON.stringify({ version: cancel.version, comment }),
      });
      await client.invalidateQueries();
      toast.success('ยกเลิกใบงานแล้ว');
      setCancel(null);
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="scrollbar-thin overflow-x-auto">
      <table>
        <thead>
          <tr>
            <th>
              <button className="flex items-center gap-2" onClick={() => onSort?.('documentNo')}>
                เลขที่เอกสาร {onSort && <ArrowUpDown size={11} />}
              </button>
            </th>
            {!compact && <th>วันที่สั่งการ</th>}
            <th>ชิ้นงาน / สินค้า</th>
            <th>จำนวน</th>
            <th>เครื่องจักร</th>
            <th>
              <button className="flex items-center gap-2" onClick={() => onSort?.('dueDate')}>
                กำหนดส่ง {onSort && <ArrowUpDown size={11} />}
              </button>
            </th>
            <th>ผู้สั่งงาน</th>
            {!compact && <th>แผนก</th>}
            <th>ความสำคัญ</th>
            <th>สถานะ</th>
            <th className="w-12" />
          </tr>
        </thead>
        <tbody>
          {orders.map((order) => {
            const owner = user?.roles.includes('ADMIN') || user?.id === order.issuerId;
            return (
              <tr key={order.id}>
                <td>
                  <Link
                    className="font-semibold text-blue-700 hover:underline"
                    href={`/work-orders/${order.id}`}
                  >
                    {order.documentNo}
                  </Link>
                </td>
                {!compact && (
                  <td className="whitespace-nowrap text-slate-500">{thaiDate(order.orderDate)}</td>
                )}
                <td className="min-w-[175px]">
                  <p className="font-medium text-slate-700">{order.productCode}</p>
                  <p className="mt-1 max-w-[230px] truncate text-[11px] text-slate-400">
                    {order.productName}
                  </p>
                </td>
                <td className="whitespace-nowrap">
                  <b className="font-medium">
                    {order.quantityText ||
                      order.quantity?.toLocaleString('th-TH', { maximumFractionDigits: 4 }) ||
                      '—'}
                  </b>{' '}
                  <span className="text-[10px] text-slate-400">{order.unit}</span>
                </td>
                <td className="whitespace-nowrap text-slate-500">{order.machine.name}</td>
                <td className="whitespace-nowrap text-slate-600">
                  {thaiDate(order.dueDate)}
                  <p className="mt-1 text-[10px] text-slate-400">{order.dueTime} น.</p>
                </td>
                <td className="whitespace-nowrap text-slate-500">{order.issuer.name}</td>
                {!compact && (
                  <td className="whitespace-nowrap text-slate-500">{order.department.name}</td>
                )}
                <td>
                  <PriorityBadge priority={order.priority} />
                </td>
                <td>
                  <StatusBadge status={order.status} />
                </td>
                <td>
                  <details
                    className="relative"
                    onToggle={(event) => {
                      const details = event.currentTarget;
                      const menu = details.querySelector<HTMLDivElement>('div');
                      if (details.open && menu) {
                        const rect = details.getBoundingClientRect();
                        menu.style.top = `${Math.max(8, Math.min(rect.bottom + 6, window.innerHeight - menu.offsetHeight - 10))}px`;
                        menu.style.left = `${Math.max(8, rect.right - menu.offsetWidth)}px`;
                      }
                    }}
                  >
                    <summary
                      aria-label={`จัดการ ${order.documentNo}`}
                      className="list-none cursor-pointer rounded p-1 text-slate-400 hover:bg-slate-100"
                    >
                      <MoreHorizontal size={18} />
                    </summary>
                    <div className="fixed z-40 w-44 rounded-lg border border-slate-200 bg-white p-1 shadow-xl">
                      <Link
                        className="flex items-center gap-2 rounded px-3 py-2 hover:bg-slate-50"
                        href={`/work-orders/${order.id}`}
                      >
                        <Eye size={13} />
                        ดู / ดำเนินการ
                      </Link>
                      {owner &&
                        order.status === 'DRAFT' &&
                        user?.permissions.includes('work_order.update') && (
                          <Link
                            className="flex items-center gap-2 rounded px-3 py-2 hover:bg-slate-50"
                            href={`/work-orders/${order.id}/edit`}
                          >
                            <Pencil size={13} />
                            แก้ไข
                          </Link>
                        )}
                      {user?.permissions.includes('work_order.create') && (
                        <Link
                          className="flex items-center gap-2 rounded px-3 py-2 hover:bg-slate-50"
                          href={`/work-orders/new?duplicate=${order.id}`}
                        >
                          <Copy size={13} />
                          ทำสำเนา
                        </Link>
                      )}
                      {owner && user?.permissions.includes('work_order.print') && (
                        <button
                          className="flex w-full items-center gap-2 rounded px-3 py-2 hover:bg-slate-50"
                          onClick={() => print(order.id, true)}
                        >
                          <Printer size={13} />
                          พิมพ์
                        </button>
                      )}
                      {owner && user?.permissions.includes('work_order.export') && (
                        <button
                          className="flex w-full items-center gap-2 rounded px-3 py-2 hover:bg-slate-50"
                          onClick={() => print(order.id, false)}
                        >
                          <Download size={13} />
                          Export PDF
                        </button>
                      )}
                      {user?.permissions.includes('work_order.cancel') &&
                        !['COMPLETED', 'CANCELLED', 'REJECTED'].includes(order.status) && (
                          <button
                            className="flex w-full items-center gap-2 rounded px-3 py-2 text-red-600 hover:bg-red-50"
                            onClick={(event) => {
                              event.currentTarget.closest('details')?.removeAttribute('open');
                              setComment('');
                              setCancel(order);
                            }}
                          >
                            <X size={13} />
                            ยกเลิก
                          </button>
                        )}
                    </div>
                  </details>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <Dialog
        open={!!cancel}
        onOpenChange={(open) => {
          if (!open && !busy) setCancel(null);
        }}
        title="ยืนยันยกเลิกใบงาน"
        description={`เอกสาร ${cancel?.documentNo ?? ''} · กรุณาระบุเหตุผล`}
      >
        <textarea
          aria-label="เหตุผลยกเลิก"
          value={comment}
          maxLength={4000}
          onChange={(e) => setComment(e.target.value)}
        />
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="secondary" disabled={busy} onClick={() => setCancel(null)}>
            กลับ
          </Button>
          <Button disabled={busy || !comment.trim()} onClick={cancelOrder}>
            ยืนยันยกเลิก
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
