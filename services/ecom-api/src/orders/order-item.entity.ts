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

  // Snapshot of the product name + unit price at order time.
  @Column()
  name!: string;

  @Column({ name: 'unit_amount_minor', type: 'int' })
  unitAmountMinor!: number;

  @Column({ type: 'int' })
  quantity!: number;
}
