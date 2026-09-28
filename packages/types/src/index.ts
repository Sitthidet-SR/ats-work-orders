export const statuses = [
  'DRAFT',
  'SUBMITTED',
  'SUPERVISOR_REVIEW',
  'WAITING_APPROVAL',
  'APPROVED',
  'ISSUED',
  'IN_PROGRESS',
  'COMPLETED',
  'REJECTED',
  'CANCELLED',
] as const;
export type WorkOrderStatus = (typeof statuses)[number];
export const priorities = ['NORMAL', 'URGENT', 'CRITICAL'] as const;
export const reasons = ['REWORK', 'SAMPLE', 'ERP_FAILURE', 'URGENT', 'OTHER'] as const;
export const statusLabels: Record<WorkOrderStatus, string> = {
  DRAFT: 'ร่าง',
  SUBMITTED: 'ส่งตรวจสอบ',
  SUPERVISOR_REVIEW: 'หัวหน้าตรวจสอบ',
  WAITING_APPROVAL: 'รออนุมัติ',
  APPROVED: 'อนุมัติแล้ว',
  ISSUED: 'ออกเอกสารแล้ว',
  IN_PROGRESS: 'กำลังดำเนินการ',
  COMPLETED: 'เสร็จแล้ว',
  REJECTED: 'ไม่อนุมัติ',
  CANCELLED: 'ยกเลิก',
};
export const priorityLabels = { NORMAL: 'ปกติ', URGENT: 'ด่วน', CRITICAL: 'ด่วนที่สุด' };
export const reasonLabels = {
  REWORK: 'งานแก้ไข',
  SAMPLE: 'ผลิตสินค้าตัวอย่าง',
  ERP_FAILURE: 'ระบบ ERP ขัดข้อง',
  URGENT: 'งานด่วน',
  OTHER: 'อื่น ๆ',
};
export interface Master {
  id: string;
  code: string;
  name: string;
  active?: boolean;
  description?: string | null;
}
export interface Person {
  id: string;
  email: string;
  username: string;
  name: string;
  position: string;
  departmentId: string;
  department: Master;
  roles: string[];
  permissions: string[];
  forcePasswordChange?: boolean;
}
export interface Material {
  id?: string;
  materialCode: string;
  materialName: string;
  quantity: number | null;
  unit: string;
  remark: string;
  sortOrder: number;
}
export interface Attachment {
  id: string;
  fileName: string;
  size: number;
  mimeType: string;
  createdAt: string;
  uploader: { name: string };
}
export interface Approval {
  id: string;
  stage: string;
  status: string;
  comment: string | null;
  decidedAt: string | null;
  decidedBy: { id: string; name: string; position: string; department: Master } | null;
  user: { id: string; name: string; position: string; department: Master };
}
export interface AuditEvent {
  id: string;
  action: string;
  createdAt: string;
  user: { name: string };
  oldValue: unknown;
  newValue: unknown;
}
export interface WorkOrderInput {
  issuerDisplayName?: string;
  quantityText?: string;
  orderDate: string;
  departmentId: string;
  description: string;
  followAttachment: boolean;
  productCode: string;
  productName: string;
  quantity: number | null;
  unit: string;
  machineId: string;
  dueDate: string;
  dueTime: string;
  priority: (typeof priorities)[number];
  reasonType: (typeof reasons)[number];
  reasonDetail: string;
  specialInstructions: string;
  supervisorId: string;
  approverId: string;
  materials: Material[];
}
export interface PdfArchive {
  id: string;
  orderVersion: number;
  templateVersion: string;
  documentNo: string;
  fileName: string;
  size: number;
  sha256: string;
  createdAt: string;
  createdBy: { name: string };
}
export interface WorkOrder extends WorkOrderInput {
  id: string;
  publicReference: string;
  documentNo: string;
  issuerId: string;
  status: WorkOrderStatus;
  version: number;
  createdAt: string;
  updatedAt: string;
  issuer: { id: string; name: string; position: string; department: Master };
  department: Master;
  machine: Master;
  attachments: Attachment[];
  approvals: Approval[];
  activities: AuditEvent[];
}
export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}
export interface Dashboard {
  total: number;
  draft: number;
  waiting: number;
  approved: number;
  inProgress: number;
  urgent: number;
  overdue: number;
  completed: number;
  today: WorkOrder[];
  recent: WorkOrder[];
}
