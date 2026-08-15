import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AdminLoginForm } from "@/components/admin/login-form";
import { peekAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "Steward sign-in",
  robots: { index: false, follow: false, nocache: true },
};

export default async function AdminLoginPage() {
  const admin = await peekAdmin();
  if (admin) redirect("/admin");

  return (
    <main className="mx-auto max-w-lg px-4 py-24">
      <p className="kicker text-center">Stewardship</p>
      <h1 className="permanence-title mt-5 text-center">Keep the stone clean.</h1>
      <span className="title-rule mx-auto mt-6 block" aria-hidden="true" />
      <p className="lede mx-auto mt-6 max-w-md text-center">
        This console is for operators who moderate the live day and watch a Wall
        become history. It is not public.
      </p>
      <AdminLoginForm />
    </main>
  );
}
