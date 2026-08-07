import { IsString, Length } from 'class-validator';

/** Validated body for PATCH /api/cart (change the cart's country). */
export class SetCountryDto {
  @IsString()
  @Length(2, 2)
  country!: string;
}
