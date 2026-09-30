import { Module } from '@nestjs/common';
import { WorkOrdersController } from './work-orders.controller';
import { WorkOrdersService } from './work-orders.service';
import { WorkflowService } from './workflow.service';
import { AttachmentsService } from './attachments.service';
import { PdfService } from '../documents/pdf.service';
import { AuditModule } from '../audit/audit.module';
import { StorageModule } from '../storage/storage.module';
import { PdfAttachmentsService } from '../documents/pdf-attachments.service';
@Module({
  imports: [AuditModule, StorageModule],
  controllers: [WorkOrdersController],
  providers: [
    WorkOrdersService,
    WorkflowService,
    AttachmentsService,
    PdfService,
    PdfAttachmentsService,
  ],
})
export class WorkOrdersModule {}
