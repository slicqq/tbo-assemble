"use client";

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { supabaseBrowser } from "@/lib/supabase/browser";

const AUTH_STORAGE_KEY = "tbo-auth";

interface AuthContextType {
  isAuthenticated: boolean;
  user: { name: string; email: string; role: string } | null;
  login: (email: string, password: string) => boolean;
  logout: () => Promise<void>;
  authMode: "supabase" | "legacy" | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Demo credentials
const DEMO_USERS = [
  { email: "rajesh@tbo.com", password: "tbo2026", name: "Rajesh Kumar", role: "Travel Agent" },
  { email: "admin@tbo.com", password: "admin123", name: "Admin User", role: "Administrator" },
  { email: "demo@tbo.com", password: "demo", name: "Demo User", role: "Travel Agent" },
];

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<AuthContextType["user"]>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [authMode, setAuthMode] = useState<"supabase" | "legacy" | null>(null);

  useEffect(() => {
    let active = true;
    let authSubscription: { unsubscribe: () => void } | undefined;
    const loadLegacy = () => {
      try {
        const stored = localStorage.getItem(AUTH_STORAGE_KEY);
        if (!stored) return null;
        const parsed = JSON.parse(stored);
        return parsed && typeof parsed.name === 'string' && typeof parsed.email === 'string' ? parsed : null;
      } catch { return null; }
    };
    const applyLegacy = () => {
      if (!active) return;
      const legacy = loadLegacy();
      setUser(legacy); setAuthMode(legacy ? 'legacy' : null); setIsAuthenticated(Boolean(legacy));
    };
    try {
      const client = supabaseBrowser();
      const refresh = async () => {
        try {
          const { data, error } = await client.auth.getUser();
          if (!active) return;
          if (!error && data.user) {
            const metaName = data.user.user_metadata?.full_name;
            const name = typeof metaName === 'string' && metaName.trim() ? metaName.trim().slice(0, 100) : (data.user.email || 'User');
            setUser({ name, email: data.user.email || '', role: 'Account' });
            setAuthMode('supabase'); setIsAuthenticated(true);
          } else applyLegacy();
        } catch { applyLegacy(); }
        finally { if (active) setIsLoading(false); }
      };
      void refresh();
      const { data } = client.auth.onAuthStateChange(() => { setTimeout(() => { void refresh(); }, 0); });
      authSubscription = data.subscription;
    } catch { setTimeout(() => { applyLegacy(); if (active) setIsLoading(false); }, 0); }
    const storageChanged = (e: StorageEvent) => {
      if (e.key === AUTH_STORAGE_KEY) {
        try { void supabaseBrowser().auth.getUser().then(({data}) => { if (!data.user) applyLegacy(); }).catch(applyLegacy); }
        catch { applyLegacy(); }
      }
    };
    window.addEventListener('storage', storageChanged);
    return () => { active = false; authSubscription?.unsubscribe(); window.removeEventListener('storage', storageChanged); };
  }, []);

  const login = useCallback((email: string, password: string): boolean => {
    const found = DEMO_USERS.find(
      (u) => u.email.toLowerCase() === email.toLowerCase() && u.password === password
    );
    if (found) {
      const userData = { name: found.name, email: found.email, role: found.role };
      setUser(userData);
      setAuthMode("legacy");
      setIsAuthenticated(true);
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(userData));
      return true;
    }
    return false;
  }, []);

  const logout = useCallback(async () => {
    // Clear both sessions to avoid silently falling back to a shared demo login.
    localStorage.removeItem(AUTH_STORAGE_KEY);
    try { await supabaseBrowser().auth.signOut(); } catch { /* clear local UI regardless */ }
    setUser(null); setAuthMode(null); setIsAuthenticated(false);
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="TBO Assemble" className="h-12 w-12 animate-pulse" />
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ isAuthenticated, user, login, logout, authMode }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
