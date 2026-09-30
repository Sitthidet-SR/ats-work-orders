import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PrismaService } from '../src/common/prisma.service';
import { WorkOrdersService } from '../src/modules/work-orders/work-orders.service';
import { WorkflowService } from '../src/modules/work-orders/workflow.service';
import { DocumentSequenceService } from '../src/modules/documents/document-sequence.service';
import { AuditService } from '../src/modules/audit/audit.service';
import { Actor, AuditContext } from '../src/modules/auth/auth.types';
import { CreateWorkOrderDto } from '../src/modules/work-orders/work-order.dto';

function harness(selfApproval: boolean) {
  const issuerId = 'issuer';
  const approvals = [
    { stage: 'ISSUER', userId: issuerId, status: 'PENDING', user: { id: issuerId } },
    ...(selfApproval ? [] : [{ stage: 'SUPERVISOR', userId: 'supervisor', status: 'PENDING', user: { id: 'supervisor' } }]),
    { stage: 'APPROVER', userId: selfApproval ? issuerId : 'approver', status: 'PENDING', user: { id: selfApproval ? issuerId : 'approver' } },
  ];
  const order = { id: 'order', issuerId, status: 'DRAFT', version: 0, approvals, attachments: [], followAttachment: false, quantity: 1, materials: [] };
  const decisions: string[] = [];
  const auditActions: string[] = [];
  const tx = {
    workOrder: {
      findUnique: async () => order,
      findUniqueOrThrow: async () => order,
      updateMany: async ({ where, data }: { where: { status: string; version: number }; data: { status: string } }) => {
        if (order.status !== where.status || order.version !== where.version) return { count: 0 };
        order.status = data.status;
        order.version++;
        return { count: 1 };
      },
    },
    workOrderApproval: {
      update: async ({ where, data }: { where: { workOrderId_stage: { stage: string } }; data: { status: string; decidedById: string } }) => {
        const approval = approvals.find((item) => item.stage === where.workOrderId_stage.stage)!;
        approval.status = data.status;
        decisions.push(`${approval.stage}:${data.decidedById}`);
      },
    },
  };
  const db = { $transaction: async (operation: (client: typeof tx) => Promise<unknown>) => operation(tx) } as unknown as PrismaService;
  const audit = { write: async (_tx: unknown, _actor: unknown, action: string) => { auditActions.push(action); } } as unknown as AuditService;
  const service = new WorkOrdersService(db, {} as DocumentSequenceService, new WorkflowService(), audit);
  const issuer = { id: issuerId, roles: ['APPROVER'], permissions: ['work_order.approve'] } as Actor;
  const approver = { id: 'approver', roles: ['APPROVER'], permissions: ['work_order.approve'] } as Actor;
  return { service, order, approvals, decisions, auditActions, issuer, approver };
}

test('authorized issuer submits and approves in one auditable transaction', async () => {
  const { service, order, approvals, decisions, auditActions, issuer } = harness(true);
  const context = {} as AuditContext;
  await service.action('order', 'submit', { version: 0 }, issuer, context);
  assert.equal(order.status, 'APPROVED');
  assert.equal(approvals.find((item) => item.stage === 'APPROVER')?.status, 'APPROVED');
  assert.deepEqual(decisions, ['ISSUER:issuer', 'APPROVER:issuer']);
  assert.deepEqual(auditActions, ['SUBMIT_AND_APPROVE']);
});

test('older submitted self-approved orders can still be approved explicitly', async () => {
  const { service, order, decisions, issuer } = harness(true);
  order.status = 'SUBMITTED';
  order.version = 1;
  await service.action('order', 'approve', { version: 1 }, issuer, {} as AuditContext);
  assert.equal(order.status, 'APPROVED');
  assert.deepEqual(decisions, ['APPROVER:issuer']);
});

test('self-approval on submit requires approver permission', async () => {
  const { service, order, decisions, issuer } = harness(true);
  issuer.permissions = ['work_order.submit'];
  await assert.rejects(service.action('order', 'submit', { version: 0 }, issuer, {} as AuditContext));
  assert.equal(order.status, 'DRAFT');
  assert.deepEqual(decisions, []);
});

test('admin submitting another issuer’s order does not approve it as the issuer', async () => {
  const { service, order, decisions } = harness(true);
  const admin = { id: 'admin', roles: ['ADMIN'], permissions: ['work_order.submit'] } as Actor;
  await service.action('order', 'submit', { version: 0 }, admin, {} as AuditContext);
  assert.equal(order.status, 'SUBMITTED');
  assert.deepEqual(decisions, ['ISSUER:admin']);
});

test('a different approver cannot skip the assigned supervisor', async () => {
  const { service, order, issuer, approver } = harness(false);
  const context = {} as AuditContext;
  await service.action('order', 'submit', { version: 0 }, issuer, context);
  await assert.rejects(service.action('order', 'approve', { version: 1 }, approver, context));
  assert.equal(order.status, 'SUBMITTED');
});

test('an issuer without the approver role cannot assign themselves to approve', async () => {
  const db = {
    machine: { findUnique: async () => ({ active: true }) },
    user: { findFirst: async () => null },
  } as unknown as PrismaService;
  const service = new WorkOrdersService(
    db, {} as DocumentSequenceService, new WorkflowService(), {} as AuditService,
  );
  const issuer = { id: 'issuer', roles: ['ISSUER'], departmentId: 'department' } as Actor;
  const input = {
    issuerDisplayName: 'Issuer', quantity: 1, orderDate: '2026-09-30', dueDate: '2026-10-01',
    reasonType: 'URGENT', reasonDetail: '', departmentId: 'department', machineId: 'machine',
    supervisorId: '', approverId: 'issuer',
  } as CreateWorkOrderDto;
  await assert.rejects(service.create(input, issuer, {} as AuditContext), /APPROVER/);
});
