import { Module } from '@nestjs/common';
import { StorageService } from './storage.service';

/** MinIO object storage (return-request images). */
@Module({
  providers: [StorageService],
  exports: [StorageService],
})
export class StorageModule {}
