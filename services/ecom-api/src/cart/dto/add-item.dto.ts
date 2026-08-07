import { IsInt, IsOptional, IsString, IsUUID, Length, Min } from 'class-validator';

/** Validated body for POST /api/cart/items. */
export class AddItemDto {
  @IsUUID()
  productId!: string;

  @IsInt()
  @Min(1)
  quantity!: number;

  // Optionally set/switch the cart's country in the same call.
  @IsOptional()
  @IsString()
  @Length(2, 2)
  country?: string;
}
