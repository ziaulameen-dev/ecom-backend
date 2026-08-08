import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { SetShippingRateDto } from './dto/set-shipping-rate.dto';
import { ShippingService } from './shipping.service';

/**
 * The single flat delivery charge (India-only, INR).
 *   Public : GET the current charge (storefront display).
 *   Admin  : PUT to set it.
 */
@Controller('shipping-rate')
export class ShippingController {
  constructor(private readonly shipping: ShippingService) {}

  @Get()
  async get() {
    const rate = await this.shipping.get();
    return { amountMinor: rate?.amountMinor ?? 0 };
  }

  @Put()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  upsert(@Body() dto: SetShippingRateDto) {
    return this.shipping.upsert(dto);
  }
}
