import type { Metadata } from "next";
import { RandomMode } from "@/components/random-mode";
import { loadEvent } from "@/lib/data/load";
import { pickRandomMessages } from "@/lib/data/messages";
import { publicPageMetadata } from "@/lib/share/metadata";

export const revalidate = 5;

export async function generateMetadata(): Promise<Metadata> {
  const event = await loadEvent();
  return publicPageMetadata({ event, path: "/wall/random", kind: "countdown" });
}

export default async function RandomPage() {
  const event = await loadEvent();
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
