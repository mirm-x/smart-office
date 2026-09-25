import type { Metadata } from "next";
import "./globals.css";
import { IdentityProvider } from "./components/identity";
import { IdentityBar } from "./components/identity-bar";
import { AppShell } from "./components/app-shell";

export const metadata: Metadata = {
  title: "Smart Office POC",
  description: "ZRS Camp 2026 - desk & parking booking POC",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <IdentityProvider>
          <IdentityBar />
          <AppShell>{children}</AppShell>
        </IdentityProvider>
      </body>
    </html>
  );
}
