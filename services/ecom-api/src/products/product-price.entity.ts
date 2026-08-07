import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { Product } from './product.entity';

/**
 * A product's price in ONE country. Admins set these per market, so a product
 * is buyable in a country only if it has a price row there. `amountMinor` is
 * the smallest currency unit (e.g. cents) to avoid float rounding.
 */
@Entity('product_prices')
@Unique(['productId', 'country'])
export class ProductPrice {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ name: 'product_id', type: 'uuid' })
  productId!: string;

  @ManyToOne(() => Product, (p) => p.prices, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'product_id' })
  product!: Product;

  // ISO 3166-1 alpha-2, uppercase (e.g. "US", "IN", "GB").
  @Column({ type: 'varchar', length: 2 })
  country!: string;

  // ISO 4217, lowercase for Stripe (e.g. "usd", "eur", "inr").
  @Column({ type: 'varchar', length: 3 })
  currency!: string;

  @Column({ name: 'amount_minor', type: 'int' })
  amountMinor!: number;
}
