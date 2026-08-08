import {
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';

/** Create a variant under a product. `valueIds` are AttributeValue ids. */
export class CreateVariantDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsUUID('all', { each: true })
  valueIds!: string[];

  @IsInt()
  @Min(0)
  priceMinor!: number;

  @IsInt()
  @Min(0)
  stock!: number;

  @IsOptional()
  @IsString()
  sku?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  images?: string[];

  @IsOptional()
  @IsBoolean()
  listedSeparately?: boolean;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

/** Update a variant — all optional. */
export class UpdateVariantDto {
  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @IsUUID('all', { each: true })
  valueIds?: string[];

  @IsOptional()
  @IsInt()
  @Min(0)
  priceMinor?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  stock?: number;

  @IsOptional()
  @IsString()
  sku?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  images?: string[];

  @IsOptional()
  @IsBoolean()
  listedSeparately?: boolean;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}
