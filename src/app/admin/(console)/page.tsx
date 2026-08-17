import type { Metadata } from "next";
import { AdminDashboard } from "@/components/admin/dashboard";
import { requireAdminConsole } from "@/lib/admin/page";

export const metadata: Metadata = {
  title: "Overview",
};

export default async function AdminOverviewPage() {
  const { overview } = await requireAdminConsole();
  return <AdminDashboard initial={overview} />;
}
