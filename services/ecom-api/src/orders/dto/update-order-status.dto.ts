import { IsIn } from 'class-validator';
import { OrderStatus } from '../order.entity';

const STATUSES: OrderStatus[] = [
  'pending',
  'paid',
  'failed',
  'cancelled',
  'refunded',
  'fulfilled',
  'shipped',
  'delivered',
];

/** Validated body for PATCH /api/admin/orders/:id/status. */
export class UpdateOrderStatusDto {
  @IsIn(STATUSES)
  status!: OrderStatus;
}
