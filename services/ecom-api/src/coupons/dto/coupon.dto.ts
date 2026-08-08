import {
  IsBoolean,
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  Matches,
  Min,
} from 'class-validator';

export class CreateCouponDto {
  @IsString()
  @Matches(/^[A-Za-z0-9_-]{3,32}$/, { message: 'code must be 3-32 alphanumeric chars' })
  code!: string;

  @IsIn(['percent', 'fixed'])
  type!: 'percent' | 'fixed';

  @IsInt()
  @Min(1)
  value!: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  minSubtotalMinor?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  maxDiscountMinor?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  maxRedemptions?: number;

  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  @IsISO8601()
  expiresAt?: string;
}

export class UpdateCouponDto {
  @IsOptional()
  @IsIn(['percent', 'fixed'])
  type?: 'percent' | 'fixed';

  @IsOptional()
  @IsInt()
  @Min(1)
  value?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  minSubtotalMinor?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  maxDiscountMinor?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  maxRedemptions?: number;

  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  @IsISO8601()
  expiresAt?: string | null;
}

export class ValidateCouponDto {
  @IsString()
  code!: string;

  @IsInt()
  @Min(0)
  subtotalMinor!: number;
}
