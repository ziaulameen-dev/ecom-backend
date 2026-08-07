import { Module } from '@nestjs/common';
import { DenylistService } from './denylist.service';

/** Shared Redis session denylist. Exported for the AuthModule (guard + logout). */
@Module({
  providers: [DenylistService],
  exports: [DenylistService],
})
export class DenylistModule {}
