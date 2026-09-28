import { Controller, Get, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { DatabaseModule, PrismaService } from './common/prisma.service';
import { AuthModule } from './modules/auth/auth.module';
import { AuthGuard, PermissionGuard } from './modules/auth/auth.guard';
import { Public } from './modules/roles/permissions';
import { WorkOrdersModule } from './modules/work-orders/work-orders.module';
import { DocumentsModule } from './modules/documents/documents.module';
import { MachinesModule } from './modules/machines/machines.module';
import { DepartmentsModule } from './modules/departments/departments.module';
import { UsersModule } from './modules/users/users.module';
import { AuditModule } from './modules/audit/audit.module';
@Controller('health')
class HealthController {
  constructor(private readonly db: PrismaService) {}
  @Public() @Get() async health() {
    await this.db.$queryRaw`SELECT 1`;
    return { status: 'ok' };
  }
}
@Module({
  imports: [
    DatabaseModule,
    AuthModule,
    DocumentsModule,
    AuditModule,
    MachinesModule,
    DepartmentsModule,
    UsersModule,
    WorkOrdersModule,
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 180 }]),
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_GUARD, useClass: PermissionGuard },
  ],
})
export class AppModule {}
