import { IsUUID } from 'class-validator';

/** Validated body for POST /api/checkout. */
export class CheckoutDto {
  @IsUUID()
  addressId!: string;
}
