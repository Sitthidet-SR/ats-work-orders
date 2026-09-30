import { Check, Circle, Factory, CalendarDays, Package, Flag } from 'lucide-react';
import { statuses, statusLabels, type WorkOrderStatus, type Approval } from '@ats/types';
import { Card, PriorityBadge, StatusBadge } from '@/components/ui/common';
import { thaiDate } from '@/lib/utils';
export function Summary({
  priority,
  machine,
  dueDate,
  quantity,
  quantityText,
  unit,
  productCode,
  status = 'DRAFT',
  selfApproval = false,
}: {
  priority: 'NORMAL' | 'URGENT' | 'CRITICAL';
  machine: string;
  dueDate: string;
  quantity: number | null;
  quantityText?: string;
  unit: string;
  productCode: string;
  status?: WorkOrderStatus;
  selfApproval?: boolean;
}) {
  const visibleStatuses = statuses.slice(0, 8).filter((stage) =>
    !selfApproval || !['SUPERVISOR_REVIEW', 'WAITING_APPROVAL'].includes(stage),
  );
  const step = visibleStatuses.indexOf(status);
  return (
    <Card title="สรุปใบสั่งงาน" subtitle="WORK ORDER SUMMARY">
      <div className="space-y-4">
        <div className="flex justify-between text-xs">
          <span className="flex items-center gap-2 text-slate-400">
            <Flag size={14} />
            ความสำคัญ
          </span>
          <PriorityBadge priority={priority} />
        </div>
        {[
          [Factory, 'เครื่องจักร', machine || '—'],
          [CalendarDays, 'กำหนดส่ง', thaiDate(dueDate)],
          [
            Package,
            'จำนวน',
            `${quantityText || (Number.isFinite(quantity) ? quantity : '—')} ${unit}`,
          ],
        ].map(([Icon, label, value]) => {
          const I = Icon as typeof Factory;
          return (
            <div key={label as string} className="flex items-start justify-between gap-4 text-xs">
              <span className="flex shrink-0 items-center gap-2 text-slate-400">
                <I size={14} />
                {label as string}
              </span>
              <span className="text-right font-medium text-slate-600">{value as string}</span>
            </div>
          );
        })}
        <div className="border-t border-slate-100 pt-4">
          <p className="mb-1 text-[11px] text-slate-400">รหัสชิ้นงาน</p>
          <p className="break-all text-sm font-semibold">{productCode || '—'}</p>
        </div>
        <div className="flex items-center justify-between border-t border-slate-100 pt-4">
          <span className="text-xs text-slate-400">สถานะเอกสาร</span>
          <StatusBadge status={status} />
        </div>
      </div>
      <div className="mt-6 border-t border-slate-100 pt-5">
        <h3 className="mb-4 text-xs font-medium">ขั้นตอนการดำเนินงาน</h3>
        <div className="space-y-3">
          {visibleStatuses.map((s, i) => (
            <div
              key={s}
              className={`flex items-center gap-3 text-[11px] ${i === step ? 'font-semibold text-blue-600' : i < step && step < visibleStatuses.length ? 'text-emerald-600' : 'text-slate-400'}`}
            >
              {i < step && step < visibleStatuses.length ? (
                <Check size={14} />
              ) : (
                <Circle size={12} className={i === step ? 'fill-blue-100' : ''} />
              )}
              <span>{statusLabels[s]}</span>
              {i === step && <span className="ml-auto text-[9px]">ปัจจุบัน</span>}
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}
export function ApprovalPanel({ approvals }: { approvals: Approval[] }) {
  return (
    <Card title="การอนุมัติ / ผู้เกี่ยวข้อง" subtitle="APPROVAL & SIGNATURE">
      <div className="space-y-5">
        {['ISSUER', 'SUPERVISOR', 'APPROVER'].filter((stage) =>
          approvals.some((approval) => approval.stage === stage),
        ).map((stage, i) => {
          const item = approvals.find((a) => a.stage === stage);
          return (
            <div key={stage}>
              <p className="mb-2 text-[10px] text-slate-400">
                {i + 1}. {stage === 'ISSUER' ? 'ผู้สั่งงาน' : stage === 'SUPERVISOR' ? 'ผู้รับสั่งงาน / หัวหน้า' : 'ผู้อนุมัติ'}
              </p>
              <div className="flex items-start gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-500">
                  {item?.user.name.slice(0, 2).toUpperCase() ?? '—'}
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-semibold">{item?.user.name ?? 'ยังไม่ได้เลือก'}</p>
                  <p className="mt-1 text-[10px] text-slate-400">
                    {item?.user.position} · {item?.user.department.name}
                  </p>
                  <p
                    className={`mt-2 text-[10px] ${item?.status === 'APPROVED' ? 'text-emerald-600' : item?.status === 'REJECTED' ? 'text-red-600' : 'text-amber-600'}`}
                  >
                    {item?.status === 'APPROVED'
                      ? 'อนุมัติแล้ว'
                      : item?.status === 'REJECTED'
                        ? 'ไม่อนุมัติ'
                        : 'รอดำเนินการ'}{' '}
                    {item?.decidedAt &&
                      `${thaiDate(item.decidedAt)} ${new Date(item.decidedAt).toLocaleTimeString('th-TH', { timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit' })}`}
                  </p>
                  {item?.comment && (
                    <p className="mt-2 whitespace-pre-wrap break-words rounded bg-slate-50 p-2 text-[11px] text-slate-500">
                      {item.comment}
                    </p>
                  )}
                  {item?.decidedBy && item.decidedBy.id !== item.user.id && (
                    <p className="mt-2 text-[10px] text-blue-600">
                      ดำเนินการโดย {item.decidedBy.name}
                    </p>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
