import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Order } from './order.entity';

/** A line in an order — product + snapshotted name/price/quantity. */
@Entity('order_items')
export class OrderItem {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ name: 'order_id', type: 'uuid' })
  orderId!: string;

  @ManyToOne(() => Order, (o) => o.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'order_id' })
  order!: Order;

  @Column({ name: 'product_id', type: 'uuid' })
  productId!: string;

  // The purchased variant (null for a simple product). Drives stock moves.
  @Column({ name: 'variant_id', type: 'uuid', nullable: true })
  variantId!: string | null;

  // Snapshot of the product name + unit price at order time.
  @Column()
  name!: string;

  // Snapshot of the variant options label, e.g. "Black / Steel".
  @Column({ name: 'variant_label', type: 'varchar', nullable: true })
  variantLabel!: string | null;

  @Column({ name: 'unit_amount_minor', type: 'int' })
  unitAmountMinor!: number;

  @Column({ type: 'int' })
  quantity!: number;

  // How many units of this line have been returned (prevents over-returning).
  @Column({ name: 'returned_quantity', type: 'int', default: 0 })
  returnedQuantity!: number;
}
