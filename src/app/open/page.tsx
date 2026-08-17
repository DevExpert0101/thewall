import type { Metadata } from "next";
import { JsonLd } from "@/components/json-ld";
import { WaitingRoom } from "@/components/waiting-room";
import { loadEvent } from "@/lib/data/load";
import { firstSearch } from "@/lib/watch/config";
import { publicPageMetadata } from "@/lib/share/metadata";

export const revalidate = 5;

type Props = { searchParams: Promise<{ from?: string | string[] }> };

export async function generateMetadata(): Promise<Metadata> {
  const event = await loadEvent();
  return publicPageMetadata({ event, path: "/open", kind: "countdown" });
}

export default async function OpenPage({ searchParams }: Props) {
  const raw = await searchParams;
  const invited = firstSearch(raw.from) === "invite";
  const event = await loadEvent();

  return (
    <main>
      <JsonLd event={event} />
      <WaitingRoom event={event} invited={invited} />
    </main>
  );
}
