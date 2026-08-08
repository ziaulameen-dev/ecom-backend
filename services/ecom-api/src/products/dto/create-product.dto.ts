import {
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

/** Validated body for POST /api/products (admin only). */
export class CreateProductDto {
  @IsString()
  @MinLength(2)
  name!: string;

  // INR price in paise (e.g. 49900 = ₹499.00).
  @IsInt()
  @Min(0)
  priceMinor!: number;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  imageUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  category?: string;

  @IsInt()
  @Min(0)
  stock!: number;
}
