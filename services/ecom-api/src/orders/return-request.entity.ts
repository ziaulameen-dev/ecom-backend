import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type ReturnStatus =
  | 'requested' // customer asked to return
  | 'approved' // admin approved, awaiting the goods
  | 'rejected' // admin declined
  | 'received' // goods back
  | 'refunded'; // money returned + stock restored

/** One returned line (a subset of the order's items). */
export interface ReturnLine {
  productId: string;
  quantity: number;
}

/**
 * A return (RMA) request against a delivered/shipped order. On completion it
 * triggers a partial refund for the returned items and restores their stock.
 */
@Entity('return_requests')
export class ReturnRequest {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ name: 'order_id', type: 'uuid' })
  orderId!: string;

  @Index()
  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @Column({ type: 'varchar', default: 'requested' })
  status!: ReturnStatus;

  @Column({ type: 'text', nullable: true })
  reason!: string | null;

  @Column({ type: 'jsonb' })
  items!: ReturnLine[];

  // MinIO object keys for customer-uploaded evidence images.
  @Column({ type: 'jsonb', default: () => "'[]'" })
  images!: string[];

  // The amount refunded when the return completes (minor units).
  @Column({ name: 'refund_minor', type: 'int', default: 0 })
  refundMinor!: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
