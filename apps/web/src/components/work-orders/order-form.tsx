'use client';
import { useEffect, useState, type ReactNode } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm, useFieldArray, type FieldErrors } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Plus,
  Save,
  Send,
  Eye,
  Printer,
  UploadCloud,
  Paperclip,
  X,
  Trash2,
  ArrowUp,
  ArrowDown,
  FileText,
  Check,
} from 'lucide-react';
import {
  priorityLabels,
  priorities,
  reasonLabels,
  reasons,
  type Master,
  type Person,
  type WorkOrder,
  type WorkOrderInput,
} from '@ats/types';
import { useAuth } from '@/components/providers';
import { PageHeader } from '@/components/erp-shell';
import { Button } from '@/components/ui/button';
import { Card, Loading, ErrorState, Spinner } from '@/components/ui/common';
import { Dialog } from '@/components/ui/dialog';
import { Summary } from './summary';
import { api, openPdf, openArchivedPdf, pdfBlob } from '@/lib/api';
import { today, thaiDate } from '@/lib/utils';
import { toast } from 'sonner';
const required = z.string().trim().min(1, 'กรุณากรอกข้อมูล');
const schema = z
  .object({
    issuerDisplayName: z.string().max(150).optional(),
    quantityText: z.string().max(100).optional(),
    orderDate: required.regex(/^20\d{2}-\d{2}-\d{2}$/, 'กรุณาใช้ปี ค.ศ.'),
    departmentId: z.uuid('กรุณาเลือกแผนก'),
    description: required.max(20000),
    followAttachment: z.boolean(),
    productCode: required.max(100),
    productName: z.string().max(300),
    quantity: z
      .number({ error: 'กรุณาระบุจำนวน' })
      .positive('จำนวนต้องมากกว่า 0')
      .max(999999999999)
      .nullable(),
    unit: z.string().max(30),
    machineId: z.uuid('กรุณาเลือกเครื่องจักร'),
    dueDate: required.regex(/^20\d{2}-\d{2}-\d{2}$/, 'กรุณาใช้ปี ค.ศ.'),
    dueTime: z.string().regex(/^$|^([01]\d|2[0-3]):[0-5]\d$/, 'เวลาไม่ถูกต้อง'),
    priority: z.enum(priorities),
    reasonType: z.enum(reasons),
    reasonDetail: z.string().max(4000),
    specialInstructions: z.string().max(20000),
    supervisorId: z.union([z.uuid('กรุณาเลือกหัวหน้าหน้างาน'), z.literal('')]),
    approverId: z.union([z.uuid('กรุณาเลือกผู้อนุมัติ'), z.literal('')]),
    materials: z.array(
      z.object({
        materialCode: required.max(100),
        materialName: z.string().max(300),
        quantity: z.number({ error: 'กรุณาระบุจำนวน' }).min(0, 'จำนวนห้ามติดลบ').nullable(),
        unit: z.string().max(30),
        remark: z.string().max(2000),
        sortOrder: z.number().int().min(0),
      }),
    ),
  })
  .superRefine((value, ctx) => {
    if (value.quantity === null && !value.quantityText?.trim())
      ctx.addIssue({ code: 'custom', path: ['quantityText'], message: 'กรุณาระบุข้อความแทนจำนวน' });
    if (value.dueDate < value.orderDate)
      ctx.addIssue({
        code: 'custom',
        path: ['dueDate'],
        message: 'กำหนดส่งต้องไม่ก่อนวันที่สั่งการ',
      });
    if (value.reasonType === 'OTHER' && !value.reasonDetail.trim())
      ctx.addIssue({ code: 'custom', path: ['reasonDetail'], message: 'กรุณาระบุเหตุผลเพิ่มเติม' });
    if (value.supervisorId && value.supervisorId === value.approverId)
      ctx.addIssue({
        code: 'custom',
        path: ['approverId'],
        message: 'หัวหน้าและผู้อนุมัติต้องเป็นคนละคน',
      });
  });
