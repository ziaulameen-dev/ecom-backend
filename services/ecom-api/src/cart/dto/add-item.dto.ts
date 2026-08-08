import { IsInt, IsUUID, Min } from 'class-validator';

/** Validated body for POST /api/cart/items. */
export class AddItemDto {
  @IsUUID()
  productId!: string;

  @IsInt()
  @Min(1)
  quantity!: number;
}
