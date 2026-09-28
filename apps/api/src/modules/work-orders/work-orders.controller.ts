import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { AuthRequest, auditContext } from '../auth/auth.types';
import { RequirePermission } from '../roles/permissions';
import { WorkOrdersService } from './work-orders.service';
import {
  ActionDto,
  CreateWorkOrderDto,
  ListWorkOrdersDto,
  UpdateWorkOrderDto,
} from './work-order.dto';
import { PdfService } from '../documents/pdf.service';
import { AttachmentsService } from './attachments.service';
@ApiTags('work-orders')
@ApiBearerAuth()
@Controller('work-orders')
export class WorkOrdersController {
  constructor(
    private readonly orders: WorkOrdersService,
    private readonly pdf: PdfService,
    private readonly attachments: AttachmentsService,
  ) {}
  @Get('summary') @RequirePermission('work_order.read') summary() {
    return this.orders.dashboard();
  }
  @Get() @RequirePermission('work_order.read') list(@Query() query: ListWorkOrdersDto) {
    return this.orders.list(query);
  }
  @Post('preview') @RequirePermission('work_order.create') async preview(
    @Body() dto: CreateWorkOrderDto,
    @Req() req: AuthRequest,
    @Res() res: Response,
  ) {
    const buffer = await this.pdf.preview(dto, req.user);
    res.type('application/pdf').setHeader('Cache-Control', 'private, no-store');
    res.send(buffer);
  }
  @Post(':id/pdf-archives') @RequirePermission('work_order.print') async savePdf(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: AuthRequest,
  ) {
    const result = await this.pdf.generate(id, req.user, 'work_order.print');
    return { id: result.id, fileName: result.fileName };
  }
  @Get(':id/pdf-archives') @RequirePermission('work_order.read') pdfHistory(
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.pdf.history(id);
  }
  @Get(':id/pdf-archives/:archiveId') @RequirePermission('work_order.print') async archivedPdf(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('archiveId', ParseUUIDPipe) archiveId: string,
    @Req() req: AuthRequest,
    @Res() res: Response,
  ) {
    const result = await this.pdf.archived(id, archiveId, req.user);
    res
      .type('application/pdf')
      .setHeader('Cache-Control', 'private, no-store')
      .setHeader('Content-Disposition', `inline; filename="${result.fileName}"`);
    res.send(result.buffer);
  }
  @Post() @RequirePermission('work_order.create') create(
    @Body() dto: CreateWorkOrderDto,
    @Req() req: AuthRequest,
  ) {
    return this.orders.create(dto, req.user, auditContext(req));
  }
  @Get(':id') @RequirePermission('work_order.read') detail(@Param('id', ParseUUIDPipe) id: string) {
    return this.orders.detail(id);
  }
  @Patch(':id') @RequirePermission('work_order.update') update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateWorkOrderDto,
    @Req() req: AuthRequest,
  ) {
    return this.orders.update(id, dto, req.user, auditContext(req));
  }
  @Delete(':id') @RequirePermission('work_order.delete') delete(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ActionDto,
    @Req() req: AuthRequest,
  ) {
    return this.orders.deleteDraft(id, dto, req.user, auditContext(req));
  }
  @Post(':id/submit') @RequirePermission('work_order.submit') submit(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ActionDto,
    @Req() req: AuthRequest,
  ) {
    return this.orders.action(id, 'submit', dto, req.user, auditContext(req));
  }
  @Post(':id/supervisor-review') @RequirePermission('work_order.supervisor_review') review(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ActionDto,
    @Req() req: AuthRequest,
  ) {
    return this.orders.action(id, 'supervisor-review', dto, req.user, auditContext(req));
  }
  @Post(':id/approve') @RequirePermission('work_order.approve') approve(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ActionDto,
    @Req() req: AuthRequest,
  ) {
    return this.orders.action(id, 'approve', dto, req.user, auditContext(req));
  }
  @Post(':id/reject') @RequirePermission('work_order.reject') reject(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ActionDto,
    @Req() req: AuthRequest,
  ) {
    return this.orders.action(id, 'reject', dto, req.user, auditContext(req));
  }
  @Post(':id/issue') @RequirePermission('work_order.issue') issue(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ActionDto,
    @Req() req: AuthRequest,
  ) {
    return this.orders.action(id, 'issue', dto, req.user, auditContext(req));
  }
  @Post(':id/start') @RequirePermission('work_order.start') start(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ActionDto,
    @Req() req: AuthRequest,
  ) {
    return this.orders.action(id, 'start', dto, req.user, auditContext(req));
  }
  @Post(':id/complete') @RequirePermission('work_order.complete') complete(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ActionDto,
    @Req() req: AuthRequest,
  ) {
    return this.orders.action(id, 'complete', dto, req.user, auditContext(req));
  }
  @Post(':id/cancel') @RequirePermission('work_order.cancel') cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ActionDto,
    @Req() req: AuthRequest,
  ) {
    return this.orders.action(id, 'cancel', dto, req.user, auditContext(req));
  }
  @Get(':id/pdf') @RequirePermission('work_order.export') async export(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: AuthRequest,
    @Res() res: Response,
  ) {
    const result = await this.pdf.generate(id, req.user);
    res
      .type('application/pdf')
      .setHeader('Content-Disposition', `attachment; filename="${result.documentNo}.pdf"`);
    res.send(result.buffer);
  }
  @Get(':id/print') @RequirePermission('work_order.print') async print(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: AuthRequest,
    @Res() res: Response,
  ) {
    const result = await this.pdf.generate(id, req.user, 'work_order.print');
    res
      .type('application/pdf')
      .setHeader('Content-Disposition', `inline; filename="${result.documentNo}.pdf"`);
    res.send(result.buffer);
  }
  @Post(':id/attachments')
  @RequirePermission('work_order.update')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 20 * 1024 * 1024, files: 1 } }))
  upload(
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file: Express.Multer.File,
    @Req() req: AuthRequest,
  ) {
    return this.attachments.upload(id, file, req.user, auditContext(req));
  }
  @Get(':id/attachments/:attachmentId') @RequirePermission('work_order.read') download(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('attachmentId', ParseUUIDPipe) attachmentId: string,
  ) {
    return this.attachments.download(id, attachmentId);
  }
}
