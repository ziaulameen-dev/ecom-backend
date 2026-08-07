import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RefreshToken } from './refresh-token.entity';
import { RefreshService } from './refresh.service';

/** Owns the refresh-token store. Exported for the AuthModule. */
@Module({
  imports: [TypeOrmModule.forFeature([RefreshToken])],
  providers: [RefreshService],
  exports: [RefreshService],
})
export class RefreshModule {}
