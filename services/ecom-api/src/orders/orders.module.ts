import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AddressesModule } from '../addresses/addresses.module';
import { AuthModule } from '../auth/auth.module';
import { CartModule } from '../cart/cart.module';
import { ProductsModule } from '../products/products.module';
import { ShippingModule } from '../shipping/shipping.module';
import { StripeModule } from '../stripe/stripe.module';
import { CheckoutController } from './checkout.controller';
import { OrderItem } from './order-item.entity';
import { Order } from './order.entity';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { WebhookController } from './webhook.controller';

/** Checkout, orders, Stripe payment webhook, and admin order management. */
@Module({
  imports: [
    TypeOrmModule.forFeature([Order, OrderItem]),
    AuthModule,
    CartModule,
    AddressesModule,
    ShippingModule,
    ProductsModule,
    StripeModule,
  ],
  controllers: [CheckoutController, OrdersController, WebhookController],
  providers: [OrdersService],
})
export class OrdersModule {}
