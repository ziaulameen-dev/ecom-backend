import { IsInt, IsOptional, IsString, Min, MinLength } from 'class-validator';

/** Validated body for PATCH /api/products/:id (admin only). */
export class UpdateProductDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  stock?: number;
}
