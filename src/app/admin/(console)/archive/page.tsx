import type { Metadata } from "next";
import { AdminArchivePanel } from "@/components/admin/archive-panel";
import { requireAdminConsole } from "@/lib/admin/page";

export const metadata: Metadata = {
  title: "Archive",
};

export default async function AdminArchivePage() {
  const { overview } = await requireAdminConsole();
  return <AdminArchivePanel initial={overview} />;
}
