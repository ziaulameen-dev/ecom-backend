import { DataSource } from 'typeorm';
import { Address } from './addresses/address.entity';
import { CartItem } from './cart/cart-item.entity';
import { Cart } from './cart/cart.entity';
import { OrderItem } from './orders/order-item.entity';
import { Order } from './orders/order.entity';
import { ReturnRequest } from './orders/return-request.entity';
import { Product } from './products/product.entity';
import { ProductVariant } from './products/product-variant.entity';
import { Category } from './categories/category.entity';
import { AttributeType } from './attributes/attribute-type.entity';
import { AttributeValue } from './attributes/attribute-value.entity';
import { Review } from './reviews/review.entity';
import { Coupon } from './coupons/coupon.entity';
import { ShippingRate } from './shipping/shipping-rate.entity';

/**
 * Standalone TypeORM DataSource for the migration CLI. Dev uses `synchronize`
 * (see app.module.ts); in PRODUCTION set NODE_ENV=production (synchronize off)
 * and run `npm run migration:run` on deploy.
 */
export default new DataSource({
  type: 'postgres',
  host: process.env.ECOM_DB_HOST ?? 'localhost',
  port: parseInt(process.env.ECOM_DB_PORT ?? '5432', 10),
  username: process.env.ECOM_DB_USER ?? 'ecom',
  password: process.env.ECOM_DB_PASSWORD ?? 'ecom',
  database: process.env.ECOM_DB_NAME ?? 'ecomdb',
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
  migrations: ['src/migrations/*.ts'],
  synchronize: false,
});
