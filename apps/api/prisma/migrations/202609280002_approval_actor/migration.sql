ALTER TABLE work_order_approvals ADD COLUMN "decidedById" UUID;
ALTER TABLE work_order_approvals ADD CONSTRAINT "work_order_approvals_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE;
-- Recover actual signers from the append-only audit trail for existing decisions.
UPDATE work_order_approvals a SET "decidedById" = (
  SELECT l."userId" FROM audit_logs l
  WHERE l."entityId" = a."workOrderId" AND l."entityType" = 'WorkOrder'
    AND l.action = CASE a.stage WHEN 'ISSUER' THEN 'SUBMIT' WHEN 'SUPERVISOR' THEN 'SUPERVISOR_REVIEW' ELSE CASE a.status WHEN 'REJECTED' THEN 'REJECT' ELSE 'APPROVE' END END
  ORDER BY l."createdAt" DESC LIMIT 1
) WHERE a.status <> 'PENDING';
