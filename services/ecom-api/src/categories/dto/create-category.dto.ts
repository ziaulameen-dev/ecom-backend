import {
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

/** Validated body for POST /api/categories (admin only). */
export class CreateCategoryDto {
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name!: string;

  // URL-safe slug (lowercase letters, numbers, hyphens).
  @IsString()
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: 'slug must be kebab-case (a-z, 0-9, hyphens)',
  })
  slug!: string;

  // Omit / null for a top-level category; set for a subcategory.
  @IsOptional()
  @IsUUID()
  parentId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  imageUrl?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}
