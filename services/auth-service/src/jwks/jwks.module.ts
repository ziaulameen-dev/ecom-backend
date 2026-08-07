import { Module } from '@nestjs/common';
import { KeysModule } from '../keys/keys.module';
import { JwksController } from './jwks.controller';

/**
 * Exposes the public JWKS endpoint. Depends on KeysModule for the key set.
 */
@Module({
  imports: [KeysModule],
  controllers: [JwksController],
})
export class JwksModule {}
