import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AdminWallDesk } from "@/components/admin/wall-desk";
import { FireButton } from "@/components/fire-button";
import { LandingHero } from "@/components/landing-hero";
import { applyAdminEventControl } from "@/lib/admin/event-control";
import { configPreviewFromEvent } from "@/lib/admin/data";
import { emptyAdminOps, type AdminOverview } from "@/lib/admin/types";
import { createWallKey, hashWallKey } from "@/lib/crypto";
import {
  addSimulatedReaction,
  createSimulatedIntent,
  currentSimulatedEvent,
  fulfillSimulatedPayment,
  listSimulatedEditions,
  simulatedMessageList,
  listSimulatedMonumentEntries,
  resetSimulationState,
} from "@/lib/data/simulation";
import { AppError } from "@/lib/errors";
import { monumentCanvasFromEnv } from "@/lib/monument/canvas";
import { listMonumentEntries } from "@/lib/monument/store";
import { preflightMessage } from "@/lib/publish/preflight";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/admin/wall",
}));

vi.mock("@/lib/session-client", () => ({
  ensureAnonymousSession: () =>
    Promise.resolve({
      configured: true,
      present: true,
      restored: false,
      created: true,
    }),
}));

vi.mock("@marsidev/react-turnstile", () => ({
  Turnstile: ({ onSuccess }: { onSuccess: (token: string) => void }) => (
    <button type="button" onClick={() => onSuccess("ok-token-ok-token")}>
      pass-challenge
    </button>
  ),
}));

const initiateBasePayment = vi.fn(() => Promise.resolve({ id: `0x${"ab".repeat(32)}` }));

vi.mock("@/lib/payment/browser", () => ({
  initiateBasePayment: () => initiateBasePayment(),
}));

const SENTENCE = "I left this mark on the operator-day wall.";
const VISITOR_ID = "local-sim-operator-day";

function json(body: unknown, status = 200) {
  return Promise.resolve(
    new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    }),
  );
}

function readBody(init?: RequestInit): Record<string, unknown> {
  if (!init?.body || typeof init.body !== "string") return {};
  return JSON.parse(init.body) as Record<string, unknown>;
}

function fail(error: unknown) {
  if (error instanceof AppError) {
    return json({ error: error.message, code: error.code, recovery: error.message }, error.status);
  }
  return json({ error: error instanceof Error ? error.message : "failed" }, 500);
}

function overviewFromSim(): AdminOverview {
  const event = currentSimulatedEvent();
  const config = configPreviewFromEvent(event);
  return {
    config,
    totals: {
      messages: event.totalMessages,
      reactions: event.totalReactions,
      usdc: event.totalMessages,
    },
    simulation: true,
    editions: [],
    feedback: [],
    claimAttempts: [],
    reactionSignals: [],
    recentFailures: [],
    openReports: [],
    flaggedMessages: [],
    reviewRanks: [],
    audit: [],
    health: {
      database: "configured",
      privilegedDb: "configured",
      payments: "configured",
      turnstile: "configured",
      network: event.network,
      eventStatus: event.phase,
      moderation: "rules-v1",
    },
    ops: emptyAdminOps(config),
    opsAudit: [],
  };
}

beforeEach(() => {
  resetSimulationState();
  initiateBasePayment.mockClear();
  vi.stubEnv("NEXT_PUBLIC_SIMULATE_LIVE", "true");
  vi.stubEnv("NEXT_PUBLIC_TURNSTILE_SITE_KEY", "1x00000000000000000000AA");
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const body = readBody(init);
      try {
        if (url.includes("/api/analytics")) return json({ ok: true });
        if (url.includes("/api/event")) return json(currentSimulatedEvent());
        if (url.includes("/api/monument")) return json(await listMonumentEntries());
        if (url.includes("/api/admin/stats")) return json(overviewFromSim());
        if (url.includes("/api/admin/event")) {
          const event = await applyAdminEventControl(body as Parameters<typeof applyAdminEventControl>[0]);
          return json({ event });
        }
        if (url.includes("/api/publish/preflight")) {
          const result = await preflightMessage(String(body.message ?? ""));
          return json(result);
        }
        if (url.includes("/api/publish/intent")) {
          const result = await preflightMessage(String(body.message ?? ""));
          const wallKey = createWallKey();
          const checkout = createSimulatedIntent({
            text: result.text,
            userId: VISITOR_ID,
            claimSecretHash: hashWallKey(wallKey),
          });
          return json({ ...checkout, wallKey });
        }
        if (url.includes("/api/publish/verify")) {
          return json(
            fulfillSimulatedPayment({
              intentId: String(body.intentId ?? ""),
              userId: VISITOR_ID,
              paymentId: String(body.transactionHash ?? ""),
            }),
          );
        }
        if (url.includes("/api/react")) {
          return json({
            reactionCount: addSimulatedReaction(String(body.messageId ?? ""), VISITOR_ID),
          });
        }
        return json({ error: "not found" }, 404);
      } catch (error) {
        return fail(error);
      }
    }),
  );
});

