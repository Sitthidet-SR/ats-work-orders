'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, ArrowRight, ShieldCheck, Layers, Factory } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAuth } from '@/components/providers';
import { Brand } from '@/components/erp-shell';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/common';
const schema = z.object({
  identifier: z.string().min(1, 'กรุณากรอกชื่อผู้ใช้หรืออีเมล'),
  password: z.string().min(1, 'กรุณากรอกรหัสผ่าน'),
  remember: z.boolean(),
});
export default function Login() {
  const { login, user, loading } = useAuth();
  const router = useRouter();
  const [visible, setVisible] = useState(false);
  const [error, setError] = useState('');
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { identifier: '', password: '', remember: false },
  });
  useEffect(() => {
    if (user && !loading) router.replace('/dashboard');
  }, [user, loading, router]);
  async function submit(data: z.infer<typeof schema>) {
    setError('');
    try {
      await login(data.identifier, data.password, data.remember);
      router.replace('/dashboard');
    } catch (e) {
      setError((e as Error).message);
    }
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
          <p className="mb-4 text-[11px] tracking-[3px] text-red-400">BUILT FOR YOUR OPERATIONS</p>
          <h1 className="text-4xl font-semibold leading-[1.5] text-white">
            ทุกงานผลิต
            <br />
            เชื่อมต่อเป็นระบบเดียว
          </h1>
          <p className="mt-5 max-w-md text-sm leading-7 text-slate-400">
            จัดการใบสั่งงาน ตรวจสอบ และอนุมัติเอกสาร
            <br />
            พร้อมขับเคลื่อนการทำงานของทีมอย่างเป็นระบบ
          </p>
          <div className="mt-10 flex gap-8 text-xs text-slate-300">
            <span className="flex items-center gap-2">
              <ShieldCheck size={16} className="text-red-400" />
              ปลอดภัยด้วยสิทธิ์ผู้ใช้งาน
            </span>
            <span className="flex items-center gap-2">
              <Layers size={16} className="text-red-400" />
              รองรับการเติบโตของ ERP
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
            WELCOME TO ATS
          </p>
          <h2 className="text-[29px] font-semibold">เข้าสู่ระบบ</h2>
          <p className="mb-8 mt-2 text-sm text-slate-400">Temporary Work Order System</p>
          <form onSubmit={form.handleSubmit(submit)} className="space-y-5">
            <div>
              <label className="field" htmlFor="identifier">
                อีเมล / ชื่อผู้ใช้
              </label>
              <input
                id="identifier"
                autoComplete="username"
                placeholder="name@company.com"
                {...form.register('identifier')}
              />
              <p className="mt-1 text-xs text-red-600">
                {form.formState.errors.identifier?.message}
              </p>
            </div>
            <div>
              <label className="field" htmlFor="password">
                รหัสผ่าน
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={visible ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="กรอกรหัสผ่าน"
                  {...form.register('password')}
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
              <p className="mt-1 text-xs text-red-600">{form.formState.errors.password?.message}</p>
            </div>
            <label className="flex items-center gap-2 text-xs text-slate-500">
              <input type="checkbox" {...form.register('remember')} />
              จดจำการเข้าสู่ระบบ 30 วัน
            </label>
            {error && (
              <p role="alert" className="rounded-lg bg-red-50 p-3 text-xs text-red-700">
                {error}
              </p>
            )}
            <Button className="w-full" disabled={form.formState.isSubmitting || loading}>
              {form.formState.isSubmitting ? <Spinner /> : <ArrowRight size={16} />}เข้าสู่ระบบ
            </Button>
          </form>
          <p className="mt-8 border-t border-slate-100 pt-5 text-center text-[10px] text-slate-400">
            สำหรับผู้ใช้งานภายใน AUTO-TECHSYSTEM เท่านั้น
          </p>
        </div>
      </div>
    </div>
  );
}
