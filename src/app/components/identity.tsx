"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

export interface Identity {
  employeeExternalId: string;
  displayName: string;
}

interface IdentityContextValue {
  identity: Identity | null;
  loading: boolean;
  signIn: (employeeExternalId: string) => Promise<{ ok: boolean; error?: string }>;
  signOut: () => Promise<void>;
}

const IdentityContext = createContext<IdentityContextValue | null>(null);

export function useIdentity(): IdentityContextValue {
  const ctx = useContext(IdentityContext);
  if (!ctx) throw new Error("useIdentity must be used within IdentityProvider");
  return ctx;
}

export function IdentityProvider({ children }: { children: React.ReactNode }) {
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const data = await fetch("/api/auth/session")
      .then((r) => r.json())
      .catch(() => ({ signedIn: false }));
    if (data.signedIn) {
      setIdentity({ employeeExternalId: data.employeeExternalId, displayName: data.displayName });
    } else {
      setIdentity(null);
    }
  }, []);

  useEffect(() => {
    let active = true;
    refresh().finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [refresh]);

  const signIn = useCallback(
    async (employeeExternalId: string) => {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ employeeExternalId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        return { ok: false, error: data.error ?? "sign_in_failed" };
      }
      // The login route only returns the external id; fetch the session to get
      // the display name for the identity bar.
      await refresh();
      return { ok: true };
    },
    [refresh]
  );

  const signOut = useCallback(async () => {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    setIdentity(null);
  }, []);

  return (
    <IdentityContext.Provider value={{ identity, loading, signIn, signOut }}>
      {children}
    </IdentityContext.Provider>
  );
}
