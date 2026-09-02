import { listSpectatorPage, loadVictorRace } from "@/lib/data/load";
import { listMessages, pickRandomMessages } from "@/lib/data/messages";
import { publicMessageForPhase } from "@/lib/event/state";
import { isLivingForVictor } from "@/lib/ranking";
import type { EventSnapshot, PublicMessage } from "@/lib/types";

export type LiveBoard = {
  leader: PublicMessage | null;
  rising: PublicMessage[];
  random: PublicMessage | null;
};

function asPublic(event: EventSnapshot, messages: PublicMessage[]): PublicMessage[] {
  return messages
    .filter(isLivingForVictor)
    .map((message) => publicMessageForPhase(message, event.phase));
}

export async function loadLiveBoard(event: EventSnapshot): Promise<LiveBoard> {
  try {
    const [race, risingPage, randomPick, hot] = await Promise.all([
      loadVictorRace(event),
      event.phase === "live"
        ? listSpectatorPage(event, { limit: 8 })
        : listMessages({
            eventId: event.id,
            sort: "hot",
            limit: 8,
            endsAt: event.endsAt,
          }),
      pickRandomMessages({ eventId: event.id, count: 2 }),
      listMessages({
        eventId: event.id,
        sort: "hot",
        limit: 8,
        endsAt: event.endsAt,
      }),
    ]);

    const hotPublic = asPublic(event, hot.messages);
    const sealed = hotPublic.find((message) => message.finalRank === 1) ?? null;
    const raceLeader = race[0]
      ? hotPublic.find((message) => message.publicNumber === race[0]?.publicNumber) ?? null
      : null;
    const leader = sealed ?? raceLeader ?? hotPublic[0] ?? null;

    const rising = asPublic(event, risingPage.messages)
      .filter((message) => message.id !== leader?.id)
      .slice(0, 4);

    const randomPool = asPublic(event, randomPick.messages);
    const random =
      randomPool.find((message) => message.id !== leader?.id) ?? randomPool[0] ?? null;

    return { leader, rising, random };
  } catch {
    return { leader: null, rising: [], random: null };
  }
}
