'use client';
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { Master } from '@ats/types';
import { api } from '@/lib/api';
import { Card, Spinner } from './ui/common';
import { Button } from './ui/button';
import { toast } from 'sonner';
const schema = z.object({
  email: z.email('อีเมลไม่ถูกต้อง'),
  username: z
    .string()
    .regex(/^[A-Za-z0-9._-]{3,50}$/, 'ใช้ตัวอักษรอังกฤษ ตัวเลข . _ - อย่างน้อย 3 ตัว'),
  name: z.string().min(1, 'กรุณากรอกชื่อ'),
  position: z.string().min(1, 'กรุณากรอกตำแหน่ง'),
  departmentId: z.uuid('กรุณาเลือกแผนก'),
  password: z.string().min(12, 'รหัสผ่านอย่างน้อย 12 ตัว').max(72),
  role: z.enum(['ADMIN', 'ISSUER', 'SUPERVISOR', 'APPROVER', 'VIEWER']),
});
export function UserSetup() {
  const [open, setOpen] = useState(false);
  const client = useQueryClient();
  const departments = useQuery({
    queryKey: ['departments'],
    queryFn: () => api<Master[]>('/departments'),
  });
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: {
      email: '',
      username: '',
      name: '',
      position: '',
      departmentId: '',
      password: '',
      role: 'VIEWER',
    },
  });
  async function save(data: z.infer<typeof schema>) {
    try {
      const { role, ...fields } = data;
      await api('/users', { method: 'POST', body: JSON.stringify({ ...fields, roles: [role] }) });
      form.reset();
      setOpen(false);
      await client.invalidateQueries();
      toast.success('สร้างผู้ใช้แล้ว');
    } catch (error) {
      toast.error((error as Error).message);
    }
  }
  return (
    <Card
      title="จัดการผู้ใช้งาน"
      subtitle="สร้างบัญชีผู้สั่งงาน หัวหน้า และผู้อนุมัติ"
      action={
        <Button size="sm" variant="secondary" onClick={() => setOpen(!open)}>
          {open ? 'ปิด' : 'เพิ่มผู้ใช้'}
        </Button>
      }
    >
      {open ? (
        <form onSubmit={form.handleSubmit(save)} className="grid gap-4 sm:grid-cols-2">
          {(
            [
              ['email', 'อีเมล'],
              ['username', 'ชื่อผู้ใช้'],
              ['name', 'ชื่อ'],
              ['position', 'ตำแหน่ง'],
              ['password', 'รหัสผ่านเริ่มต้น'],
            ] as const
          ).map(([key, label]) => (
            <div key={key}>
              <label className="field">{label} *</label>
              <input
                aria-label={label}
                type={key === 'password' ? 'password' : 'text'}
                autoComplete={key === 'password' ? 'new-password' : 'off'}
                {...form.register(key)}
              />
              <p className="mt-1 text-[11px] text-red-600">{form.formState.errors[key]?.message}</p>
            </div>
          ))}
          <div>
            <label className="field">แผนก *</label>
            <select aria-label="แผนกผู้ใช้" {...form.register('departmentId')}>
              <option value="">เลือกแผนก</option>
              {departments.data?.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
            <p className="mt-1 text-[11px] text-red-600">
              {form.formState.errors.departmentId?.message}
            </p>
          </div>
          <div>
            <label className="field">บทบาท *</label>
            <select aria-label="บทบาท" {...form.register('role')}>
              {['ADMIN', 'ISSUER', 'SUPERVISOR', 'APPROVER', 'VIEWER'].map((role) => (
                <option key={role}>{role}</option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <Button disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting && <Spinner />}สร้างบัญชี
            </Button>
          </div>
        </form>
      ) : (
        <p className="text-xs leading-6 text-slate-500">
          สร้างผู้รับผิดชอบก่อนออกใบงานจริง ผู้สั่งงาน หัวหน้าหน้างาน และผู้อนุมัติต้องเป็นคนละบัญชี
          เลือกบทบาทให้ตรงกับหน้าที่ของผู้ใช้งาน
        </p>
      )}
    </Card>
  );
}
