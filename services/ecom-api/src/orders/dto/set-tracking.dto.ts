import { IsString, MaxLength, MinLength } from 'class-validator';

/** Validated body for PATCH /api/admin/orders/:id/tracking. */
export class SetTrackingDto {
  @IsString()
  @MinLength(2)
  @MaxLength(60)
  carrier!: string;

  @IsString()
  @MinLength(3)
  @MaxLength(80)
  trackingNumber!: string;
}
