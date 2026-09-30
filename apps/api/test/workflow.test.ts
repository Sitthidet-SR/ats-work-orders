import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WorkflowService } from '../src/modules/work-orders/workflow.service';
import { WorkOrderStatus } from '@prisma/client';
const workflow = new WorkflowService();
test('full lifecycle passes every review step', () => {
  let status: WorkOrderStatus = 'DRAFT';
  for (const action of [
    'submit',
    'supervisor-review',
    'supervisor-review',
    'approve',
    'issue',
    'start',
    'complete',
  ] as const)
    status = workflow.next(status, action);
  assert.equal(status, 'COMPLETED');
});
test('terminal documents cannot resume or cancel', () => {
  for (const status of ['COMPLETED', 'CANCELLED', 'REJECTED'] as const)
    for (const action of ['submit', 'approve', 'start', 'cancel'] as const)
      assert.throws(() => workflow.next(status, action));
});
test('cannot approve before supervisor review, or skip issuing', () => {
  assert.throws(() => workflow.next('SUBMITTED', 'approve'));
  assert.throws(() => workflow.next('APPROVED', 'start'));
  assert.equal(workflow.next('WAITING_APPROVAL', 'reject'), 'REJECTED');
});
test('an assigned self approver can decide after submitting without a supervisor step', () => {
  assert.equal(workflow.next('SUBMITTED', 'approve', true), 'APPROVED');
  assert.equal(workflow.next('SUBMITTED', 'reject', true), 'REJECTED');
  assert.throws(() => workflow.next('DRAFT', 'approve', true));
});
