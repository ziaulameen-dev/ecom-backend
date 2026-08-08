'use client';

/** Client-side token + guest-cart storage (localStorage, SSR-safe). */
const ACCESS = 'sbaz_access';
const REFRESH = 'sbaz_refresh';
const CART = 'sbaz_cart_id';

const canUse = () => typeof window !== 'undefined';

export const tokens = {
  get access() {
    return canUse() ? localStorage.getItem(ACCESS) : null;
  },
  get refresh() {
    return canUse() ? localStorage.getItem(REFRESH) : null;
  },
  set(access?: string, refresh?: string) {
    if (!canUse()) return;
    if (access) localStorage.setItem(ACCESS, access);
    if (refresh) localStorage.setItem(REFRESH, refresh);
  },
  clear() {
    if (!canUse()) return;
    localStorage.removeItem(ACCESS);
    localStorage.removeItem(REFRESH);
  },
};

export const cartId = {
  get: () => (canUse() ? localStorage.getItem(CART) : null),
  set: (id: string) => {
    if (canUse() && id) localStorage.setItem(CART, id);
  },
  clear: () => canUse() && localStorage.removeItem(CART),
};
