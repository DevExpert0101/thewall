import type { Metadata } from "next";
import { AdminWallDesk } from "@/components/admin/wall-desk";
import { requireAdminConsole } from "@/lib/admin/page";

export const metadata: Metadata = {
  title: "This Wall",
};

export default async function AdminWallPage() {
  const { overview } = await requireAdminConsole();
  return <AdminWallDesk initial={overview} />;
}
