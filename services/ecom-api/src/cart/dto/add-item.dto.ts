import { IsInt, IsOptional, IsUUID, Min } from 'class-validator';

/** Validated body for POST /api/cart/items. */
export class AddItemDto {
  @IsUUID()
  productId!: string;

  // Required when the product has variants; omit for a simple product.
  @IsOptional()
  @IsUUID()
  variantId?: string;

  @IsInt()
  @Min(1)
  quantity!: number;
}
