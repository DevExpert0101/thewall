import type { Metadata } from "next";
import { AdminPaymentsPanel } from "@/components/admin/payments-panel";
import { requireAdminConsole } from "@/lib/admin/page";

export const metadata: Metadata = {
  title: "Payments",
};

export default async function AdminPaymentsPage() {
  const { overview } = await requireAdminConsole();
  return <AdminPaymentsPanel initial={overview} />;
}
