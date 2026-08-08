'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import { tokens } from '@/lib/session';
import type { User } from '@/lib/types';

export const authKeys = { me: ['me'] as const };

/** Current user (null when logged out). */
export function useMe() {
  return useQuery({
    queryKey: authKeys.me,
    queryFn: async () => {
      if (!tokens.access) return null;
      try {
        return await api.get<User>('/auth/me');
      } catch {
        return null;
      }
    },
    staleTime: 60_000,
  });
}

interface AuthResult {
  accessToken: string;
  refreshToken: string;
  user: User;
}

/** Step 1: request an OTP for an email. */
export function useRequestOtp() {
  return useMutation({
    mutationFn: (email: string) => api.post('/auth/otp', { email }, false),
  });
}

/** Step 2: verify the OTP → store tokens, prime the user. */
export function useVerifyOtp() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { email: string; otp: string; name?: string }) =>
      api.post<AuthResult>('/auth/verify-otp', input, false),
    onSuccess: (res) => {
      tokens.set(res.accessToken, res.refreshToken);
      qc.setQueryData(authKeys.me, res.user);
      qc.invalidateQueries({ queryKey: ['cart'] });
    },
  });
}

export function useLogout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      await api.post('/auth/logout', { refreshToken: tokens.refresh }, false).catch(() => {});
      tokens.clear();
    },
    onSuccess: () => {
      qc.setQueryData(authKeys.me, null);
      qc.invalidateQueries({ queryKey: ['cart'] });
    },
  });
}
