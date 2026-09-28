import { Module } from '@nestjs/common';
import { StorageService, S3StorageService } from './storage.service';
@Module({
  providers: [{ provide: StorageService, useClass: S3StorageService }],
  exports: [StorageService],
})
export class StorageModule {}
