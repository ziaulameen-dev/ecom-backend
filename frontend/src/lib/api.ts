/**
 * Tiny API client for the gateway. Uses BEARER auth (tokens in localStorage) so
 * the demo works cross-origin without cookie/CSRF juggling. The guest cart id
 * is sent via the X-Cart-Id header. Auto-refreshes the access token on 401.
 */
const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3008';

const ACCESS = 'ecom_access';
const REFRESH = 'ecom_refresh';
const CART = 'ecom_cart_id';

export const tokens = {
  get access() {
    return localStorage.getItem(ACCESS);
  },
  get refresh() {
    return localStorage.getItem(REFRESH);
  },
  set(access: string, refresh?: string) {
    if (access) localStorage.setItem(ACCESS, access);
    if (refresh) localStorage.setItem(REFRESH, refresh);
  },
  clear() {
    localStorage.removeItem(ACCESS);
    localStorage.removeItem(REFRESH);
  },
};

export const cartId = {
  get: () => localStorage.getItem(CART),
  set: (id: string) => id && localStorage.setItem(CART, id),
  clear: () => localStorage.removeItem(CART),
};

class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function raw(path: string, opts: RequestInit & { auth?: boolean } = {}) {
  const headers = new Headers(opts.headers);
  if (opts.body && !headers.has('Content-Type'))
    headers.set('Content-Type', 'application/json');
  if (opts.auth !== false && tokens.access)
    headers.set('Authorization', `Bearer ${tokens.access}`);
  const cid = cartId.get();
  if (cid) headers.set('X-Cart-Id', cid);
  return fetch(`${BASE}${path}`, { ...opts, headers });
}

async function parse(res: Response) {
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = json?.error?.message || json?.message || res.statusText;
    throw new ApiError(res.status, Array.isArray(msg) ? msg.join(', ') : msg);
  }
  return json.data ?? json;
}

async function tryRefresh(): Promise<boolean> {
  if (!tokens.refresh) return false;
  const res = await raw('/auth/refresh', {
    method: 'POST',
    auth: false,
    body: JSON.stringify({ refreshToken: tokens.refresh }),
  });
  if (!res.ok) return false;
  const data = (await res.json()).data;
  tokens.set(data.accessToken, data.refreshToken);
  return true;
}

/** Request helper that retries once after refreshing on 401. */
export async function api(path: string, opts: RequestInit & { auth?: boolean } = {}) {
  let res = await raw(path, opts);
  if (res.status === 401 && opts.auth !== false && (await tryRefresh())) {
    res = await raw(path, opts);
  }
  return parse(res);
}

export const get = (p: string) => api(p);
export const post = (p: string, body?: unknown, auth = true) =>
  api(p, { method: 'POST', body: body ? JSON.stringify(body) : undefined, auth });
export const patch = (p: string, body?: unknown) =>
  api(p, { method: 'PATCH', body: body ? JSON.stringify(body) : undefined });
export const put = (p: string, body?: unknown) =>
  api(p, { method: 'PUT', body: body ? JSON.stringify(body) : undefined });
export const del = (p: string) => api(p, { method: 'DELETE' });

/** POST multipart form data (e.g. file uploads). Retries once on 401. */
export const postForm = (p: string, form: FormData) =>
  api(p, { method: 'POST', body: form });

/**
 * Fetch a protected binary (image) with the bearer token and return an object
 * URL — `<img>` can't send an Authorization header, so we fetch then blob it.
 */
export async function fetchImageUrl(path: string): Promise<string> {
  const res = await raw(path);
  if (!res.ok) throw new ApiError(res.status, 'image failed');
  return URL.createObjectURL(await res.blob());
}

/** Build an SSE URL with the access token in the query (EventSource can't set headers). */
export const sseUrl = (path: string) =>
  `${BASE}${path}?access_token=${encodeURIComponent(tokens.access ?? '')}`;
