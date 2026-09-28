import { SetMetadata } from '@nestjs/common';
export const RequirePermission = (permission: string) => SetMetadata('permission', permission);
export const Public = () => SetMetadata('public', true);
export const permissionNames = [
  'create',
  'read',
  'update',
  'delete',
  'submit',
  'supervisor_review',
  'approve',
  'reject',
  'issue',
  'start',
  'complete',
  'cancel',
  'print',
  'export',
].map((name) => `work_order.${name}`);
export const rolePermissions: Record<string, string[]> = {
  ADMIN: [...permissionNames, 'master.manage', 'audit.read', 'users.read'],
  ISSUER: [
    'work_order.create',
    'work_order.read',
    'work_order.update',
    'work_order.submit',
    'work_order.print',
  ],
  SUPERVISOR: ['work_order.read', 'work_order.supervisor_review'],
  APPROVER: ['work_order.read', 'work_order.approve', 'work_order.reject'],
  VIEWER: ['work_order.read'],
};
