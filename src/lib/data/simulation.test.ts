import { afterEach, describe, expect, it, vi } from "vitest";
import { createWallKey, hashWallKey } from "@/lib/crypto";
import {
  addSimulatedFeedback,
  addSimulatedReaction,
  closeSimulatedWall,
  createSimulatedIntent,
  currentSimulatedEvent,
  fulfillSimulatedPayment,
  getSimulatedArchive,
  getSimulatedMessage,
  getSimulatedEdition,
  listSimulatedEditions,
  listSimulatedFeedback,
  configureSimulatedWall,
  holdSimulatedWall,
  hurrySimulatedClock,
  listSimulatedMessages,
  startSimulatedWall,
  lookupSimulatedCertificate,
  publishSimulatedMark,
  reopenSimulatedWall,
  resetSimulationState,
  runFullSimulation,
  simulatedArchivedEvent,
  simulatedLiveEvent,
} from "@/lib/data/simulation";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { isArchiveSimulation, isSimulation } from "@/lib/env";

describe("live simulation", () => {
  afterEach(() => {
    resetSimulationState();
    vi.unstubAllEnvs();
  });
  it("opens a live 24-hour window with mock sentences", () => {
    const event = simulatedLiveEvent(new Date("2026-08-13T18:00:00Z"));
    expect(event.phase).toBe("live");
    expect(event.id).toBe("local");
    expect(event.totalMessages).toBeGreaterThan(0);
    expect(event.totalReactions).toBeGreaterThan(0);
    expect(new Date(event.startsAt).getTime()).toBeLessThan(Date.parse(event.serverNow));
    expect(new Date(event.endsAt).getTime()).toBeGreaterThan(Date.parse(event.serverNow));
  });

  it("sorts trending, hot, and new without fabricating a database", () => {
    const trending = listSimulatedMessages({ sort: "trending", limit: 6 }).messages;
    const hot = listSimulatedMessages({ sort: "hot", limit: 6 }).messages;
    const newest = listSimulatedMessages({ sort: "new", limit: 1 }).messages[0];
    expect(trending.length).toBe(6);
    expect(hot[0]?.reactionCount).toBeGreaterThanOrEqual(hot[1]?.reactionCount ?? 0);
    expect(newest?.publicNumber).toBe(18);
    const paged = listSimulatedMessages({ sort: "new", limit: 6 });
    expect(paged.nextCursor).toBe("6");
    const more = listSimulatedMessages({ sort: "new", limit: 6, cursor: paged.nextCursor ?? undefined });
    expect(more.messages[0]?.publicNumber).toBeLessThan(paged.messages.at(-1)?.publicNumber ?? 0);
    expect(more.nextCursor).toBe("12");
  });

  it("loads a simulated message by public number and redacts removed text", () => {
    const kept = getSimulatedMessage(4);
    expect(kept.text).toMatch(/fifty years/i);
    expect(kept.isRemoved).toBe(false);
    const removed = getSimulatedMessage(8);
    expect(removed.isRemoved).toBe(true);
    expect(removed.text).toBe("Message removed under archive policy.");
  });

  it("opens a frozen archive with final ranks and no further writes", () => {
    const now = new Date("2026-08-13T18:00:00Z");
    const event = simulatedArchivedEvent(now);
    expect(event.phase).toBe("archived");
    expect(event.id).toBe("local");
    expect(event.archivedAt).toBe(event.endsAt);
    expect(event.finalizedAt).toBe(event.endsAt);
    expect(Date.parse(event.endsAt)).toBeLessThan(now.getTime());
    expect(Date.parse(event.startsAt)).toBe(Date.parse(event.endsAt) - 24 * 60 * 60 * 1000);

    const listed = listSimulatedMessages({
      sort: "hot",
      limit: 48,
      finalized: true,
      now,
    }).messages;
    expect(listed.length).toBe(event.totalMessages);
    expect(listed.every((message) => message.finalRank !== null)).toBe(true);
    expect(listed[0]?.publicNumber).toBe(4);
    expect(listed[0]?.finalRank).toBe(1);
    expect(listed.map((message) => message.finalRank)).toEqual(
      listed.map((_, index) => index + 1),
    );
    for (const message of listed) {
      expect(Date.parse(message.publishedAt)).toBeLessThanOrEqual(Date.parse(event.endsAt));
    }
    const removed = listed.find((message) => message.publicNumber === 8);
    expect(removed?.isRemoved).toBe(true);
    expect(removed?.text).toBe("Message removed under archive policy.");
    expect(removed?.finalRank).toBeGreaterThan(0);
    expect(event.id).toBe(simulatedLiveEvent(now).id);
  });

  it("does not invent a previous Wall while the live mock is open", () => {
    const live = simulatedLiveEvent(new Date("2026-08-13T18:00:00Z"));
    expect(live.phase).toBe("live");
    expect(live.archivedAt).toBeNull();
    expect(listSimulatedEditions()).toEqual([]);
    expect(
      listSimulatedMessages({ sort: "hot", limit: 3 }).messages.every((message) => message.finalRank === null),
    ).toBe(true);
  });

  it("keeps each finished simulation as its own sealed edition", () => {
    closeSimulatedWall(new Date("2026-08-13T18:00:00Z"));
    expect(listSimulatedEditions()).toHaveLength(1);
    reopenSimulatedWall();
    expect(currentSimulatedEvent().phase).toBe("live");
    expect(listSimulatedEditions()).toHaveLength(1);
    expect(listSimulatedEditions()[0]?.editionNumber).toBe(1);
    publishSimulatedMark("Second day, same stone.");
    closeSimulatedWall(new Date("2026-08-14T18:00:00Z"));
    const editions = listSimulatedEditions();
    expect(editions).toHaveLength(2);
    expect(editions.map((edition) => edition.editionNumber)).toEqual([1, 2]);
    expect(editions[1]?.totalMessages).toBeGreaterThan(editions[0]?.totalMessages ?? 0);
    expect(getSimulatedEdition(1)?.messages.some((message) => message.publicNumber === 19)).toBe(false);
    expect(getSimulatedEdition(2)?.messages.some((message) => message.text.includes("Second day"))).toBe(true);
    reopenSimulatedWall();
    expect(currentSimulatedEvent().phase).toBe("live");
    expect(listSimulatedEditions()).toHaveLength(2);
  });

  it("seals this Wall as edition №001 with a canonical proof", () => {
    closeSimulatedWall(new Date("2026-08-13T18:00:00Z"));
    const editions = listSimulatedEditions();
    expect(editions).toHaveLength(1);
    expect(editions[0]?.editionNumber).toBe(1);
    expect(editions[0]?.winning?.publicNumber).toBe(4);
    expect(editions[0]?.archiveHash).toMatch(/^[0-9a-f]{64}$/);
    expect(editions[0]?.merkleRoot).toMatch(/^[0-9a-f]{64}$/);
    expect(editions.some((edition) => edition.editionNumber === 2)).toBe(false);
    const listed = listSimulatedMessages({ sort: "hot", limit: 48 }).messages;
    expect(listed[0]?.publicNumber).toBe(4);
    expect(listed.find((message) => message.publicNumber === 8)?.text).toBe(
      "Message removed under archive policy.",
    );
  });

  it("treats archive simulation as this Wall frozen, not a second event", () => {
    vi.stubEnv("NEXT_PUBLIC_SIMULATE_LIVE", "true");
    vi.stubEnv("NEXT_PUBLIC_SIMULATE_ARCHIVE", "true");
    expect(isArchiveSimulation()).toBe(true);
    const now = new Date("2026-08-13T18:00:00Z");
    expect(simulatedArchivedEvent(now).id).toBe(simulatedLiveEvent(now).id);
  });

  it("allows one simulated reaction per visitor per sentence", () => {
    const id = "00000000-0000-4000-8000-000000000001";
    const first = addSimulatedReaction(id, "tester-once");
    expect(first).toBeGreaterThan(0);
    try {
      addSimulatedReaction(id, "tester-once");
      throw new Error("expected duplicate");
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      expect((error as AppError).code).toBe(ERROR_CODES.DUPLICATE_REACTION);
    }
    expect(addSimulatedReaction(id, "tester-other")).toBe(first + 1);
  });

  it("publishes a simulated payment and opens the certificate after the clock", () => {
    const wallKey = createWallKey();
    const checkout = createSimulatedIntent({
      text: "I left this in the local chamber.",
      userId: "local-sim",
      claimSecretHash: hashWallKey(wallKey),
    });
    const published = fulfillSimulatedPayment({
      intentId: checkout.intentId,
      userId: "local-sim",
      paymentId: checkout.simulatedPaymentId,
    });
    expect(published.publicNumber).toBe(19);
    expect(getSimulatedMessage(19).text).toMatch(/local chamber/i);
    expect(listSimulatedMessages({ sort: "new", limit: 1 }).messages[0]?.publicNumber).toBe(19);

    closeSimulatedWall();
    expect(currentSimulatedEvent().phase).toBe("archived");
    const ledger = getSimulatedArchive();
    expect(ledger?.event.phase).toBe("archived");
    expect(ledger?.messages.some((message) => message.publicNumber === 19)).toBe(true);
    expect(ledger?.messages.every((message) => message.finalRank !== null)).toBe(true);
    expect(
      listSimulatedMessages({ sort: "hot", limit: 48 }).messages.some((message) => message.publicNumber === 19),
    ).toBe(true);
    const frozen = getSimulatedMessage(19);
    expect(frozen.finalRank).toBeGreaterThan(0);
    const certificate = lookupSimulatedCertificate(wallKey);
    expect(certificate?.publicNumber).toBe(19);
    expect(certificate?.text).toMatch(/local chamber/i);
    expect(certificate?.finalRank).toBe(frozen.finalRank);
    expect(lookupSimulatedCertificate("7K9P-X4MF-82QH-K3R2")).toBeNull();
  });

  it("runs countdown, payment, fire, and finish in one local loop", () => {
    const loop = runFullSimulation();
    expect(loop.publicNumber).toBe(19);
    expect(getSimulatedMessage(19).text).toMatch(/paid a dollar/i);
    expect(currentSimulatedEvent().phase).toBe("live");
    const remaining = Date.parse(currentSimulatedEvent().endsAt) - Date.now();
    expect(remaining).toBeGreaterThan(8 * 60 * 1000);
    expect(remaining).toBeLessThan(11 * 60 * 1000);
    expect(currentSimulatedEvent().totalReactions).toBeGreaterThan(401);
    expect(loop.fires).toBe(4);

    closeSimulatedWall();
    expect(currentSimulatedEvent().phase).toBe("archived");
    expect(getSimulatedArchive()?.messages.some((message) => message.publicNumber === 19)).toBe(true);
  });

  it("hurries the clock and publishes a paid sentence without a wallet", () => {
    const endsAt = hurrySimulatedClock(45_000);
    expect(Date.parse(endsAt) - Date.now()).toBeLessThan(50_000);
    const paid = publishSimulatedMark();
    expect(paid.publicNumber).toBe(19);
    expect(paid.wallKey.length).toBeGreaterThan(8);
  });

  it("stores visitor notes off the public wall", () => {
    addSimulatedFeedback({
      body: "The type is too small on my phone.",
      category: "product",
      email: "reader@example.com",
    });
    const notes = listSimulatedFeedback();
    expect(notes).toHaveLength(1);
    expect(notes[0]?.body).toMatch(/too small/i);
    expect(notes[0]?.email).toBe("reader@example.com");
    const publicTexts = listSimulatedMessages({ sort: "new", limit: 40 }).messages.map((row) => row.text);
    expect(publicTexts.join("\n")).not.toMatch(/too small/i);
  });

  it("keeps the public wall blank until a steward starts the day", () => {
    const held = holdSimulatedWall();
    expect(held.phase).toBe("upcoming");
    expect(held.totalMessages).toBe(0);
    expect(listSimulatedMessages({ sort: "new", limit: 20 }).messages).toEqual([]);
    const opened = startSimulatedWall({ title: "OPENING DAY", durationMinutes: 30 });
    expect(opened.phase).toBe("live");
    expect(opened.title).toBe("OPENING DAY");
    expect(listSimulatedMessages({ sort: "new", limit: 20 }).messages.length).toBeGreaterThan(0);
  });

  it("seals an expired live day into the archive instead of dropping it", () => {
    startSimulatedWall({ title: "The first wall", durationMinutes: 5 });
    configureSimulatedWall({
      startsAt: "2026-08-15T01:00:00.000Z",
      endsAt: "2026-08-15T01:05:00.000Z",
    });
    const sealed = currentSimulatedEvent(new Date("2026-08-15T01:06:00.000Z"));
    expect(sealed.phase).toBe("archived");
    expect(sealed.title).toBe("The first wall");
    const editions = listSimulatedEditions();
    expect(editions).toHaveLength(1);
    expect(editions[0]?.title).toBe("The first wall");
  });

  it("lets stewardship set the title, duration, and remaining time", () => {
    configureSimulatedWall({ title: "THE WALL №007", durationMinutes: 5 });
    const named = currentSimulatedEvent();
    expect(named.title).toBe("THE WALL №007");
    expect(Date.parse(named.endsAt) - Date.parse(named.startsAt)).toBe(5 * 60_000);
    expect(named.phase).toBe("live");
    configureSimulatedWall({ remainingMinutes: 2 });
    const hurried = currentSimulatedEvent();
    expect(Date.parse(hurried.endsAt) - Date.now()).toBeLessThan(3 * 60_000);
    expect(hurried.title).toBe("THE WALL №007");
  });

  it("starts a new live day after a seal without dropping the library", () => {
    closeSimulatedWall();
    expect(currentSimulatedEvent().phase).toBe("archived");
    startSimulatedWall({ title: "THE NEXT DAY", durationMinutes: 15 });
    const next = currentSimulatedEvent();
    expect(next.phase).toBe("live");
    expect(next.title).toBe("THE NEXT DAY");
    expect(Date.parse(next.endsAt) - Date.parse(next.startsAt)).toBe(15 * 60_000);
    expect(listSimulatedEditions()).toHaveLength(1);
  });

  it("treats a missing Supabase config as simulation", () => {
    vi.stubEnv("NEXT_PUBLIC_SIMULATE_LIVE", "");
    vi.stubEnv("SIMULATE_LIVE", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "");
    expect(isSimulation()).toBe(true);
  });
});

describe("event cache policy", () => {
  it("does not treat finalizing as archived for long cache", async () => {
    const { cacheForPhase } = await import("@/lib/data/event");
    expect(cacheForPhase("finalizing")).not.toContain("3600");
  });
});
