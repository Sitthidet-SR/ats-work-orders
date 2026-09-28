import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
@Injectable()
export class DocumentSequenceService {
  async next(tx: Prisma.TransactionClient, date = new Date()) {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Bangkok',
      year: 'numeric',
      month: '2-digit',
    }).formatToParts(date);
    const year = parts.find((p) => p.type === 'year')!.value;
    const month = parts.find((p) => p.type === 'month')!.value;
    const period = `PN${year.slice(-2)}${month}`;
    const rows = await tx.$queryRaw<
      { value: number }[]
    >`INSERT INTO document_sequences (id, period, value, "updatedAt") VALUES (gen_random_uuid(), ${period}, 1, NOW()) ON CONFLICT (period) DO UPDATE SET value = document_sequences.value + 1, "updatedAt" = NOW() RETURNING value`;
    return `${period}${String(rows[0].value).padStart(3, '0')}`;
  }
}
