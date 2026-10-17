import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CertificateView } from "@/components/certificate-view";
import { lookupCertificate } from "@/lib/certificate/lookup";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "Certificate",
  robots: { index: false, follow: false, nocache: true },
  referrer: "no-referrer",
  other: {
    "Cache-Control": "private, no-store",
  },
};

export default async function CertificatePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const lookedUp = await lookupCertificate(token).then(
    (value) => ({ ok: true as const, value }),
    () => ({ ok: false as const, value: null }),
  );
  if (!lookedUp.ok) notFound();
  return <CertificateView data={lookedUp.value} />;
}
