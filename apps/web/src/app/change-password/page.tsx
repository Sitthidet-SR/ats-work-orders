'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, Check, Factory, ShieldCheck, Layers } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAuth } from '@/components/providers';
import { Brand } from '@/components/erp-shell';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/common';
import { api, refreshSession } from '@/lib/api';
import { toast } from 'sonner';

const schema = z
  .object({
    newPassword: z.string().min(12, 'รหัสผ่านต้องมีความยาวอย่างน้อย 12 ตัวอักษร'),
    confirmPassword: z.string().min(12, 'กรุณายืนยันรหัสผ่าน'),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'รหัสผ่านไม่ตรงกัน',
    path: ['confirmPassword'],
  });

export default function ChangePassword() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [visible, setVisible] = useState(false);
  const [error, setError] = useState('');

  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { newPassword: '', confirmPassword: '' },
  });

  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.replace('/login');
      } else if (!user.forcePasswordChange) {
        router.replace('/dashboard');
      }
    }
  }, [user, loading, router]);

  async function submit(data: z.infer<typeof schema>) {
    setError('');
    try {
      await api('/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ newPassword: data.newPassword }),
      });
      toast.success('เปลี่ยนรหัสผ่านสำเร็จ');
      // Refresh session to update forcePasswordChange flag in memory
      await refreshSession();
      // force reload or router push, but AuthProvider should update state via refreshSession...
      // wait, AuthProvider does not export a way to update the user without login. 
      // A full page reload is safest to get the new session into AuthProvider.
      window.location.href = '/dashboard';
    } catch (e) {
      setError((e as Error).message);
    }
  }

  if (loading || !user || !user.forcePasswordChange) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden flex-col justify-between overflow-hidden bg-[#152238] p-14 lg:flex">
        <Brand light />
        <div className="absolute -right-32 top-40 h-[600px] w-[600px] rounded-full border border-white/5" />
        <div className="absolute -right-16 top-56 h-[450px] w-[450px] rounded-full border border-white/5" />
        <div className="relative">
          <div className="mb-7 flex h-14 w-14 items-center justify-center rounded-xl border border-white/15 bg-white/5">
            <Factory className="text-red-400" size={28} />
          </div>
          <p className="mb-4 text-[11px] tracking-[3px] text-red-400">SECURITY REQUIREMENT</p>
          <h1 className="text-4xl font-semibold leading-[1.5] text-white">
            ความปลอดภัย
            <br />
            เริ่มต้นที่ตัวคุณ
          </h1>
          <p className="mt-5 max-w-md text-sm leading-7 text-slate-400">
            กรุณาตั้งรหัสผ่านใหม่เพื่อความปลอดภัยของบัญชีของคุณ
            <br />
            (สำหรับการเข้าสู่ระบบครั้งแรก หรือถูกรีเซ็ตรหัสผ่าน)
          </p>
          <div className="mt-10 flex gap-8 text-xs text-slate-300">
            <span className="flex items-center gap-2">
              <ShieldCheck size={16} className="text-red-400" />
              บังคับตั้งรหัสผ่านใหม่
            </span>
            <span className="flex items-center gap-2">
              <Layers size={16} className="text-red-400" />
              การเข้ารหัสมาตรฐานสากล
            </span>
          </div>
        </div>
        <p className="relative text-[10px] tracking-wider text-slate-500">
          AUTO-TECHSYSTEM CO., LTD. · COMPANY PLATFORM
        </p>
      </div>
      <div className="flex items-center justify-center bg-white px-6 py-12">
        <div className="w-full max-w-[380px]">
          <div className="mb-12 lg:hidden">
            <Brand />
          </div>
          <p className="mb-3 text-[11px] font-semibold tracking-[2px] text-[#c62836]">
            UPDATE YOUR PASSWORD
          </p>
          <h2 className="text-[29px] font-semibold">เปลี่ยนรหัสผ่าน</h2>
          <p className="mb-8 mt-2 text-sm text-slate-400">คุณ {user?.name}</p>
          <form onSubmit={form.handleSubmit(submit)} className="space-y-5">
            <div>
              <label className="field" htmlFor="newPassword">
                รหัสผ่านใหม่ (อย่างน้อย 12 ตัวอักษร)
              </label>
              <div className="relative">
                <input
                  id="newPassword"
                  type={visible ? 'text' : 'password'}
                  placeholder="รหัสผ่านใหม่"
                  {...form.register('newPassword')}
                />
                <button
                  type="button"
                  aria-label={visible ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'}
                  className="absolute right-3 top-3 text-slate-400"
                  onClick={() => setVisible(!visible)}
                >
                  {visible ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
              <p className="mt-1 text-xs text-red-600">
                {form.formState.errors.newPassword?.message}
              </p>
            </div>
            <div>
              <label className="field" htmlFor="confirmPassword">
                ยืนยันรหัสผ่านใหม่
              </label>
              <div className="relative">
                <input
                  id="confirmPassword"
                  type={visible ? 'text' : 'password'}
                  placeholder="ยืนยันรหัสผ่านใหม่"
                  {...form.register('confirmPassword')}
                />
              </div>
              <p className="mt-1 text-xs text-red-600">
                {form.formState.errors.confirmPassword?.message}
              </p>
            </div>
            {error && (
              <p role="alert" className="rounded-lg bg-red-50 p-3 text-xs text-red-700">
                {error}
              </p>
            )}
            <Button className="w-full" disabled={form.formState.isSubmitting || loading}>
              {form.formState.isSubmitting ? <Spinner /> : <Check size={16} />} ยืนยันการเปลี่ยนรหัสผ่าน
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
