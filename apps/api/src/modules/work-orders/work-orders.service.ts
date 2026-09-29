import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ApprovalStage, Prisma, WorkOrderStatus } from '@prisma/client';
import { PrismaService } from '../../common/prisma.service';
import { Actor, AuditContext } from '../auth/auth.types';
import { AuditService } from '../audit/audit.service';
import { DocumentSequenceService } from '../documents/document-sequence.service';
import { WorkflowAction, WorkflowService } from './workflow.service';
import {
  ActionDto,
  CreateWorkOrderDto,
  ListWorkOrdersDto,
  UpdateWorkOrderDto,
} from './work-order.dto';
export const personSelect = { id: true, name: true, position: true, department: true } as const;
export const orderInclude = {
  issuer: { select: personSelect },
  department: true,
  machine: true,
  materials: { orderBy: { sortOrder: 'asc' } },
  attachments: {
    select: {
      id: true,
      fileName: true,
      size: true,
      mimeType: true,
      createdAt: true,
      uploader: { select: { name: true } },
    },
  },
  approvals: {
    include: { user: { select: personSelect }, decidedBy: { select: personSelect } },
    orderBy: { stage: 'asc' },
  },
} satisfies Prisma.WorkOrderInclude;
export const dateOnly = (value: string) => new Date(`${value.slice(0, 10)}T00:00:00.000Z`);
export function bangkokToday() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}
@Injectable()
export class WorkOrdersService {
  constructor(
    private readonly db: PrismaService,
    private readonly sequence: DocumentSequenceService,
    private readonly workflow: WorkflowService,
    private readonly audit: AuditService,
  ) {}
  assertOwner(actor: Actor, order: { issuerId: string }) {
    if (!actor.roles.includes('ADMIN') && actor.id !== order.issuerId)
      throw new ForbiddenException('เฉพาะผู้สั่งงานเจ้าของเอกสาร');
  }
  private async validateInput(dto: CreateWorkOrderDto, actor: Actor) {
    if (!dto.issuerDisplayName?.trim()) throw new BadRequestException('กรุณากรอกผู้สั่งงาน');
    if (dto.quantity == null && !dto.quantityText?.trim())
      throw new BadRequestException('กรุณาระบุจำนวนหรือข้อความแทนจำนวน');
    if (dto.dueDate < dto.orderDate)
      throw new BadRequestException('กำหนดส่งต้องไม่ก่อนวันที่สั่งการ');
    if (dto.reasonType === 'OTHER' && !dto.reasonDetail.trim())
      throw new BadRequestException('กรุณาระบุเหตุผลเพิ่มเติม');
    if (!actor.roles.includes('ADMIN') && dto.departmentId !== actor.departmentId)
      throw new ForbiddenException('ไม่สามารถเปลี่ยนแผนกได้');
    if (
      (dto.supervisorId && dto.supervisorId === dto.approverId) ||
      dto.supervisorId === actor.id ||
      dto.approverId === actor.id
    )
      throw new BadRequestException('ผู้สั่งงาน หัวหน้า และผู้อนุมัติต้องเป็นคนละคน');
    const machine = await this.db.machine.findUnique({ where: { id: dto.machineId } });
    if (!machine?.active) throw new BadRequestException('เครื่องจักรไม่พร้อมใช้งาน');
    for (const [id, role] of [
      [dto.supervisorId, 'SUPERVISOR'],
      [dto.approverId, 'APPROVER'],
    ]) {
      if (!id) continue;
      const assigned = await this.db.user.findFirst({
        where: { id, active: true, roles: { some: { role: { name: { in: [role, 'ADMIN'] } } } } },
      });
      if (!assigned) throw new BadRequestException(`ผู้รับผิดชอบต้องมีบทบาท ${role}`);
    }
  }
  private fields(dto: CreateWorkOrderDto) {
    return {
      orderDate: dateOnly(dto.orderDate),
      departmentId: dto.departmentId,
      description: dto.description,
      followAttachment: dto.followAttachment,
      issuerDisplayName: dto.issuerDisplayName?.trim() ?? '',
      quantityText: dto.quantity == null ? (dto.quantityText?.trim() ?? '') : '',
      productCode: dto.productCode,
      productName: dto.productName,
      quantity: dto.quantity,
      unit: dto.unit,
      machineId: dto.machineId,
      dueDate: dateOnly(dto.dueDate),
      dueTime: dto.dueTime,
      priority: dto.priority,
      reasonType: dto.reasonType,
      reasonDetail: dto.reasonDetail,
      specialInstructions: dto.specialInstructions,
    };
  }
  async create(dto: CreateWorkOrderDto, actor: Actor, context: AuditContext) {
    await this.validateInput(dto, actor);
    return this.db.$transaction(async (tx) => {
      const documentNo = await this.sequence.next(tx, dateOnly(dto.orderDate));
      const order = await tx.workOrder.create({
        data: {
          ...this.fields(dto),
          documentNo,
          issuerId: actor.id,
          materials: { create: dto.materials.map((m, i) => ({ ...m, sortOrder: i })) },
          approvals: {
            create: [
              { userId: actor.id, stage: 'ISSUER' },
              ...(dto.supervisorId
                ? [{ userId: dto.supervisorId, stage: ApprovalStage.SUPERVISOR }]
                : []),
              ...(dto.approverId
                ? [{ userId: dto.approverId, stage: ApprovalStage.APPROVER }]
                : []),
            ],
          },
        },
        include: orderInclude,
      });
      await this.audit.write(tx, actor, 'CREATE', order.id, null, order, context);
      return this.serialize(order);
    });
  }
  async detail(reference: string) {
    const order = await this.db.workOrder.findFirst({
      where: { OR: [{ id: reference }, { publicReference: reference }] },
      include: orderInclude,
    });
    if (!order) throw new NotFoundException('ไม่พบใบสั่งงาน');
    const activities = await this.db.auditLog.findMany({
      where: { entityType: 'WorkOrder', entityId: order.id },
      include: { user: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return this.serialize({ ...order, activities });
  }
  serialize<
    T extends {
      quantity: Prisma.Decimal | null;
      materials: { quantity: Prisma.Decimal | null }[];
      approvals: { stage: ApprovalStage; userId: string }[];
    },
  >(order: T) {
    return {
      ...order,
      quantity: order.quantity === null ? null : Number(order.quantity),
      materials: order.materials.map((m) => ({
        ...m,
        quantity: m.quantity === null ? null : Number(m.quantity),
      })),
      supervisorId: order.approvals.find((a) => a.stage === 'SUPERVISOR')?.userId ?? '',
      approverId: order.approvals.find((a) => a.stage === 'APPROVER')?.userId ?? '',
    };
  }
  async update(id: string, dto: UpdateWorkOrderDto, actor: Actor, context: AuditContext) {
    return this.db.$transaction(async (tx) => {
      const old = await tx.workOrder.findUnique({ where: { id }, include: orderInclude });
      if (!old) throw new NotFoundException('ไม่พบใบสั่งงาน');
      this.assertOwner(actor, old);
      if (old.status !== 'DRAFT') throw new ConflictException('แก้ไขได้เฉพาะร่าง');
      const merged = {
        ...this.serialize(old),
        ...dto,
        orderDate: dto.orderDate ?? old.orderDate.toISOString().slice(0, 10),
        dueDate: dto.dueDate ?? old.dueDate.toISOString().slice(0, 10),
      } as CreateWorkOrderDto;
      await this.validateInput(merged, actor);
      const changed = await tx.workOrder.updateMany({
        where: { id, status: 'DRAFT', version: dto.version },
        data: { ...this.fields(merged), version: { increment: 1 } },
      });
      if (changed.count !== 1) throw new ConflictException('ข้อมูลเปลี่ยนแล้ว กรุณาโหลดใหม่');
      await tx.workOrderMaterial.deleteMany({ where: { workOrderId: id } });
      await tx.workOrderMaterial.createMany({
        data: merged.materials.map((m, i) => ({
          workOrderId: id,
          materialCode: m.materialCode,
          materialName: m.materialName,
          quantity: m.quantity,
          unit: m.unit,
          remark: m.remark,
          sortOrder: i,
        })),
      });
      for (const [stage, userId] of [
        ['SUPERVISOR', merged.supervisorId],
        ['APPROVER', merged.approverId],
      ] as const) {
        if (userId)
          await tx.workOrderApproval.upsert({
            where: { workOrderId_stage: { workOrderId: id, stage } },
            update: { userId },
            create: { workOrderId: id, stage, userId },
          });
        else await tx.workOrderApproval.deleteMany({ where: { workOrderId: id, stage } });
      }
      const updated = await tx.workOrder.findUniqueOrThrow({
        where: { id },
        include: orderInclude,
      });
      await this.audit.write(tx, actor, 'UPDATE', id, old, updated, context);
      return this.serialize(updated);
    });
  }
  async action(
    id: string,
    action: WorkflowAction,
    dto: ActionDto,
    actor: Actor,
    context: AuditContext,
  ) {
    return this.db.$transaction(async (tx) => {
      const old = await tx.workOrder.findUnique({ where: { id }, include: orderInclude });
      if (!old) throw new NotFoundException('ไม่พบใบสั่งงาน');
      if (action === 'submit') {
        this.assertOwner(actor, old);
        if (
          !old.approvals.some((a) => a.stage === 'SUPERVISOR') ||
          !old.approvals.some((a) => a.stage === 'APPROVER')
        )
          throw new BadRequestException('กรุณาระบุหัวหน้างานและผู้อนุมัติก่อนส่งอนุมัติ');
        if (old.followAttachment && old.attachments.length === 0)
          throw new BadRequestException('กรุณาแนบเอกสารก่อนส่งอนุมัติ');
      }
      if (['reject', 'cancel'].includes(action) && !dto.comment?.trim())
        throw new BadRequestException('กรุณาระบุเหตุผล');
      const stage =
        action === 'submit'
          ? 'ISSUER'
          : action === 'supervisor-review'
            ? 'SUPERVISOR'
            : ['approve', 'reject'].includes(action)
              ? 'APPROVER'
              : null;
      if (
        stage &&
        !actor.roles.includes('ADMIN') &&
        old.approvals.find((a) => a.stage === stage)?.userId !== actor.id
      )
        throw new ForbiddenException('คุณไม่ได้รับมอบหมายในขั้นตอนนี้');
      const status = this.workflow.next(old.status, action);
      const updated = await tx.workOrder.updateMany({
        where: { id, status: old.status, version: dto.version },
        data: { status, version: { increment: 1 } },
      });
      if (updated.count !== 1) throw new ConflictException('ข้อมูลเปลี่ยนแล้ว กรุณาโหลดใหม่');
      if (stage && !(action === 'supervisor-review' && status === 'SUPERVISOR_REVIEW'))
        await tx.workOrderApproval.update({
          where: { workOrderId_stage: { workOrderId: id, stage } },
          data: {
            status: action === 'reject' ? 'REJECTED' : 'APPROVED',
            decidedAt: new Date(),
            decidedById: actor.id,
            comment: dto.comment ?? null,
          },
        });
      const order = await tx.workOrder.findUniqueOrThrow({ where: { id }, include: orderInclude });
      await this.audit.write(
        tx,
        actor,
        action.replace('-', '_').toUpperCase(),
        id,
        { status: old.status, version: old.version },
        { status, version: order.version, comment: dto.comment ?? null },
        context,
      );
      return this.serialize(order);
    });
  }
  async deleteDraft(id: string, dto: ActionDto, actor: Actor, context: AuditContext) {
    return this.db.$transaction(async (tx) => {
      const old = await tx.workOrder.findUnique({ where: { id } });
      if (!old) throw new NotFoundException('ไม่พบใบสั่งงาน');
      this.assertOwner(actor, old);
      if (old.status !== 'DRAFT') throw new ConflictException('ลบได้เฉพาะร่าง');
      if (!dto.comment?.trim()) throw new BadRequestException('กรุณาระบุเหตุผล');
      const result = await tx.workOrder.updateMany({
        where: { id, status: 'DRAFT', version: dto.version },
        data: { status: 'CANCELLED', version: { increment: 1 } },
      });
      if (result.count !== 1) throw new ConflictException('ข้อมูลเปลี่ยนแล้ว กรุณาโหลดใหม่');
      await this.audit.write(
        tx,
        actor,
        'DELETE',
        id,
        { status: old.status },
        { status: 'CANCELLED', comment: dto.comment },
        context,
      );
      return { id, status: 'CANCELLED' };
    });
  }
  async list(query: ListWorkOrdersDto) {
    const where: Prisma.WorkOrderWhereInput = {
      status: query.status,
      priority: query.priority,
      machineId: query.machineId,
      departmentId: query.departmentId,
      issuerId: query.issuerId,
    };
    const open = {
      notIn: [WorkOrderStatus.COMPLETED, WorkOrderStatus.CANCELLED, WorkOrderStatus.REJECTED],
    };
    if (query.summary === 'waiting')
      where.AND = { status: { in: ['SUBMITTED', 'SUPERVISOR_REVIEW', 'WAITING_APPROVAL'] } };
    if (query.summary === 'approved') where.AND = { status: { in: ['APPROVED', 'ISSUED'] } };
    if (query.summary === 'urgent')
      where.AND = { priority: { in: ['URGENT', 'CRITICAL'] }, status: open };
    if (query.summary === 'overdue')
      where.AND = { dueDate: { lt: dateOnly(bangkokToday()) }, status: open };
    if (query.search)
      where.OR = ['documentNo', 'productCode', 'productName', 'description'].map((field) => ({
        [field]: { contains: query.search, mode: 'insensitive' },
      }));
    if (query.dateFrom || query.dateTo)
      where.orderDate = {
        gte: query.dateFrom ? dateOnly(query.dateFrom) : undefined,
        lte: query.dateTo ? dateOnly(query.dateTo) : undefined,
      };
    if (query.dueFrom || query.dueTo)
      where.dueDate = {
        gte: query.dueFrom ? dateOnly(query.dueFrom) : undefined,
        lte: query.dueTo ? dateOnly(query.dueTo) : undefined,
      };
    const [total, items] = await this.db.$transaction([
      this.db.workOrder.count({ where }),
      this.db.workOrder.findMany({
        where,
        include: orderInclude,
        orderBy: [{ [query.sortBy]: query.sortOrder }, { id: 'asc' }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
    ]);
    return {
      items: items.map((o) => this.serialize(o)),
      total,
      page: query.page,
      limit: query.limit,
      pages: Math.ceil(total / query.limit),
    };
  }
  async dashboard() {
    const today = dateOnly(bangkokToday());
    const open = {
      notIn: [WorkOrderStatus.COMPLETED, WorkOrderStatus.CANCELLED, WorkOrderStatus.REJECTED],
    };
    const [
      total,
      draft,
      waiting,
      approved,
      inProgress,
      urgent,
      overdue,
      completed,
      todayOrders,
      recent,
    ] = await this.db.$transaction([
      this.db.workOrder.count(),
      this.db.workOrder.count({ where: { status: 'DRAFT' } }),
      this.db.workOrder.count({
        where: { status: { in: ['SUBMITTED', 'SUPERVISOR_REVIEW', 'WAITING_APPROVAL'] } },
      }),
      this.db.workOrder.count({ where: { status: { in: ['APPROVED', 'ISSUED'] } } }),
      this.db.workOrder.count({ where: { status: 'IN_PROGRESS' } }),
      this.db.workOrder.count({
        where: { priority: { in: ['URGENT', 'CRITICAL'] }, status: open },
      }),
      this.db.workOrder.count({ where: { dueDate: { lt: today }, status: open } }),
      this.db.workOrder.count({ where: { status: 'COMPLETED' } }),
      this.db.workOrder.findMany({
        where: { dueDate: today, status: open },
        include: orderInclude,
        take: 20,
        orderBy: { dueTime: 'asc' },
      }),
      this.db.workOrder.findMany({
        include: orderInclude,
        take: 6,
        orderBy: { createdAt: 'desc' },
      }),
    ]);
    return {
      total,
      draft,
      waiting,
      approved,
      inProgress,
      urgent,
      overdue,
      completed,
      today: todayOrders.map((o) => this.serialize(o)),
      recent: recent.map((o) => this.serialize(o)),
    };
  }
}
