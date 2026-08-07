import { IsInt, IsString, Min, MinLength } from 'class-validator';

/** Validated body for POST /api/products (admin only). Price is set separately. */
export class CreateProductDto {
  @IsString()
  @MinLength(2)
  name!: string;

  @IsInt()
  @Min(0)
  stock!: number;
}
