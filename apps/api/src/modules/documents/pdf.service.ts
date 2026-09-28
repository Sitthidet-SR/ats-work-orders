import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { chromium } from 'playwright';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { WorkOrdersService } from '../work-orders/work-orders.service';
import { CreateWorkOrderDto } from '../work-orders/work-order.dto';
import { Actor } from '../auth/auth.types';
import { PrismaService } from '../../common/prisma.service';
import { paperHtml, PaperOrder, PAPER_TEMPLATE_VERSION } from './paper-template';
const metadata = {
  id: true,
  orderVersion: true,
  templateVersion: true,
  documentNo: true,
  fileName: true,
  size: true,
  sha256: true,
  createdAt: true,
  createdBy: { select: { name: true } },
} satisfies Prisma.WorkOrderPdfSelect;
@Injectable()
export class PdfService {
  private queue: Promise<unknown> = Promise.resolve();
  constructor(
    private readonly orders: WorkOrdersService,
    private readonly db: PrismaService,
  ) {}
  private serial<T>(operation: () => Promise<T>): Promise<T> {
    const task = this.queue.then(operation);
    this.queue = task.catch(() => undefined);
    return task;
  }
  private async render(order: PaperOrder) {
    const [font, template] = await Promise.all([
      readFile(resolve(__dirname, '../../../assets/Sarabun-Regular.ttf')),
      readFile(resolve(__dirname, '../../../assets/work-order-template.jpg')),
    ]);
    const browser = await chromium.launch({
      headless: true,
      executablePath: process.env.CHROMIUM_EXECUTABLE_PATH || undefined,
      args: [
        '--disable-dev-shm-usage',
        ...(process.env.NODE_ENV === 'production' ? ['--no-sandbox'] : []),
      ],
    });
    try {
      const page = await browser.newPage();
      await page.setContent(paperHtml(order, template, font), { waitUntil: 'load' });
      await page.evaluate(async () => {
        await document.fonts.ready;
        for (const span of document.querySelectorAll<HTMLElement>('.fit')) {
          let size = 23;
          while (span.scrollWidth > span.clientWidth && size > 10)
            span.style.fontSize = `${--size}px`;
        }
      });
      return await page.pdf({
        format: 'Letter',
        printBackground: true,
        margin: { top: 0, bottom: 0, left: 0, right: 0 },
        preferCSSPageSize: true,
      });
    } finally {
      await browser.close();
    }
  }
  async preview(dto: CreateWorkOrderDto, actor: Actor) {
    const [issuer, department, machine] = await Promise.all([
      this.db.user.findUniqueOrThrow({ where: { id: actor.id }, select: { name: true } }),
      this.db.department.findUniqueOrThrow({ where: { id: dto.departmentId } }),
      this.db.machine.findUniqueOrThrow({ where: { id: dto.machineId } }),
    ]);
    return this.serial(() =>
      this.render({
        ...dto,
        documentNo: 'รอออกเลขที่เอกสาร',
        issuer,
        department,
        machine,
        approvals: [],
      }),
    );
  }
  async generate(id: string, actor: Actor, permission = 'work_order.export') {
    if (!actor.permissions.includes(permission))
      throw new ForbiddenException('คุณไม่มีสิทธิ์พิมพ์/ส่งออก');
    return this.serial(async () => {
      const order = await this.orders.detail(id);
      this.orders.assertOwner(actor, order);
      const key = {
        workOrderId: order.id,
        orderVersion: order.version,
        templateVersion: PAPER_TEMPLATE_VERSION,
      };
      let saved = await this.db.workOrderPdf.findUnique({
        where: { workOrderId_orderVersion_templateVersion: key },
      });
      if (!saved) {
        const buffer = await this.render({
          ...order,
          quantity: order.quantity == null ? null : Number(order.quantity),
          materials: order.materials.map((m) => ({
            ...m,
            quantity: m.quantity == null ? null : Number(m.quantity),
          })),
        });
        const snapshot = JSON.parse(
          JSON.stringify({ ...order, activities: undefined }),
        ) as Prisma.InputJsonValue;
        try {
          saved = await this.db.$transaction(async (tx) => {
            const archive = await tx.workOrderPdf.create({
              data: {
                ...key,
                documentNo: order.documentNo,
                fileName: `${order.documentNo}-v${order.version + 1}.pdf`,
                content: new Uint8Array(buffer),
                size: buffer.length,
                sha256: createHash('sha256').update(buffer).digest('hex'),
                snapshot,
                createdById: actor.id,
              },
            });
            await tx.auditLog.create({
              data: {
                userId: actor.id,
                action: 'SAVE_PDF',
                entityType: 'WorkOrder',
                entityId: order.id,
                newValue: { archiveId: archive.id, version: order.version, sha256: archive.sha256 },
              },
            });
            return archive;
          });
        } catch (error) {
          if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002')
            throw error;
          saved = await this.db.workOrderPdf.findUniqueOrThrow({
            where: { workOrderId_orderVersion_templateVersion: key },
          });
        }
      }
      return {
        id: saved.id,
        documentNo: saved.documentNo,
        fileName: saved.fileName,
        buffer: Buffer.from(saved.content),
      };
    });
  }
  async history(id: string) {
    const order = await this.orders.detail(id);
    return this.db.workOrderPdf.findMany({
      where: { workOrderId: order.id },
      select: metadata,
      orderBy: { createdAt: 'desc' },
    });
  }
  async archived(id: string, archiveId: string, actor: Actor) {
    const order = await this.orders.detail(id);
    this.orders.assertOwner(actor, order);
    const archive = await this.db.workOrderPdf.findFirst({
      where: { id: archiveId, workOrderId: order.id },
    });
    if (!archive) throw new NotFoundException('ไม่พบ PDF ที่บันทึกไว้');
    return { buffer: Buffer.from(archive.content), fileName: archive.fileName };
  }
}
