import { test } from 'node:test';
import assert from 'node:assert/strict';
import { degrees, PDFDocument, PageSizes } from 'pdf-lib';
import { PdfAttachmentsService } from '../src/modules/documents/pdf-attachments.service';
import { PrismaService } from '../src/common/prisma.service';
import { StorageService } from '../src/modules/storage/storage.service';

async function pdf(sizes: [number, number][]) {
  const document = await PDFDocument.create();
  for (const size of sizes) document.addPage(size).drawRectangle({ x: 10, y: 10, width: 20, height: 20 });
  return Buffer.from(await document.save());
}
test('attachments append every PDF page in order on portrait or landscape A4 sheets', async () => {
  const form = await pdf([PageSizes.A4]);
  const data = new Map([
    ['first', await pdf([[300, 400], [400, 600]])],
    ['second', await pdf([[720, 540]])],
  ]);
  const db = {
    workOrderAttachment: {
      findMany: async () => [
        { fileName: 'drawing.pdf', storageKey: 'first' },
        { fileName: 'part.dwg', storageKey: 'cad' },
        { fileName: 'DETAILS.PDF', storageKey: 'second' },
      ],
    },
  } as unknown as PrismaService;
  const fetched: string[] = [];
  const storage = {
    read: async (key: string) => {
      fetched.push(key);
      return data.get(key)!;
    },
  } as StorageService;
  const service = new PdfAttachmentsService(db, storage);
  const merged = await PDFDocument.load(await service.append('order', form, ['a', 'b', 'c']));
  assert.deepEqual(merged.getPages().map((page) => [page.getWidth(), page.getHeight()]), [
    PageSizes.A4,
    PageSizes.A4,
    PageSizes.A4,
    [PageSizes.A4[1], PageSizes.A4[0]],
  ]);
  assert.deepEqual(fetched, ['first', 'second']);
});
test('rotated and cropped PDF pages use their visible dimensions when fitted to A4', async () => {
  const source = await PDFDocument.create();
  const page = source.addPage([600, 800]);
  page.setCropBox(100, 100, 300, 500);
  page.setRotation(degrees(90));
  page.drawRectangle({ x: 120, y: 140, width: 50, height: 80 });
  const db = { workOrderAttachment: { findMany: async () => [{ fileName: 'drawing.pdf', storageKey: 'drawing' }] } } as unknown as PrismaService;
  const storage = { read: async () => Buffer.from(await source.save()) } as unknown as StorageService;
  const service = new PdfAttachmentsService(db, storage);
  const merged = await PDFDocument.load(await service.append('order', await pdf([PageSizes.A4]), ['file']));
  assert.deepEqual(
    merged.getPages().map((sheet) => [sheet.getWidth(), sheet.getHeight()]),
    [PageSizes.A4, [PageSizes.A4[1], PageSizes.A4[0]]],
  );
  assert.equal(merged.getPage(1).getRotation().angle, 0);
});
test('blank PDF pages remain printable blank A4 pages', async () => {
  const blank = await PDFDocument.create();
  blank.addPage([700, 500]);
  const db = { workOrderAttachment: { findMany: async () => [{ fileName: 'blank.pdf', storageKey: 'blank' }] } } as unknown as PrismaService;
  const storage = { read: async () => Buffer.from(await blank.save()) } as unknown as StorageService;
  const service = new PdfAttachmentsService(db, storage);
  const merged = await PDFDocument.load(await service.append('order', await pdf([PageSizes.A4]), ['file']));
  assert.deepEqual(
    [merged.getPage(1).getWidth(), merged.getPage(1).getHeight()],
    [PageSizes.A4[1], PageSizes.A4[0]],
  );
});
test('orders without attachments preserve the original PDF bytes without a storage query', async () => {
  const form = await pdf([PageSizes.A4]);
  const service = new PdfAttachmentsService({} as PrismaService, {} as StorageService);
  assert.equal(await service.append('order', form, []), form);
});
test('a corrupt or inaccessible PDF raises an error naming the attachment instead of silently omitting it', async () => {
  const db = {
    workOrderAttachment: {
      findMany: async () => [{ fileName: 'broken.pdf', storageKey: 'broken' }],
    },
  } as unknown as PrismaService;
  const storage = { read: async () => Buffer.from('not a PDF') } as unknown as StorageService;
  const service = new PdfAttachmentsService(db, storage);
  await assert.rejects(service.append('order', await pdf([PageSizes.A4]), ['file']), /broken\.pdf/);
});
