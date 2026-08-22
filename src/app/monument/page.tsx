import type { Metadata } from "next";
import { connection } from "next/server";
import { MonumentIndex } from "@/components/monument-index";
import { loadEvent } from "@/lib/data/load";
import { isSimulation } from "@/lib/env";
import { BRAND } from "@/lib/brand";
import { listMonumentEntries } from "@/lib/monument/store";
import { publicPageMetadata } from "@/lib/share/metadata";

export const revalidate = 3600;

export async function generateMetadata(): Promise<Metadata> {
  const event = await loadEvent();
  return {
    ...publicPageMetadata({ event, path: "/monument", kind: "milestone" }),
    title: { absolute: `${BRAND.monumentWordmark} — ${BRAND.name}` },
    description: "Millions may speak. One sentence from every Wall remains here.",
  };
}

export default async function MonumentPage() {
  if (isSimulation()) await connection();
  const catalog = await listMonumentEntries();
  return <MonumentIndex catalog={catalog} />;
}
