import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { ShippingController } from './shipping.controller';
import { ShippingRate } from './shipping-rate.entity';
import { ShippingService } from './shipping.service';

/** Single flat delivery charge (admin-managed). */
@Module({
  imports: [TypeOrmModule.forFeature([ShippingRate]), AuthModule],
  controllers: [ShippingController],
  providers: [ShippingService],
  exports: [ShippingService],
})
export class ShippingModule {}
