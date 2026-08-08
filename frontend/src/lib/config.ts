/** Runtime config. The gateway base URL is overridable per environment. */
export const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3008';

export const STORE_NAME = process.env.NEXT_PUBLIC_STORE_NAME ?? 'SBAZWIDE';
