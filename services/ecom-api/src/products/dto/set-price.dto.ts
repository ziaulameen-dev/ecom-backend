import { IsInt, IsString, Length, Min } from 'class-validator';

/**
 * Validated body for PUT /api/products/:id/prices (admin only) — upserts the
 * price for one country. `amountMinor` is in the smallest currency unit.
 */
export class SetPriceDto {
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
