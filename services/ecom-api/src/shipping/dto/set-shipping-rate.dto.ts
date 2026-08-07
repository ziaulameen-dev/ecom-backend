import { IsInt, IsString, Length, Min } from 'class-validator';

/**
 * Validated body for PUT /api/shipping-rates (admin only) — upserts the flat
 * delivery charge for one country. `amountMinor` is the smallest currency unit.
 */
export class SetShippingRateDto {
  @IsString()
  @Length(2, 2)
  country!: string; // ISO 3166-1 alpha-2

  @IsString()
  @Length(3, 3)
  currency!: string; // ISO 4217

  @IsInt()
  @Min(0)
  amountMinor!: number;
}
