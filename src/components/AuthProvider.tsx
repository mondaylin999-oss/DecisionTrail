"use client";
import { GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut, type User } from "firebase/auth";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { deviceAiStatus, type DeviceAiStatus } from "@/lib/ai/availability";
import { api } from "@/lib/api";
import { firebaseAuth, isFirebaseConfigured } from "@/lib/firebase/client";
import type { PrivacyMode } from "@/lib/vocab";

interface Me {
  id: string;
  email: string | null;
  displayName: string | null;
  privacyMode: PrivacyMode;
}

interface Ctx {
  ready: boolean;
  configured: boolean;
  user: User | null;
  me: Me | null;
  aiStatus: DeviceAiStatus | null;
  refreshAiStatus: () => Promise<void>;
  setPrivacyMode: (m: PrivacyMode) => Promise<void>;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  error: string | null;
}

const AuthCtx = createContext<Ctx | null>(null);
const READY_FALLBACK_MS = 8000;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [configured] = useState(() => isFirebaseConfigured());
  const [ready, setReady] = useState(!configured);
  const [user, setUser] = useState<User | null>(null);
  const [me, setMe] = useState<Me | null>(null);
  const [aiStatus, setAiStatus] = useState<DeviceAiStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refreshAiStatus = useCallback(async () => setAiStatus(await deviceAiStatus()), []);

  useEffect(() => {
    void deviceAiStatus().then(setAiStatus);
    if (!configured) return;
    return onAuthStateChanged(firebaseAuth(), async (u) => {
      setUser(u);
      if (u) {
        // Never leave the whole app on the loading screen if the server is slow to answer.
        const unblock = setTimeout(() => setReady(true), READY_FALLBACK_MS);
        try {
          setMe(await api<Me>("/api/me"));
          setError(null);
        } catch (e) {
          setError(e instanceof Error ? e.message : String(e));
        } finally {
          clearTimeout(unblock);
        }
      } else {
        setMe(null);
      }
      setReady(true);
    });
  }, [configured]);

  const value: Ctx = {
    ready,
    configured,
    user,
    me,
    aiStatus,
    refreshAiStatus,
    error,
    setPrivacyMode: async (m) => {
      const r = await api<{ privacyMode: PrivacyMode }>("/api/me", { method: "PATCH", body: { privacy_mode: m } });
      setMe((prev) => (prev ? { ...prev, privacyMode: r.privacyMode } : prev));
    },
    signIn: async () => {
      await signInWithPopup(firebaseAuth(), new GoogleAuthProvider());
    },
    signOut: async () => {
      await signOut(firebaseAuth());
    },
  };
  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export function useAuth(): Ctx {
  const c = useContext(AuthCtx);
  if (!c) throw new Error("useAuth outside AuthProvider");
  return c;
}
