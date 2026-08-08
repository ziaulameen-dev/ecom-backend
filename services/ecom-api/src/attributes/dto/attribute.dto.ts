import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateAttributeTypeDto {
  @IsString()
  @MinLength(2)
  @MaxLength(40)
  name!: string;

  @IsString()
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, { message: 'slug must be kebab-case' })
  slug!: string;

  @IsOptional()
  @IsIn(['text', 'swatch'])
  display?: 'text' | 'swatch';

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

export class UpdateAttributeTypeDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(40)
  name?: string;

  @IsOptional()
  @IsIn(['text', 'swatch'])
  display?: 'text' | 'swatch';

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

export class CreateAttributeValueDto {
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  value!: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  swatch?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}