function Field({
  label,
  required: star = false,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label className="field">
        {label}
        {star && <span className="ml-1 text-red-600">*</span>}
      </label>
      {children}
      {error && <p className="mt-1 text-[11px] text-red-600">{error}</p>}
    </div>
  );
}
function fromOrder(order: WorkOrder): WorkOrderInput {
  return {
    issuerDisplayName: order.issuerDisplayName || order.issuer.name,
    quantityText: order.quantityText || '',
    orderDate: order.orderDate.slice(0, 10),
    departmentId: order.departmentId,
    description: order.description,
    followAttachment: order.followAttachment,
    productCode: order.productCode,
    productName: order.productName,
    quantity: order.quantity,
    unit: order.unit,
    machineId: order.machineId,
    dueDate: order.dueDate.slice(0, 10),
    dueTime: order.dueTime,
    priority: order.priority,
    reasonType: order.reasonType,
    reasonDetail: order.reasonDetail,
    specialInstructions: order.specialInstructions,
    supervisorId: order.supervisorId,
    approverId: order.approverId,
    materials: order.materials.map(({ id: _id, ...m }) => m),
  };
}
export function OrderFormPage({ id }: { id?: string }) {
  const { user } = useAuth();
  const params = useSearchParams();
  const source = id ?? params.get('duplicate');
  const masters = useQuery({
    queryKey: ['form-masters'],
    queryFn: async () => {
      const [machines, departments, people] = await Promise.all([
        api<Master[]>('/machines'),
        api<Master[]>('/departments'),
        api<Person[]>('/users'),
      ]);
      return { machines, departments, people };
    },
    enabled: !!user,
  });
  const order = useQuery({
    queryKey: ['order', source],
    queryFn: () => api<WorkOrder>(`/work-orders/${source}`),
    enabled: !!source && !!user,
  });
  if (masters.isPending || (source && order.isPending)) return <Loading />;
  if (masters.error || order.error) return <ErrorState error={masters.error ?? order.error!} />;
  if (id && order.data?.status !== 'DRAFT')
    return <ErrorState error={new Error('แก้ไขได้เฉพาะเอกสารร่าง')} />;
  if (!user?.permissions.includes(id ? 'work_order.update' : 'work_order.create'))
    return <ErrorState error={new Error('คุณไม่มีสิทธิ์สร้างหรือแก้ไขใบงาน')} />;
  if (id && !user.roles.includes('ADMIN') && order.data?.issuerId !== user.id)
    return <ErrorState error={new Error('เฉพาะเจ้าของเอกสารสามารถแก้ไขได้')} />;
  return (
    <OrderForm
      key={id ?? source ?? 'new'}
      masters={masters.data}
      initial={order.data}
      editing={!!id}
    />
  );
}
function OrderForm({
  masters,
  initial,
  editing,
}: {
  masters: { machines: Master[]; departments: Master[]; people: Person[] };
  initial?: WorkOrder;
  editing: boolean;
}) {
  const { user } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [preview, setPreview] = useState(false);
  const [previewUrl, setPreviewUrl] = useState('');
  useEffect(
    () => () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    },
    [previewUrl],
  );
  const [dragging, setDragging] = useState(false);
  const form = useForm<WorkOrderInput>({
    resolver: zodResolver(schema),
    defaultValues: initial
      ? {
          ...fromOrder(initial),
          ...(!editing
            ? { orderDate: today(), departmentId: user!.departmentId, followAttachment: false }
            : {}),
        }
      : {
          issuerDisplayName: user?.name || '',
          quantityText: '',
          orderDate: today(),
          departmentId: user!.departmentId,
          description: '',
          followAttachment: false,
          productCode: '',
          productName: '',
          quantity: 1,
          unit: 'ชิ้น',
          machineId: '',
          dueDate: today(),
          dueTime: '',
          priority: 'NORMAL',
          reasonType: 'URGENT',
          reasonDetail: '',
          specialInstructions: '',
          supervisorId: '',
          approverId: '',
          materials: [],
        },
  });
  const materials = useFieldArray({ control: form.control, name: 'materials' });
  const data = form.watch();
  const errors = form.formState.errors;
  const register = form.register;
  function invalid(_errors: FieldErrors<WorkOrderInput>) {
    toast.error('กรุณาตรวจสอบช่องที่จำเป็นและข้อมูลที่ไม่ถูกต้อง');
  }
  async function persist(values: WorkOrderInput, mode: 'draft' | 'submit' | 'print' | 'pdf') {
    if (busy) return;
    if (mode === 'submit' && (!values.supervisorId || !values.approverId)) {
      toast.error('กรุณาระบุหัวหน้างานและผู้อนุมัติก่อนส่งอนุมัติ');
      setConfirm(false);
      return;
    }
    setBusy(true);
    let savedId: string | undefined;
    try {
      const payload = {
        ...values,
        materials: values.materials.map((m, i) => ({ ...m, sortOrder: i })),
      };
      let order = await api<WorkOrder>(editing ? `/work-orders/${initial!.id}` : '/work-orders', {
        method: editing ? 'PATCH' : 'POST',
        body: JSON.stringify({ ...payload, ...(editing ? { version: initial!.version } : {}) }),
      });
      savedId = order.id;
      for (const file of files) {
        const body = new FormData();
        body.append('file', file);
        await api(`/work-orders/${order.id}/attachments`, { method: 'POST', body });
      }
      if (files.length) order = await api<WorkOrder>(`/work-orders/${order.id}`);
      if (mode === 'submit')
        await api(`/work-orders/${order.id}/submit`, {
          method: 'POST',
          body: JSON.stringify({ version: order.version }),
        });
      const archived = user?.permissions.includes('work_order.print')
        ? await api<{ id: string; fileName: string }>(`/work-orders/${order.id}/pdf-archives`, {
            method: 'POST',
          })
        : null;
      await queryClient.invalidateQueries();
      toast.success(mode === 'submit' ? 'ส่งอนุมัติเรียบร้อย' : 'บันทึกใบสั่งงานเรียบร้อย');
      if (mode === 'print') await openPdf(order.id, true);
      if (mode === 'pdf' && archived)
        await openArchivedPdf(order.id, archived.id, archived.fileName, true);
      router.push(`/work-orders/${order.id}`);
    } catch (e) {
      toast.error((e as Error).message);
      if (savedId) {
        toast.info(
          'ข้อมูลใบงานบันทึกแล้ว กรุณาตรวจสอบไฟล์แนบหรือบันทึก PDF อีกครั้งจากหน้ารายละเอียด',
        );
        router.push(`/work-orders/${savedId}`);
      }
    } finally {
      setBusy(false);
      setConfirm(false);
    }
  }
  async function showPreview(values: WorkOrderInput) {
    setBusy(true);
    try {
      const blob = await pdfBlob('/work-orders/preview', {
        method: 'POST',
        body: JSON.stringify(values),
      });
      setPreviewUrl(URL.createObjectURL(blob));
      setPreview(true);
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function addFiles(incoming: File[]) {
    const accepted = incoming.filter((file) => {
      if (file.size > 20 * 1024 * 1024) {
        toast.error(`${file.name}: ไฟล์เกิน 20 MB`);
        return false;
      }
      if (!/\.(pdf|jpe?g|png|xlsx?|docx?|dwg|dxf|step|stp)$/i.test(file.name)) {
        toast.error(`${file.name}: ชนิดไฟล์ไม่รองรับ`);
        return false;
      }
      return true;
    });
    setFiles((current) => [...current, ...accepted]);
  }
  return (
    <>
      <PageHeader
        title={editing ? 'แก้ไขใบสั่งงานผลิตชั่วคราว' : 'ใบสั่งงานผลิตชั่วคราว'}
        subtitle="TEMPORARY WORK ORDER"
        crumb={`ฝ่ายผลิต / ใบสั่งงานผลิตชั่วคราว / ${editing ? 'แก้ไข' : 'สร้างเอกสาร'}`}
        action={
          <>
            <Button
              variant="secondary"
              disabled={busy}
              onClick={form.handleSubmit((values) => persist(values, 'draft'), invalid)}
            >
              <Save size={15} />
              บันทึกร่าง + PDF
            </Button>
            <Button
              variant="secondary"
              disabled={busy}
              onClick={form.handleSubmit(showPreview, invalid)}
            >
              <Eye size={15} />
              ดูตัวอย่างใบจริง
            </Button>
            {user?.permissions.includes('work_order.print') && (
              <Button
                disabled={busy}
                onClick={form.handleSubmit((values) => persist(values, 'pdf'), invalid)}
              >
                <Save size={15} />
                บันทึกและดาวน์โหลด PDF
              </Button>
            )}
            {user?.permissions.includes('work_order.print') && (
              <Button
                variant="secondary"
                disabled={busy}
                onClick={form.handleSubmit((values) => persist(values, 'print'), invalid)}
              >
                <Printer size={15} />
                Print
              </Button>
            )}
            {user?.permissions.includes('work_order.submit') && (
              <Button
                variant="blue"
                disabled={busy}
                onClick={form.handleSubmit(() => setConfirm(true), invalid)}
              >
                <Send size={15} />
                ส่งอนุมัติ
              </Button>
            )}
          </>
        }
      />
      <form onSubmit={form.handleSubmit((values) => persist(values, 'draft'), invalid)}>
        <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,3fr)_minmax(260px,1fr)]">
          <div className="min-w-0 space-y-6">
            <Card
              title="ข้อมูลเอกสาร"
              subtitle="01 / DOCUMENT INFORMATION"
              action={<FileText size={17} className="text-slate-300" />}
            >
              <div className="grid gap-5 sm:grid-cols-3">
                <Field label="เลขที่เอกสาร">
                  <input
                    disabled
                    value={editing ? initial!.documentNo : 'สร้างอัตโนมัติเมื่อบันทึก'}
                  />
                </Field>
                <Field label="วันที่สั่งการ" required error={errors.orderDate?.message}>
                  <input type="date" aria-label="วันที่สั่งการ" {...register('orderDate')} />
                </Field>
                <Field label="ผู้สั่งงาน">
                  <input
                    aria-label="ผู้สั่งงานในเอกสาร"
                    maxLength={150}
                    {...register('issuerDisplayName')}
                  />
                </Field>
                <Field label="แผนก" required error={errors.departmentId?.message}>
                  <select
                    aria-label="แผนก"
                    disabled={!user?.roles.includes('ADMIN')}
                    {...register('departmentId')}
                  >
                    {masters.departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="ความสำคัญ" required>
                  <select aria-label="ความสำคัญ" {...register('priority')}>
                    {priorities.map((p) => (
                      <option key={p} value={p}>
                        {priorityLabels[p]}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="สถานะ">
                  <input disabled value="ร่าง / DRAFT" />
                </Field>
              </div>
            </Card>
            <Card title="รายละเอียดงานผลิต" subtitle="02 / PRODUCTION DETAILS">
              <Field label="รายละเอียดงานผลิต" required error={errors.description?.message}>
                <textarea
                  aria-label="รายละเอียดงานผลิต"
                  rows={4}
                  placeholder="ระบุรายละเอียดงานผลิต ขอบเขตงาน และข้อกำหนด..."
                  {...register('description')}
                />
              </Field>
              <label className="my-4 flex items-center gap-2 text-xs text-slate-600">
                <input
                  type="checkbox"
                  {...register('followAttachment')}
                  onChange={(e) => {
                    form.setValue('followAttachment', e.target.checked);
                    if (e.target.checked && !form.getValues('description'))
                      form.setValue('description', 'ตามเอกสารแนบท้าย');
                  }}
                />
                ตามเอกสารแนบท้าย
              </label>
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragging(false);
                  addFiles(Array.from(e.dataTransfer.files));
                }}
                className={`rounded-xl border-2 border-dashed p-6 text-center ${dragging ? 'border-blue-400 bg-blue-50' : 'border-slate-200 bg-slate-50/50'}`}
              >
                <UploadCloud size={26} className="mx-auto mb-3 text-slate-400" />
                <p className="mb-2 text-xs text-slate-500">
                  ลากไฟล์มาวางที่นี่ หรือ{' '}
                  <label htmlFor="attachments" className="cursor-pointer font-medium text-blue-600">
                    เลือกไฟล์
                  </label>
                </p>
                <input
                  id="attachments"
                  type="file"
                  multiple
                  className="sr-only"
                  accept=".pdf,.jpg,.jpeg,.png,.xls,.xlsx,.doc,.docx,.dwg,.dxf,.step,.stp"
                  onChange={(e) => {
                    addFiles(Array.from(e.target.files ?? []));
                    e.target.value = '';
                  }}
                />
                <p className="text-[10px] text-slate-400">
                  PDF, รูปภาพ, Office, CAD · สูงสุด 20 MB ต่อไฟล์
                </p>
              </div>
              {editing &&
                initial!.attachments.map((a) => (
                  <div
                    key={a.id}
                    className="mt-3 flex items-center gap-2 rounded-lg border border-slate-100 p-3 text-xs"
                  >
                    <Paperclip size={14} />
                    <span>{a.fileName}</span>
                    <span className="ml-auto text-[10px] text-slate-400">
                      {(a.size / 1024).toFixed(0)} KB · {a.uploader.name} · {thaiDate(a.createdAt)}
                    </span>
                  </div>
                ))}
              {files.map((file, i) => (
                <div
                  key={`${file.name}-${i}`}
                  className="mt-3 flex items-center gap-3 rounded-lg border border-slate-100 p-3"
                >
                  <Paperclip size={15} className="text-blue-500" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs">{file.name}</p>
                    <p className="mt-1 text-[10px] text-slate-400">
                      {(file.size / 1024).toFixed(0)} KB · {file.type || 'CAD'} · {user?.name} ·
                      รออัปโหลด
                    </p>
                  </div>
                  <button
                    type="button"
                    aria-label={`นำ ${file.name} ออก`}
                    onClick={() => setFiles((current) => current.filter((_, n) => n !== i))}
                  >
                    <X size={14} className="text-slate-400" />
                  </button>
                </div>
              ))}
            </Card>
            <Card title="ข้อมูลชิ้นงาน" subtitle="03 / PRODUCT INFORMATION">
              <div className="grid gap-5 sm:grid-cols-2">
                <Field
                  label="รหัสชิ้นงาน/ชื่อสินค้า (Product ID/Name)"
                  required
                  error={errors.productCode?.message}
                >
                  <input
                    aria-label="รหัสชิ้นงาน"
                    placeholder="เช่น CALP2609-067"
                    {...register('productCode')}
                  />
                </Field>
                <Field label="ชื่อสินค้าเพิ่มเติม (ถ้ามี)" error={errors.productName?.message}>
                  <input
                    aria-label="ชื่อสินค้า"
                    placeholder="ระบุชื่อชิ้นงาน / สินค้า"
                    {...register('productName')}
                  />
                </Field>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="จำนวนที่สั่งผลิต" required error={errors.quantity?.message}>
                    {data.quantity === null ? (
                      <input
                        aria-label="ข้อความแทนจำนวน"
                        placeholder="ตามเอกสารแนบท้าย"
                        {...register('quantityText')}
                      />
                    ) : (
                      <input
                        aria-label="จำนวนที่สั่งผลิต"
                        type="number"
                        step="0.0001"
                        {...register('quantity', { valueAsNumber: true })}
                      />
                    )}
                    <label className="mt-2 flex items-center gap-2 text-xs">
                      <input
                        type="checkbox"
                        checked={data.quantity === null}
                        onChange={(e) => {
                          form.setValue('quantity', e.target.checked ? null : 1);
                          form.setValue('quantityText', e.target.checked ? 'ตามเอกสารแนบท้าย' : '');
                        }}
                      />
                      ใช้ข้อความแทนจำนวน
                    </label>
                    {errors.quantityText && (
                      <p className="text-xs text-red-600">{errors.quantityText.message}</p>
                    )}
                  </Field>
                  <Field label="หน่วยนับ (Unit)" error={errors.unit?.message}>
                    <input aria-label="หน่วยนับ" {...register('unit')} />
                  </Field>
                </div>
                <Field label="ไลน์ผลิต / เครื่องจักร" required error={errors.machineId?.message}>
                  <select aria-label="เครื่องจักร" {...register('machineId')}>
                    <option value="">เลือกเครื่องจักร</option>
                    {masters.machines
                      .filter((m) => m.active)
                      .map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name}
                        </option>
                      ))}
                  </select>
                </Field>
                <Field label="กำหนดส่งงาน" required error={errors.dueDate?.message}>
                  <input type="date" aria-label="กำหนดส่งงาน" {...register('dueDate')} />
                </Field>
                <Field label="เวลา (เว้นว่างได้)" error={errors.dueTime?.message}>
                  <input type="time" aria-label="เวลา" {...register('dueTime')} />
                </Field>
              </div>
            </Card>
            <Card
              title="รายการวัตถุดิบ / ส่วนประกอบ"
              subtitle="04 / MATERIALS & COMPONENTS"
              action={
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() =>
                    materials.append({
                      materialCode: '',
                      materialName: '',
                      quantity: null,
                      unit: '',
                      remark: '',
                      sortOrder: materials.fields.length,
                    })
                  }
                >
                  <Plus size={14} />
                  เพิ่มวัตถุดิบ
                </Button>
              }
            >
              <div className="scrollbar-thin overflow-x-auto">
                <table className="min-w-[700px]">
                  <thead>
                    <tr>
                      {[
                        '#',
                        'รหัสวัตถุดิบ *',
                        'ชื่อวัตถุดิบ (ถ้ามี)',
                        'จำนวนที่ใช้',
                        'หน่วย',
                        'หมายเหตุ',
                        'จัดการ',
                      ].map((h) => (
                        <th key={h}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {materials.fields.map((field, i) => (
                      <tr key={field.id}>
                        <td>{i + 1}</td>
                        {(
                          ['materialCode', 'materialName', 'quantity', 'unit', 'remark'] as const
                        ).map((key) => (
                          <td
                            key={key}
                            style={{
                              padding: '8px 5px',
                              minWidth: key === 'quantity' ? 80 : key === 'unit' ? 70 : 110,
                            }}
                          >
                            <input
                              aria-label={`${key} ${i + 1}`}
                              type={key === 'quantity' ? 'number' : 'text'}
                              step={key === 'quantity' ? '0.0001' : undefined}
                              {...register(
                                `materials.${i}.${key}`,
                                key === 'quantity'
                                  ? { setValueAs: (value) => (value === '' ? null : Number(value)) }
                                  : {},
                              )}
                            />
                            <p className="mt-1 text-[10px] text-red-600">
                              {errors.materials?.[i]?.[key]?.message}
                            </p>
                          </td>
                        ))}
                        <td>
                          <div className="flex gap-1">
                            <button
                              type="button"
                              aria-label="เลื่อนขึ้น"
                              disabled={i === 0}
                              onClick={() => materials.move(i, i - 1)}
                            >
                              <ArrowUp size={13} />
                            </button>
                            <button
                              type="button"
                              aria-label="เลื่อนลง"
                              disabled={i === materials.fields.length - 1}
                              onClick={() => materials.move(i, i + 1)}
                            >
                              <ArrowDown size={13} />
                            </button>
                            <button
                              type="button"
                              aria-label="ลบวัตถุดิบ"
                              onClick={() => materials.remove(i)}
                            >
                              <Trash2 size={14} className="text-red-400" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!materials.fields.length && (
                  <p className="py-8 text-center text-xs text-slate-400">
                    ยังไม่มีรายการวัตถุดิบ · กดเพิ่มวัตถุดิบเพื่อเริ่มต้น
                  </p>
                )}
              </div>
            </Card>
            <Card title="ขั้นตอน / คำสั่งพิเศษ" subtitle="05 / SPECIAL INSTRUCTIONS">
              <textarea
                aria-label="คำสั่งพิเศษ"
                rows={4}
                placeholder="ขั้นตอนพิเศษ ข้อควรระวัง หรือรายละเอียดเพิ่มเติม..."
                {...register('specialInstructions')}
              />
            </Card>
            <Card title="เหตุผลในการออกเอกสารชั่วคราว" subtitle="06 / TEMPORARY DOCUMENT REASON">
              <div className="flex flex-wrap gap-3">
                {reasons.map((reason) => (
                  <label
                    key={reason}
                    className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-3 text-xs ${data.reasonType === reason ? 'border-red-200 bg-red-50 text-red-700' : 'border-slate-200 text-slate-500'}`}
                  >
                    <input type="radio" value={reason} {...register('reasonType')} />
                    {reasonLabels[reason]}
                  </label>
                ))}
              </div>
              {data.reasonType === 'OTHER' && (
                <div className="mt-4">
                  <Field label="รายละเอียดเพิ่มเติม" required error={errors.reasonDetail?.message}>
                    <textarea aria-label="รายละเอียดเหตุผล" {...register('reasonDetail')} />
                  </Field>
                </div>
              )}
            </Card>
          </div>
          <aside className="space-y-5 xl:sticky xl:top-[100px]">
            <Summary
              priority={data.priority}
              machine={masters.machines.find((m) => m.id === data.machineId)?.name ?? ''}
              dueDate={data.dueDate}
              quantity={data.quantity}
              quantityText={data.quantityText}
              unit={data.unit}
              productCode={data.productCode}
            />
            <Card title="การอนุมัติ / ผู้เกี่ยวข้อง" subtitle="ASSIGN APPROVAL">
              <div className="space-y-5">
                <Field label="ผู้สั่งงาน">
                  <input value={editing ? initial!.issuer.name : user?.name} disabled />
                </Field>
                {(['supervisorId', 'approverId'] as const).map((key, i) => (
                  <Field
                    key={key}
                    label={i === 0 ? 'ผู้รับสั่งงาน / หัวหน้า' : 'ผู้อนุมัติ'}
                    error={errors[key]?.message}
                  >
                    <select
                      aria-label={i === 0 ? 'ผู้รับสั่งงาน / หัวหน้า' : 'ผู้อนุมัติ'}
                      {...register(key)}
                    >
                      <option value="">เว้นว่าง / เลือกก่อนส่งอนุมัติ</option>
                      {masters.people
                        .filter(
                          (p) =>
                            p.id !== (editing ? initial!.issuerId : user?.id) &&
                            (p.roles.includes(i === 0 ? 'SUPERVISOR' : 'APPROVER') ||
                              p.roles.includes('ADMIN')),
                        )
                        .map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                    </select>
                  </Field>
                ))}
              </div>
              <p className="mt-4 flex items-center gap-2 text-[10px] text-slate-400">
                <Check size={12} />
                บันทึกร่างและ PDF ได้ก่อนเลือกผู้อนุมัติ
                ช่องลงชื่อในใบพิมพ์จะเว้นว่างจนกว่าจะอนุมัติ
              </p>
            </Card>
          </aside>
        </div>
        <div className="mt-6 flex items-center justify-between rounded-xl border border-slate-200 bg-white p-5">
          <span className="text-xs text-slate-400">
            * ช่องที่จำเป็น · บันทึกเป็นร่างก่อนส่งอนุมัติ
          </span>
          <Button disabled={busy}>
            {busy ? <Spinner /> : <Save size={15} />}บันทึกเอกสารและเก็บ PDF
          </Button>
        </div>
      </form>
      <Dialog
        open={confirm}
        onOpenChange={setConfirm}
        title="ยืนยันการส่งอนุมัติ"
        description="ระบบจะบันทึกเอกสาร อัปโหลดไฟล์ และส่งให้หัวหน้าหน้างานตรวจสอบ หลังจากส่งแล้วจะไม่สามารถแก้ไขได้"
      >
        <div className="flex justify-end gap-2">
          <Button variant="secondary" disabled={busy} onClick={() => setConfirm(false)}>
            กลับไปตรวจสอบ
          </Button>
          <Button
            variant="blue"
            disabled={busy}
            onClick={form.handleSubmit((values) => persist(values, 'submit'), invalid)}
          >
            {busy && <Spinner />}ยืนยันส่งอนุมัติ
          </Button>
        </div>
      </Dialog>
      <Dialog
        open={preview}
        onOpenChange={setPreview}
        title="ตัวอย่างใบสั่งงาน"
        description="แบบเดียวกับ PDF ที่จะบันทึก เลขที่เอกสารจริงจะออกเมื่อบันทึก"
        wide
      >
        {previewUrl && (
          <iframe
            title="ตัวอย่าง PDF ใบสั่งงาน"
            src={previewUrl}
            className="h-[70vh] w-full rounded border border-slate-200"
          />
        )}
      </Dialog>
    </>
  );
}
