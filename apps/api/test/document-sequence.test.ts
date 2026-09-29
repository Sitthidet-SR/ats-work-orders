import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Prisma } from '@prisma/client';
import { DocumentSequenceService } from '../src/modules/documents/document-sequence.service';

test('document numbers use Bangkok year/month and independent monthly counters', async () => {
  const counters = new Map<string, number>();
  const tx = {
    $queryRaw: async (_sql: TemplateStringsArray, period: string) => {
      const value = (counters.get(period) ?? 0) + 1;
      counters.set(period, value);
      return [{ value }];
    },
  } as unknown as Prisma.TransactionClient;
  const sequence = new DocumentSequenceService();
  assert.equal(await sequence.next(tx, new Date('2026-09-28T00:00:00Z')), 'PN2609001');
  assert.equal(await sequence.next(tx, new Date('2026-09-29T00:00:00Z')), 'PN2609002');
  assert.equal(await sequence.next(tx, new Date('2026-09-30T17:00:00Z')), 'PN2610001');
  assert.equal(await sequence.next(tx, new Date('2026-12-31T17:00:00Z')), 'PN2701001');
  counters.set('PN2609', 23);
  assert.equal(await sequence.next(tx, new Date('2026-09-28T00:00:00Z')), 'PN2609024');
  counters.set('PN2609', 999);
  assert.equal(await sequence.next(tx, new Date('2026-09-28T00:00:00Z')), 'PN26091000');
});
