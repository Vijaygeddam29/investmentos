import React, { createContext, useContext, useEffect, useState, useCallback } from "react";

const API = import.meta.env.BASE_URL.replace(/\/$/, "");

export interface AuthUser {
  id: number;
  email: string | null;
  phone: string | null;
  name: string | null;
  verified: boolean;
}

export type Market = "United States" | "United Kingdom" | "Europe" | "India" | "All";

interface AuthCtx {
  user: AuthUser | null;
  token: string | null;
  loading: boolean;
  market: Market;
  setMarket: (m: Market) => void;
  login: (token: string, user: AuthUser) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthCtx>({
  user: null,
  token: null,
  loading: true,
  market: "All",
  setMarket: () => {},
  login: () => {},
  logout: () => {},
});

const TOKEN_KEY  = "ios_jwt";
const MARKET_KEY = "ios_market";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user,    setUser]    = useState<AuthUser | null>(null);
  const [token,   setToken]   = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [market,  setMarketState] = useState<Market>(
    () => (localStorage.getItem(MARKET_KEY) as Market | null) ?? "All"
  );

  useEffect(() => {
    const stored = localStorage.getItem(TOKEN_KEY);
    if (!stored) {
      setLoading(false);
      return;
    }
    fetch(`${API}/api/auth/me`, {
      headers: { Authorization: `Bearer ${stored}` },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.user) {
          setToken(stored);
          setUser(data.user);
        } else {
          localStorage.removeItem(TOKEN_KEY);
        }
      })
      .catch(() => localStorage.removeItem(TOKEN_KEY))
      .finally(() => setLoading(false));
  }, []);

  const setMarket = useCallback((m: Market) => {
    localStorage.setItem(MARKET_KEY, m);
    setMarketState(m);
  }, []);

  const login = useCallback((tok: string, u: AuthUser) => {
    localStorage.setItem(TOKEN_KEY, tok);
    setToken(tok);
    setUser(u);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, token, loading, market, setMarket, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
