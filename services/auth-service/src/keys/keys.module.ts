import { Module } from '@nestjs/common';
import { KeysService } from './keys.service';

/**
 * Owns the signing key material. Exported so the AuthModule can sign tokens
 * and the JwksModule can publish the public key.
 */
@Module({
  providers: [KeysService],
  exports: [KeysService],
})
export class KeysModule {}
