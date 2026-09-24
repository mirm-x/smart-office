import type { Metadata } from "next";
import "./globals.css";
import { IdentityProvider } from "./components/identity";
import { IdentityBar } from "./components/identity-bar";
import { AppNav } from "./components/nav";

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
          <AppNav />
          <main className="app-main">{children}</main>
        </IdentityProvider>
      </body>
    </html>
  );
}
