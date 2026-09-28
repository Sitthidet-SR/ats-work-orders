import { Controller, Get, Module } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../../common/prisma.service';
import { RequirePermission } from '../roles/permissions';
@ApiTags('departments')
@ApiBearerAuth()
@RequirePermission('work_order.read')
@Controller('departments')
class DepartmentsController {
  constructor(private readonly db: PrismaService) {}
  @Get() list() {
    return this.db.department.findMany({ orderBy: { code: 'asc' } });
  }
}
@Module({ controllers: [DepartmentsController] })
export class DepartmentsModule {}
