import { IsInt, IsOptional, Min } from 'class-validator';

/** Validated body for POST /api/admin/orders/:id/refund. Omit amount = full. */
export class RefundDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  amountMinor?: number;
}
