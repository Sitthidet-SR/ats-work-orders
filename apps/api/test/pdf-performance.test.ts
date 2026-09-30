import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chromium, type Browser } from 'playwright';
import { PdfService } from '../src/modules/documents/pdf.service';
import { PrismaService } from '../src/common/prisma.service';
import { WorkOrdersService } from '../src/modules/work-orders/work-orders.service';
import { Actor } from '../src/modules/auth/auth.types';
import { CreateWorkOrderDto } from '../src/modules/work-orders/work-order.dto';
import { PdfAttachmentsService } from '../src/modules/documents/pdf-attachments.service';

const dto = {
  issuerDisplayName: 'Issuer',
  departmentId: 'department',
  machineId: 'machine',
  followAttachment: false,
  productName: '',
  dueTime: '',
  priority: 'NORMAL',
  reasonDetail: '',
  supervisorId: '',
  approverId: '',
  materials: [],
  orderDate: '2026-09-29',
  dueDate: '2026-09-30',
  description: '',
  productCode: '',
  specialInstructions: '',
  quantity: 1,
  unit: '',
  reasonType: 'URGENT',
} as CreateWorkOrderDto;
const actor = { id: 'actor', permissions: ['work_order.print'] } as Actor;
function database() {
  return {
    user: { findUniqueOrThrow: async () => ({ name: 'Issuer' }) },
    department: { findUniqueOrThrow: async () => ({ name: 'Department' }) },
    machine: { findUniqueOrThrow: async () => ({ name: 'Machine' }) },
    workOrderPdf: {
      findUnique: async () => ({
        id: 'archive',
        documentNo: 'PN2609027',
        fileName: 'saved.pdf',
        content: Buffer.from('%PDF-cached'),
      }),
    },
  } as unknown as PrismaService;
}

test('PDF requests reuse Chromium, close every page and restart after disconnect', async (t) => {
  let launches = 0,
    pages = 0,
    closedPages = 0,
    openPages = 0,
    maxOpenPages = 0,
    closedBrowsers = 0;
  let disconnected: (() => void) | undefined;
  t.mock.method(chromium, 'launch', async () => {
    launches++;
    return {
      on: (_event: string, handler: () => void) => {
        disconnected = handler;
      },
      close: async () => {
        closedBrowsers++;
      },
      newPage: async () => {
        pages++;
        openPages++;
        maxOpenPages = Math.max(maxOpenPages, openPages);
        return {
          setContent: async () => {},
          evaluate: async () => {},
          pdf: async () => Buffer.from('%PDF-new'),
          close: async () => {
            closedPages++;
            openPages--;
          },
        };
      },
    } as unknown as Browser;
  });
  const service = new PdfService({} as WorkOrdersService, database(), {} as PdfAttachmentsService);
  await Promise.all([service.preview(dto, actor), service.preview(dto, actor)]);
  assert.equal(launches, 1);
  assert.equal(maxOpenPages, 1, 'Concurrent PDF rendering must remain bounded');
  disconnected!();
  await service.preview(dto, actor);
  assert.equal(launches, 2);
  assert.equal(pages, closedPages);
  await service.onModuleDestroy();
  assert.equal(closedBrowsers, 1);
});

test('a failed browser launch is retried by the next PDF request', async (t) => {
  let launches = 0;
  t.mock.method(chromium, 'launch', async () => {
    if (++launches === 1) throw new Error('launch failed');
    return {
      on: () => {},
      close: async () => {},
      newPage: async () => ({
        setContent: async () => {},
        evaluate: async () => {},
        pdf: async () => Buffer.from('%PDF-retry'),
        close: async () => {},
      }),
    } as unknown as Browser;
  });
  const service = new PdfService({} as WorkOrdersService, database(), {} as PdfAttachmentsService);
  await assert.rejects(service.preview(dto, actor), /launch failed/);
  assert.equal((await service.preview(dto, actor)).toString(), '%PDF-retry');
  assert.equal(launches, 2);
  await service.onModuleDestroy();
});

test(
  'cached PDFs bypass the render queue and still enforce owner and print permissions',
  { timeout: 2000 },
  async (t) => {
    let finish!: () => void, started!: () => void;
    const ready = new Promise<void>((resolve) => {
      started = resolve;
    });
    const blocked = new Promise<void>((resolve) => {
      finish = resolve;
    });
    t.mock.method(
      chromium,
      'launch',
      async () =>
        ({
          on: () => {},
          close: async () => {},
          newPage: async () => ({
            setContent: async () => {},
            evaluate: async () => {},
            pdf: async () => {
              started();
              await blocked;
              return Buffer.from('%PDF-preview');
            },
            close: async () => {},
          }),
        }) as unknown as Browser,
    );
    let ownerChecks = 0;
    const orders = {
      detail: async () => ({ id: 'order', version: 0 }),
      assertOwner: () => {
        ownerChecks++;
      },
    } as unknown as WorkOrdersService;
    const service = new PdfService(orders, database(), {} as PdfAttachmentsService);
    const preview = service.preview(dto, actor);
    try {
      await ready;
      const saved = await service.generate('order', actor, 'work_order.print');
      assert.equal(saved.buffer.toString(), '%PDF-cached');
      assert.equal(ownerChecks, 1);
      await assert.rejects(
        service.generate('order', { ...actor, permissions: [] }, 'work_order.print'),
        /ไม่มีสิทธิ์/,
      );
    } finally {
      finish();
      await preview;
      await service.onModuleDestroy();
    }
  },
);
