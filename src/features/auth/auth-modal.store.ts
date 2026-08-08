'use client';

import { create } from 'zustand';

/** Controls the global login modal. `next` is where to go after a successful sign-in. */
interface AuthModalState {
  open: boolean;
  next?: string;
  openLogin: (next?: string) => void;
  close: () => void;
}

export const useAuthModal = create<AuthModalState>((set) => ({
  open: false,
  next: undefined,
  openLogin: (next) => set({ open: true, next }),
  close: () => set({ open: false, next: undefined }),
}));
