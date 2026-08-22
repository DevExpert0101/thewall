import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { MonumentEntryView } from "@/components/monument-entry-view";
import { isSimulation } from "@/lib/env";
import { formatMonumentNumber, parseMonumentNumber } from "@/lib/monument/format";
import { loadMonumentEntry } from "@/lib/monument/store";
import { formatCount, monumentPath, siteUrl } from "@/lib/utils";

export const revalidate = 3600;

type Props = { params: Promise<{ number: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const monumentNumber = parseMonumentNumber((await params).number);
  if (!monumentNumber) return { title: "The Monument", robots: { index: false } };
  try {
    const entry = await loadMonumentEntry(monumentNumber);
    const title = `${formatMonumentNumber(entry.monumentNumber)} — Victor of ${entry.themeTitle}`;
    const description = `The sentence that ranked first among ${formatCount(entry.wallTotalMessages)} inscriptions in The Wall №${String(entry.editionNumber).padStart(3, "0")}.`;
    const canonical = `${siteUrl()}${monumentPath(entry.monumentNumber)}`;
    return {
      title: { absolute: title },
      description,
      alternates: { canonical },
      openGraph: {
        title,
        description,
        url: canonical,
        type: "article",
      },
      twitter: {
        card: "summary_large_image",
        title,
        description,
      },
    };
  } catch {
    return { title: "Monument entry not found", robots: { index: false } };
  }
}

export default async function MonumentEntryPage({ params }: Props) {
  if (isSimulation()) await connection();
  const monumentNumber = parseMonumentNumber((await params).number);
  if (!monumentNumber) notFound();
  let entry;
  try {
    entry = await loadMonumentEntry(monumentNumber);
  } catch {
    notFound();
  }
  return <MonumentEntryView entry={entry} />;
}
