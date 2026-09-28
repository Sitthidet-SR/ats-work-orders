'use client';
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Download, Eye, FilePlus2 } from 'lucide-react';
import type { PdfArchive } from '@ats/types';
import { api, openArchivedPdf } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, Empty, Spinner } from '@/components/ui/common';
import { toast } from 'sonner';
export function PdfHistory({ id, canDownload }: { id: string; canDownload: boolean }) {
  const client = useQueryClient();
  const [busy, setBusy] = useState(false);
  const query = useQuery({
    queryKey: ['pdf-history', id],
    queryFn: () => api<PdfArchive[]>(`/work-orders/${id}/pdf-archives`),
  });
  async function save() {
    setBusy(true);
    try {
      await api(`/work-orders/${id}/pdf-archives`, { method: 'POST' });
      await client.invalidateQueries({ queryKey: ['pdf-history', id] });
      await client.invalidateQueries({ queryKey: ['order', id] });
      toast.success('เก็บสำเนา PDF ในประวัติแล้ว');
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function open(item: PdfArchive, download: boolean) {
    try {
      await openArchivedPdf(id, item.id, item.fileName, download);
    } catch (error) {
      toast.error((error as Error).message);
    }
  }
  return (
    <Card
      title="PDF ที่บันทึกไว้ / ดูย้อนหลัง"
      subtitle="สำเนาแต่ละฉบับจะคงข้อมูล ณ วันที่บันทึก"
      action={
        canDownload && (
          <Button size="sm" variant="secondary" disabled={busy} onClick={save}>
            {busy ? <Spinner /> : <FilePlus2 size={15} />}บันทึก PDF ฉบับปัจจุบัน
          </Button>
        )
      }
    >
      {query.isPending ? (
        <Spinner />
      ) : query.error ? (
        <p className="text-sm text-red-600">{query.error.message}</p>
      ) : !query.data?.length ? (
        <Empty text="ยังไม่มีสำเนา PDF ที่บันทึกไว้" />
      ) : (
        <div className="space-y-3">
          {query.data.map((item) => (
            <div
              key={item.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 p-3"
            >
              <div>
                <p className="text-sm font-medium">
                  {item.documentNo} · ฉบับที่ {item.orderVersion + 1}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {new Date(item.createdAt).toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' })} ·{' '}
                  {item.createdBy.name} · {Math.ceil(item.size / 1024)} KB
                </p>
              </div>
              {canDownload && (
                <div className="flex gap-2">
                  <Button size="sm" variant="secondary" onClick={() => open(item, false)}>
                    <Eye size={14} />
                    เปิดดู
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => open(item, true)}>
                    <Download size={14} />
                    ดาวน์โหลด
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
