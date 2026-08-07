import { SetMetadata } from '@nestjs/common';

/** Metadata key the TransformInterceptor looks for. */
export const RAW_RESPONSE = 'raw_response';

/**
 * Mark a route handler so its return value is sent AS-IS, skipping the global
 * success-envelope wrapping. Used by the JWKS endpoint, which must return the
 * standardized `{ keys: [...] }` shape verbatim.
 */
export const Raw = () => SetMetadata(RAW_RESPONSE, true);