afterEach(() => {
  resetSimulationState();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("operator day through the hero stone", () => {
  it("types and clicks through configure, $1 publish, 🔥, and FINISH", async () => {
    const user = userEvent.setup();

    const admin = render(<AdminWallDesk initial={overviewFromSim()} />);
    const title = screen.getByLabelText(/^title$/i);
    await user.clear(title);
    await user.type(title, "THE WALL");
    await user.click(screen.getByRole("button", { name: /save this wall/i }));
    await waitFor(() => {
      expect(currentSimulatedEvent().phase).toBe("live");
      expect(currentSimulatedEvent().title).toBe("THE WALL");
    });
    admin.unmount();

    const hero = render(
      <LandingHero
        event={currentSimulatedEvent()}
        monument={{
          entries: [],
          sealedCount: 0,
          capacity: null,
          canvas: monumentCanvasFromEnv(),
        }}
      />,
    );
    await user.click(screen.getByRole("button", { name: /leave your mark/i }));
    await user.type(await screen.findByLabelText(/your sentence/i), SENTENCE);
    await user.click(screen.getByRole("button", { name: /^preview$/i }));
    await user.click(await screen.findByRole("button", { name: /^continue$/i }));
    await user.click(await screen.findByRole("button", { name: /pass-challenge/i }));
    await user.click(await screen.findByRole("button", { name: /^continue$/i }));
    expect(screen.getByText(/practice mode — no money is taken/i)).toBeInTheDocument();
    await user.click(await screen.findByLabelText(/i saved my wall key/i));
    await user.click(screen.getByRole("button", { name: /pay \$1/i }));
    expect(await screen.findByText("YOU ARE ON THE WALL.")).toBeInTheDocument();
    expect(initiateBasePayment).not.toHaveBeenCalled();
    hero.unmount();

    const published = simulatedMessageList().find((row) => row.text === SENTENCE);
    expect(published?.text).toBe(SENTENCE);
    if (!published) throw new Error("published sentence missing from the live wall");

    const fire = render(<FireButton messageId={published.id} count={published.reactionCount} />);
    await user.click(screen.getByRole("button", { name: /react with fire/i }));
    expect(await screen.findByRole("button", { name: /already reacted with fire/i })).toHaveTextContent(
      String(published.reactionCount + 1),
    );
    fire.unmount();

    let fires = published.reactionCount + 1;
    for (let i = 0; i < 69; i += 1) {
      fires = addSimulatedReaction(published.id, `local-sim-operator-fire-${i}`);
    }
    expect(fires).toBeGreaterThan(67);
    expect(currentSimulatedEvent().phase).toBe("live");
    expect(listSimulatedMonumentEntries()).toHaveLength(0);

    const review = render(<AdminWallDesk initial={overviewFromSim()} />);
    await user.click(screen.getByRole("button", { name: /close for review/i }));
    await waitFor(() => {
      expect(currentSimulatedEvent().phase).toBe("finalizing");
    });
    expect(listSimulatedEditions()).toHaveLength(0);
    expect(listSimulatedMonumentEntries()).toHaveLength(0);
    await user.click(await screen.findByRole("button", { name: /finish this wall/i }));
    await user.type(screen.getByLabelText(/type finish/i), "FINISH");
    await user.click(screen.getByRole("button", { name: /disclose results/i }));
    await waitFor(() => {
      expect(currentSimulatedEvent().phase).toBe("archived");
    });
    review.unmount();

    const editions = listSimulatedEditions();
    expect(editions).toHaveLength(1);
    expect(editions[0]?.archiveHash).toMatch(/^[0-9a-f]{64}$/);

    const monument = listSimulatedMonumentEntries();
    expect(monument).toHaveLength(1);
    expect(monument[0]?.text).toBe(SENTENCE);
    expect(monument[0]?.sentenceSnapshot).toBe(SENTENCE);
    expect(monument[0]?.originalPublicNumber).toBe(published.publicNumber);
    expect(monument[0]?.monumentNumber).toBe(1);

    const { container } = render(
      <LandingHero
        event={currentSimulatedEvent()}
        monument={{
          entries: monument,
          sealedCount: monument.length,
          capacity: null,
          canvas: monumentCanvasFromEnv(),
        }}
      />,
    );
    expect(screen.getByText(/the wall №001 has closed/i)).toBeInTheDocument();
    expect(document.querySelector("source")?.getAttribute("src")).toBe("/hero-wall.mp4");
    container.querySelector("video")?.dispatchEvent(new Event("ended"));
    await waitFor(() => {
      expect(screen.getByText(SENTENCE)).toBeInTheDocument();
    });
    expect(document.querySelectorAll(".monument-sentence")).toHaveLength(1);
    expect(document.querySelector("a.monument-sentence")).toBeNull();
    expect(document.querySelector(".hero-stone")).toBeTruthy();
  });
});
