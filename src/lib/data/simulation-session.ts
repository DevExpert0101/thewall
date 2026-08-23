import { cookies } from "next/headers";
import { closeSimulatedWall, currentSimulatedEvent, isSimulatedWallClosed } from "@/lib/data/simulation";
import { isSimulation } from "@/lib/env";
import type { EventPhase } from "@/lib/event/state";

export const SIM_CLOSED_COOKIE = "thewall-sim-closed";

const CLOSED_COOKIE = {
  path: "/",
  sameSite: "lax" as const,
  httpOnly: true,
};

export function simulatedCloseCookieValue(startsAt: string) {
  return `v1:${startsAt}`;
}

/** Only seal the same wall that wrote the cookie — never a later live day. */
export function resolveSimulatedCloseCookie(
  cookie: string | undefined,
  event: { startsAt: string; phase: EventPhase },
): "apply" | "drop" | "ignore" {
  if (!cookie) return "ignore";
  if (cookie === simulatedCloseCookieValue(event.startsAt)) {
    return event.phase === "archived" ? "ignore" : "apply";
  }
  return "drop";
}

function expireCloseCookie(jar: Awaited<ReturnType<typeof cookies>>) {
  jar.set(SIM_CLOSED_COOKIE, "", { ...CLOSED_COOKIE, maxAge: 0 });
  jar.delete(SIM_CLOSED_COOKIE);
}

export async function markSimulatedClosed(closed: boolean) {
  try {
    const jar = await cookies();
    if (closed) {
      jar.set(SIM_CLOSED_COOKIE, simulatedCloseCookieValue(currentSimulatedEvent().startsAt), {
        ...CLOSED_COOKIE,
        maxAge: 60 * 60 * 24 * 7,
      });
      return;
    }
    expireCloseCookie(jar);
  } catch {
    // close still lives in memory and on disk
  }
}

/** Close this same simulated Wall when another isolate missed the in-memory write. */
export async function syncSimulatedCloseFromCookie() {
  if (!isSimulation()) return;
  try {
    const jar = await cookies();
    const event = currentSimulatedEvent();
    const action = resolveSimulatedCloseCookie(jar.get(SIM_CLOSED_COOKIE)?.value, event);
    if (action === "drop") {
      expireCloseCookie(jar);
      return;
    }
    if (action === "apply" && !isSimulatedWallClosed()) closeSimulatedWall();
  } catch {
    // no request cookie store (tests, static image workers)
  }
}
