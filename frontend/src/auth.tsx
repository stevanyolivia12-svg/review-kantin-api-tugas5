import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { ApiError, getCurrentUser, login as loginRequest, register as registerRequest } from './api';
import type { AuthSession, AuthUser } from './types';

const TOKEN_KEY = 'review-kantin-access-token';

interface AuthContextValue {
  token: string | null;
  user: AuthUser | null;
  checkingSession: boolean;
  sessionMessage: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY));
  const [user, setUser] = useState<AuthUser | null>(null);
  const [checkingSession, setCheckingSession] = useState(Boolean(token));
  const [sessionMessage, setSessionMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setCheckingSession(false);
      setUser(null);
      return;
    }

    let active = true;
    setCheckingSession(true);
    getCurrentUser(token)
      .then((currentUser) => {
        if (active) {
          setUser(currentUser);
          setSessionMessage(null);
        }
      })
      .catch((error: unknown) => {
        if (!active) return;
        if (error instanceof ApiError && error.status === 401) {
          localStorage.removeItem(TOKEN_KEY);
          setToken(null);
          setUser(null);
          setSessionMessage('Sesi berakhir. Silakan masuk kembali.');
        } else {
          setSessionMessage(error instanceof Error ? error.message : 'Sesi tidak dapat diperiksa.');
        }
      })
      .finally(() => {
        if (active) setCheckingSession(false);
      });

    return () => {
      active = false;
    };
  }, [token]);

  async function saveSession(action: Promise<AuthSession>) {
    const session = await action;
    const profile = await getCurrentUser(session.accessToken);
    localStorage.setItem(TOKEN_KEY, session.accessToken);
    setToken(session.accessToken);
    setUser(profile);
    setSessionMessage(null);
  }

  function logout() {
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setUser(null);
    setSessionMessage(null);
  }

  const value: AuthContextValue = {
    token,
    user,
    checkingSession,
    sessionMessage,
    login: (email, password) => saveSession(loginRequest(email, password)),
    register: (name, email, password) => saveSession(registerRequest(name, email, password)),
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth harus digunakan di dalam AuthProvider.');
  return context;
}
