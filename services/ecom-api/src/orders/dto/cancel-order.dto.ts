import { IsOptional, IsString, MaxLength } from 'class-validator';

/** Validated body for cancelling an order — an optional reason (no image). */
export class CancelOrderDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
