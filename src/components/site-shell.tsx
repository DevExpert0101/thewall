"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SimulationBar } from "@/components/simulation-bar";
import { ThemeSwitch } from "@/components/theme-switch";
import { APP_NAME } from "@/lib/constants";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/wall", label: "The Wall" },
  { href: "/archive", label: "Archive" },
  { href: "/about", label: "About" },
];

export function SiteShell({
  children,
  simulation = false,
}: {
  children: React.ReactNode;
  simulation?: boolean;
}) {
  const pathname = usePathname();
  const isAdmin = pathname.startsWith("/admin");
  const isCertificate = pathname.startsWith("/certificate");

  if (isAdmin) {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:bg-paper focus:px-3 focus:py-2 focus:text-void"
      >
        Skip to content
      </a>
      {!isCertificate ? (
        <header className="site-header sticky top-0 z-40">
          <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:h-16 sm:px-6">
            <Link
              href="/"
              className="wordmark font-display text-[0.95rem] tracking-[0.14em] text-paper sm:text-lg sm:tracking-[0.22em]"
            >
              {APP_NAME}
            </Link>
            <div className="flex items-center">
              <nav aria-label="Primary" className="flex items-center">
                {NAV.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    data-active={pathname === item.href || (item.href === "/wall" && pathname.startsWith("/message"))}
                    className={cn("nav-link px-2 sm:px-3")}
                  >
                    {item.label}
                  </Link>
                ))}
              </nav>
              <ThemeSwitch />
            </div>
          </div>
          {simulation ? <SimulationBar /> : null}
        </header>
      ) : null}
      <div id="content" className="flex flex-1 flex-col">
        {children}
      </div>
      {!isCertificate ? (
        <footer className="border-t border-line bg-ink/35 py-10">
          <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 sm:flex-row sm:items-end sm:justify-between sm:px-6">
            <p className="font-display text-lg leading-snug text-mist">
              One day. One dollar.
              <br className="sm:hidden" /> One sentence forever.
            </p>
            <p className="kicker">
              <Link href="/about#safety" className="hover:text-paper">
                Safety
              </Link>
              <span aria-hidden="true"> · </span>
              <Link href="/archive" className="hover:text-paper">
                Archive
              </Link>
            </p>
          </div>
        </footer>
      ) : null}
    </div>
  );
}
