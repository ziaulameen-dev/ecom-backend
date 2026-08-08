import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthUser, JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CheckoutDto } from './dto/checkout.dto';
import { OrdersService } from './orders.service';

/**
 * POST /api/checkout — turn the user's cart into a pending order and return a
 * Stripe PaymentIntent client secret for the frontend to confirm. Login required.
 */
@Controller('checkout')
export class CheckoutController {
  constructor(
    private readonly orders: OrdersService,
    private readonly config: ConfigService,
  ) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 10, ttl: 600_000 } }) // 10 / 10 min per IP
  async checkout(@CurrentUser() user: AuthUser, @Body() dto: CheckoutDto) {
    const result = await this.orders.checkout(user.sub, user.email, dto.addressId);
    return {
      ...result,
      publishableKey: this.config.get<string>('stripe.publishableKey'),
    };
  }
}
