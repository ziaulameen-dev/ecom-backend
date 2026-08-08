import {
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

/** Validated body for POST /api/reviews (admin only, for now). */
export class CreateReviewDto {
  @IsUUID()
  productId!: string;

  @IsInt()
  @Min(1)
  @Max(5)
  rating!: number;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  title?: string;

  @IsString()
  @MinLength(2)
  @MaxLength(2000)
  body!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(80)
  authorName!: string;
}
