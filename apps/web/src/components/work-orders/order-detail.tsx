'use client';
import Link from 'next/link';
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Pencil,
  Copy,
  Printer,
  Download,
  Send,
  Check,
  X,
  Play,
  CircleCheck,
  FileCheck2,
  Paperclip,
  Clock3,
  ArrowLeft,
  UploadCloud,
} from 'lucide-react';
import { reasonLabels, type WorkOrder } from '@ats/types';
import { api, openPdf } from '@/lib/api';
import { thaiDate } from '@/lib/utils';
import { useAuth } from '@/components/providers';
import { PageHeader } from '@/components/erp-shell';
import { Button } from '@/components/ui/button';
import {
  Card,
  Loading,
  ErrorState,
  PriorityBadge,
  StatusBadge,
  Spinner,
  Empty,
} from '@/components/ui/common';
import { Dialog } from '@/components/ui/dialog';
import { Summary, ApprovalPanel } from './summary';
import { PdfHistory } from './pdf-history';
import { toast } from 'sonner';
const labels: Record<string, string> = {
  submit: 'ส่งอนุมัติ',
  'supervisor-review': 'ตรวจสอบโดยหัวหน้า',
  approve: 'อนุมัติ',
  reject: 'ไม่อนุมัติ',
  issue: 'ออกเอกสาร',
  start: 'เริ่มผลิต',
  complete: 'ปิดงาน',
  cancel: 'ยกเลิกใบงาน',
};
const auditLabels: Record<string, string> = {
  CREATE: 'สร้างเอกสาร',
  UPDATE: 'แก้ไขร่าง',
  SUBMIT: 'ส่งอนุมัติ',
  SUPERVISOR_REVIEW: 'หัวหน้าตรวจสอบ',
  APPROVE: 'อนุมัติ',
  REJECT: 'ไม่อนุมัติ',
  ISSUE: 'ออกเอกสาร',
  START: 'เริ่มผลิต',
  COMPLETE: 'ปิดงาน',
  CANCEL: 'ยกเลิก',
  ATTACH: 'แนบไฟล์',
  SAVE_PDF: 'บันทึกสำเนา PDF',
};
export function OrderDetail({ id }: { id: string }) {
  const { user } = useAuth();
  const client = useQueryClient();
  const query = useQuery({
    queryKey: ['order', id],
    queryFn: () => api<WorkOrder>(`/work-orders/${id}`),
    enabled: !!user,
  });
  const [action, setAction] = useState<string | null>(null);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  if (query.isPending) return <Loading />;
  if (query.error) return <ErrorState error={query.error} retry={() => query.refetch()} />;
  const order = query.data;
  const admin = user?.roles.includes('ADMIN');
  const owner = admin || user?.id === order.issuerId;
  const selfApproval =
    !order.approvals.some((approval) => approval.stage === 'SUPERVISOR') &&
    order.approvals.some((approval) => approval.stage === 'APPROVER' && approval.user.id === order.issuerId);
  const can = (permission: string) => !!user?.permissions.includes(`work_order.${permission}`);
  const assigned = (stage: string) =>
    order.approvals.some((approval) =>
      approval.stage === stage && (admin || approval.user.id === user?.id),
    );
  const actions: { key: string; label: string; icon: typeof Check }[] = [];
  if (order.status === 'DRAFT' && owner && can('submit'))
    actions.push({ key: 'submit', label: labels.submit, icon: Send });
  if (
    ['SUBMITTED', 'SUPERVISOR_REVIEW'].includes(order.status) &&
    assigned('SUPERVISOR') &&
    can('supervisor_review')
  )
    actions.push({
      key: 'supervisor-review',
      label: order.status === 'SUBMITTED' ? 'รับงานตรวจสอบ' : 'ตรวจสอบแล้ว ส่งผู้อนุมัติ',
      icon: Check,
    });
  if ((order.status === 'WAITING_APPROVAL' || (order.status === 'SUBMITTED' && selfApproval)) && assigned('APPROVER')) {
    if (can('approve')) actions.push({ key: 'approve', label: labels.approve, icon: Check });
    if (can('reject')) actions.push({ key: 'reject', label: labels.reject, icon: X });
  }
  for (const [status, key, Icon] of [
    ['APPROVED', 'issue', FileCheck2],
    ['ISSUED', 'start', Play],
    ['IN_PROGRESS', 'complete', CircleCheck],
  ] as const)
    if (order.status === status && can(key)) actions.push({ key, label: labels[key], icon: Icon });
  if (!['COMPLETED', 'CANCELLED', 'REJECTED'].includes(order.status) && can('cancel'))
    actions.push({ key: 'cancel', label: labels.cancel, icon: X });
  async function perform() {
    if (!action || busy) return;
    setBusy(true);
    try {
      await api(`/work-orders/${order.id}/${action}`, {
        method: 'POST',
        body: JSON.stringify({ version: order.version, comment }),
      });
      await client.invalidateQueries();
      toast.success(`${labels[action]}เรียบร้อย`);
      setAction(null);
      setComment('');
    } catch (e) {
      toast.error((e as Error).message);
      await query.refetch();
    } finally {
      setBusy(false);
    }
  }
  async function print(mode: boolean) {
    setBusy(true);
    try {
      await openPdf(order.id, mode);
      await client.invalidateQueries({ queryKey: ['pdf-history', order.id] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function upload(files: FileList | null) {
    if (!files) return;
    setBusy(true);
    try {
      for (const file of Array.from(files)) {
        const body = new FormData();
        body.append('file', file);
        await api(`/work-orders/${order.id}/attachments`, { method: 'POST', body });
      }
      toast.success('อัปโหลดไฟล์เรียบร้อย');
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      await client.invalidateQueries();
      setBusy(false);
    }
  }
  async function download(attachmentId: string) {
    try {
      const result = await api<{ url: string }>(
        `/work-orders/${order.id}/attachments/${attachmentId}`,
      );
      window.location.assign(result.url);
    } catch (e) {
      toast.error((e as Error).message);
    }
  }
  return (
    <>
      <Link href="/work-orders" className="mb-4 flex items-center gap-2 text-xs text-slate-400">
        <ArrowLeft size={13} />
        กลับรายการใบสั่งงาน
      </Link>
      <PageHeader
        title={order.documentNo}
        subtitle="ใบสั่งงานผลิตชั่วคราว · TEMPORARY WORK ORDER"
        action={
          <>
            {owner && order.status === 'DRAFT' && can('update') && (
              <Button asChild variant="secondary">
                <Link href={`/work-orders/${order.id}/edit`}>
                  <Pencil size={15} />
                  แก้ไข
                </Link>
              </Button>
            )}
            {can('create') && (
              <Button asChild variant="secondary">
                <Link href={`/work-orders/new?duplicate=${order.id}`}>
                  <Copy size={15} />
                  ทำสำเนา
                </Link>
              </Button>
            )}
            {owner && can('print') && (
              <Button variant="secondary" disabled={busy} onClick={() => print(true)}>
                <Printer size={15} />
                พิมพ์
              </Button>
            )}
            {owner && can('export') && (
              <Button variant="secondary" disabled={busy} onClick={() => print(false)}>
                <Download size={15} />
                PDF
              </Button>
            )}
          </>
        }
      />
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex items-center gap-3">
          <PriorityBadge priority={order.priority} />
          <StatusBadge status={order.status} />
          <span className="hidden text-[11px] text-slate-400 sm:inline">
            อัปเดต {thaiDate(order.updatedAt)}
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          {actions.map(({ key, label, icon: Icon }) => (
            <Button
              key={key}
              size="sm"
              disabled={busy}
              variant={['reject', 'cancel'].includes(key) ? 'danger' : 'blue'}
              onClick={() => {
                setComment('');
                setAction(key);
              }}
            >
              <Icon size={14} />
              {label}
            </Button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,3fr)_minmax(260px,1fr)]">
        <div className="min-w-0 space-y-6">
          <Card title="ข้อมูลเอกสาร" subtitle="DOCUMENT INFORMATION">
            <div className="grid gap-5 sm:grid-cols-3">
              {[
                ['เลขที่เอกสาร', order.documentNo],
                ['วันที่สั่งการ', thaiDate(order.orderDate)],
                ['ผู้สั่งงาน', order.issuer.name],
                ['แผนก', order.department.name],
                ['ความสำคัญ', order.priority],
                ['สถานะ', order.status],
              ].map(([label, value]) => (
                <div key={label}>
                  <p className="mb-2 text-[11px] text-slate-400">{label}</p>
                  <p className="text-sm font-medium">{value}</p>
                </div>
              ))}
            </div>
          </Card>
          <Card title="รายละเอียดงานผลิต" subtitle="PRODUCTION DETAILS">
            <p className="whitespace-pre-wrap break-words text-sm leading-7 text-slate-600">
              {order.description}
            </p>
            <p className="mt-4 flex items-center gap-2 text-xs text-slate-400">
              <Paperclip size={13} />
              {order.followAttachment ? 'ตามเอกสารแนบท้าย' : 'รายละเอียดตามข้อความข้างต้น'}
            </p>
            <div className="mt-5 border-t border-slate-100 pt-4">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-xs font-medium">เอกสารแนบ ({order.attachments.length})</h3>
                {owner && order.status === 'DRAFT' && can('update') && (
                  <label className="flex cursor-pointer items-center gap-2 text-xs text-blue-600">
                    <UploadCloud size={14} />
                    แนบไฟล์
                    <input
                      aria-label="แนบไฟล์"
                      type="file"
                      multiple
                      className="sr-only"
                      disabled={busy}
                      onChange={(e) => {
                        upload(e.target.files);
                        e.target.value = '';
                      }}
                    />
                  </label>
                )}
              </div>
              {order.attachments.length ? (
                order.attachments.map((a) => (
                  <button
                    key={a.id}
                    onClick={() => download(a.id)}
                    className="mb-2 flex w-full items-center gap-3 rounded-lg border border-slate-100 p-3 text-left hover:bg-slate-50"
                  >
                    <Paperclip size={16} className="text-blue-500" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-medium">{a.fileName}</p>
                      <p className="mt-1 text-[10px] text-slate-400">
                        {(a.size / 1024).toFixed(0)} KB · {a.mimeType} · {a.uploader.name} ·{' '}
                        {thaiDate(a.createdAt)}
                      </p>
                    </div>
                    <Download size={14} className="text-slate-400" />
                  </button>
                ))
              ) : (
                <p className="text-xs text-slate-400">ไม่มีเอกสารแนบ</p>
              )}
            </div>
          </Card>
          <Card title="ข้อมูลชิ้นงาน" subtitle="PRODUCT INFORMATION">
            <div className="grid gap-6 sm:grid-cols-2">
              {[
                ['รหัสชิ้นงาน', order.productCode],
                ['ชื่อสินค้า', order.productName],
                [
                  'จำนวนที่สั่งผลิต',
                  `${order.quantityText || order.quantity?.toLocaleString('th-TH', { maximumFractionDigits: 4 }) || '—'} ${order.unit}`,
                ],
                ['ไลน์ผลิต / เครื่องจักร', order.machine.name],
                ['กำหนดส่งงาน', thaiDate(order.dueDate)],
                ['เวลา', `${order.dueTime} น.`],
              ].map(([label, value]) => (
                <div key={label}>
                  <p className="mb-2 text-[11px] text-slate-400">{label}</p>
                  <p className="text-sm font-medium">{value}</p>
                </div>
              ))}
            </div>
          </Card>
          <Card title="รายการวัตถุดิบ / ส่วนประกอบ" subtitle="MATERIALS & COMPONENTS">
            <div className="overflow-x-auto">
              {order.materials.length ? (
                <table>
                  <thead>
                    <tr>
                      {['#', 'วัตถุ / วัสดุ', 'เกรดวัสดุ'].map(
                        (h) => (
                          <th key={h}>{h}</th>
                        ),
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {order.materials.map((m, i) => (
                      <tr key={m.id}>
                        <td>{i + 1}</td>
                        <td>{m.materialName || m.materialCode || '—'}</td>
                        <td>{m.materialGrade || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <Empty text="ไม่มีรายการวัตถุดิบ" />
              )}
            </div>
          </Card>
          <Card title="ขั้นตอน / คำสั่งพิเศษ" subtitle="SPECIAL INSTRUCTIONS">
            <p className="whitespace-pre-wrap break-words text-sm leading-7 text-slate-600">
              {order.specialInstructions || '—'}
            </p>
          </Card>
          <Card title="เหตุผลในการออกเอกสารชั่วคราว">
            <span className="rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-700">
              {reasonLabels[order.reasonType]}
            </span>
            {order.reasonDetail && (
              <p className="mt-4 whitespace-pre-wrap text-sm text-slate-600">
                {order.reasonDetail}
              </p>
            )}
          </Card>
          <PdfHistory id={order.id} canDownload={!!owner && can('print')} />
          <Card
            title="ประวัติการดำเนินงาน"
            subtitle="ACTIVITY TIMELINE · AUDIT LOG"
            action={<Clock3 size={16} className="text-slate-400" />}
          >
            {order.activities.length ? (
              <div className="space-y-6">
                {order.activities.map((event) => (
                  <div key={event.id} className="flex gap-4">
                    <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-blue-500 ring-4 ring-blue-50" />
                    <div>
                      <p className="text-xs">
                        <b className="font-medium">{event.user.name}</b>{' '}
                        <span className="text-slate-500">
                          {auditLabels[event.action] ?? event.action}
                        </span>
                      </p>
                      <p className="mt-1 text-[10px] text-slate-400">
                        {thaiDate(event.createdAt)} ·{' '}
                        {new Date(event.createdAt).toLocaleTimeString('th-TH', {
                          timeZone: 'Asia/Bangkok',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                      {typeof event.newValue === 'object' &&
                        event.newValue !== null &&
                        'comment' in event.newValue &&
                        typeof event.newValue.comment === 'string' && (
                          <p className="mt-2 whitespace-pre-wrap text-xs text-slate-500">
                            {event.newValue.comment}
                          </p>
                        )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <Empty text="ยังไม่มีประวัติ" />
            )}
          </Card>
        </div>
        <aside className="space-y-5 xl:sticky xl:top-[100px]">
          <Summary
            priority={order.priority}
            machine={order.machine.name}
            dueDate={order.dueDate}
            quantity={order.quantity}
            quantityText={order.quantityText}
            unit={order.unit}
            productCode={order.productCode}
            status={order.status}
            selfApproval={selfApproval}
          />
          <ApprovalPanel approvals={order.approvals} />
        </aside>
      </div>
      <Dialog
        open={!!action}
        onOpenChange={(open) => {
          if (!busy && !open) setAction(null);
        }}
        title={`ยืนยัน${action ? labels[action] : ''}`}
        description={`เอกสาร ${order.documentNo} · ระบบจะบันทึกผู้ดำเนินการและเวลาใน Audit Log`}
      >
        <label className="field" htmlFor="comment">
          ความคิดเห็น / เหตุผล{' '}
          {['reject', 'cancel'].includes(action ?? '') && <span className="text-red-600">*</span>}
        </label>
        <textarea
          id="comment"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          maxLength={4000}
          placeholder="ระบุความคิดเห็นประกอบการดำเนินการ"
        />
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" disabled={busy} onClick={() => setAction(null)}>
            กลับ
          </Button>
          <Button
            disabled={busy || (['reject', 'cancel'].includes(action ?? '') && !comment.trim())}
            onClick={perform}
          >
            {busy && <Spinner />}ยืนยัน
          </Button>
        </div>
      </Dialog>
    </>
  );
}
