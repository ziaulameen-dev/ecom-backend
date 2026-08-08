import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { OrderItem } from './order-item.entity';

export type OrderStatus =
  | 'pending' // created, awaiting payment
  | 'processing' // async payment method settling
  | 'paid' // payment confirmed (webhook)
  | 'failed' // payment failed
  | 'cancelled'
  | 'refunded'
  | 'disputed' // chargeback opened
  | 'fulfilled'
  | 'shipped'
  | 'delivered';

/** A snapshot of the shipping address at order time (immutable). */
export interface ShippingAddressSnapshot {
  fullName: string;
  phone: string | null;
  line1: string;
  line2: string | null;
  city: string;
  state: string | null;
  postalCode: string | null;
  country: string;
}

/**
 * A customer order. Money is all in the smallest currency unit. Line prices and
 * the shipping address are SNAPSHOTTED so history is immutable even if products
 * or the address later change.
 */
@Entity('orders')
export class Order {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  // Snapshot of the buyer's email (from their token at checkout) so the service
  // can email order updates without reaching into the auth DB.
  @Column({ name: 'customer_email', type: 'varchar', nullable: true })
  customerEmail!: string | null;

  @Column({ type: 'varchar', default: 'pending' })
  status!: OrderStatus;

  @Column({ type: 'varchar', length: 3 })
  currency!: string;

  @Column({ name: 'subtotal_minor', type: 'int' })
  subtotalMinor!: number;

  @Column({ name: 'shipping_minor', type: 'int', default: 0 })
  shippingMinor!: number;

  @Column({ name: 'tax_minor', type: 'int', default: 0 })
  taxMinor!: number;

  @Column({ name: 'total_minor', type: 'int' })
  totalMinor!: number;

  // Total refunded so far (minor units) — supports partial refunds/returns.
  @Column({ name: 'refunded_minor', type: 'int', default: 0 })
  refundedMinor!: number;

  @Column({ name: 'shipping_address', type: 'jsonb' })
  shippingAddress!: ShippingAddressSnapshot;

  // The Cashfree order id (we use our own order id as the Cashfree order_id).
  @Index()
  @Column({ name: 'payment_ref', type: 'varchar', nullable: true })
  paymentRef!: string | null;

  // Shipment tracking (set by admin when shipping).
  @Column({ type: 'varchar', nullable: true })
  carrier!: string | null;

  @Column({ name: 'tracking_number', type: 'varchar', nullable: true })
  trackingNumber!: string | null;

  @OneToMany(() => OrderItem, (i) => i.order, { cascade: true })
  items!: OrderItem[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
