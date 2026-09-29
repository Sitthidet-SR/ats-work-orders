import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
process.loadEnvFile(new URL('../.env', import.meta.url));
const origin = process.env.ADMIN_RESET_CHECK_URL || 'http://127.0.0.1:3100';
const department = { id: '11111111-1111-4111-8111-111111111111', name: 'ฝ่ายผลิต', active: true };
const administrator = {
  id: '22222222-2222-4222-8222-222222222222',
  username: '1ATS050',
  name: 'แอดมินทดสอบ',
  departmentId: department.id,
  department,
  position: 'Admin',
  roles: ['ADMIN'],
  forcePasswordChange: false,
  permissions: ['master.manage', 'work_order.read', 'audit.read'],
};
const employee = {
  ...administrator,
  id: '33333333-3333-4333-8333-333333333333',
  username: '1ATS001',
  name: 'พนักงานทดสอบ',
  roles: ['ISSUER'],
};
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROMIUM_EXECUTABLE_PATH,
});
async function setup(actor) {
  const context = await browser.newContext();
  const page = await context.newPage();
  let authenticated = true;
  let resetStatus = 201;
  let logouts = 0;
  const resets = [];
  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname.replace(/^\/api/, '');
    const headers = {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Allow-Headers': 'authorization, content-type',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    };
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
    if (path === '/auth/refresh' && !authenticated)
      return route.fulfill({ status: 401, headers, json: { success: false } });
    let data;
    if (path === '/auth/refresh') data = { accessToken: 'test', user: actor };
    else if (path === '/auth/logout') {
      authenticated = false;
      logouts++;
      data = { loggedOut: true };
    } else if (path === '/machines') data = [];
    else if (path === '/departments') data = [department];
    else if (path === '/users') data = [administrator, employee];
    else if (path === '/audit-logs') data = { items: [], total: 0, page: 1, pages: 0, limit: 20 };
    else if (path.endsWith('/reset-password')) {
      assert.equal(request.method(), 'POST');
      resets.push(path);
      if (resetStatus !== 201)
        return route.fulfill({
          status: resetStatus,
          headers,
          json: { success: false, error: { message: 'รีเซ็ตไม่สำเร็จทดสอบ' } },
        });
      data = { id: path.split('/')[2], forcePasswordChange: true };
    } else throw new Error(`Unexpected request: ${request.method()} ${path}`);
    return route.fulfill({ headers, json: { success: true, data } });
  });
  return {
    context,
    page,
    resets,
    fail: () => {
      resetStatus = 500;
    },
    succeed: () => {
      resetStatus = 201;
    },
    logouts: () => logouts,
  };
}
try {
  const f = await setup(administrator);
  await f.page.goto(`${origin}/settings`);
  const resetOther = f.page.getByRole('button', { name: 'รีเซ็ตรหัสผ่าน 1ATS001', exact: true });
  await resetOther.click();
  await f.page
    .getByRole('dialog')
    .getByText(/Password@1/)
    .waitFor();
  await f.page.getByRole('button', { name: 'ยกเลิก', exact: true }).click();
  assert.equal(f.resets.length, 0);
  await resetOther.click();
  await f.page.getByRole('button', { name: 'ยืนยันรีเซ็ตรหัสผ่าน', exact: true }).click();
  await f.page
    .getByText('รีเซ็ตรหัสผ่านของ 1ATS001 เป็น Password@1 แล้ว', { exact: true })
    .waitFor();
  assert.deepEqual(f.resets, [`/users/${employee.id}/reset-password`]);
  f.fail();
  await resetOther.click();
  await f.page.getByRole('button', { name: 'ยืนยันรีเซ็ตรหัสผ่าน', exact: true }).click();
  await f.page.getByText('รีเซ็ตไม่สำเร็จทดสอบ', { exact: true }).waitFor();
  assert.equal(await f.page.getByRole('dialog').isVisible(), true);
  await f.page.getByRole('button', { name: 'ยกเลิก', exact: true }).click();
  f.succeed();
  await f.page.getByRole('button', { name: 'รีเซ็ตรหัสผ่าน 1ATS050', exact: true }).click();
  await f.page.getByText('คุณจะออกจากระบบหลังรีเซ็ตรหัสผ่านของตัวเอง', { exact: true }).waitFor();
  await f.page.getByRole('button', { name: 'ยืนยันรีเซ็ตรหัสผ่าน', exact: true }).click();
  await f.page.waitForURL(`${origin}/login`);
  assert.equal(f.logouts(), 1);
  assert.equal(f.resets.at(-1), `/users/${administrator.id}/reset-password`);
  await f.context.close();
  const restricted = await setup({ ...administrator, roles: ['ISSUER'] });
  await restricted.page.goto(`${origin}/settings`);
  await restricted.page.getByText('รายชื่อพนักงานในระบบ (2)', { exact: true }).waitFor();
  assert.equal(await restricted.page.getByRole('button', { name: /^รีเซ็ตรหัสผ่าน / }).count(), 0);
  await restricted.context.close();
  console.log(
    'Admin reset browser checks passed: cancellation, reset, failure, self-reset logout, and non-admin button visibility. API calls were mocked; no real password changes.',
  );
} finally {
  await browser.close();
}
