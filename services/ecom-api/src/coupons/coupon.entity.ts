import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type CouponType = 'percent' | 'fixed';

/**
 * A discount coupon. `percent` takes `value` as a percentage (optionally capped
 * by `maxDiscountMinor`); `fixed` takes `value` as a flat amount in paise.
 */
@Entity('coupons')
export class Coupon {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  // Stored uppercase; compared case-insensitively.
  @Index({ unique: true })
  @Column()
  code!: string;

  @Column({ type: 'varchar', default: 'percent' })
  type!: CouponType;

  // percent: 1..100  |  fixed: amount in paise
  @Column({ type: 'int' })
  value!: number;

  @Column({ name: 'min_subtotal_minor', type: 'int', default: 0 })
  minSubtotalMinor!: number;

  // Optional cap on a percentage discount (paise). Null = uncapped.
  @Column({ name: 'max_discount_minor', type: 'int', nullable: true })
  maxDiscountMinor!: number | null;

  // Optional total redemption limit. Null = unlimited.
  @Column({ name: 'max_redemptions', type: 'int', nullable: true })
  maxRedemptions!: number | null;

  @Column({ name: 'times_redeemed', type: 'int', default: 0 })
  timesRedeemed!: number;

  @Column({ type: 'boolean', default: true })
  active!: boolean;

  @Column({ name: 'expires_at', type: 'timestamptz', nullable: true })
  expiresAt!: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
