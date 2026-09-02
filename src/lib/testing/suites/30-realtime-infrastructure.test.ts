import { afterEach, describe, expect, it } from "vitest";
import { currentSimulatedEvent, listSimulatedMessages, simulatedMessageList } from "@/lib/data/simulation";
import { compareRising } from "@/lib/ranking";
import {
  addReactions,
  openShortLiveWall,
  payAndPublish,
  reactOnce,
  resetAutomatedWall,
} from "@/lib/testing/harness";
import { WALL_COUNT_PULSE_MS, WALL_PAGE_SIZE, WALL_PULSE_MS } from "@/lib/wall/constants";
import { applyReactionCounts, mergeArrival } from "@/lib/wall/feed";
import { WALL_READER_SUBSCRIBES_TO_POSTGRES } from "@/lib/wall/realtime";
import type { PublicMessage } from "@/lib/types";

afterEach(() => {
  resetAutomatedWall();
});

type Beat = {
  totalMessages: number;
  totalReactions: number;
  latestPublicNumber: number;
  counts: Record<string, number>;
  phase: "live" | "finalizing" | "archived" | "upcoming";
};

type SpectatorReport = {
  id: number;
  numbers: number[];
  counts: Record<string, number>;
  totals: { messages: number; reactions: number };
  liveLink: "ok" | "paused";
  missedNumbers: number[];
};

/** Mirrors WallLive beat / ingest / count-sync without a browser. */
class PulseSpectator {
  feed: PublicMessage[] = [];
  totals = { messages: 0, reactions: 0 };
  liveLink: "ok" | "paused" = "ok";
  fails = 0;
  hidden = false;
  closed = false;

  constructor(readonly id: number) {}

  snapshotFromServer() {
    const event = currentSimulatedEvent();
    const page = listSimulatedMessages({ sort: "new", limit: WALL_PAGE_SIZE });
    this.feed = page.messages;
    this.totals = { messages: event.totalMessages, reactions: event.totalReactions };
    this.liveLink = "ok";
    this.fails = 0;
    this.closed = event.phase !== "live";
  }

  refresh() {
    this.snapshotFromServer();
  }

  reconnect() {
    this.feed = [];
    this.totals = { messages: 0, reactions: 0 };
    this.fails = 0;
    this.liveLink = "ok";
    this.beat();
  }

  private maxLocal() {
    return this.feed.reduce((max, row) => Math.max(max, row.publicNumber), 0);
  }

  applyBeat(data: Beat) {
    if (this.closed) return;
    this.totals = { messages: data.totalMessages, reactions: data.totalReactions };
    this.feed = applyReactionCounts(this.feed, data.counts);
  }

  ingest(incoming: PublicMessage[]) {
    if (this.closed) return;
    const maxLocal = this.maxLocal();
    const fresh = incoming.filter((row) => row.publicNumber > maxLocal);
    this.feed = fresh.reduce((acc, row) => mergeArrival(acc, row), this.feed);
  }

  beat(opts?: { fail?: boolean; dropFetch?: boolean }) {
    if (this.hidden) return;
    if (opts?.fail) {
      this.fails += 1;
      if (this.fails >= 2) this.liveLink = "paused";
      return;
    }
    const event = currentSimulatedEvent();
    const latest = event.totalMessages;
    const beat: Beat = {
      totalMessages: event.totalMessages,
      totalReactions: event.totalReactions,
      latestPublicNumber: latest,
      counts: Object.fromEntries(this.feed.map((row) => [row.id, row.reactionCount])),
      phase: event.phase,
    };
    this.fails = 0;
    this.liveLink = "ok";
    this.applyBeat(beat);
    if (opts?.dropFetch) return;
    if (latest > this.maxLocal()) {
      const page = listSimulatedMessages({ sort: "new", limit: WALL_PAGE_SIZE });
      this.ingest(page.messages);
    }
  }

  syncCounts() {
    if (this.hidden) return;
    const ledger = new Map(simulatedMessageList().map((row) => [row.id, row.reactionCount]));
    const counts: Record<string, number> = {};
    for (const row of this.feed) {
      const live = ledger.get(row.id);
      if (typeof live === "number") counts[row.id] = live;
    }
    const event = currentSimulatedEvent();
    this.applyBeat({
      totalMessages: event.totalMessages,
      totalReactions: event.totalReactions,
      latestPublicNumber: event.totalMessages,
      counts,
      phase: event.phase,
    });
  }

