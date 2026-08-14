import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AdminLoginForm } from "@/components/admin/login-form";
import { peekAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "Admin sign-in",
  robots: { index: false, follow: false, nocache: true },
};

export default async function AdminLoginPage() {
  const admin = await peekAdmin();
  if (admin) redirect("/admin");

  return (
    <main className="mx-auto max-w-lg px-4 py-24">
      <p className="kicker text-center">Operations</p>
      <h1 className="mt-4 text-center font-display text-4xl">Administration</h1>
      <p className="mt-3 text-center text-sm text-ash">
        Permanent administrator identities only. This console is not public.
      </p>
      <AdminLoginForm />
    </main>
  );
}
