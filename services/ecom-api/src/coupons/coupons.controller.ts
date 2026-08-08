import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { CouponsService } from './coupons.service';
import {
  CreateCouponDto,
  UpdateCouponDto,
  ValidateCouponDto,
} from './dto/coupon.dto';

/**
 * Coupons.
 *   Customer : validate a code against their subtotal (discount preview).
 *   Admin    : CRUD.
 */
@Controller()
export class CouponsController {
  constructor(private readonly coupons: CouponsService) {}

  @Post('coupons/validate')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  validate(@Body() dto: ValidateCouponDto) {
    return this.coupons.validate(dto.code, dto.subtotalMinor);
  }

  @Get('admin/coupons')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  list() {
    return this.coupons.list();
  }

  @Post('admin/coupons')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  create(@Body() dto: CreateCouponDto) {
    return this.coupons.create(dto);
  }

  @Patch('admin/coupons/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  update(@Param('id') id: string, @Body() dto: UpdateCouponDto) {
    return this.coupons.update(id, dto);
  }

  @Delete('admin/coupons/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  remove(@Param('id') id: string) {
    return this.coupons.remove(id);
  }
}
