"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SimulationBar } from "@/components/simulation-bar";
import { ThemeSwitch } from "@/components/theme-switch";
import { APP_NAME } from "@/lib/constants";

const NAV = [
  { href: "/wall", label: "The Wall" },
  { href: "/watch", label: "Watch" },
  { href: "/wall/random", label: "Random" },
  { href: "/archive", label: "Archive" },
  { href: "/monument", label: "Monument" },
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
  const isRandom = pathname === "/wall/random" || pathname.endsWith("/random");
  const isStream = pathname.startsWith("/watch/stream");
  const isArchive =
    pathname.startsWith("/archive") ||
    pathname.startsWith("/monument") ||
    pathname === "/records" ||
    pathname.startsWith("/records/");

  if (isAdmin || isStream) {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-dvh flex-col" data-mode={isArchive ? "archive" : "live"}>
      <a
        href="#content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:bg-paper focus:px-3 focus:py-2 focus:text-void"
      >
        Skip to content
      </a>
      {!isCertificate ? (
        <header className="site-header sticky top-0 z-40">
          <div className="site-header-inner">
            <Link href="/" className="wordmark">
              {APP_NAME}
            </Link>
            <nav aria-label="Primary" className="site-nav">
              {NAV.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  data-active={
                    pathname === item.href ||
                    (item.href === "/wall" && pathname.startsWith("/message")) ||
                    (item.href === "/archive" && pathname.startsWith("/archive")) ||
                    (item.href === "/monument" && pathname.startsWith("/monument"))
                  }
                  className="nav-link"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
            <div className="site-header-theme">
              <ThemeSwitch />
            </div>
          </div>
          {simulation ? <SimulationBar /> : null}
        </header>
      ) : null}
      <div id="content" className="flex flex-1 flex-col">
        {children}
      </div>
      {!isCertificate && !isRandom ? (
        <footer className="site-footer">
          <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 sm:flex-row sm:items-end sm:justify-between sm:px-6">
            <p className="font-monument text-base tracking-[0.14em] text-bronze sm:text-lg">
              One day. One dollar.
              <br className="sm:hidden" /> One sentence.
            </p>
            <p className="kicker">
              <Link href="/how-it-works" className="hover:text-paper">
                How it works
              </Link>
              <span aria-hidden="true"> · </span>
              <Link href="/about#safety" className="hover:text-paper">
                Safety
              </Link>
              <span aria-hidden="true"> · </span>
              <Link href="/archive" className="hover:text-paper">
                Archive
              </Link>
              <span aria-hidden="true"> · </span>
              <Link href="/monument" className="hover:text-paper">
                Monument
              </Link>
              <span aria-hidden="true"> · </span>
              <Link href="/records" className="hover:text-paper">
                Records
              </Link>
              <span aria-hidden="true"> · </span>
              <Link href="/#feedback" className="hover:text-paper">
                Feedback
              </Link>
            </p>
          </div>
        </footer>
      ) : null}
    </div>
  );
}
