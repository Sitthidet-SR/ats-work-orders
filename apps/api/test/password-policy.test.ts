import 'reflect-metadata';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateSync } from 'class-validator';
import { compare } from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { Prisma } from '@prisma/client';
import { ChangePasswordDto, LoginDto } from '../src/modules/auth/auth.dto';
import { CreateUserDto } from '../src/modules/users/users.dto';
import { AuthService } from '../src/modules/auth/auth.service';
import { PrismaService } from '../src/common/prisma.service';

test('password setting accepts 4–6 characters and rejects other lengths', () => {
  for (const length of [3, 4, 5, 6, 7, 12]) {
    const password = 'a'.repeat(length);
    const accepted = length >= 4 && length <= 6;
    const change = Object.assign(new ChangePasswordDto(), { newPassword: password });
    assert.equal(validateSync(change).length === 0, accepted, `Change password: ${length}`);
    const create = Object.assign(new CreateUserDto(), {
      email: 'employee@ats.local',
      username: '1ATS999',
      name: 'Test',
      position: 'Test',
      departmentId: '11111111-1111-4111-8111-111111111111',
      roles: ['ISSUER'],
      password,
    });
    assert.equal(validateSync(create).length === 0, accepted, `Create user: ${length}`);
  }
  const login = Object.assign(new LoginDto(), {
    identifier: '1ATS050',
    password: 'Password@1',
    remember: false,
  });
  assert.equal(
    validateSync(login).length,
    0,
    'Existing temporary passwords remain usable for login',
  );
});

test('changePassword enforces the policy, hashes accepted passwords and clears initial-change flag', async () => {
  const updates: Prisma.UserUpdateArgs[] = [];
  const db = {
    user: {
      update: async (args: Prisma.UserUpdateArgs) => {
        updates.push(args);
      },
    },
  } as unknown as PrismaService;
  const auth = new AuthService(db, new JwtService());
  for (const password of ['abc', 'abcdefg', 'abcdefghijkl']) {
    await assert.rejects(auth.changePassword('employee', password));
  }
  assert.equal(updates.length, 0, 'Invalid passwords must not write to the database');
  for (const password of ['abcd', 'abcde', 'abcdef']) {
    await auth.changePassword('employee', password);
    const update = updates.at(-1)!;
    assert.equal(update.where.id, 'employee');
    assert.equal(update.data.forcePasswordChange, false);
    assert.equal(typeof update.data.passwordHash, 'string');
    assert.equal(await compare(password, update.data.passwordHash as string), true);
  }
});
