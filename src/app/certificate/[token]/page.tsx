import type { Metadata } from "next";
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
  let data;
  try {
    data = await lookupCertificate(token);
  } catch {
    return <Invalid />;
  }
  return <CertificateView token={token} data={data} />;
}

function Invalid() {
  return (
    <main className="mx-auto max-w-lg px-4 py-24 text-center">
      <p className="kicker">Certificate</p>
      <h1 className="mt-5 font-display text-4xl">Certificate not found</h1>
      <p className="lede mt-4">
        This certificate link is invalid. Check the Wall Key you saved when you published.
      </p>
    </main>
  );
}
