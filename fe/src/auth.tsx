import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { api } from './lib/api';

export interface User {
  id: string;
  name: string;
  email: string;
  role: 'user' | 'admin';
  createdAt: string;
}
interface AuthState {
  user: User | null;
  loading: boolean;
  error: string;
  refresh: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}
const AuthContext = createContext<AuthState | null>(null);
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const refresh = useCallback(async () => {
    try {
      const data = await api<{ user: User | null }>('/auth/me');
      setUser(data.user);
      setError('');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  const login = async (email: string, password: string) => {
    const data = await api<{ user: User }>('/auth/login', { email, password });
    setUser(data.user);
    setError('');
  };
  const register = async (name: string, email: string, password: string) => {
    const data = await api<{ user: User }>('/auth/register', { name, email, password });
    setUser(data.user);
    setError('');
  };
  const logout = async () => {
    await api('/auth/logout', {});
    setUser(null);
    setError('');
  };
  return (
    <AuthContext.Provider value={{ user, loading, error, refresh, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('Missing AuthProvider');
  return context;
}
