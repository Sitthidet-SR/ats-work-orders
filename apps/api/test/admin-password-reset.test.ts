import 'reflect-metadata';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compare } from 'bcrypt';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { UsersService } from '../src/modules/users/users.service';
import { UsersModule } from '../src/modules/users/users.module';
import { PrismaService } from '../src/common/prisma.service';
import { AuditService } from '../src/modules/audit/audit.service';
import { Actor } from '../src/modules/auth/auth.types';

function fixture(exists = true) {
  const updates: Prisma.UserUpdateArgs[] = [];
  const revocations: Prisma.RefreshTokenUpdateManyArgs[] = [];
  const audits: Parameters<AuditService['write']>[] = [];
  let transactions = 0;
  const target = { id: 'target', username: '1ATS001', forcePasswordChange: false };
  const tx = {
    user: {
      findUnique: async () => (exists ? target : null),
      update: async (args: Prisma.UserUpdateArgs) => {
        updates.push(args);
      },
    },
    refreshToken: {
      updateMany: async (args: Prisma.RefreshTokenUpdateManyArgs) => {
        revocations.push(args);
        return { count: 2 };
      },
    },
  } as unknown as Prisma.TransactionClient;
  const db = {
    $transaction: async (
      operation: (transaction: Prisma.TransactionClient) => Promise<unknown>,
    ) => {
      transactions++;
      return operation(tx);
    },
  } as unknown as PrismaService;
  const audit = {
    write: async (...args: Parameters<AuditService['write']>) => {
      audits.push(args);
    },
  } as unknown as AuditService;
  return {
    service: new UsersService(db, audit),
    updates,
    revocations,
    audits,
    tx,
    transactions: () => transactions,
  };
}

const admin = { id: 'admin', roles: ['ADMIN'], permissions: ['master.manage'] } as Actor;

test('admin reset stores a temporary password, requires change, revokes only target sessions and audits without credentials', async () => {
  const f = fixture();
  const result = await f.service.resetPassword('target', admin, { ipAddress: '127.0.0.1' });
  assert.equal(f.transactions(), 1);
  assert.equal(f.updates.length, 1);
  assert.equal(f.updates[0].where.id, 'target');
  assert.equal(f.updates[0].data.forcePasswordChange, true);
  assert.equal(await compare('Password@1', f.updates[0].data.passwordHash as string), true);
  assert.deepEqual(f.revocations[0].where, { userId: 'target', revokedAt: null });
  assert.ok(f.revocations[0].data.revokedAt instanceof Date);
  assert.equal(f.audits[0][0], f.tx);
  assert.equal(f.audits[0][1], admin);
  assert.equal(f.audits[0][2], 'ADMIN_RESET_PASSWORD');
  assert.equal(f.audits[0][3], 'target');
  assert.deepEqual(f.audits[0][5], { forcePasswordChange: true, revokedSessions: 2 });
  assert.equal(f.audits[0][7], 'User');
  assert.deepEqual(result, { id: 'target', username: '1ATS001', forcePasswordChange: true });
  for (const value of [result, f.audits[0].slice(2)]) {
    assert.equal(JSON.stringify(value).includes('Password@1'), false);
    assert.equal(JSON.stringify(value).includes('passwordHash'), false);
  }
});

test('a non-admin cannot reset passwords even with master.manage permission', async () => {
  const f = fixture();
  await assert.rejects(
    f.service.resetPassword('target', { ...admin, roles: ['ISSUER'] }, {}),
    ForbiddenException,
  );
  assert.equal(f.transactions(), 0);
  assert.equal(f.updates.length, 0);
});

test('missing users return not found without changing accounts or sessions', async () => {
  const f = fixture(false);
  await assert.rejects(f.service.resetPassword('missing', admin, {}), NotFoundException);
  assert.equal(f.updates.length, 0);
  assert.equal(f.revocations.length, 0);
  assert.equal(f.audits.length, 0);
});

test('the reset endpoint requires master.manage at the controller', () => {
  const [controller] = Reflect.getMetadata('controllers', UsersModule);
  assert.equal(
    Reflect.getMetadata('permission', controller.prototype.resetPassword),
    'master.manage',
  );
  assert.equal(
    Reflect.getMetadata('path', controller.prototype.resetPassword),
    ':id/reset-password',
  );
});
