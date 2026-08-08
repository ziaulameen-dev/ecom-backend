import {
  Injectable,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client } from 'minio';
import { randomUUID } from 'crypto';
import { Readable } from 'stream';

/**
 * MinIO (S3-compatible) object storage for return-request images. The API
 * proxies both upload and download, so the browser never talks to MinIO and we
 * avoid presigned-URL host mismatches inside Docker.
 */
@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
  private readonly client: Client;
  private readonly bucket: string;

  constructor(private readonly config: ConfigService) {
    this.bucket = this.config.get<string>('storage.bucket')!;
    this.client = new Client({
      endPoint: this.config.get<string>('storage.endpoint')!,
      port: this.config.get<number>('storage.port'),
      useSSL: this.config.get<boolean>('storage.useSSL'),
      accessKey: this.config.get<string>('storage.accessKey')!,
      secretKey: this.config.get<string>('storage.secretKey')!,
    });
  }

  /** Ensure the bucket exists on boot (idempotent). */
  async onModuleInit() {
    try {
      if (!(await this.client.bucketExists(this.bucket))) {
        await this.client.makeBucket(this.bucket, '');
        this.logger.log(`Created bucket "${this.bucket}"`);
      }
    } catch (e) {
      this.logger.warn(`MinIO not ready: ${(e as Error).message}`);
    }
  }

  /** Store a file under `prefix/` and return the object key. */
  async put(
    prefix: string,
    buffer: Buffer,
    contentType: string,
    ext: string,
  ): Promise<string> {
    const key = `${prefix}/${randomUUID()}${ext}`;
    await this.client.putObject(this.bucket, key, buffer, buffer.length, {
      'Content-Type': contentType,
    });
    return key;
  }

  /** Open a read stream + content-type for an object key. */
  async get(key: string): Promise<{ stream: Readable; contentType: string }> {
    const stat = await this.client.statObject(this.bucket, key);
    const stream = await this.client.getObject(this.bucket, key);
    return {
      stream,
      contentType: stat.metaData?.['content-type'] ?? 'application/octet-stream',
    };
  }
}
