import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { hash } from 'bcrypt';
import { PrismaService } from '../../common/prisma.service';
import { AuditService } from '../audit/audit.service';
import { Actor, AuditContext } from '../auth/auth.types';
import { CreateUserDto } from './users.dto';
const publicSelect = {
  id: true,
  email: true,
  username: true,
  name: true,
  position: true,
  departmentId: true,
  department: true,
  roles: { select: { role: { select: { name: true } } } },
} as const;
@Injectable()
export class UsersService {
  constructor(
    private readonly db: PrismaService,
    private readonly audit: AuditService,
  ) {}
  async list() {
    const users = await this.db.user.findMany({
      where: { active: true },
      select: publicSelect,
      orderBy: { name: 'asc' },
    });
    return users.map((user) => ({ ...user, roles: user.roles.map((r) => r.role.name) }));
  }
  async resetPassword(id: string, actor: Actor, context: AuditContext) {
    if (!actor.roles.includes('ADMIN'))
      throw new ForbiddenException('เฉพาะแอดมินสามารถรีเซ็ตรหัสผ่านได้');
    // Temporary reset passwords are separate from the 4–6 character policy for new passwords.
    const passwordHash = await hash('Password@1', 12);
    return this.db.$transaction(async (tx) => {
      const user = await tx.user.findUnique({
        where: { id },
        select: { id: true, username: true, forcePasswordChange: true },
      });
      if (!user) throw new NotFoundException('ไม่พบบัญชีผู้ใช้');
      await tx.user.update({ where: { id }, data: { passwordHash, forcePasswordChange: true } });
      const revoked = await tx.refreshToken.updateMany({
        where: { userId: id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      await this.audit.write(
        tx,
        actor,
        'ADMIN_RESET_PASSWORD',
        id,
        { forcePasswordChange: user.forcePasswordChange },
        { forcePasswordChange: true, revokedSessions: revoked.count },
        context,
        'User',
      );
      return { id: user.id, username: user.username, forcePasswordChange: true };
    });
  }
  async create(dto: CreateUserDto, actor: Actor, context: AuditContext) {
    if (dto.password.length < 4 || dto.password.length > 6)
      throw new BadRequestException('รหัสผ่านต้องมีความยาว 4–6 ตัวอักษร');
    const passwordHash = await hash(dto.password, 12);
    const roles = await this.db.role.findMany({ where: { name: { in: dto.roles } } });
    if (roles.length !== dto.roles.length)
      throw new BadRequestException('กรุณา seed บทบาทก่อนสร้างผู้ใช้');
    return this.db.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: dto.email.toLowerCase(),
          username: dto.username,
          name: dto.name,
          position: dto.position,
          departmentId: dto.departmentId,
          passwordHash,
          roles: { create: roles.map((role) => ({ roleId: role.id })) },
        },
        select: publicSelect,
      });
      const result = { ...user, roles: user.roles.map((r) => r.role.name) };
      await this.audit.write(tx, actor, 'CREATE', user.id, null, result, context, 'User');
      return result;
    });
  }
}
