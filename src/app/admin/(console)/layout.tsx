import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AdminShell } from "@/components/admin/shell";
import { peekAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "Stewardship",
  robots: { index: false, follow: false, nocache: true },
};

export default async function AdminConsoleLayout({ children }: { children: React.ReactNode }) {
  const admin = await peekAdmin();
  if (!admin) redirect("/admin/login");
  return <AdminShell email={admin.email}>{children}</AdminShell>;
}
