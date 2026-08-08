import { IsInt, Min } from 'class-validator';

/**
 * Validated body for PUT /api/shipping-rate (admin only) — sets the single flat
 * delivery charge. `amountMinor` is in paise (INR).
 */
export class SetShippingRateDto {
  @IsInt()
  @Min(0)
  amountMinor!: number;
}
