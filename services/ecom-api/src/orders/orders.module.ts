import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AddressesModule } from '../addresses/addresses.module';
import { AuthModule } from '../auth/auth.module';
import { CartModule } from '../cart/cart.module';
import { MailModule } from '../mail/mail.module';
import { ProductsModule } from '../products/products.module';
import { ShippingModule } from '../shipping/shipping.module';
import { CashfreeModule } from '../cashfree/cashfree.module';
import { CouponsModule } from '../coupons/coupons.module';
import { EventsModule } from '../events/events.module';
import { StorageModule } from '../storage/storage.module';
import { CheckoutController } from './checkout.controller';
import { OrderItem } from './order-item.entity';
import { Order } from './order.entity';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { ReturnRequest } from './return-request.entity';
import { ReturnsService } from './returns.service';
import { WebhookController } from './webhook.controller';
import { WebhookEventsService } from './webhook-events.service';

/** Checkout, orders, Cashfree payment webhook, and admin order management. */
@Module({
  imports: [
    TypeOrmModule.forFeature([Order, OrderItem, ReturnRequest]),
    AuthModule,
    CartModule,
    AddressesModule,
    ShippingModule,
    ProductsModule,
    CashfreeModule,
    CouponsModule,
    EventsModule,
    StorageModule,
    MailModule,
  ],
  controllers: [CheckoutController, OrdersController, WebhookController],
  providers: [OrdersService, ReturnsService, WebhookEventsService],
  exports: [OrdersService],
})
export class OrdersModule {}
