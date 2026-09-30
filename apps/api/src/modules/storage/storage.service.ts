import { BadRequestException, Injectable } from '@nestjs/common';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'node:crypto';
import { extname } from 'node:path';
import { required } from '../../common/env';
export abstract class StorageService {
  abstract put(file: Express.Multer.File): Promise<{ key: string; url: string; mimeType: string }>;
  abstract download(key: string, fileName: string): Promise<string>;
  abstract remove(key: string): Promise<void>;
  abstract read(key: string): Promise<Buffer>;
}
const types: Record<string, string[]> = {
  pdf: ['application/pdf'],
  jpg: ['image/jpeg'],
  jpeg: ['image/jpeg'],
  png: ['image/png'],
  xls: ['application/vnd.ms-excel', 'application/x-cfb'],
  xlsx: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
  doc: ['application/msword', 'application/x-cfb'],
  docx: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  ppt: ['application/vnd.ms-powerpoint', 'application/x-cfb'],
  pptx: ['application/vnd.openxmlformats-officedocument.presentationml.presentation'],
  dwg: ['image/vnd.dwg', 'application/acad', 'application/octet-stream'],
  dxf: ['image/vnd.dxf', 'application/dxf', 'application/octet-stream', 'text/plain'],
  step: ['application/step', 'model/step', 'application/octet-stream', 'text/plain'],
  stp: ['application/step', 'model/step', 'application/octet-stream', 'text/plain'],
};
@Injectable()
export class S3StorageService extends StorageService {
  private client(publicUrl = false) {
    return new S3Client({
      endpoint:
        (publicUrl ? process.env.STORAGE_PUBLIC_ENDPOINT : undefined) ||
        process.env.STORAGE_ENDPOINT ||
        undefined,
      region: required('STORAGE_REGION'),
      forcePathStyle: process.env.STORAGE_FORCE_PATH_STYLE === 'true',
      credentials: {
        accessKeyId: required('STORAGE_ACCESS_KEY'),
        secretAccessKey: required('STORAGE_SECRET_KEY'),
      },
    });
  }
  async put(file: Express.Multer.File) {
    const extension = extname(file.originalname).slice(1).toLowerCase();
    if (!types[extension]?.includes(file.mimetype) || !file.size || file.size > 20 * 1024 * 1024)
      throw new BadRequestException('ชนิดไฟล์ไม่รองรับ หรือไฟล์เกิน 20 MB');
    // Magic-byte detection for document/image formats. CAD text/binary signatures are checked separately.
    // Preserve native ESM import when compiling the NestJS application to CommonJS.
    const { fileTypeFromBuffer } = await import('file-type');
    const detected = await fileTypeFromBuffer(file.buffer);
    if (
      ['pdf', 'jpg', 'jpeg', 'png', 'xls', 'xlsx', 'doc', 'docx', 'ppt', 'pptx'].includes(extension)
    ) {
      if (!detected || !types[extension].includes(detected.mime))
        throw new BadRequestException('เนื้อหาไฟล์ไม่ตรงกับชนิดไฟล์');
    } else {
      const head = file.buffer.subarray(0, 4096).toString('utf8');
      const valid =
        extension === 'dwg'
          ? /^AC10\d{2}/.test(head)
          : ['step', 'stp'].includes(extension)
            ? /ISO-10303-21;/.test(head)
            : /(SECTION|AutoCAD Binary DXF)/.test(head);
      if (!valid) throw new BadRequestException('รูปแบบไฟล์ CAD ไม่ถูกต้อง');
    }
    const key = `work-orders/${randomUUID()}.${extension}`;
    const mimeType = detected?.mime ?? file.mimetype;
    await this.client().send(
      new PutObjectCommand({
        Bucket: required('STORAGE_BUCKET'),
        Key: key,
        Body: file.buffer,
        ContentType: mimeType,
      }),
    );
    return { key, url: `s3://${required('STORAGE_BUCKET')}/${key}`, mimeType };
  }
  async download(key: string, fileName: string) {
    return getSignedUrl(
      this.client(true),
      new GetObjectCommand({
        Bucket: required('STORAGE_BUCKET'),
        Key: key,
        ResponseContentDisposition: `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`,
      }),
      { expiresIn: 300 },
    );
  }
  async remove(key: string) {
    await this.client().send(
      new DeleteObjectCommand({ Bucket: required('STORAGE_BUCKET'), Key: key }),
    );
  }
  async read(key: string) {
    const object = await this.client().send(
      new GetObjectCommand({ Bucket: required('STORAGE_BUCKET'), Key: key }),
    );
    if (!object.Body) throw new BadRequestException('ไม่พบเนื้อหาไฟล์แนบ');
    return Buffer.from(await object.Body.transformToByteArray());
  }
}
