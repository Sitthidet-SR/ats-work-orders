import 'reflect-metadata';
import './common/env';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { NextFunction, Request, Response } from 'express';
import { AppModule } from './app.module';
import { GlobalExceptionFilter, ResponseInterceptor } from './common/http';
import { required, validateEnvironment } from './common/env';
async function bootstrap() {
  validateEnvironment();
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');
  // Only one trusted Render proxy hop; do not trust arbitrary client forwarding chains.
  if (process.env.NODE_ENV === 'production')
    app.getHttpAdapter().getInstance().set('trust proxy', 1);
  app.use(helmet());
  app.use(cookieParser());
  const origins = required('FRONTEND_URL').split(',');
  app.enableCors({ origin: origins, credentials: true });
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (
      !['GET', 'HEAD', 'OPTIONS'].includes(req.method) &&
      req.headers.origin &&
      !origins.includes(req.headers.origin)
    ) {
      res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Origin ไม่ได้รับอนุญาต', details: [] },
      });
      return;
    }
    if (
      req.path.startsWith('/api/auth/') &&
      req.headers['sec-fetch-site'] === 'cross-site' &&
      !req.headers.origin
    ) {
      res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Origin required', details: [] },
      });
      return;
    }
    next();
  });
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );
  app.useGlobalFilters(new GlobalExceptionFilter());
  app.useGlobalInterceptors(new ResponseInterceptor());
  const config = new DocumentBuilder()
    .setTitle('ATS Company Platform')
    .setDescription('Temporary Work Order REST API')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, config));
  app.enableShutdownHooks();
  await app.listen(Number(process.env.PORT ?? 4000), '0.0.0.0');
}
bootstrap().catch((error) => {
  console.error(error instanceof Error ? error.message : 'Startup failed');
  process.exit(1);
});
