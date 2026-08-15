import { cookies } from "next/headers";
import { closeSimulatedWall, isSimulatedWallClosed } from "@/lib/data/simulation";
import { isSimulation } from "@/lib/env";

export const SIM_CLOSED_COOKIE = "thewall-sim-closed";

export async function markSimulatedClosed(closed: boolean) {
  try {
    const jar = await cookies();
    if (closed) {
      jar.set(SIM_CLOSED_COOKIE, "1", {
        path: "/",
        sameSite: "lax",
        httpOnly: true,
        maxAge: 60 * 60 * 24 * 7,
      });
      return;
    }
    jar.delete(SIM_CLOSED_COOKIE);
  } catch {
    // close still lives in memory and on disk
  }
}

/** Close this same simulated Wall when another isolate missed the in-memory write. */
export async function syncSimulatedCloseFromCookie() {
  if (!isSimulation()) return;
  try {
    const jar = await cookies();
    if (jar.get(SIM_CLOSED_COOKIE)?.value !== "1") return;
    if (!isSimulatedWallClosed()) closeSimulatedWall();
  } catch {
    // no request cookie store (tests, static image workers)
  }
}
