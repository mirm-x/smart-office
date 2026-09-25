"use client";

import { useIdentity } from "./identity";
import { AppNav } from "./nav";

// Gate the whole app behind sign-in: until an employee is signed in we only
// show the identity bar (rendered separately) plus a prompt, hiding the nav and
// every booking screen. Simulated sign-in only -- see IdentityBar.
export function AppShell({ children }: { children: React.ReactNode }) {
  const { identity, loading } = useIdentity();

  if (loading) {
    return (
      <main className="app-main">
        <div className="banner banner--info" role="status">
          ⓘ Loading…
        </div>
      </main>
    );
  }

  if (!identity) {
    return (
      <main className="app-main">
        <div className="signed-out">
          <span className="eyebrow">Welcome to Smart Office</span>
          <h1 className="screen-title">Sign in to get started</h1>
          <p>Enter your employee id in the bar above (e.g. emp-alice) to book a desk or parking space.</p>
        </div>
      </main>
    );
  }

  return (
    <>
      <AppNav />
      <main className="app-main">{children}</main>
    </>
  );
}
