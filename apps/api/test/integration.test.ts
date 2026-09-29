import '../src/common/env';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PrismaClient } from '@prisma/client';
import { required } from '../src/common/env';
import { JwtService } from '@nestjs/jwt';
const base = 'http://localhost:4000/api';
type Session = { token: string; cookie: string; user: { id: string; departmentId: string } };
type Order = {
  id: string;
  version: number;
  documentNo: string;
  status: string;
  approvals: { userId: string; stage: string }[];
};
async function request(path: string, method = 'GET', body?: unknown, session?: Session) {
  const res = await fetch(base + path, {
    method,
    headers: { ...(session ? { Authorization: `Bearer ${session.token}` } : {}) },
    ...(!(body instanceof FormData) && body !== undefined
      ? {
          headers: {
            'Content-Type': 'application/json',
            ...(session ? { Authorization: `Bearer ${session.token}` } : {}),
          },
        }
      : {}),
    body: body === undefined ? undefined : body instanceof FormData ? body : JSON.stringify(body),
  });
  const content = res.headers.get('content-type');
  const json = content?.includes('json') ? await res.json() : undefined;
  return { res, json };
}
async function login(identifier: string): Promise<Session> {
  const { res, json } = await request('/auth/login', 'POST', {
    identifier,
    password: required('ADMIN_INITIAL_PASSWORD'),
    remember: false,
  });
  assert.equal(res.status, 201, JSON.stringify(json));
  return {
    token: json.data.accessToken,
    cookie: res.headers.get('set-cookie')!.split(';')[0],
    user: json.data.user,
  };
}
test('PostgreSQL + API lifecycle, security, concurrency, audit, storage and Thai PDF', async () => {
  assert.equal(
    process.env.NODE_ENV,
    'development',
    'Integration tests must use a local development database',
  );
  assert.equal(process.env.SEED_DEMO, 'true', 'Run development seed first');
  const db = new PrismaClient();
  try {
    assert.equal((await request('/work-orders')).res.status, 401);
    const admin = await login('admin');
    const issuer = await login('Pattama.sa');
    const supervisor = await login('supervisor');
    const approver = await login('approver');
    const viewer = await login('viewer');
    const newUserInput = {
      email: `test-${Date.now()}@ats.local`,
      username: `test-${Date.now()}`,
      name: 'Unassigned Supervisor',
      position: 'หัวหน้าทดสอบ',
      departmentId: supervisor.user.departmentId,
      password: '123456',
      roles: ['SUPERVISOR'],
    };
    assert.equal((await request('/users', 'POST', newUserInput, viewer)).res.status, 403);
    const newUser = await request('/users', 'POST', newUserInput, admin);
    assert.equal(newUser.res.status, 201, JSON.stringify(newUser.json));
    assert.equal(newUser.json.data.passwordHash, undefined);
    const unassigned: Session = {
      token: new JwtService().sign(
        { sub: newUser.json.data.id },
        { secret: required('JWT_SECRET'), expiresIn: '15m' },
      ),
      cookie: '',
      user: newUser.json.data,
    };
    const machines = (await request('/machines', 'GET', undefined, admin)).json.data as {
      id: string;
      name: string;
    }[];
    const departments = (await request('/departments', 'GET', undefined, admin)).json.data as {
      id: string;
      name: string;
    }[];
    const today = new Date().toISOString().slice(0, 10);
    const payload = {
      orderDate: today,
      departmentId: issuer.user.departmentId,
      description: 'Integration test — ภาษาไทย งานผลิต',
      followAttachment: false,
      productCode: 'TEST-' + Date.now(),
      productName: 'ชิ้นงานทดสอบ',
      quantity: 2,
      unit: 'ชิ้น',
      machineId: machines[0].id,
      dueDate: today,
      dueTime: '16:30',
      priority: 'URGENT',
      reasonType: 'URGENT',
      reasonDetail: '',
      specialInstructions: 'ตรวจสอบขนาดตามแบบ',
      supervisorId: supervisor.user.id,
      approverId: approver.user.id,
      materials: [
        {
          materialCode: 'TEST-M',
          materialName: 'อะลูมิเนียม',
          quantity: 1,
          unit: 'ชิ้น',
          remark: 'ทดสอบ',
          sortOrder: 0,
        },
      ],
    };
    assert.equal((await request('/work-orders', 'POST', payload, viewer)).res.status, 403);
    assert.equal(
      (await request('/work-orders', 'POST', { ...payload, quantity: 0 }, issuer)).res.status,
      400,
    );
    assert.equal(
      (
        await request(
          '/work-orders',
          'POST',
          {
            ...payload,
            departmentId: departments.find((d) => d.id !== issuer.user.departmentId)!.id,
          },
          issuer,
        )
      ).res.status,
      403,
    );
    assert.equal(
      (await request('/work-orders', 'POST', { ...payload, extra: 'injected' }, issuer)).res.status,
      400,
    );
    const created = await Promise.all(
      Array.from({ length: 8 }, () => request('/work-orders', 'POST', payload, issuer)),
    );
    created.forEach((result) => assert.equal(result.res.status, 201, JSON.stringify(result.json)));
    const orders = created.map((result) => result.json.data as Order);
    assert.equal(new Set(orders.map((o) => o.documentNo)).size, 8);
    assert.match(orders[0].documentNo, /^PN\d{7,}$/);
    let order = orders[0];
    const edited = await request(
      `/work-orders/${order.id}`,
      'PATCH',
      { version: order.version, quantity: 3 },
      issuer,
    );
    assert.equal(edited.res.status, 200, JSON.stringify(edited.json));
    order = edited.json.data;
    assert.equal(edited.json.data.priority, 'URGENT', 'Partial update must preserve priority');
    assert.equal(edited.json.data.materials.length, 1, 'Partial update must preserve materials');
    assert.equal(
      (
        await request(
          `/work-orders/${order.id}`,
          'PATCH',
          { version: order.version, quantity: null },
          issuer,
        )
      ).res.status,
      400,
    );
    assert.equal(
      (await request(`/work-orders/${order.id}`, 'PATCH', { version: 0, quantity: 4 }, issuer)).res
        .status,
      409,
    );
    const foreign = await request(
      '/work-orders',
      'POST',
      { ...payload, departmentId: admin.user.departmentId },
      admin,
    );
    assert.equal(foreign.res.status, 201);
    assert.equal(
      (
        await request(
          `/work-orders/${foreign.json.data.id}`,
          'PATCH',
          { version: 0, quantity: 4 },
          issuer,
        )
      ).res.status,
      403,
    );
    assert.equal(
      (
        await request(
          `/work-orders/${order.id}/approve`,
          'POST',
          { version: order.version },
          approver,
        )
      ).res.status,
      409,
    );
    const invalidFile = new FormData();
    invalidFile.append('file', new Blob(['not-pdf'], { type: 'application/pdf' }), 'fake.pdf');
    assert.equal(
      (await request(`/work-orders/${order.id}/attachments`, 'POST', invalidFile, issuer)).res
        .status,
      400,
    );
    const pdf = await request(`/work-orders/${order.id}/pdf`, 'GET', undefined, admin);
    assert.equal(pdf.res.status, 200, JSON.stringify(pdf.json));
    const buffer = Buffer.from(await pdf.res.arrayBuffer());
    assert.equal(buffer.subarray(0, 5).toString(), '%PDF-');
    assert.ok(buffer.length > 10000);
    const file = new FormData();
    file.append('file', new Blob([buffer], { type: 'application/pdf' }), 'ใบงานทดสอบ.pdf');
    const uploaded = await request(`/work-orders/${order.id}/attachments`, 'POST', file, issuer);
    assert.equal(uploaded.res.status, 201, JSON.stringify(uploaded.json));
    assert.equal(uploaded.json.data.fileName, 'ใบงานทดสอบ.pdf');
    const signed = await request(
      `/work-orders/${order.id}/attachments/${uploaded.json.data.id}`,
      'GET',
      undefined,
      viewer,
    );
    assert.equal(signed.res.status, 200);
    const downloaded = await fetch(signed.json.data.url);
    assert.equal(downloaded.status, 200);
    assert.equal((await downloaded.arrayBuffer()).byteLength, buffer.length);
    order = (await request(`/work-orders/${order.id}`, 'GET', undefined, issuer)).json.data;
    const [first, second] = await Promise.all([
      request(`/work-orders/${order.id}/submit`, 'POST', { version: order.version }, issuer),
      request(`/work-orders/${order.id}/submit`, 'POST', { version: order.version }, issuer),
    ]);
    assert.deepEqual([first.res.status, second.res.status].sort(), [201, 409]);
    order = first.res.status === 201 ? first.json.data : second.json.data;
    assert.equal(
      (
        await request(
          `/work-orders/${order.id}/supervisor-review`,
          'POST',
          { version: order.version },
          unassigned,
        )
      ).res.status,
      403,
      'Unassigned supervisors must not review',
    );
    assert.equal(
      (
        await request(
          `/work-orders/${order.id}`,
          'PATCH',
          { version: order.version, quantity: 4 },
          issuer,
        )
      ).res.status,
      409,
    );
    assert.equal(
      (
        await request(
          `/work-orders/${order.id}/supervisor-review`,
          'POST',
          { version: order.version },
          viewer,
        )
      ).res.status,
      403,
    );
    for (const [action, session, status] of [
      ['supervisor-review', supervisor, 'SUPERVISOR_REVIEW'],
      ['supervisor-review', supervisor, 'WAITING_APPROVAL'],
      ['approve', approver, 'APPROVED'],
      ['issue', admin, 'ISSUED'],
      ['start', admin, 'IN_PROGRESS'],
      ['complete', admin, 'COMPLETED'],
    ] as const) {
      const result = await request(
        `/work-orders/${order.id}/${action}`,
        'POST',
        { version: order.version, comment: 'ทดสอบการอนุมัติ' },
        session,
      );
      assert.equal(result.res.status, 201, JSON.stringify(result.json));
      order = result.json.data;
      assert.equal(order.status, status);
    }
    assert.equal(
      (
        await request(
          `/work-orders/${order.id}/cancel`,
          'POST',
          { version: order.version, comment: 'ทดสอบ' },
          admin,
        )
      ).res.status,
      409,
    );
    const detail = (await request(`/work-orders/${order.id}`, 'GET', undefined, admin)).json.data;
    assert.ok(detail.activities.length >= 10);
    assert.ok(detail.approvals.every((a: { status: string }) => a.status === 'APPROVED'));
    await assert.rejects(
      db.auditLog.update({ where: { id: detail.activities[0].id }, data: { action: 'TAMPER' } }),
    );
    const rejected = orders[1];
    let rejectOrder = rejected;
    for (const [action, session] of [
      ['submit', issuer],
      ['supervisor-review', supervisor],
      ['supervisor-review', supervisor],
    ] as const)
      rejectOrder = (
        await request(
          `/work-orders/${rejectOrder.id}/${action}`,
          'POST',
          { version: rejectOrder.version },
          session,
        )
      ).json.data;
    assert.equal(
      (
        await request(
          `/work-orders/${rejectOrder.id}/reject`,
          'POST',
          { version: rejectOrder.version },
          approver,
        )
      ).res.status,
      400,
    );
    const reject = await request(
      `/work-orders/${rejectOrder.id}/reject`,
      'POST',
      { version: rejectOrder.version, comment: 'ไม่ผ่านข้อกำหนด' },
      approver,
    );
    assert.equal(reject.res.status, 201);
    assert.equal(reject.json.data.status, 'REJECTED');
    const list = await request(
      `/work-orders?search=${payload.productCode}&limit=3&sortBy=documentNo&sortOrder=asc`,
      'GET',
      undefined,
      admin,
    );
    assert.equal(list.json.data.items.length, 3);
    assert.ok(list.json.data.total >= 8);
    const dashboard = (await request('/work-orders/summary', 'GET', undefined, admin)).json.data;
    for (const summary of ['waiting', 'approved', 'urgent', 'overdue'])
      assert.equal(
        (await request(`/work-orders?summary=${summary}`, 'GET', undefined, admin)).json.data.total,
        dashboard[summary],
      );
    assert.equal(
      (await request(`/work-orders/${foreign.json.data.id}/print`, 'GET', undefined, issuer)).res
        .status,
      403,
    );
    const draftToDelete = orders[2];
    assert.equal(
      (
        await request(
          `/work-orders/${draftToDelete.id}`,
          'DELETE',
          { version: draftToDelete.version, comment: 'ลบร่างทดสอบ' },
          admin,
        )
      ).res.status,
      200,
    );
    const csrf = await fetch(base + '/auth/refresh', {
      method: 'POST',
      headers: { Origin: 'https://untrusted.example', Cookie: issuer.cookie },
    });
    assert.equal(csrf.status, 403);
    const rotated = await fetch(base + '/auth/refresh', {
      method: 'POST',
      headers: { Cookie: issuer.cookie },
    });
    assert.equal(rotated.status, 201);
    const rotatedCookie = rotated.headers.get('set-cookie')!.split(';')[0];
    assert.notEqual(rotatedCookie, issuer.cookie);
    assert.equal(
      (await fetch(base + '/auth/refresh', { method: 'POST', headers: { Cookie: issuer.cookie } }))
        .status,
      401,
    );
    assert.equal(
      (await fetch(base + '/auth/refresh', { method: 'POST', headers: { Cookie: rotatedCookie } }))
        .status,
      401,
    );
    console.log(
      'Verified concurrent numbering, ownership, full approval lifecycle, immutable audit, storage signatures, Thai PDF and refresh replay revocation. Test records remain in the local development database.',
    );
  } finally {
    await db.$disconnect();
  }
});
