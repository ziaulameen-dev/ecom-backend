import { IsOptional, IsString, MaxLength } from 'class-validator';

/** Validated body for PATCH /auth/profile. All fields optional. */
export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  mobile?: string;
}
