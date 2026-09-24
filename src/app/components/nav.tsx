"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Book" },
  { href: "/bookings", label: "My bookings" },
];

export function AppNav() {
  const pathname = usePathname();
  return (
    <nav className="app-nav" aria-label="Primary">
      {LINKS.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className="app-nav__link"
          aria-current={pathname === link.href ? "page" : undefined}
        >
          {link.label}
        </Link>
      ))}
    </nav>
  );
}
