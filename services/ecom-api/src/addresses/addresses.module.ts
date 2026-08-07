import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { Address } from './address.entity';
import { AddressesController } from './addresses.controller';
import { AddressesService } from './addresses.service';

/** User-scoped shipping addresses. */
@Module({
  imports: [TypeOrmModule.forFeature([Address]), AuthModule],
  controllers: [AddressesController],
  providers: [AddressesService],
  exports: [AddressesService],
})
export class AddressesModule {}
