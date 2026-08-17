import { MonumentCanvas } from "@/components/monument-canvas";
import { BRAND } from "@/lib/brand";
import type { MonumentCatalog } from "@/lib/monument/types";

export function MonumentIndex({ catalog }: { catalog: MonumentCatalog }) {
  return (
    <main className="monument-surface">
      <h1 className="sr-only">{BRAND.monumentWordmark}</h1>
      <MonumentCanvas canvas={catalog.canvas} entries={catalog.entries} />
    </main>
  );
}
