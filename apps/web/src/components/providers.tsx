'use client';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import type { Person } from '@ats/types';
import { api, refreshSession, setToken } from '@/lib/api';
interface AuthContextValue {
  user: Person | null;
  loading: boolean;
  login: (identifier: string, password: string, remember: boolean) => Promise<void>;
  logout: () => Promise<void>;
}
const AuthContext = createContext<AuthContextValue | null>(null);
export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('Auth provider missing');
  return value;
}
function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Person | null>(null);
  const [loading, setLoading] = useState(true);
  const queryClient = useQueryClient();
  useEffect(() => {
    let active = true;
    refreshSession()
      .then((result) => {
        if (active) setUser(result.user);
      })
      .catch(() => undefined)
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);
  async function login(identifier: string, password: string, remember: boolean) {
    const result = await api<{ accessToken: string; user: Person }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ identifier, password, remember }),
    });
    setToken(result.accessToken);
    queryClient.clear();
    setUser(result.user);
  }
  async function logout() {
    await api('/auth/logout', { method: 'POST' });
    setToken(null);
    queryClient.clear();
    setUser(null);
  }
  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>{children}</AuthContext.Provider>
  );
}
export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { retry: 1, staleTime: 30000, refetchOnWindowFocus: true } },
      }),
  );
  return (
    <QueryClientProvider client={client}>
      <AuthProvider>{children}</AuthProvider>
      <Toaster position="top-right" richColors />
    </QueryClientProvider>
  );
}
