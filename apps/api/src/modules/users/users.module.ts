import { Body, Controller, Get, Module, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RequirePermission } from '../roles/permissions';
import { UsersService } from './users.service';
import { CreateUserDto } from './users.dto';
import { AuditModule } from '../audit/audit.module';
import { AuthRequest, auditContext } from '../auth/auth.types';
@ApiTags('users')
@ApiBearerAuth()
@RequirePermission('work_order.read')
@Controller('users')
class UsersController {
  constructor(private readonly users: UsersService) {}
  @Get() async list() {
    return this.users.list();
  }
  @Post() @RequirePermission('master.manage') create(
    @Body() dto: CreateUserDto,
    @Req() req: AuthRequest,
  ) {
    return this.users.create(dto, req.user, auditContext(req));
  }
}
@Module({ imports: [AuditModule], controllers: [UsersController], providers: [UsersService] })
export class UsersModule {}
