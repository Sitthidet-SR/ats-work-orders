import 'reflect-metadata';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateSync } from 'class-validator';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { UsersService } from '../src/modules/users/users.service';
import { UsersModule } from '../src/modules/users/users.module';
import { UpdateUserRolesDto } from '../src/modules/users/users.dto';
import { PrismaService } from '../src/common/prisma.service';
import { AuditService } from '../src/modules/audit/audit.service';
import { Actor } from '../src/modules/auth/auth.types';

function fixture(
  options: {
    oldRoles?: string[];
    admins?: number;
    currentAdmin?: boolean;
    exists?: boolean;
    missingRoles?: boolean;
  } = {},
) {
  const catalog = ['ADMIN', 'ISSUER', 'SUPERVISOR', 'APPROVER', 'VIEWER'].map((name) => ({
    id: `role-${name}`,
    name,
  }));
  const target = {
    id: 'target',
    username: '1ATS001',
    active: true,
    roles: (options.oldRoles ?? ['ISSUER']).map((name) => ({
      role: catalog.find((role) => role.name === name)!,
    })),
  };
  const writes: string[] = [];
  const sequence: string[] = [];
  const audits: Parameters<AuditService['write']>[] = [];
  const tx = {
    $queryRaw: async () => {
      sequence.push('lock');
      return [{ id: 'role-ADMIN' }];
    },
    user: {
      findUnique: async () => {
        sequence.push('target');
        return options.exists === false ? null : target;
      },
      findUniqueOrThrow: async () => target,
      count: async () => options.admins ?? 2,
    },
    role: {
      findMany: async ({ where }: { where: { name: { in: string[] } } }) =>
        options.missingRoles ? [] : catalog.filter((role) => where.name.in.includes(role.name)),
    },
    userRole: {
      findFirst: async () => {
        sequence.push('authorize');
        return options.currentAdmin === false ? null : { userId: 'admin' };
      },
      deleteMany: async ({ where }: { where: { userId: string } }) => {
        assert.equal(where.userId, 'target');
        writes.push('delete');
        target.roles = [];
      },
      createMany: async ({ data }: { data: Prisma.UserRoleCreateManyInput[] }) => {
        assert.equal(
          data.every((item) => item.userId === 'target'),
          true,
        );
        writes.push('create');
        target.roles = data.map((item) => ({
          role: catalog.find((role) => role.id === item.roleId)!,
        }));
      },
    },
  } as unknown as Prisma.TransactionClient;
  const db = {
    $transaction: async (operation: (transaction: Prisma.TransactionClient) => Promise<unknown>) =>
      operation(tx),
  } as unknown as PrismaService;
  const audit = {
    write: async (...args: Parameters<AuditService['write']>) => {
      audits.push(args);
    },
  } as unknown as AuditService;
  return { service: new UsersService(db, audit), target, writes, sequence, audits, tx };
}
const admin = { id: 'admin', roles: ['ADMIN'], permissions: ['master.manage'] } as Actor;

test('role DTO rejects empty, duplicate and unknown roles', () => {
  for (const roles of [[], ['ADMIN', 'ADMIN'], ['OWNER'], null, 'ADMIN']) {
    assert.ok(validateSync(Object.assign(new UpdateUserRolesDto(), { roles })).length > 0);
  }
  assert.equal(
    validateSync(Object.assign(new UpdateUserRolesDto(), { roles: ['ISSUER', 'SUPERVISOR'] }))
      .length,
    0,
  );
});

test('admin can replace roles with multiple roles and audit before/after', async () => {
  const f = fixture();
  const result = await f.service.updateRoles(
    'target',
    { roles: ['SUPERVISOR', 'APPROVER'] },
    admin,
    {},
  );
  assert.deepEqual(f.sequence.slice(0, 3), ['lock', 'authorize', 'target']);
  assert.deepEqual(f.writes, ['delete', 'create']);
  assert.deepEqual(result.roles, ['SUPERVISOR', 'APPROVER']);
  assert.equal(f.audits[0][0], f.tx);
  assert.equal(f.audits[0][2], 'UPDATE_USER_ROLES');
  assert.equal(f.audits[0][3], 'target');
  assert.deepEqual(f.audits[0][4], { roles: ['ISSUER'] });
  assert.deepEqual(f.audits[0][5], { roles: ['SUPERVISOR', 'APPROVER'] });
  assert.equal(f.audits[0][7], 'User');
});

test('non-admin and an administrator demoted while waiting cannot change roles', async () => {
  const f = fixture();
  await assert.rejects(
    f.service.updateRoles('target', { roles: ['ADMIN'] }, { ...admin, roles: ['ISSUER'] }, {}),
    ForbiddenException,
  );
  assert.deepEqual(f.sequence, []);
  const stale = fixture({ currentAdmin: false });
  await assert.rejects(
    stale.service.updateRoles('target', { roles: ['ADMIN'] }, admin, {}),
    ForbiddenException,
  );
  assert.deepEqual(stale.writes, []);
});

test('last active administrator cannot be removed, while removal with another admin is allowed', async () => {
  const last = fixture({ oldRoles: ['ADMIN'], admins: 1 });
  await assert.rejects(
    last.service.updateRoles('target', { roles: ['VIEWER'] }, admin, {}),
    BadRequestException,
  );
  assert.deepEqual(last.writes, []);
  const multiple = fixture({ oldRoles: ['ADMIN'], admins: 2 });
  const result = await multiple.service.updateRoles('target', { roles: ['VIEWER'] }, admin, {});
  assert.deepEqual(result.roles, ['VIEWER']);
});

test('invalid roles, missing users and missing seeded roles never delete existing roles', async () => {
  for (const roles of [[], ['ADMIN', 'ADMIN'], ['__proto__'], ['UNKNOWN']]) {
    const f = fixture();
    await assert.rejects(
      f.service.updateRoles('target', { roles }, admin, {}),
      BadRequestException,
    );
    assert.deepEqual(f.writes, []);
  }
  const absent = fixture({ exists: false });
  await assert.rejects(
    absent.service.updateRoles('target', { roles: ['VIEWER'] }, admin, {}),
    NotFoundException,
  );
  assert.deepEqual(absent.writes, []);
  const unseeded = fixture({ missingRoles: true });
  await assert.rejects(
    unseeded.service.updateRoles('target', { roles: ['VIEWER'] }, admin, {}),
    BadRequestException,
  );
  assert.deepEqual(unseeded.writes, []);
});

test('the role endpoint requires master.manage permission', () => {
  const [controller] = Reflect.getMetadata('controllers', UsersModule);
  assert.equal(
    Reflect.getMetadata('permission', controller.prototype.updateRoles),
    'master.manage',
  );
  assert.equal(Reflect.getMetadata('path', controller.prototype.updateRoles), ':id/roles');
});
