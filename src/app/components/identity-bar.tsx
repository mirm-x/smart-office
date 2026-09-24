"use client";

import { useState } from "react";
import { useIdentity } from "./identity";

// Simulated sign-in stub (POC only -- clearly labelled, no real SSO). The
// entered employee id drives every API call via the signed session cookie.
export function IdentityBar() {
  const { identity, loading, signIn, signOut } = useIdentity();
  const [value, setValue] = useState("emp-alice");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const result = await signIn(value.trim());
      if (!result.ok) {
        setError(result.error === "unknown_employee" ? "We don't recognise that employee id." : "Sign-in failed.");
      }
    } catch {
      setError("Sign-in failed. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <header className="identity-bar">
      <div className="identity-bar__inner">
        <span className="identity-bar__brand">Smart Office</span>
        <div className="identity-bar__id">
          <span className="tag-simulated" title="This POC does not use real corporate sign-in.">
            ◈ Simulated sign-in — no real SSO
          </span>
          {identity ? (
            <>
              <span className="identity-bar__label">
                Signed in as <strong>{identity.displayName}</strong> ({identity.employeeExternalId})
              </span>
              <button type="button" className="btn btn--ghost btn--sm" onClick={() => signOut()}>
                Sign out
              </button>
            </>
          ) : (
            <form className="identity-bar__id" onSubmit={handleSignIn}>
              <label className="identity-bar__label" htmlFor="employee-id">
                Signed in as
              </label>
              <input
                id="employee-id"
                className="field__control"
                style={{ height: 32, width: 140 }}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="e.g. emp-alice"
                disabled={loading || busy}
                aria-invalid={error ? true : undefined}
              />
              <button type="submit" className="btn btn--secondary btn--sm" disabled={loading || busy || !value.trim()}>
                {busy ? "Signing in…" : "Sign in"}
              </button>
            </form>
          )}
        </div>
      </div>
      {error && (
        <div className="identity-bar__inner" role="alert">
          <span className="banner banner--error" style={{ width: "100%" }}>
            ⚠ {error}
          </span>
        </div>
      )}
    </header>
  );
}
