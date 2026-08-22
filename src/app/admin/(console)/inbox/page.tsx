import type { Metadata } from "next";
import { AdminInboxPanel } from "@/components/admin/inbox-panel";
import { requireAdminConsole } from "@/lib/admin/page";

export const metadata: Metadata = {
  title: "Inbox",
};

export default async function AdminInboxPage() {
  const { overview } = await requireAdminConsole();
  return <AdminInboxPanel initial={overview} />;
}
