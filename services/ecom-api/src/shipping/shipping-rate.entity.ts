import {
  Column,
  Entity,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';

/**
 * The flat delivery charge for one destination country, set by admins.
 * `amountMinor` is the smallest currency unit. One row per country.
 */
@Entity('shipping_rates')
@Unique(['country'])
export class ShippingRate {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  // ISO 3166-1 alpha-2, uppercase.
  @Column({ type: 'varchar', length: 2 })
  country!: string;

  // ISO 4217, lowercase (should match the product prices for that country).
  @Column({ type: 'varchar', length: 3 })
  currency!: string;

  @Column({ name: 'amount_minor', type: 'int' })
  amountMinor!: number;
}
