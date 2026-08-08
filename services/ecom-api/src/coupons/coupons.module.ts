import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { Coupon } from './coupon.entity';
import { CouponsController } from './coupons.controller';
import { CouponsService } from './coupons.service';

/** Discount coupons (admin-managed, validated at checkout). */
@Module({
  imports: [TypeOrmModule.forFeature([Coupon]), AuthModule],
  controllers: [CouponsController],
  providers: [CouponsService],
  exports: [CouponsService],
})
export class CouponsModule {}
