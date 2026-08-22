import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { RandomMode } from "@/components/random-mode";
import { loadSealedEdition } from "@/lib/data/editions";
import { pickRandomMessages } from "@/lib/data/messages";
import { isSimulation } from "@/lib/env";
import { publicPageMetadata } from "@/lib/share/metadata";
import { editionPath, parseEdition } from "@/lib/utils";

export const revalidate = 3600;

type Props = { params: Promise<{ edition: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const editionNumber = parseEdition((await params).edition);
  if (!editionNumber) return { title: "Random", robots: { index: false } };
  try {
    const event = await loadSealedEdition(editionNumber);
    return publicPageMetadata({
      event,
      path: `${editionPath(editionNumber)}/random`,
      kind: "milestone",
    });
  } catch {
    return { title: "Edition not found", robots: { index: false } };
  }
}

export default async function EditionRandomPage({ params }: Props) {
  if (isSimulation()) await connection();
  const editionNumber = parseEdition((await params).edition);
  if (!editionNumber) notFound();

  let event;
  try {
    event = await loadSealedEdition(editionNumber);
  } catch {
    notFound();
  }

  let initial: Awaited<ReturnType<typeof pickRandomMessages>>["messages"] = [];
  try {
    initial = (await pickRandomMessages({ eventId: event.id, count: 2 })).messages;
  } catch {
    initial = [];
  }

  return (
    <main>
      <h1 className="sr-only">Random</h1>
      <RandomMode event={event} initial={initial} variant="page" />
    </main>
  );
}
