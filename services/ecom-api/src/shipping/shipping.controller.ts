import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { SetShippingRateDto } from './dto/set-shipping-rate.dto';
import { ShippingService } from './shipping.service';

/**
 * Shipping rates.
 *   Public : GET the delivery charge for a `?country=` (storefront display).
 *   Admin  : list all / upsert / delete per-country rates.
 */
@Controller('shipping-rates')
export class ShippingController {
  constructor(private readonly shipping: ShippingService) {}

  @Get()
  async forCountry(@Query('country') country?: string) {
    if (!country) {
      // No country -> admin listing (guarded separately below via /all).
      return this.shipping.list();
    }
    const rate = await this.shipping.getForCountry(country);
    if (!rate) throw new NotFoundException('No shipping rate for that country');
    return rate;
  }

  @Put()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  upsert(@Body() dto: SetShippingRateDto) {
    return this.shipping.upsert(dto);
  }

  @Delete(':country')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  remove(@Param('country') country: string) {
    return this.shipping.remove(country);
  }
}
