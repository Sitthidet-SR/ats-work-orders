import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
process.loadEnvFile(new URL('../.env', import.meta.url));
const origin = process.env.USER_ROLES_CHECK_URL || 'http://127.0.0.1:3100';
const department = { id: '11111111-1111-4111-8111-111111111111', name: 'ฝ่ายผลิต', active: true };
const admin = {
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
  ...admin,
  id: '33333333-3333-4333-8333-333333333333',
  username: '1ATS001',
  name: 'พนักงานทดสอบ',
  roles: ['ISSUER'],
};
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROMIUM_EXECUTABLE_PATH,
});
async function setup(roles = ['ADMIN']) {
  const context = await browser.newContext();
  const page = await context.newPage();
  let actor = { ...admin, roles };
  const users = [{ ...admin }, { ...employee }];
  let failed = false;
  const changes = [];
  let meCalls = 0;
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
    if (path === '/auth/refresh') data = { accessToken: 'test', user: actor };
    else if (path === '/auth/me') {
      meCalls++;
      data = actor;
    } else if (path === '/machines') data = [];
    else if (path === '/departments') data = [department];
    else if (path === '/users') data = users;
    else if (path === '/audit-logs') data = { items: [], total: 0, page: 1, pages: 0, limit: 20 };
    else if (path.endsWith('/roles')) {
      assert.equal(request.method(), 'PATCH');
      const input = request.postDataJSON();
      changes.push(input.roles);
      if (failed)
        return route.fulfill({
          status: 400,
          headers,
          json: { success: false, error: { message: 'บันทึกสิทธิ์ไม่สำเร็จทดสอบ' } },
        });
      const target = users.find((user) => user.id === path.split('/')[2]);
      target.roles = input.roles;
      if (target.id === actor.id)
        actor = {
          ...actor,
          roles: input.roles,
          permissions: input.roles.includes('ADMIN') ? admin.permissions : ['work_order.read'],
        };
      data = target;
    } else throw new Error(`Unexpected request: ${request.method()} ${path}`);
    return route.fulfill({ headers, json: { success: true, data } });
  });
  return {
    context,
    page,
    changes,
    fail: () => {
      failed = true;
    },
    succeed: () => {
      failed = false;
    },
    meCalls: () => meCalls,
  };
}
try {
  const f = await setup();
  await f.page.goto(`${origin}/settings`);
  const manage = f.page.getByRole('button', { name: 'จัดการสิทธิ์ 1ATS001', exact: true });
  const dialog = f.page.getByRole('dialog');
  await manage.click();
  assert.equal(
    await dialog.getByRole('checkbox', { name: 'ISSUER', exact: true }).isChecked(),
    true,
  );
  await dialog.getByRole('button', { name: 'ยกเลิก', exact: true }).click();
  assert.equal(f.changes.length, 0);
  await manage.click();
  await dialog.getByRole('checkbox', { name: 'ISSUER', exact: true }).uncheck();
  assert.equal(
    await dialog.getByRole('button', { name: 'บันทึกสิทธิ์', exact: true }).isDisabled(),
    true,
  );
  await dialog.getByRole('checkbox', { name: 'ISSUER', exact: true }).check();
  await dialog.getByRole('checkbox', { name: 'ADMIN', exact: true }).check();
  await dialog.getByRole('checkbox', { name: 'SUPERVISOR', exact: true }).check();
  await dialog.getByRole('button', { name: 'บันทึกสิทธิ์', exact: true }).click();
  await dialog.waitFor({ state: 'hidden' });
  assert.deepEqual(f.changes[0], ['ISSUER', 'ADMIN', 'SUPERVISOR']);
  const row = f.page.getByRole('row').filter({ has: f.page.getByText('1ATS001', { exact: true }) });
  await row.getByText('SUPERVISOR', { exact: true }).waitFor();
  await row.getByText('ADMIN', { exact: true }).waitFor();
  f.fail();
  await manage.click();
  await dialog.getByRole('checkbox', { name: 'SUPERVISOR', exact: true }).uncheck();
  await dialog.getByRole('button', { name: 'บันทึกสิทธิ์', exact: true }).click();
  await f.page.getByText('บันทึกสิทธิ์ไม่สำเร็จทดสอบ', { exact: true }).waitFor();
  assert.equal(await dialog.isVisible(), true);
  f.succeed();
  await dialog.getByRole('button', { name: 'บันทึกสิทธิ์', exact: true }).click();
  await dialog.waitFor({ state: 'hidden' });
  await manage.click();
  assert.equal(
    await dialog.getByRole('checkbox', { name: 'SUPERVISOR', exact: true }).isChecked(),
    false,
  );
  await dialog.getByRole('button', { name: 'ยกเลิก', exact: true }).click();
  await f.page.getByRole('button', { name: 'จัดการสิทธิ์ 1ATS050', exact: true }).click();
  await dialog.getByRole('checkbox', { name: 'VIEWER', exact: true }).check();
  await dialog.getByRole('checkbox', { name: 'ADMIN', exact: true }).uncheck();
  await dialog.getByRole('button', { name: 'บันทึกสิทธิ์', exact: true }).click();
  await f.page.getByText('จัดการผู้ใช้งาน', { exact: true }).waitFor({ state: 'hidden' });
  assert.equal(f.meCalls(), 1, 'Self role changes must refresh the authenticated user');
  await f.context.close();
  const restricted = await setup(['ISSUER']);
  await restricted.page.goto(`${origin}/settings`);
  await restricted.page.getByText('รายชื่อพนักงานในระบบ (2)', { exact: true }).waitFor();
  assert.equal(await restricted.page.getByRole('button', { name: /^จัดการสิทธิ์ / }).count(), 0);
  await restricted.context.close();
  console.log(
    'User role browser checks passed: cancel, nonempty/multiple roles, save, retry after errors, badges, self-permission refresh, and non-admin button visibility. API calls were mocked; no real permission changes.',
  );
} finally {
  await browser.close();
}
