import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { compare, hash } from 'bcrypt';
import { createHash, randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma.service';
import { required } from '../../common/env';
import { Actor } from './auth.types';
import { LoginDto } from './auth.dto';
const digest = (value: string) => createHash('sha256').update(value).digest('hex');
@Injectable()
export class AuthService {
  constructor(
    private readonly db: PrismaService,
    private readonly jwt: JwtService,
  ) {}
  async actor(id: string): Promise<Actor> {
    const user = await this.db.user.findUnique({
      where: { id },
      include: {
        department: true,
        roles: {
          include: { role: { include: { permissions: { include: { permission: true } } } } },
        },
      },
    });
    if (!user?.active) throw new UnauthorizedException('บัญชีไม่พร้อมใช้งาน');
    return {
      id: user.id,
      email: user.email,
      username: user.username,
      name: user.name,
      position: user.position,
      departmentId: user.departmentId,
      department: user.department,
      roles: user.roles.map((r) => r.role.name),
      permissions: [
        ...new Set(user.roles.flatMap((r) => r.role.permissions.map((p) => p.permission.name))),
      ],
      forcePasswordChange: user.forcePasswordChange,
    };
  }
  async login(dto: LoginDto) {
    const user = await this.db.user.findFirst({
      where: { OR: [{ email: dto.identifier.toLowerCase() }, { username: dto.identifier }] },
    });
    // A real bcrypt comparison even for nonexistent users prevents trivial timing enumeration.
    const hash =
      user?.passwordHash ?? '$2b$12$R9h/cIPz0gi.URNNX3kh2OPST9/PgBkqquzi.Ss7KIUgO2t0jWMUW';
    const valid = await compare(dto.password, hash);
    if (!user?.active || !valid)
      throw new UnauthorizedException('ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง');
    return this.issue(user.id, randomUUID(), dto.remember ? 30 : 1);
  }
  private async issue(
    userId: string,
    familyId: string,
    days: number,
    tx: Prisma.TransactionClient = this.db,
  ) {
    const id = randomUUID();
    const expiresAt = new Date(Date.now() + days * 86400000);
    const refreshToken = this.jwt.sign(
      { sub: userId, jti: id, familyId, days },
      { secret: required('JWT_REFRESH_SECRET'), expiresIn: days * 86400 },
    );
    await tx.refreshToken.create({
      data: { id, userId, familyId, tokenHash: digest(refreshToken), expiresAt },
    });
    return {
      accessToken: this.jwt.sign(
        { sub: userId },
        { secret: required('JWT_SECRET'), expiresIn: '15m' },
      ),
      refreshToken,
      expiresAt,
      user: await this.actor(userId),
    };
  }
  async refresh(token: string | undefined) {
    if (!token) throw new UnauthorizedException('กรุณาเข้าสู่ระบบ');
    let payload: { sub: string; jti: string; familyId: string; days: number };
    try {
      payload = this.jwt.verify(token, { secret: required('JWT_REFRESH_SECRET') });
    } catch {
      throw new UnauthorizedException('Session หมดอายุ');
    }
    const tokenHash = digest(token);
    const result = await this.db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM refresh_tokens WHERE "tokenHash" = ${tokenHash} FOR UPDATE`;
      const existing = await tx.refreshToken.findUnique({ where: { tokenHash } });
      if (!existing || existing.revokedAt || existing.expiresAt < new Date()) {
        if (existing)
          await tx.refreshToken.updateMany({
            where: { familyId: existing.familyId, revokedAt: null },
            data: { revokedAt: new Date() },
          });
        return null;
      }
      await this.actor(existing.userId);
      await tx.refreshToken.update({ where: { id: existing.id }, data: { revokedAt: new Date() } });
      return this.issue(existing.userId, existing.familyId, payload.days, tx);
    });
    if (!result) throw new UnauthorizedException('Session ถูกยกเลิก');
    return result;
  }
  async logout(token: string | undefined) {
    if (token) {
      const tokenHash = digest(token);
      await this.db.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM refresh_tokens WHERE "tokenHash" = ${tokenHash} FOR UPDATE`;
        const existing = await tx.refreshToken.findUnique({ where: { tokenHash } });
        if (existing)
          await tx.refreshToken.updateMany({
            where: { familyId: existing.familyId, revokedAt: null },
            data: { revokedAt: new Date() },
          });
      });
    }
    return { loggedOut: true };
  }

  async changePassword(userId: string, newPassword: string) {
    if (newPassword.length < 12)
      throw new UnauthorizedException('รหัสผ่านต้องมีความยาวอย่างน้อย 12 ตัวอักษร');
    const passwordHash = await hash(newPassword, 12);
    await this.db.user.update({
      where: { id: userId },
      data: { passwordHash, forcePasswordChange: false },
    });
    return { success: true };
  }
}
