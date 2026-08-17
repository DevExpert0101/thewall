"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { ThemeSwitch } from "@/components/theme-switch";
import { ADMIN_PHASE_LABEL } from "@/lib/admin/labels";
import type { AdminOverview } from "@/lib/admin/types";
import { formatEditionNumber } from "@/lib/utils";

const NAV = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/wall", label: "This Wall" },
  { href: "/admin/moderation", label: "Moderation", badge: "reports" as const },
  { href: "/admin/archive", label: "Archive" },
  { href: "/admin/inbox", label: "Inbox", badge: "inbox" as const },
  { href: "/admin/payments", label: "Payments" },
  { href: "/admin/system", label: "System" },
];

export function AdminShell({ email, children }: { email: string; children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [counts, setCounts] = useState({ reports: 0, inbox: 0, phase: "", edition: 1, simulation: false });

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/admin/stats")
      .then(async (res) => {
        if (res.status === 401 || res.status === 403) {
          router.push("/admin/login");
          return;
        }
        if (!res.ok) return;
        const data = (await res.json()) as AdminOverview;
        if (cancelled) return;
        setCounts({
          reports: data.openReports.length,
          inbox: data.feedback.length,
          phase: data.config.phase,
          edition: data.config.editionNumber,
          simulation: data.simulation,
        });
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [pathname, router]);

  async function signOut() {
    await fetch("/api/admin/logout", { method: "POST" });
    router.push("/admin/login");
    router.refresh();
  }

  return (
    <div className="admin-console" data-simulation={counts.simulation ? "true" : "false"}>
      <aside className="admin-rail">
        <div className="admin-rail-brand">
          <p className="kicker">Stewardship</p>
          <p className="admin-rail-edition">{formatEditionNumber(counts.edition || 1)}</p>
          <p className="admin-rail-phase">
            {ADMIN_PHASE_LABEL[counts.phase] ?? (counts.phase || "Loading")}
            {counts.simulation ? " · Simulation" : ""}
          </p>
        </div>
        <nav className="admin-rail-nav" aria-label="Stewardship">
          {NAV.map((item) => {
            const active = item.href === "/admin" ? pathname === "/admin" : pathname.startsWith(item.href);
            const badge = item.badge === "reports" ? counts.reports : item.badge === "inbox" ? counts.inbox : 0;
            return (
              <Link key={item.href} href={item.href} className="admin-nav-link" data-active={active}>
                <span>{item.label}</span>
                {badge > 0 ? <span className="admin-nav-badge">{badge}</span> : null}
              </Link>
            );
          })}
        </nav>
        <div className="admin-rail-foot">
          <p className="admin-rail-email">{email}</p>
          <div className="admin-rail-actions">
            <Link href="/wall" className="btn-ghost kicker">
              The Wall
            </Link>
            <Link href="/" className="btn-ghost kicker">
              Public
            </Link>
            <button type="button" className="btn btn-line" onClick={() => void signOut()}>
              Sign out
            </button>
          </div>
        </div>
      </aside>
      <div className="admin-stage">
        <header className="admin-topbar">
          <nav className="admin-top-nav" aria-label="Stewardship sections">
            {NAV.map((item) => {
              const active = item.href === "/admin" ? pathname === "/admin" : pathname.startsWith(item.href);
              return (
                <Link key={item.href} href={item.href} className="admin-top-link" data-active={active}>
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <ThemeSwitch />
        </header>
        <main className="admin-main">{children}</main>
      </div>
    </div>
  );
}
