import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

/** Validated body for POST /api/checkout. */
export class CheckoutDto {
  @IsUUID()
  addressId!: string;

  // Optional discount coupon code.
  @IsOptional()
  @IsString()
  @MaxLength(32)
  couponCode?: string;
}
