'use client';
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import type { Master, AuditEvent, Page } from '@ats/types';
import { api } from '@/lib/api';
import { useAuth } from '@/components/providers';
import { PageHeader } from '@/components/erp-shell';
import { Button } from '@/components/ui/button';
import { Card, ErrorState, Loading } from '@/components/ui/common';
import { thaiDate } from '@/lib/utils';
import { toast } from 'sonner';
import { UserSetup } from '@/components/user-setup';
export default function Settings() {
  const { user } = useAuth();
  const client = useQueryClient();
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const machines = useQuery({
    queryKey: ['machines'],
    queryFn: () => api<Master[]>('/machines'),
    enabled: !!user,
  });
  const logs = useQuery({
    queryKey: ['audit'],
    queryFn: () => api<Page<AuditEvent>>('/audit-logs?limit=20'),
    enabled: !!user?.permissions.includes('audit.read'),
  });
  if (machines.isPending) return <Loading />;
  if (machines.error) return <ErrorState error={machines.error} />;
  async function create() {
    setBusy(true);
    try {
      await api('/machines', {
        method: 'POST',
        body: JSON.stringify({ code, name, description: '', active: true }),
      });
      setCode('');
      setName('');
      await client.invalidateQueries({ queryKey: ['machines'] });
      toast.success('เพิ่มเครื่องจักรแล้ว');
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageHeader title="ตั้งค่าระบบ" subtitle="Machine Master & Audit" crumb="ตั้งค่า" />
      <div className="grid items-start gap-6 xl:grid-cols-2">
        {user?.permissions.includes('master.manage') && <UserSetup />}
        <Card title="เครื่องจักร / Machine Master">
          {user?.permissions.includes('master.manage') && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                create();
              }}
              className="mb-5 flex flex-wrap gap-2"
            >
              <input
                required
                aria-label="รหัสเครื่องจักร"
                placeholder="รหัสเครื่องจักร"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="min-w-24 flex-1"
                maxLength={30}
              />
              <input
                required
                aria-label="ชื่อเครื่องจักร"
                placeholder="ชื่อเครื่องจักร"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="min-w-24 flex-1"
                maxLength={100}
              />
              <Button disabled={busy}>
                <Plus size={15} />
                เพิ่ม
              </Button>
            </form>
          )}
          <table>
            <thead>
              <tr>
                <th>รหัส</th>
                <th>เครื่องจักร</th>
                <th>สถานะ</th>
              </tr>
            </thead>
            <tbody>
              {machines.data.map((m) => (
                <tr key={m.id}>
                  <td>{m.code}</td>
                  <td>{m.name}</td>
                  <td>{m.active ? 'ใช้งาน' : 'ปิดใช้งาน'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
        {user?.permissions.includes('audit.read') && (
          <Card title="Audit Log ล่าสุด" subtitle="ประวัติการดำเนินการ · ไม่สามารถแก้ไขได้">
            {logs.error ? (
              <ErrorState error={logs.error} />
            ) : (
              <div className="space-y-3">
                {logs.data?.items.map((log) => (
                  <div
                    key={log.id}
                    className="flex justify-between gap-3 border-b border-slate-100 pb-3 text-xs"
                  >
                    <span>
                      {log.user.name} · {log.action}
                    </span>
                    <span className="text-slate-400">{thaiDate(log.createdAt)}</span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        )}
      </div>
    </>
  );
}
