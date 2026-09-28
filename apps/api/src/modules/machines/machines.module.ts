import { Body, Controller, Get, Module, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiProperty, ApiTags } from '@nestjs/swagger';
import { IsBoolean, IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { PrismaService } from '../../common/prisma.service';
import { RequirePermission } from '../roles/permissions';
import { AuditModule } from '../audit/audit.module';
import { AuditService } from '../audit/audit.service';
import { AuthRequest, auditContext } from '../auth/auth.types';
class MachineDto {
  @ApiProperty() @IsString() @IsNotEmpty() @MaxLength(30) code!: string;
  @ApiProperty() @IsString() @IsNotEmpty() @MaxLength(100) name!: string;
  @ApiProperty() @IsString() @MaxLength(1000) description = '';
  @ApiProperty() @IsBoolean() active = true;
}
@ApiTags('machines')
@ApiBearerAuth()
@Controller('machines')
class MachinesController {
  constructor(
    private readonly db: PrismaService,
    private readonly audit: AuditService,
  ) {}
  @Get() @RequirePermission('work_order.read') list() {
    return this.db.machine.findMany({ orderBy: { name: 'asc' } });
  }
  @Post() @RequirePermission('master.manage') create(
    @Body() dto: MachineDto,
    @Req() req: AuthRequest,
  ) {
    return this.db.$transaction(async (tx) => {
      const machine = await tx.machine.create({ data: dto });
      await this.audit.write(
        tx,
        req.user,
        'CREATE',
        machine.id,
        null,
        machine,
        auditContext(req),
        'Machine',
      );
      return machine;
    });
  }
}
@Module({ imports: [AuditModule], controllers: [MachinesController] })
export class MachinesModule {}
