import { BadRequestException, Injectable } from '@nestjs/common';
import { degrees, PDFDocument, PDFPage, PageSizes } from 'pdf-lib';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { basename, extname, join, resolve, sep } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
import { PrismaService } from '../../common/prisma.service';
import { StorageService } from '../storage/storage.service';

const run = promisify(execFile);
const officeExtensions = new Set(['.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx']);
const pageMargin = 12;

async function addA4Pages(target: PDFDocument, source: PDFDocument) {
  const pages = source.getPages();
  if (!pages.length) throw new Error('Empty attachment');
  const boxes = pages.map((page) => {
    const { x, y, width, height } = page.getCropBox();
    if (!(width > 0 && height > 0 && Number.isFinite(width) && Number.isFinite(height)))
      throw new Error('Invalid attachment page size');
    return { left: x, bottom: y, right: x + width, top: y + height };
  });
  const drawable = pages.map((page, index) => ({ page, box: boxes[index], index }))
    .filter(({ page }) => !!page.node.Contents());
  const embedded = await target.embedPages(drawable.map(({ page }) => page), drawable.map(({ box }) => box));
  const embeddedByIndex = new Map(drawable.map(({ index }, position) => [index, embedded[position]]));
  pages.forEach((sourcePage: PDFPage, index) => {
    const { width, height } = sourcePage.getCropBox();
    const rotation = ((sourcePage.getRotation().angle % 360) + 360) % 360;
    if (![0, 90, 180, 270].includes(rotation)) throw new Error('Unsupported page rotation');
    const sideways = rotation === 90 || rotation === 270;
    const visibleWidth = sideways ? height : width;
    const visibleHeight = sideways ? width : height;
    const [paperWidth, paperHeight] = visibleWidth > visibleHeight
      ? [PageSizes.A4[1], PageSizes.A4[0]]
      : PageSizes.A4;
    const scale = Math.min(
      (paperWidth - pageMargin * 2) / visibleWidth,
      (paperHeight - pageMargin * 2) / visibleHeight,
    );
    const left = (paperWidth - visibleWidth * scale) / 2;
    const bottom = (paperHeight - visibleHeight * scale) / 2;
    const placed = target.addPage([paperWidth, paperHeight]);
    const drawing = embeddedByIndex.get(index);
    if (!drawing) return;
    placed.drawPage(drawing, {
      x: left + (rotation === 180 ? width * scale : rotation === 270 ? height * scale : 0),
      y: bottom + (rotation === 90 ? width * scale : rotation === 180 ? height * scale : 0),
      xScale: scale,
      yScale: scale,
      rotate: degrees(-rotation),
    });
  });
}
@Injectable()
export class PdfAttachmentsService {
  private officeQueue: Promise<unknown> = Promise.resolve();
  constructor(
    private readonly db: PrismaService,
    private readonly storage: StorageService,
  ) {}

  async append(orderId: string, form: Buffer, attachmentIds: string[]) {
    if (!attachmentIds.length) return form;
    const attachments = await this.db.workOrderAttachment.findMany({
      where: { workOrderId: orderId, id: { in: attachmentIds } },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
    const printable = attachments.filter((file) => {
      const extension = extname(file.fileName).toLowerCase();
      return extension === '.pdf' || officeExtensions.has(extension);
    });
    if (!printable.length) return form;
    const combined = await PDFDocument.load(form);
    for (const file of printable) {
      try {
        const content = await this.storage.read(file.storageKey);
        const extension = extname(file.fileName).toLowerCase();
        const pdf = extension === '.pdf' ? content : await this.convertOffice(content, extension);
        const document = await PDFDocument.load(pdf);
        document.getForm().flatten();
        await addA4Pages(combined, document);
      } catch {
        throw new BadRequestException(
          `รวมไฟล์แนบ "${file.fileName}" ไม่สำเร็จ กรุณาตรวจไฟล์หรือแปลงเป็น PDF แล้วแนบใหม่`,
        );
      }
    }
    return Buffer.from(await combined.save());
  }

  private convertOffice(content: Buffer, extension: string) {
    const task = this.officeQueue.then(() => this.renderOffice(content, extension));
    this.officeQueue = task.catch(() => undefined);
    return task;
  }
  private async renderOffice(content: Buffer, extension: string) {
    const tempRoot = resolve(tmpdir());
    const directory = await mkdtemp(join(tempRoot, 'ats-office-'));
    // Verify the absolute cleanup target before recursively removing temporary files.
    if (
      !resolve(directory).startsWith(tempRoot + sep) ||
      !basename(directory).startsWith('ats-office-')
    )
      throw new Error('Unexpected temporary directory');
    try {
      const profile = join(directory, 'profile');
      await mkdir(join(profile, 'user'), { recursive: true });
      await writeFile(
        join(profile, 'user', 'registrymodifications.xcu'),
        '<?xml version="1.0" encoding="UTF-8"?><oor:items xmlns:oor="http://openoffice.org/2001/registry"><item oor:path="/org.openoffice.Office.Common/Security/Scripting"><prop oor:name="MacroSecurityLevel" oor:op="fuse"><value>3</value></prop></item></oor:items>',
      );
      const input = join(directory, `attachment${extension}`);
      await writeFile(input, content);
      await run(
        process.env.LIBREOFFICE_EXECUTABLE_PATH || 'libreoffice',
        [
          `-env:UserInstallation=${pathToFileURL(profile).href}`,
          '--headless',
          '--nologo',
          '--nodefault',
          '--nolockcheck',
          '--norestore',
          '--convert-to',
          'pdf',
          '--outdir',
          directory,
          input,
        ],
        { timeout: 120000, maxBuffer: 1024 * 1024 },
      );
      return await readFile(join(directory, 'attachment.pdf'));
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  }
}
