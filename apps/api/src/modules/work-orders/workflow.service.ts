import { ConflictException, Injectable } from '@nestjs/common';
import { WorkOrderStatus } from '@prisma/client';
export type WorkflowAction =
  'submit' | 'supervisor-review' | 'approve' | 'reject' | 'issue' | 'start' | 'complete' | 'cancel';
const transitions: Record<
  Exclude<WorkflowAction, 'cancel'>,
  Partial<Record<WorkOrderStatus, WorkOrderStatus>>
> = {
  submit: { DRAFT: 'SUBMITTED' },
  'supervisor-review': { SUBMITTED: 'SUPERVISOR_REVIEW', SUPERVISOR_REVIEW: 'WAITING_APPROVAL' },
  approve: { WAITING_APPROVAL: 'APPROVED' },
  reject: { WAITING_APPROVAL: 'REJECTED' },
  issue: { APPROVED: 'ISSUED' },
  start: { ISSUED: 'IN_PROGRESS' },
  complete: { IN_PROGRESS: 'COMPLETED' },
};
@Injectable()
export class WorkflowService {
  next(status: WorkOrderStatus, action: WorkflowAction, directApproval = false): WorkOrderStatus {
    if (directApproval && status === 'DRAFT' && action === 'submit')
      return WorkOrderStatus.APPROVED;
    if (directApproval && status === 'SUBMITTED') {
      if (action === 'approve') return WorkOrderStatus.APPROVED;
      if (action === 'reject') return WorkOrderStatus.REJECTED;
    }
    if (action === 'cancel' && !['COMPLETED', 'CANCELLED', 'REJECTED'].includes(status))
      return WorkOrderStatus.CANCELLED;
    const next = action === 'cancel' ? undefined : transitions[action][status];
    if (!next) throw new ConflictException(`ไม่สามารถ ${action} จากสถานะ ${status}`);
    return next;
  }
}
