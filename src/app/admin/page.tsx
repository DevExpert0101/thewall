import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AdminDashboard } from "@/components/admin/dashboard";
import { peekAdmin } from "@/lib/auth";
import { loadAdminOverview } from "@/lib/admin/data";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "Stewardship",
  robots: { index: false, follow: false, nocache: true },
};

export default async function AdminPage() {
  const admin = await peekAdmin();
  if (!admin) redirect("/admin/login");
  const overview = await loadAdminOverview();
  return (
    <main>
      <AdminDashboard initial={overview} email={admin.email} />
    </main>
  );
}
