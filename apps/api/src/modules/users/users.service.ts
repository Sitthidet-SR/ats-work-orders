import { BadRequestException, Injectable } from '@nestjs/common';
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
  async create(dto: CreateUserDto, actor: Actor, context: AuditContext) {
    if (Buffer.byteLength(dto.password, 'utf8') > 72)
      throw new BadRequestException('รหัสผ่านต้องไม่เกิน 72 bytes');
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
