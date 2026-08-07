'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { cartId, get, patch, post, tokens } from './api';

export interface User {
  id: string;
  email: string;
  name: string | null;
  roles: string[];
}
export interface CartLine {
  productId: string;
  name: string;
  quantity: number;
  unitAmountMinor: number | null;
  lineTotalMinor: number;
  available: boolean;
  stock: number;
}
export interface Cart {
  id: string;
  country: string;
  currency: string | null;
  items: CartLine[];
  itemCount: number;
  subtotalMinor: number;
}

interface StoreValue {
  user: User | null;
  cart: Cart | null;
  country: string;
  isAdmin: boolean;
  ready: boolean;
  setCountry: (c: string) => Promise<void>;
  refreshCart: () => Promise<void>;
  refreshUser: () => Promise<void>;
  logout: () => Promise<void>;
}

const StoreContext = createContext<StoreValue | null>(null);
export const useStore = () => {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore outside provider');
  return ctx;
};

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [cart, setCart] = useState<Cart | null>(null);
  const [country, setCountryState] = useState('US');
  const [ready, setReady] = useState(false);

  const applyCart = (c: Cart) => {
    setCart(c);
    if (c?.id) cartId.set(c.id);
  };

  const refreshCart = useCallback(async () => {
    const c = await get(`/api/cart?country=${localStorage.getItem('ecom_country') || 'US'}`);
    applyCart(c);
    setCountryState(c.country);
  }, []);

  const refreshUser = useCallback(async () => {
    if (!tokens.access) {
      setUser(null);
      return;
    }
    try {
      setUser(await get('/auth/me'));
    } catch {
      setUser(null);
    }
  }, []);

  const setCountry = useCallback(async (c: string) => {
    localStorage.setItem('ecom_country', c);
    const updated = await patch('/api/cart', { country: c }).catch(() => null);
    if (updated) applyCart(updated);
    setCountryState(c);
  }, []);

  const logout = useCallback(async () => {
    await post('/auth/logout', { refreshToken: tokens.refresh }, false).catch(() => {});
    tokens.clear();
    setUser(null);
    await refreshCart();
  }, [refreshCart]);

  useEffect(() => {
    (async () => {
      await Promise.all([refreshUser(), refreshCart()]);
      setReady(true);
    })();
  }, [refreshUser, refreshCart]);

  return (
    <StoreContext.Provider
      value={{
        user,
        cart,
        country,
        isAdmin: !!user?.roles?.includes('admin'),
        ready,
        setCountry,
        refreshCart,
        refreshUser,
        logout,
      }}
    >
      {children}
    </StoreContext.Provider>
  );
}
