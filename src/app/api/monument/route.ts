import { jsonError, jsonOk } from "@/lib/http";
import { isSimulation } from "@/lib/env";
import { listMonumentEntries } from "@/lib/monument/store";

export async function GET() {
  try {
    const catalog = await listMonumentEntries();
    return jsonOk(catalog, {
      cache: isSimulation() ? "private, no-store" : "public, s-maxage=5, stale-while-revalidate=30",
    });
  } catch (error) {
    return jsonError(error);
  }
}
