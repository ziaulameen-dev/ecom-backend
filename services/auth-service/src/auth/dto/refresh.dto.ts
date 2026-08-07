import { IsOptional, IsString } from 'class-validator';

/**
 * Validated body for POST /auth/refresh. Bearer clients pass the refresh token
 * here; browser (cookie) clients omit it and the token is read from the
 * HttpOnly refresh cookie instead.
 */
export class RefreshDto {
  @IsOptional()
  @IsString()
  refreshToken?: string;
}
