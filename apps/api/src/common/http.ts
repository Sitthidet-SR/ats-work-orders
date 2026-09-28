import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Response } from 'express';
import { map } from 'rxjs/operators';
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  catch(error: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();
    let status = 500;
    let message = 'เกิดข้อผิดพลาดภายในระบบ';
    let details: unknown[] = [];
    let code = 'INTERNAL_ERROR';
    if (error instanceof HttpException) {
      status = error.getStatus();
      const body = error.getResponse();
      if (typeof body === 'string') message = body;
      else {
        const value = body as { message?: string | string[] };
        if (Array.isArray(value.message)) {
          details = value.message;
          message = 'ข้อมูลไม่ถูกต้อง';
        } else message = value.message ?? error.message;
      }
      code =
        (
          {
            400: 'VALIDATION_ERROR',
            401: 'UNAUTHORIZED',
            403: 'FORBIDDEN',
            404: 'NOT_FOUND',
            409: 'CONFLICT',
            429: 'RATE_LIMITED',
          } as Record<number, string>
        )[status] ?? 'HTTP_ERROR';
    } else if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') {
        status = 409;
        code = 'DUPLICATE_RECORD';
        message = 'ข้อมูลซ้ำ กรุณาลองใหม่';
      } else if (error.code === 'P2025') {
        status = 404;
        code = 'NOT_FOUND';
        message = 'ไม่พบข้อมูล';
      } else if (error.code === 'P2003') {
        status = 400;
        code = 'INVALID_REFERENCE';
        message = 'ข้อมูลอ้างอิงไม่ถูกต้อง';
      }
    }
    if (status === 500)
      console.error(error instanceof Error ? error.name : 'Unknown internal error');
    response.status(status).json({ success: false, error: { code, message, details } });
  }
}
@Injectable()
export class ResponseInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler) {
    return next
      .handle()
      .pipe(
        map((data) =>
          context.switchToHttp().getResponse<Response>().headersSent
            ? data
            : { success: true, data, message: 'สำเร็จ' },
        ),
      );
  }
}
