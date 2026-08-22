import type { ReactNode } from "react";

export function AdminPageHeader({
  kicker,
  title,
  children,
}: {
  kicker: string;
  title: string;
  children?: ReactNode;
}) {
  return (
    <header className="admin-page-head">
      <p className="kicker">{kicker}</p>
      <h1 className="admin-page-title">{title}</h1>
      {children ? <p className="admin-page-lede">{children}</p> : null}
    </header>
  );
}

export function AdminAlert({ error }: { error: string | null }) {
  if (!error) return null;
  return (
    <p className="admin-alert" role="alert">
      {error}
    </p>
  );
}

export function AdminStat({ k, v }: { k: string; v: string }) {
  return (
    <div className="admin-stat">
      <p className="admin-stat-value">{v}</p>
      <p className="kicker mt-2">{k}</p>
    </div>
  );
}

export function AdminRow({ k, v }: { k: string; v: string }) {
  return (
    <div className="admin-row">
      <dt>{k}</dt>
      <dd>{v}</dd>
    </div>
  );
}

export function AdminEmpty({ children }: { children: ReactNode }) {
  return <p className="admin-empty">{children}</p>;
}
