"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import ThemeButton from "./ThemeButton";

const LINKS = [
  { href: "/", label: "Live wall", short: "Wall" },
  { href: "/submit", label: "Etch your message", short: "Etch" },
  { href: "/artifact", label: "Permanent record", short: "Record" },
];

export default function SiteHeader() {
  const pathname = usePathname();
  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <header className="border-b border-edge/60 bg-background/80 backdrop-blur-md print:hidden">
      <nav className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-3">
        <Link
          href="/"
          className="font-display text-xl leading-none tracking-tight text-cream"
        >
          THE<span className="text-ember">WALL</span>
        </Link>
        <div className="flex items-center gap-1">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`rounded-full px-3 py-1.5 text-xs uppercase tracking-widest transition ${
                isActive(l.href)
                  ? "bg-ember/15 text-gold"
                  : "text-muted hover:text-gold"
              }`}
            >
              <span className="hidden sm:inline">{l.label}</span>
              <span className="sm:hidden">{l.short}</span>
            </Link>
          ))}
          <span className="mx-2 hidden h-5 w-px bg-edge sm:block" />
          <ThemeButton />
        </div>
      </nav>
    </header>
  );
}
