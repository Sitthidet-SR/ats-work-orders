import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import assert from 'node:assert/strict';
process.loadEnvFile(new URL('../.env', import.meta.url));
await mkdir(new URL('../.local/screenshots/', import.meta.url), { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_EXECUTABLE_PATH || undefined,
  headless: true,
});
const page = await browser.newPage({ viewport: { width: 1536, height: 1050 } });
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));
try {
  await page.goto('http://localhost:3000/login');
  await page.screenshot({ path: '.local/screenshots/login.png', fullPage: true });
  await page.getByLabel('รหัสพนักงาน', { exact: true }).fill('admin');
  await page.getByLabel('รหัสผ่าน', { exact: true }).fill(process.env.ADMIN_INITIAL_PASSWORD);
  await page.getByRole('button', { name: 'เข้าสู่ระบบ', exact: true }).click();
  await page.waitForURL('**/dashboard');
  await page.getByRole('heading', { name: 'ภาพรวมการผลิต' }).waitFor();
  await page.screenshot({ path: '.local/screenshots/dashboard.png', fullPage: true });
  await page.getByRole('link', { name: 'สร้างใบสั่งงาน', exact: true }).click();
  await page
    .getByLabel('รายละเอียดงานผลิต', { exact: true })
    .fill('ทดสอบจากเบราว์เซอร์ — ตรวจสอบขนาดก่อนส่ง QC');
  const product = `BROWSER-${Date.now()}`;
  await page.getByLabel('รหัสชิ้นงาน', { exact: true }).fill(product);
  await page.getByLabel('ชื่อสินค้า', { exact: true }).fill('ชิ้นงานทดสอบเบราว์เซอร์');
  await page.getByLabel('เครื่องจักร', { exact: true }).selectOption({ label: 'CNC Milling' });
  await page
    .getByLabel('ผู้รับสั่งงาน / หัวหน้า', { exact: true })
    .selectOption({ label: 'Production Supervisor' });
  await page
    .getByLabel('ผู้อนุมัติ', { exact: true })
    .selectOption({ label: 'Production Manager' });
  await page.getByRole('button', { name: 'เพิ่มวัตถุดิบ' }).click();
  await page.getByLabel('materialCode 1', { exact: true }).fill('AL-TEST');
  await page.getByLabel('materialName 1', { exact: true }).fill('Aluminium');
  await page.evaluate(() => window.scrollTo(0, 0));
  const overflow = await page.evaluate(() =>
    Array.from(document.querySelectorAll('body *'))
      .map((element) => ({
        tag: element.tagName,
        cls: element.className,
        right: element.getBoundingClientRect().right,
        width: element.getBoundingClientRect().width,
      }))
      .filter((item) => item.right > window.innerWidth + 5 && item.width > 300)
      .slice(0, 12),
  );
  assert.deepEqual(overflow, [], 'Create form must not overflow horizontally');
  await page.screenshot({ path: '.local/screenshots/create.png', fullPage: true });
  await page.getByRole('button', { name: 'บันทึกร่าง', exact: true }).click();
  await page.waitForURL(/\/work-orders\/[0-9a-f-]{36}$/);
  await page.getByText(product, { exact: true }).first().waitFor();
  const documentNo = await page.getByRole('heading', { level: 1 }).innerText();
  await page.getByRole('link', { name: 'แก้ไข', exact: true }).click();
  await page.getByLabel('จำนวนที่สั่งผลิต', { exact: true }).fill('5');
  await page.getByRole('button', { name: 'บันทึกร่าง', exact: true }).click();
  await page.waitForURL(/\/work-orders\/[0-9a-f-]{36}$/);
  await page.getByText('5 ชิ้น', { exact: true }).first().waitFor();
  await page.getByRole('button', { name: 'ส่งอนุมัติ', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'ยืนยัน', exact: true }).click();
  await page.getByText('ส่งตรวจสอบ', { exact: true }).first().waitFor();
  await page.screenshot({ path: '.local/screenshots/detail.png', fullPage: true });
  await page.goto('http://localhost:3000/work-orders');
  await page.getByLabel('ค้นหาใบสั่งงาน').fill(product);
  await page.getByText('1 เอกสาร', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'ตัวกรอง', exact: true }).click();
  await page.getByLabel('กำหนดส่ง ตั้งแต่').waitFor();
  await page.screenshot({ path: '.local/screenshots/list.png', fullPage: true });
  await page.getByLabel(`จัดการ ${documentNo}`, { exact: true }).click();
  await page.getByRole('button', { name: 'ยกเลิก', exact: true }).click();
  await page.getByRole('dialog').getByLabel('เหตุผลยกเลิก').fill('ทดสอบยกเลิกจากรายการใบงาน');
  await page.getByRole('dialog').getByRole('button', { name: 'ยืนยันยกเลิก', exact: true }).click();
  await page.locator('tbody').getByText('ยกเลิก', { exact: true }).waitFor();
  await page.getByLabel(`จัดการ ${documentNo}`, { exact: true }).click();
  await page.getByRole('link', { name: 'ทำสำเนา', exact: true }).click();
  await page.getByLabel('รหัสชิ้นงาน', { exact: true }).waitFor();
  assert.equal(await page.getByLabel('รหัสชิ้นงาน', { exact: true }).inputValue(), product);
  assert.equal(await page.getByLabel('materialCode 1', { exact: true }).inputValue(), 'AL-TEST');
  await page.goto('http://localhost:3000/settings');
  await page.getByRole('button', { name: 'เพิ่มผู้ใช้', exact: true }).click();
  await page.getByLabel('อีเมล', { exact: true }).fill(`browser-${Date.now()}@ats.local`);
  await page.getByLabel('ชื่อผู้ใช้', { exact: true }).fill(`browser-${Date.now()}`);
  await page.getByLabel('ชื่อ', { exact: true }).fill('Browser Supervisor');
  await page.getByLabel('ตำแหน่ง', { exact: true }).fill('หัวหน้าทดสอบ');
  await page
    .getByLabel('รหัสผ่านเริ่มต้น', { exact: true })
    .fill(process.env.ADMIN_INITIAL_PASSWORD);
  await page.getByLabel('แผนกผู้ใช้', { exact: true }).selectOption({ label: 'ฝ่ายผลิต' });
  await page.getByLabel('บทบาท', { exact: true }).selectOption('SUPERVISOR');
  await page.getByRole('button', { name: 'สร้างบัญชี', exact: true }).click();
  await page.getByText('สร้างผู้ใช้แล้ว', { exact: true }).waitFor();
  await page.screenshot({ path: '.local/screenshots/settings.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('http://localhost:3000/dashboard');
  await page.getByRole('heading', { name: 'ภาพรวมการผลิต' }).waitFor();
  assert.ok(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    'Mobile document must not overflow horizontally',
  );
  await page.screenshot({ path: '.local/screenshots/mobile.png', fullPage: true });
  await page.getByRole('button', { name: 'เปิดเมนู', exact: true }).click();
  await page.getByRole('button', { name: 'ปิดเมนู', exact: true }).waitFor();
  await page.getByRole('button', { name: 'ปิดเมนู', exact: true }).click();
  await page.goto('http://localhost:3000/work-orders/new');
  await page.getByLabel('เครื่องจักร', { exact: true }).waitFor();
  assert.ok(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    'Mobile create form must not overflow horizontally',
  );
  await page.screenshot({ path: '.local/screenshots/mobile-form.png', fullPage: true });
  assert.deepEqual(errors, []);
  console.log(
    'Browser verified: login, dashboard, create with materials, edit, confirmed submit, search, filters, list cancellation, duplication, user provisioning, and mobile dashboard/form. Screenshots: .local/screenshots',
  );
} finally {
  await browser.close();
}
