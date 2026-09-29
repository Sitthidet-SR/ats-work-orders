import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';

process.loadEnvFile(new URL('../.env', import.meta.url));
const origin = process.env.QUANTITY_CHECK_URL || 'http://127.0.0.1:3100';
const department = { id: '11111111-1111-4111-8111-111111111111', name: 'ฝ่ายผลิต', active: true };
const machine = { id: '22222222-2222-4222-8222-222222222222', name: 'CNC Milling', active: true };
const user = {
  id: '33333333-3333-4333-8333-333333333333',
  name: 'ผู้ทดสอบ',
  position: 'ผู้สั่งงาน',
  departmentId: department.id,
  department,
  roles: ['ADMIN'],
  forcePasswordChange: false,
  permissions: ['work_order.create', 'work_order.read', 'work_order.update'],
};
const id = '44444444-4444-4444-8444-444444444444';
let saved;
const payloads = [];
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROMIUM_EXECUTABLE_PATH,
});
try {
  const page = await browser.newPage();
  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname.replace(/^\/api/, '');
    const headers = {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Allow-Headers': 'authorization, content-type',
      'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS',
    };
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
    let data;
    if (path === '/auth/refresh') data = { accessToken: 'browser-test', user };
    else if (path === '/machines') data = [machine];
    else if (path === '/departments') data = [department];
    else if (path === '/users') data = [user];
    else if (path.endsWith('/pdf-archives')) data = [];
    else if (
      (path === '/work-orders' && request.method() === 'POST') ||
      request.method() === 'PATCH'
    ) {
      const input = request.postDataJSON();
      payloads.push(input);
      // Match the API's numeric/text normalization rather than echoing invalid combinations.
      saved = {
        ...input,
        quantityText: input.quantity === null ? input.quantityText.trim() : '',
        id,
        publicReference: id,
        documentNo: 'PN2609024',
        issuerId: user.id,
        issuer: user,
        department,
        machine,
        status: 'DRAFT',
        version: (saved?.version ?? -1) + 1,
        createdAt: '2026-09-29T00:00:00Z',
        updatedAt: '2026-09-29T00:00:00Z',
        attachments: [],
        approvals: [],
        activities: [],
      };
      data = saved;
    } else if (path === `/work-orders/${id}`) data = saved;
    else throw new Error(`Unexpected API request: ${request.method()} ${path}`);
    await route.fulfill({ headers, json: { success: true, data } });
  });
  await page.goto(`${origin}/work-orders/new`);
  await page.getByLabel('รายละเอียดงานผลิต', { exact: true }).fill('ตรวจสอบจำนวนแบบข้อความ');
  await page.getByLabel('รหัสชิ้นงาน', { exact: true }).fill('QUANTITY-REGRESSION');
  await page.getByLabel('เครื่องจักร', { exact: true }).selectOption(machine.id);
  const textMode = page.getByRole('checkbox', { name: 'ใช้ข้อความแทนจำนวน' });
  await textMode.check();
  await page.getByLabel('ข้อความแทนจำนวน', { exact: true }).fill('ตามเอกสารแนบท้าย 25 ชิ้น');
  const save = () => page.getByRole('button', { name: 'บันทึกร่าง', exact: true }).click();
  await save();
  await page.waitForURL(`${origin}/work-orders/${id}`);
  assert.equal(payloads.at(-1).quantity, null);
  assert.equal(saved.quantityText, 'ตามเอกสารแนบท้าย 25 ชิ้น');
  await page.goto(`${origin}/work-orders/${id}/edit`);
  await page.getByLabel('ข้อความแทนจำนวน', { exact: true }).waitFor();
  assert.equal(await textMode.isChecked(), true);
  assert.equal(
    await page.getByLabel('ข้อความแทนจำนวน', { exact: true }).inputValue(),
    saved.quantityText,
  );
  await save();
  await page.waitForURL(`${origin}/work-orders/${id}`);
  assert.equal(
    payloads.at(-1).quantity,
    null,
    'Saving an existing text quantity must preserve null',
  );
  await page.goto(`${origin}/work-orders/${id}/edit`);
  await textMode.uncheck();
  await page.getByLabel('จำนวนที่สั่งผลิต', { exact: true }).fill('12.5');
  await save();
  await page.waitForURL(`${origin}/work-orders/${id}`);
  assert.equal(saved.quantity, 12.5);
  assert.equal(saved.quantityText, '');
  await page.goto(`${origin}/work-orders/${id}/edit`);
  await textMode.check();
  await save();
  await page.waitForURL(`${origin}/work-orders/${id}`);
  assert.equal(
    saved.quantity,
    null,
    'Switching a saved numeric quantity to text must clear the number',
  );
  assert.equal(saved.quantityText, 'ตามเอกสารแนบท้าย');
  // Some older responses contain both a numeric value and text. Text remains authoritative.
  saved.quantity = 1;
  saved.quantityText = 'ตามเอกสารแนบท้าย';
  await page.goto(`${origin}/work-orders/${id}/edit`);
  await page.getByLabel('ข้อความแทนจำนวน', { exact: true }).waitFor();
  assert.equal(await textMode.isChecked(), true);
  await save();
  await page.waitForURL(`${origin}/work-orders/${id}`);
  assert.equal(saved.quantity, null);
  console.log(
    'Quantity browser regression passed: create, reload, resave, text/number switches. API requests were mocked; no database writes.',
  );
} finally {
  await browser.close();
}
