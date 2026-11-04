import { test } from 'node:test';
import assert from 'node:assert/strict';
import { paperHtml, type PaperOrder } from '../src/modules/documents/paper-template';

test('PDF order and due dates use zero-padded day/month/Buddhist year', () => {
  const order: PaperOrder = {
    documentNo: 'PN2610001',
    orderDate: '2026-10-01',
    dueDate: new Date('2026-11-09T00:00:00.000Z'),
    issuer: { name: 'Issuer' },
    department: { name: 'Department' },
    machineDetails: [{ machine: { name: 'Machine' }, quantity: 0, remark: 'Prepare the material' }],
    description: 'Description that is long enough to have previously been moved to an appendix page.',
    followAttachment: false,
    productCode: 'PART-1',
    productName: '',
    quantity: 1,
    unit: '',
    dueTime: '',
    materials: [],
    specialInstructions: '',
    reasonType: 'URGENT',
    reasonDetail: '',
    approvals: [],
  };
  const html = paperHtml(order, Buffer.alloc(0), Buffer.alloc(0));
  assert.match(html, />01\/10\/2569<\/span>/);
  assert.match(html, />09\/11\/2569<\/span>/);
  assert.doesNotMatch(html, />01\/10\/2026<\/span>/);
  assert.match(html, /Description that is long enough/);
  assert.match(html, /Prepare the material/);
  assert.doesNotMatch(html, /เอกสารแนบท้าย/);
});

const materialOrder = (machines: number, materials: number): PaperOrder => ({
  documentNo: 'PN2610002',
  orderDate: '2026-10-01',
  dueDate: '2026-11-09',
  issuer: { name: 'Issuer' },
  department: { name: 'Department' },
  machineDetails: Array.from({ length: machines }, (_, i) => ({
    machine: { name: `Machine ${i + 1}` },
    quantity: null,
    remark: '',
  })),
  description: '',
  followAttachment: false,
  productCode: 'PART-1',
  productName: '',
  quantity: 1,
  unit: '',
  dueTime: '',
  materials: Array.from({ length: materials }, (_, i) => ({
    materialCode: '',
    materialName: `Material-${i + 1}`,
    materialGrade: 'SS400',
  })),
  specialInstructions: '',
  reasonType: 'URGENT',
  reasonDetail: '',
  approvals: [],
});

test('PDF prints every material on the first page when step rows are free', () => {
  const html = paperHtml(materialOrder(1, 6), Buffer.alloc(0), Buffer.alloc(0));
  for (let i = 1; i <= 6; i++) assert.match(html, new RegExp(`>Material-${i}<`));
  assert.equal(html.match(/class="page"/g)?.length, 1);
});

test('PDF continues materials that do not fit onto another page', () => {
  const html = paperHtml(materialOrder(5, 40), Buffer.alloc(0), Buffer.alloc(0));
  for (let i = 1; i <= 40; i++) assert.match(html, new RegExp(`>Material-${i}<`));
  assert.match(html, /มีต่อหน้าถัดไป/);
  assert.equal(html.match(/class="page"/g)?.length, 3);
});
