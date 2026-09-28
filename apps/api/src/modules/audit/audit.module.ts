import { Controller, Get, Module, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsInt, IsOptional, IsUUID, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { PrismaService } from '../../common/prisma.service';
import { RequirePermission } from '../roles/permissions';
import { AuditService } from './audit.service';
export class AuditQueryDto {
  @IsOptional() @IsUUID() entityId?: string;
  @Type(() => Number) @IsInt() @Min(1) page = 1;
  @Type(() => Number) @IsInt() @Min(1) @Max(100) limit = 20;
}
@ApiTags('audit')
@ApiBearerAuth()
@RequirePermission('audit.read')
@Controller('audit-logs')
class AuditController {
  constructor(private readonly db: PrismaService) {}
  @Get() async list(@Query() q: AuditQueryDto) {
    const where = { entityId: q.entityId };
    const [total, items] = await this.db.$transaction([
      this.db.auditLog.count({ where }),
      this.db.auditLog.findMany({
        where,
        include: { user: { select: { name: true } } },
        orderBy: { createdAt: 'desc' },
        take: q.limit,
        skip: (q.page - 1) * q.limit,
      }),
    ]);
    return { items, total, page: q.page, limit: q.limit, pages: Math.ceil(total / q.limit) };
  }
}
@Module({ controllers: [AuditController], providers: [AuditService], exports: [AuditService] })
export class AuditModule {}
