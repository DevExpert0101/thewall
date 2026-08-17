import type { Metadata } from "next";
import { AdminSystemPanel } from "@/components/admin/system-panel";
import { requireAdminConsole } from "@/lib/admin/page";

export const metadata: Metadata = {
  title: "System",
};

export default async function AdminSystemPage() {
  const { overview } = await requireAdminConsole();
  return <AdminSystemPanel initial={overview} />;
}
