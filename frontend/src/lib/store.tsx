'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { cartId, del, get, patch, post, tokens } from './api';

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
  unitAmountMinor: number;
  lineTotalMinor: number;
  available: boolean;
  stock: number;
}
export interface Cart {
  id: string;
  currency: string;
  items: CartLine[];
  itemCount: number;
  subtotalMinor: number;
}

interface StoreValue {
  user: User | null;
  cart: Cart | null;
  isAdmin: boolean;
  ready: boolean;
  refreshCart: () => Promise<void>;
  refreshUser: () => Promise<void>;
  logout: () => Promise<void>;
  addItem: (productId: string, quantity?: number) => Promise<void>;
  setItemQty: (productId: string, quantity: number) => Promise<void>;
  removeItem: (productId: string) => Promise<void>;
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
  const [ready, setReady] = useState(false);

  const applyCart = (c: Cart) => {
    setCart(c);
    if (c?.id) cartId.set(c.id);
  };

  const refreshCart = useCallback(async () => {
    applyCart(await get('/api/cart'));
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

  // Cart mutations return the updated cart view — apply it (also stores the id).
  const addItem = useCallback(async (productId: string, quantity = 1) => {
    applyCart(await post('/api/cart/items', { productId, quantity }));
  }, []);

  const setItemQty = useCallback(async (productId: string, quantity: number) => {
    applyCart(await patch(`/api/cart/items/${productId}`, { quantity }));
  }, []);

  const removeItem = useCallback(async (productId: string) => {
    applyCart(await del(`/api/cart/items/${productId}`));
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
        isAdmin: !!user?.roles?.includes('admin'),
        ready,
        refreshCart,
        refreshUser,
        logout,
        addItem,
        setItemQty,
        removeItem,
      }}
    >
      {children}
    </StoreContext.Provider>
  );
}