  applyStaleBeat(data: Beat) {
    this.applyBeat(data);
  }

  report(ledgerNumbers: number[]): SpectatorReport {
    const have = new Set(this.feed.map((row) => row.publicNumber));
    return {
      id: this.id,
      numbers: this.feed.map((row) => row.publicNumber),
      counts: Object.fromEntries(this.feed.map((row) => [row.id, row.reactionCount])),
      totals: { ...this.totals },
      liveLink: this.liveLink,
      missedNumbers: ledgerNumbers.filter((n) => !have.has(n)),
    };
  }
}

function crowd(size: number): PulseSpectator[] {
  return Array.from({ length: size }, (_, index) => new PulseSpectator(index));
}

function ledgerNumbers() {
  return simulatedMessageList().map((row) => row.publicNumber).sort((a, b) => a - b);
}

function risingTop(limit = 6) {
  return listSimulatedMessages({ sort: "rising", limit, finalized: false }).messages.map(
    (row) => row.publicNumber,
  );
}

describe("suite 30 — realtime infrastructure", () => {
  it("does not open a reader WebSocket or postgres_changes channel", () => {
    expect(WALL_READER_SUBSCRIBES_TO_POSTGRES).toBe(false);
    expect(WALL_PULSE_MS).toBe(8_000);
    expect(WALL_COUNT_PULSE_MS).toBe(16_000);
    expect(WALL_PAGE_SIZE).toBe(12);
  });

  it.each([10, 100, 1_000])(
    "shows a new message, number, and zero 🔥 to %s concurrent clients",
    (size) => {
      openShortLiveWall();
      const clients = crowd(size);
      for (const client of clients) client.snapshotFromServer();

      const published = payAndPublish("Realtime landing sentence.");
      const event = currentSimulatedEvent();
      expect(event.totalMessages).toBe(19);
      expect(published.publicNumber).toBe(19);

      for (const client of clients) client.beat();

      const reports = clients.map((client) => client.report(ledgerNumbers()));
      expect(reports.every((row) => row.numbers.includes(19))).toBe(true);
      expect(new Set(reports.map((row) => row.totals.messages)).size).toBe(1);
      expect(reports[0]?.totals.messages).toBe(19);
      const counts = reports.map((row) => {
        const id = simulatedMessageList().find((m) => m.publicNumber === 19)?.id ?? "";
        return row.counts[id];
      });
      expect(new Set(counts)).toEqual(new Set([0]));
      expect(reports.every((row) => row.missedNumbers.length === 0 || row.numbers.includes(19))).toBe(
        true,
      );
    },
  );

  it.each([10, 100, 1_000])(
    "fans a reaction out to %s clients with one consistent count",
    (size) => {
      openShortLiveWall();
      const published = payAndPublish("Count fanout sentence.");
      const clients = crowd(size);
      for (const client of clients) client.snapshotFromServer();

      const count = addReactions(published.messageId, 7);
      expect(count).toBe(7);
      expect(currentSimulatedEvent().totalReactions).toBeGreaterThanOrEqual(7);

      for (const client of clients) client.syncCounts();

      const seen = new Set(
        clients.map((client) => client.feed.find((row) => row.id === published.messageId)?.reactionCount),
      );
      expect(seen).toEqual(new Set([7]));
      expect(new Set(clients.map((client) => client.totals.reactions)).size).toBe(1);
    },
  );

  it("moves trending on the server after 🔥; pulse clients keep card order until refresh", () => {
    openShortLiveWall();
    const quiet = payAndPublish("Quiet realtime sentence.");
    const loud = payAndPublish("Loud realtime sentence.");
    addReactions(loud.messageId, 30);

    const server = risingTop(8);
    expect(server[0]).toBe(loud.publicNumber);
    expect(server).not.toContain(quiet.publicNumber);

    const client = new PulseSpectator(0);
    client.feed = [quiet, loud].map((mark) => ({
      id: mark.messageId,
      eventId: currentSimulatedEvent().id,
      publicNumber: mark.publicNumber,
      text: mark.text,
      isRemoved: false,
      reactionCount: 0,
      publishedAt: new Date().toISOString(),
      finalRank: null,
    }));
    client.syncCounts();
    expect(client.feed.map((row) => row.publicNumber)).toEqual([
      quiet.publicNumber,
      loud.publicNumber,
    ]);
    expect(client.feed[1]?.reactionCount).toBe(30);

    client.refresh();
    const after = listSimulatedMessages({ sort: "rising", limit: 8, finalized: false }).messages;
    expect(after[0]?.publicNumber).toBe(loud.publicNumber);
    expect(after[0]?.reactionCount).toBe(30);
  });

  it("reconnects, refresh, and a hidden tab recover without inventing numbers", () => {
    openShortLiveWall();
    const first = payAndPublish("Before disconnect.");
    const client = new PulseSpectator(0);
    client.snapshotFromServer();
    expect(client.feed.some((row) => row.publicNumber === first.publicNumber)).toBe(true);

    client.hidden = true;
    const during = payAndPublish("While the tab was hidden.");
    client.beat();
    expect(client.feed.some((row) => row.publicNumber === during.publicNumber)).toBe(false);

    client.hidden = false;
    client.beat();
    expect(client.feed.some((row) => row.publicNumber === during.publicNumber)).toBe(true);

    const afterRefresh = payAndPublish("After a browser refresh.");
    client.refresh();
    expect(client.feed.some((row) => row.publicNumber === afterRefresh.publicNumber)).toBe(true);
    expect(client.totals.messages).toBe(currentSimulatedEvent().totalMessages);

    client.feed = [];
    client.reconnect();
    expect(client.feed.some((row) => row.publicNumber === afterRefresh.publicNumber)).toBe(true);
    expect(new Set(simulatedMessageList().map((row) => row.publicNumber)).size).toBe(
      simulatedMessageList().length,
    );
  });

  it("treats two failed beats as a paused live link, then recovers", () => {
    openShortLiveWall();
    const client = new PulseSpectator(0);
    client.snapshotFromServer();
    client.beat({ fail: true });
    expect(client.liveLink).toBe("ok");
    client.beat({ fail: true });
    expect(client.liveLink).toBe("paused");
    expect(currentSimulatedEvent().totalMessages).toBe(18);
    client.beat();
    expect(client.liveLink).toBe("ok");
  });

  it("drops duplicate arrivals and ignores an older 🔥 pulse on a card", () => {
    openShortLiveWall();
    const mark = payAndPublish("Idempotent arrival.");
    const client = new PulseSpectator(0);
    client.snapshotFromServer();
    const row = simulatedMessageList().find((item) => item.id === mark.messageId);
    expect(row).toBeDefined();
    if (!row) return;
    const before = client.feed.length;
    client.ingest([row, row, { ...row, reactionCount: 99 }]);
    expect(client.feed.filter((item) => item.id === mark.messageId)).toHaveLength(1);
    expect(client.feed.length).toBe(before);

    addReactions(mark.messageId, 4);
    client.syncCounts();
    expect(client.feed.find((item) => item.id === mark.messageId)?.reactionCount).toBe(4);
    client.feed = applyReactionCounts(client.feed, { [mark.messageId]: 1 });
    expect(client.feed.find((item) => item.id === mark.messageId)?.reactionCount).toBe(4);
  });

  it("can roll header totals backward on a stale beat while card 🔥 stay high", () => {
    openShortLiveWall();
    const mark = payAndPublish("Stale total sentence.");
    addReactions(mark.messageId, 5);
    const client = new PulseSpectator(0);
    client.snapshotFromServer();
    expect(client.totals.reactions).toBe(currentSimulatedEvent().totalReactions);
    const card = client.feed.find((row) => row.id === mark.messageId);
    expect(card?.reactionCount).toBe(5);

    client.applyStaleBeat({
      totalMessages: 18,
      totalReactions: 0,
      latestPublicNumber: 18,
      counts: { [mark.messageId]: 1 },
      phase: "live",
    });
    expect(client.totals.messages).toBe(18);
    expect(client.totals.reactions).toBe(0);
    expect(client.feed.find((row) => row.id === mark.messageId)?.reactionCount).toBe(5);
    expect(currentSimulatedEvent().totalMessages).toBe(19);
    expect(currentSimulatedEvent().totalReactions).toBeGreaterThanOrEqual(5);
  });

  it("misses the middle of a burst larger than one New page until refresh", () => {
    openShortLiveWall();
    const client = new PulseSpectator(0);
    client.snapshotFromServer();
    const marks = Array.from({ length: 20 }, (_, index) =>
      payAndPublish(`Burst landing ${index}.`),
    );
    expect(marks).toHaveLength(20);
    client.beat();
    const have = new Set(client.feed.map((row) => row.publicNumber));
    const extras = marks.map((row) => row.publicNumber);
    const seenExtras = extras.filter((n) => have.has(n));
    const missedExtras = extras.filter((n) => !have.has(n));
    expect(seenExtras.length).toBe(WALL_PAGE_SIZE);
    expect(Math.min(...seenExtras)).toBe(27);
    expect(missedExtras).toEqual(Array.from({ length: 8 }, (_, i) => 19 + i));
    expect(currentSimulatedEvent().totalMessages).toBe(38);
    expect(new Set(ledgerNumbers()).size).toBe(38);

    client.refresh();
    const after = new Set(client.feed.map((row) => row.publicNumber));
    expect(extras.filter((n) => after.has(n)).length).toBe(WALL_PAGE_SIZE);
    const full = new Set(simulatedMessageList().map((row) => row.publicNumber));
    expect(full.size).toBe(38);
  });

  it("ignores arrivals after close; the ledger does not shrink", () => {
    openShortLiveWall();
    const mark = payAndPublish("Last live sentence.");
    const client = new PulseSpectator(0);
    client.snapshotFromServer();
    client.closed = true;
    const ghost: PublicMessage = {
      id: "00000000-0000-4000-8000-000000009999",
      eventId: currentSimulatedEvent().id,
      publicNumber: 99,
      text: "Ghost pulse after close.",
      isRemoved: false,
      reactionCount: 0,
      publishedAt: new Date().toISOString(),
      finalRank: null,
    };
    client.ingest([ghost]);
    client.applyBeat({
      totalMessages: 99,
      totalReactions: 200,
      latestPublicNumber: 99,
      counts: {},
      phase: "live",
    });
    expect(client.feed.some((row) => row.publicNumber === 99)).toBe(false);
    expect(client.feed.some((row) => row.publicNumber === mark.publicNumber)).toBe(true);
    expect(simulatedMessageList().some((row) => row.publicNumber === 99)).toBe(false);
  });

  it("keeps rising order deterministic for the same snapshot", () => {
    openShortLiveWall();
    const a = payAndPublish("Rising A.");
    const b = payAndPublish("Rising B.");
    addReactions(a.messageId, 4);
    addReactions(b.messageId, 4);
    const now = new Date();
    const rows = simulatedMessageList().filter((row) => row.publicNumber >= 19);
    const left = [...rows].sort((x, y) =>
      compareRising(
        { ...x, hourCount: x.reactionCount, hourMinutes: x.reactionCount, publishedAt: x.publishedAt },
        { ...y, hourCount: y.reactionCount, hourMinutes: y.reactionCount, publishedAt: y.publishedAt },
        now,
      ),
    );
    const right = [...rows].sort((x, y) =>
      compareRising(
        { ...x, hourCount: x.reactionCount, hourMinutes: x.reactionCount, publishedAt: x.publishedAt },
        { ...y, hourCount: y.reactionCount, hourMinutes: y.reactionCount, publishedAt: y.publishedAt },
        now,
      ),
    );
    expect(left.map((row) => row.publicNumber)).toEqual(right.map((row) => row.publicNumber));
    const first = reactOnce(a.messageId, "local-sim-same-reactor");
    expect(() => reactOnce(a.messageId, "local-sim-same-reactor")).toThrow(/Already reacted/);
    expect(
      simulatedMessageList().find((row) => row.id === a.messageId)?.reactionCount,
    ).toBe(first);
  });
});
