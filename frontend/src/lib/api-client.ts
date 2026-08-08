'use client';

import { API_BASE } from './config';
import { cartId, tokens } from './session';

/** Thrown on non-2xx responses; carries the HTTP status + server message. */
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

type Options = RequestInit & { auth?: boolean };

function buildHeaders(opts: Options): Headers {
  const headers = new Headers(opts.headers);
  const isForm = opts.body instanceof FormData;
  if (opts.body && !isForm && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  if (opts.auth !== false && tokens.access) {
    headers.set('Authorization', `Bearer ${tokens.access}`);
  }
  const cid = cartId.get();
  if (cid) headers.set('X-Cart-Id', cid);
  return headers;
}

async function raw(path: string, opts: Options = {}): Promise<Response> {
  return fetch(`${API_BASE}${path}`, { ...opts, headers: buildHeaders(opts) });
}

async function unwrap<T>(res: Response): Promise<T> {
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = json?.error?.message ?? json?.message ?? res.statusText;
    throw new ApiError(res.status, Array.isArray(msg) ? msg.join(', ') : msg);
  }
  return (json.data ?? json) as T;
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

/** Core request: unwraps the {success,data} envelope, refreshes once on 401. */
export async function apiFetch<T>(path: string, opts: Options = {}): Promise<T> {
  let res = await raw(path, opts);
  if (res.status === 401 && opts.auth !== false && (await tryRefresh())) {
    res = await raw(path, opts);
  }
  return unwrap<T>(res);
}

export const api = {
  get: <T>(p: string) => apiFetch<T>(p),
  post: <T>(p: string, body?: unknown, auth = true) =>
    apiFetch<T>(p, { method: 'POST', body: body ? JSON.stringify(body) : undefined, auth }),
  patch: <T>(p: string, body?: unknown) =>
    apiFetch<T>(p, { method: 'PATCH', body: body ? JSON.stringify(body) : undefined }),
  put: <T>(p: string, body?: unknown) =>
    apiFetch<T>(p, { method: 'PUT', body: body ? JSON.stringify(body) : undefined }),
  del: <T>(p: string) => apiFetch<T>(p, { method: 'DELETE' }),
  postForm: <T>(p: string, form: FormData) =>
    apiFetch<T>(p, { method: 'POST', body: form }),
};

/** Fetch a protected image with the bearer token → object URL (img can't send headers). */
export async function fetchImageUrl(path: string): Promise<string> {
  const res = await raw(path);
  if (!res.ok) throw new ApiError(res.status, 'image failed');
  return URL.createObjectURL(await res.blob());
}

/** SSE URL with the token in the query (EventSource can't set headers). */
export const sseUrl = (path: string) =>
  `${API_BASE}${path}?access_token=${encodeURIComponent(tokens.access ?? '')}`;
