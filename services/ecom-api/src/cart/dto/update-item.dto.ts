import { IsInt, Min } from 'class-validator';

/** Validated body for PATCH /api/cart/items/:productId (0 removes the line). */
export class UpdateItemDto {
  @IsInt()
  @Min(0)
  quantity!: number;
}
