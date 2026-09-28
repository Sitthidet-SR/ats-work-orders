import { Request } from 'express';
export interface Actor {
  id: string;
  email: string;
  username: string;
  name: string;
  position: string;
  departmentId: string;
  department: { id: string; code: string; name: string };
  roles: string[];
  permissions: string[];
  forcePasswordChange: boolean;
}
export interface AuthRequest extends Request {
  user: Actor;
}
export interface AuditContext {
  ipAddress?: string;
  userAgent?: string;
}
export function auditContext(req: Request): AuditContext {
  return { ipAddress: req.ip, userAgent: req.get('user-agent')?.slice(0, 512) };
}
