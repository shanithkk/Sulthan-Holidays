"use client";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api, tokenStore, type User } from "./api";

type Session = { token: string; user: User };
type Ctx = {
  user: User | null;
  loading: boolean;
  signIn: (s: Session) => void;
  signOut: () => void;
  setUser: (u: User) => void;
};

const AuthContext = createContext<Ctx | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const restore = tokenStore.get() ? api<User>("/me") : Promise.resolve(null);
    restore
      .then(setUser)
      .catch(() => tokenStore.clear())
      .finally(() => setLoading(false));
  }, []);

  const signIn = useCallback((s: Session) => {
    tokenStore.set(s.token);
    setUser(s.user);
  }, []);
  const signOut = useCallback(() => {
    tokenStore.clear();
    setUser(null);
  }, []);

  return <AuthContext value={{ user, loading, signIn, signOut, setUser }}>{children}</AuthContext>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
