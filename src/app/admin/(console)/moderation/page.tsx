import type { Metadata } from "next";
import { AdminModerationPanel } from "@/components/admin/moderation-panel";
import { requireAdminConsole } from "@/lib/admin/page";

export const metadata: Metadata = {
  title: "Moderation",
};

export default async function AdminModerationPage() {
  const { overview } = await requireAdminConsole();
  return <AdminModerationPanel initial={overview} />;
}
