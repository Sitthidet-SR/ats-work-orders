import {
  ConflictException,
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { StorageService } from '../storage/storage.service';
import { AuditService } from '../audit/audit.service';
import { Actor, AuditContext } from '../auth/auth.types';
import { WorkOrdersService } from './work-orders.service';
@Injectable()
export class AttachmentsService {
  constructor(
    private readonly db: PrismaService,
    private readonly storage: StorageService,
    private readonly orders: WorkOrdersService,
    private readonly audit: AuditService,
  ) {}
  async upload(id: string, file: Express.Multer.File, actor: Actor, context: AuditContext) {
    if (!file) throw new BadRequestException('กรุณาเลือกไฟล์');
    const order = await this.db.workOrder.findUnique({ where: { id } });
    if (!order) throw new NotFoundException('ไม่พบใบสั่งงาน');
    this.orders.assertOwner(actor, order);
    if (order.status !== 'DRAFT') throw new ConflictException('แนบไฟล์ได้เฉพาะร่าง');
    const stored = await this.storage.put(file);
    try {
      return await this.db.$transaction(async (tx) => {
        const locked = await tx.workOrder.updateMany({
          where: { id, status: 'DRAFT', version: order.version },
          data: { version: { increment: 1 } },
        });
        if (locked.count !== 1) throw new ConflictException('ข้อมูลเปลี่ยนแล้ว กรุณาลองใหม่');
        const attachment = await tx.workOrderAttachment.create({
          data: {
            workOrderId: id,
            fileName: Buffer.from(file.originalname, 'latin1').toString('utf8').slice(0, 255),
            size: file.size,
            mimeType: stored.mimeType,
            storageKey: stored.key,
            url: stored.url,
            uploaderId: actor.id,
          },
          select: {
            id: true,
            fileName: true,
            size: true,
            mimeType: true,
            createdAt: true,
            uploader: { select: { name: true } },
          },
        });
        await this.audit.write(tx, actor, 'ATTACH', id, null, attachment, context);
        return attachment;
      });
    } catch (error) {
      await this.storage.remove(stored.key).catch(() => undefined);
      throw error;
    }
  }
  async download(id: string, attachmentId: string) {
    const attachment = await this.db.workOrderAttachment.findFirst({
      where: { id: attachmentId, workOrderId: id },
    });
    if (!attachment) throw new NotFoundException('ไม่พบไฟล์');
    return { url: await this.storage.download(attachment.storageKey, attachment.fileName) };
  }
}
