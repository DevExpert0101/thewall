import { connection } from "next/server";
import { eventSlug, getEventSnapshot } from "@/lib/data/event";
import { listSealedEditions } from "@/lib/data/editions";
import { syncSimulatedCloseFromCookie } from "@/lib/data/simulation-session";
import { hasSupabaseConfig, isSimulation } from "@/lib/env";
import { isNextProductionBuild, isVercelProduction } from "@/lib/env/production";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { publicWinnerFrom, type PublicWinner } from "@/lib/ownership/winner";
import type { EditionSummary, EventSnapshot, PublicMessage } from "@/lib/types";
import { listLiveSurface, listMessages, pickRandomMessages } from "@/lib/data/messages";
import { isEventClosed, publicMessageForPhase } from "@/lib/event/state";
import { WALL_MIX_PAGE_SIZE } from "@/lib/wall/constants";
import { feedSortForPhase, pageWindow } from "@/lib/wall/feed";
import {
  lanesFromCards,
  spectatorHourSalt,
  spectatorRng,
  weaveSpectatorFeed,
  type SpectatorLane,
} from "@/lib/wall/mix";
import { selectWitnessSentences } from "@/lib/wall/witness";
import type { VictorRaceLeader } from "@/lib/monument/types";
import { editionNumberOf } from "@/lib/utils";
import { loadMonumentForEdition } from "@/lib/monument/store";

export async function loadEvent(): Promise<EventSnapshot> {
  if (isSimulation()) {
    try {
      await connection();
      await syncSimulatedCloseFromCookie();
    } catch {
      // request cookies / connection() are unavailable in some workers and tests
    }
  }
  try {
    return await getEventSnapshot(eventSlug());
  } catch (error) {
    const incomplete =
      isSimulation() ||
      !hasSupabaseConfig() ||
      (error instanceof AppError && error.code === ERROR_CODES.CONFIG);
    if (incomplete) {
      const { currentSimulatedEvent } = await import("@/lib/data/simulation");
      return currentSimulatedEvent();
    }
    if (isVercelProduction() && !isNextProductionBuild()) throw error;
    throw error;
  }
}

export async function loadArchiveEditions(): Promise<EditionSummary[]> {
  if (isSimulation()) {
    try {
      await connection();
      await syncSimulatedCloseFromCookie();
    } catch {
      // request cookies / connection() are unavailable in some workers and tests
    }
  }
  return listSealedEditions();
}

export async function loadLatestPublicWinner(): Promise<PublicWinner | null> {
  const editions = await loadArchiveEditions();
  const latest = editions.at(-1);
  if (!latest) return null;
  return publicWinnerFrom(latest.editionNumber, latest.winning);
}

export async function loadLiveSurface(event: EventSnapshot): Promise<PublicMessage[]> {
  try {
    const rows = await listLiveSurface(event.id);
    return rows.map((message) => publicMessageForPhase(message, event.phase));
  } catch {
    return loadPreview(event);
  }
}

export async function loadPreview(event: EventSnapshot): Promise<PublicMessage[]> {
  try {
    const { messages } = await listMessages({
      eventId: event.id,
      sort: feedSortForPhase(event.phase, "rising"),
      limit: 12,
      endsAt: event.endsAt,
    });
    return messages.map((message) => publicMessageForPhase(message, event.phase));
  } catch {
    return [];
  }
}

/** Live default /wall stream. Same mix for every visitor this hour. */
export async function listSpectatorPage(
  event: EventSnapshot,
  input: { limit?: number; cursor?: string } = {},
): Promise<{
  messages: PublicMessage[];
  nextCursor: string | null;
  lanes: Record<string, SpectatorLane>;
}> {
  const limit = input.limit ?? WALL_MIX_PAGE_SIZE;
  const closed = isEventClosed(event.phase);
  const nowMs = new Date(event.serverNow).getTime();
  const salt = spectatorHourSalt(event.id, nowMs, closed, event.endsAt);
  const risingSort = feedSortForPhase(event.phase, "rising");

  const [rising, fresh, quiet, surprise] = await Promise.all([
    listMessages({
      eventId: event.id,
      sort: risingSort,
      limit: 36,
      endsAt: event.endsAt,
    }),
    listMessages({
      eventId: event.id,
      sort: "new",
      limit: 24,
      endsAt: event.endsAt,
    }),
    listMessages({
      eventId: event.id,
      sort: "gems",
      limit: 16,
      endsAt: event.endsAt,
    }),
    pickRandomMessages({
      eventId: event.id,
      count: 8,
      random: spectatorRng(salt),
    }),
  ]);

  const woven = weaveSpectatorFeed({
    rising: rising.messages.map((message) => publicMessageForPhase(message, event.phase)),
    fresh: fresh.messages.map((message) => publicMessageForPhase(message, event.phase)),
    quiet: quiet.messages.map((message) => publicMessageForPhase(message, event.phase)),
    surprise: surprise.messages.map((message) => publicMessageForPhase(message, event.phase)),
  });
  const page = pageWindow(woven, input.cursor, limit);
  return {
    messages: page.items.map(({ lane: _lane, ...message }) => message),
    nextCursor: page.nextCursor,
    lanes: lanesFromCards(page.items),
  };
}

export async function loadVictorRace(event: EventSnapshot): Promise<VictorRaceLeader[]> {
  if (event.phase !== "live") return [];
  try {
    const { messages } = await listMessages({
      eventId: event.id,
      sort: "hot",
      limit: 3,
      endsAt: event.endsAt,
    });
    return messages.map((message) => ({
      publicNumber: message.publicNumber,
      text: message.text,
      isRemoved: message.isRemoved,
      reactionCount: message.reactionCount,
      publishedAt: message.publishedAt,
    }));
  } catch {
    return [];
  }
}

export async function loadEditionMonument(event: EventSnapshot) {
  if (event.phase !== "archived") return null;
  try {
    return await loadMonumentForEdition(editionNumberOf(event));
  } catch {
    return null;
  }
}

/** Hottest real sentences for the homepage. Does not change /wall rising order. */
export async function loadLandingWitness(event: EventSnapshot): Promise<PublicMessage[]> {
  try {
    const { messages } = await listMessages({
      eventId: event.id,
      sort: "hot",
      limit: 24,
      endsAt: event.endsAt,
    });
    return selectWitnessSentences(
      messages.map((message) => publicMessageForPhase(message, event.phase)),
    );
  } catch {
    return [];
  }
}
