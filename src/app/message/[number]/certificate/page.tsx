import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CertificateView } from "@/components/certificate-view";
import { certificateFromPublic, publicCertificatePath } from "@/lib/certificate/public";
import { loadEvent } from "@/lib/data/load";
import { getMessageByNumber } from "@/lib/data/messages";
import { APP_NAME } from "@/lib/constants";
import { creativeImageUrl, oembedEndpoint } from "@/lib/share/links";
import { editionNumberOf, formatObjectIdentity, parsePublicNumber, siteUrl } from "@/lib/utils";

export const revalidate = 5;

type Props = { params: Promise<{ number: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { number } = await params;
  const n = parsePublicNumber(number);
  if (!n) {
    return { title: "Certificate", robots: { index: false } };
  }
  try {
    const event = await loadEvent();
    const message = await getMessageByNumber(event.id, n);
    const origin = siteUrl();
    const canonical = `${origin}${publicCertificatePath(n)}`;
    const title = `PUBLIC CERTIFICATE — ${formatObjectIdentity(n, editionNumberOf(event))}`;
    const description = message.isRemoved
      ? "This sentence was removed under archive policy."
      : `“${message.text}”`;
    const image = creativeImageUrl({
      kind: "certificate",
      ratio: "1200x630",
      number: message.publicNumber,
    });
    return {
      title: { absolute: title },
      description,
      alternates: {
        canonical,
        types: {
          "application/json+oembed": oembedEndpoint(`${origin}/message/${n}`),
        },
      },
      openGraph: {
        type: "article",
        siteName: APP_NAME,
        title,
        description,
        url: canonical,
        images: [{ url: image, width: 1200, height: 630, alt: title, type: "image/png" }],
      },
      twitter: {
        card: "summary_large_image",
        title,
        description,
        images: [image],
      },
    };
  } catch {
    return { title: "Certificate not found", robots: { index: false } };
  }
}

export default async function PublicCertificatePage({ params }: Props) {
  const { number } = await params;
  const n = parsePublicNumber(number);
  if (!n) notFound();
  const event = await loadEvent();
  let message;
  try {
    message = await getMessageByNumber(event.id, n);
  } catch {
    notFound();
  }
  return <CertificateView data={certificateFromPublic(event, message)} />;
}
