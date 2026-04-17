'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { api } from '@/lib/api';

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (email: string, password: string, remember?: boolean) => Promise<void>;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem('auth_token');
    if (!stored) {
      setIsLoading(false);
      return;
    }
    setToken(stored);

    // 10s timeout — if the backend is cold/unreachable, fall back to login
    // instead of leaving the user stuck on the loading screen forever.
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 10_000);

    api.get<User>('/auth/me', { signal: ctrl.signal })
      .then(setUser)
      .catch(() => { localStorage.removeItem('auth_token'); setToken(null); })
      .finally(() => { clearTimeout(timer); setIsLoading(false); });

    return () => { clearTimeout(timer); ctrl.abort(); };
  }, []);

  const login = async (email: string, password: string, remember = false) => {
    const res = await api.post<{ token: string; user: User }>('/auth/login', {
      email,
      password,
      remember,
    });
    localStorage.setItem('auth_token', res.token);
    setToken(res.token);
    setUser(res.user);
  };

  const logout = () => {
    localStorage.removeItem('auth_token');
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
