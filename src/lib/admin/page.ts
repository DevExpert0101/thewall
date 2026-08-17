import { redirect } from "next/navigation";
import { loadAdminOverview } from "@/lib/admin/data";
import { peekAdmin } from "@/lib/auth";

export async function requireAdminConsole() {
  const admin = await peekAdmin();
  if (!admin) redirect("/admin/login");
  const overview = await loadAdminOverview();
  return { admin, overview };
}
