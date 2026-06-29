import { createContext, useContext, useState, useEffect, useCallback } from 'react';

const AUTH_URL = 'https://auth.freegamestore.online';

export interface User {
  id: string;
  name: string;
  avatar: string;
}

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  signIn: () => void;
  signOut: () => void;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  loading: true,
  signIn: () => {},
  signOut: () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

export { AuthContext };

export function useAuthProvider(): AuthContextValue {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${AUTH_URL}/me`, { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((u: User | null) => setUser(u))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const signIn = useCallback(() => {
    window.location.href = `${AUTH_URL}/login?redirect=${encodeURIComponent(window.location.href)}`;
  }, []);

  const signOut = useCallback(() => {
    fetch(`${AUTH_URL}/logout`, { method: 'POST', credentials: 'include' })
      .catch(() => {})
      .finally(() => {
        setUser(null);
        window.location.reload();
      });
  }, []);

  return { user, loading, signIn, signOut };
}
