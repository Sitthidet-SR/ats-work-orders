import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Prisma } from '@prisma/client';
import { WorkOrdersService, orderInclude } from '../src/modules/work-orders/work-orders.service';
import { PrismaService } from '../src/common/prisma.service';
import { DocumentSequenceService } from '../src/modules/documents/document-sequence.service';
import { WorkflowService } from '../src/modules/work-orders/workflow.service';
import { AuditService } from '../src/modules/audit/audit.service';
import { CreateWorkOrderDto, UpdateWorkOrderDto } from '../src/modules/work-orders/work-order.dto';
import { Actor } from '../src/modules/auth/auth.types';

test('text quantities survive create, read, updates and switches to numeric quantities', async () => {
  type StoredOrder = Prisma.WorkOrderGetPayload<{ include: typeof orderInclude }>;
  let stored: StoredOrder;
  let sequenceDate: Date | undefined;
  const tx = {
    workOrder: {
      create: async ({ data }: { data: Prisma.WorkOrderCreateInput }) => {
        stored = {
          ...data,
          id: 'order',
          status: 'DRAFT',
          version: 0,
          materials: [],
          approvals: data.approvals!.create,
        } as unknown as StoredOrder;
        return stored;
      },
      findUnique: async () => stored,
      findUniqueOrThrow: async () => stored,
      findFirst: async () => stored,
      updateMany: async ({ data }: { data: Prisma.WorkOrderUpdateManyMutationInput }) => {
        stored = { ...stored, ...data, version: stored.version + 1 } as unknown as StoredOrder;
        return { count: 1 };
      },
    },
    workOrderMaterial: { deleteMany: async () => {}, createMany: async () => {} },
    workOrderApproval: { deleteMany: async () => {} },
  };
  const db = {
    ...tx,
    machine: { findUnique: async () => ({ active: true }) },
    auditLog: { findMany: async () => [] },
    $transaction: async (operation: (transaction: typeof tx) => Promise<unknown>) => operation(tx),
  } as unknown as PrismaService;
  const sequence = {
    next: async (_tx: unknown, date: Date) => {
      sequenceDate = date;
      return 'PN2609001';
    },
  } as unknown as DocumentSequenceService;
  const service = new WorkOrdersService(db, sequence, new WorkflowService(), {
    write: async () => {},
  } as unknown as AuditService);
  const actor = { id: 'issuer', roles: ['ADMIN'], departmentId: 'department' } as Actor;
  const input = {
    orderDate: '2026-09-28',
    dueDate: '2026-09-30',
    machineId: 'machine',
    departmentId: 'department',
    quantity: null,
    quantityText: ' ตามเอกสารแนบท้าย ',
    materials: [],
    reasonType: 'URGENT',
    reasonDetail: '',
    supervisorId: '',
    approverId: '',
  } as unknown as CreateWorkOrderDto;
  const created = await service.create(input, actor, {});
  assert.equal(created.quantity, null);
  assert.equal(created.quantityText, 'ตามเอกสารแนบท้าย');
  assert.equal(sequenceDate?.toISOString(), '2026-09-28T00:00:00.000Z');
  assert.equal((await service.detail('order')).quantity, null);
  assert.equal((await service.detail('order')).quantityText, 'ตามเอกสารแนบท้าย');
  const resaved = await service.update(
    'order',
    { version: 0, description: 'แก้รายละเอียด' } as UpdateWorkOrderDto,
    actor,
    {},
  );
  assert.equal(resaved.quantity, null);
  assert.equal(resaved.quantityText, 'ตามเอกสารแนบท้าย');
  const numeric = await service.update(
    'order',
    { version: 1, quantity: 12.5 } as UpdateWorkOrderDto,
    actor,
    {},
  );
  assert.equal(numeric.quantity, 12.5);
  assert.equal(numeric.quantityText, '');
  const text = await service.update(
    'order',
    { version: 2, quantity: null, quantityText: 'ตามใบแนบ 25 ชิ้น' } as UpdateWorkOrderDto,
    actor,
    {},
  );
  assert.equal(text.quantity, null);
  assert.equal(text.quantityText, 'ตามใบแนบ 25 ชิ้น');
  assert.equal(text.documentNo, created.documentNo);
});
