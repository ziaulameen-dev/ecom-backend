import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { ThrottlerStorageRedisService } from '@nest-lab/throttler-storage-redis';
import { TypeOrmModule } from '@nestjs/typeorm';
import Redis from 'ioredis';
import { CsrfGuard } from './common/guards/csrf.guard';
import { Address } from './addresses/address.entity';
import { AddressesModule } from './addresses/addresses.module';
import { AttributeType } from './attributes/attribute-type.entity';
import { AttributeValue } from './attributes/attribute-value.entity';
import { AttributesModule } from './attributes/attributes.module';
import { Category } from './categories/category.entity';
import { CategoriesModule } from './categories/categories.module';
import { Coupon } from './coupons/coupon.entity';
import { CouponsModule } from './coupons/coupons.module';
import { Review } from './reviews/review.entity';
import { ReviewsModule } from './reviews/reviews.module';
import { CartItem } from './cart/cart-item.entity';
import { Cart } from './cart/cart.entity';
import { CartModule } from './cart/cart.module';
import configuration from './config/configuration';
import { HealthModule } from './health/health.module';
import { JobsModule } from './jobs/jobs.module';
import { OrderItem } from './orders/order-item.entity';
import { Order } from './orders/order.entity';
import { OrdersModule } from './orders/orders.module';
import { ReturnRequest } from './orders/return-request.entity';
import { Product } from './products/product.entity';
import { ProductVariant } from './products/product-variant.entity';
import { ProductsModule } from './products/products.module';
import { ProfileModule } from './profile/profile.module';
import { ShippingRate } from './shipping/shipping-rate.entity';
import { ShippingModule } from './shipping/shipping.module';

/**
 * Root module for the ecom-api.
 *
 * `TypeOrmModule.forRootAsync` connects to THIS service's own Postgres
 * (separate from the auth service's DB). `synchronize: true` auto-creates
 * tables from entities in dev; use migrations in production.
 */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      envFilePath: '.env',
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get<string>('db.host'),
        port: config.get<number>('db.port'),
        username: config.get<string>('db.username'),
        password: config.get<string>('db.password'),
        database: config.get<string>('db.database'),
        entities: [
          Product,
          ProductVariant,
          Category,
          AttributeType,
          AttributeValue,
          Review,
          Coupon,
          ShippingRate,
          Cart,
          CartItem,
          Address,
          Order,
          OrderItem,
          ReturnRequest,
        ],
        synchronize: config.get<string>('nodeEnv') !== 'production',
        retryAttempts: 10,
        retryDelay: 3000,
      }),
    }),
    // Redis-backed rate limiting (shared across replicas). Default 120/min/IP;
    // checkout is tightened per-route via @Throttle.
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        throttlers: [{ name: 'default', ttl: 60_000, limit: 120 }],
        storage: new ThrottlerStorageRedisService(
          new Redis({
            host: config.get<string>('redis.host'),
            port: config.get<number>('redis.port'),
            maxRetriesPerRequest: 2,
          }),
        ),
      }),
    }),
    ScheduleModule.forRoot(),
    HealthModule,
    CategoriesModule,
    AttributesModule,
    ReviewsModule,
    CouponsModule,
    ProductsModule,
    ProfileModule,
    ShippingModule,
    CartModule,
    AddressesModule,
    OrdersModule,
    JobsModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: CsrfGuard },
  ],
})
export class AppModule {}
