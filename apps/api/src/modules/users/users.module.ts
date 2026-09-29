import {
  Body,
  Controller,
  Get,
  Module,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RequirePermission } from '../roles/permissions';
import { UsersService } from './users.service';
import { CreateUserDto, UpdateUserRolesDto } from './users.dto';
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
  @Post(':id/reset-password')
  @RequirePermission('master.manage')
  @ApiOperation({ summary: 'Admin resets a user password to the temporary initial password' })
  resetPassword(@Param('id', ParseUUIDPipe) id: string, @Req() req: AuthRequest) {
    return this.users.resetPassword(id, req.user, auditContext(req));
  }
  @Patch(':id/roles')
  @RequirePermission('master.manage')
  @ApiOperation({ summary: 'Admin updates the roles of a user' })
  updateRoles(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserRolesDto,
    @Req() req: AuthRequest,
  ) {
    return this.users.updateRoles(id, dto, req.user, auditContext(req));
  }
}
@Module({ imports: [AuditModule], controllers: [UsersController], providers: [UsersService] })
export class UsersModule {}
