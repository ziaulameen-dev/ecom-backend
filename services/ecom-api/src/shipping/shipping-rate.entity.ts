import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

/**
 * The single flat delivery charge for the store (India-only), set by admins.
 * `amountMinor` is in paise (INR). There is at most one row.
 */
@Entity('shipping_rates')
export class ShippingRate {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'amount_minor', type: 'int', default: 0 })
  amountMinor!: number;
}
