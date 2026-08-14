import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PublishDialog } from "@/components/publish-dialog";

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

function json(body: unknown, status = 200) {
  return Promise.resolve(
    new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    }),
  );
}

const INTENT_ID = "11111111-1111-1111-1111-111111111111";

beforeEach(() => {
  initiateBasePayment.mockClear();
  vi.stubEnv("NEXT_PUBLIC_TURNSTILE_SITE_KEY", "1x00000000000000000000AA");
  sessionStorage.clear();
  vi.stubGlobal(
    "fetch",
    vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/analytics")) return json({ ok: true });
      if (url.includes("/api/publish/preflight")) {
        return json({ text: "I was here.", moderationStatus: "approved" });
      }
      if (url.includes("/api/publish/intent")) {
        return json({
          intentId: INTENT_ID,
          wallKey: "7K9P-X4MF-82QH-K3R2",
          amount: "1.00",
          recipient: "0x1111111111111111111111111111111111111111",
          network: "base-sepolia",
          expiresAt: new Date(Date.now() + 60_000).toISOString(),
        });
      }
      if (url.includes("/api/publish/verify")) {
        return json({
          publicNumber: 4291,
          messageId: "00000000-0000-4000-8000-000000000001",
          publishedAt: new Date().toISOString(),
        });
      }
      return json({ error: "not found" }, 404);
    }),
  );
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

const clock = {
  endsAt: "2026-08-13T18:00:00.000Z",
  serverNow: "2026-08-13T00:17:51.000Z",
};

describe("publish dialog", () => {
  it("walks write → preview before payment", async () => {
    const user = userEvent.setup();
    render(
      <PublishDialog open onOpenChange={() => undefined} enabled {...clock} />,
    );
    const preview = await screen.findByRole("button", { name: /^preview$/i });
    await user.type(screen.getByLabelText(/your sentence/i), "I was here.");
    await user.click(preview);
    expect(await screen.findByText(/this is the sentence/i)).toBeInTheDocument();
    expect(screen.getByText(/“I was here.”/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /pay 1\.00 usdc/i })).not.toBeInTheDocument();
  });

  it("returns to write with recovery when preflight rejects the sentence", async () => {
    const user = userEvent.setup();
    vi.mocked(fetch).mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/publish/preflight")) {
        return json(
          {
            error: "This message cannot be published.",
            code: "MODERATION_REJECTED",
            recovery: "Revise the text — you have not been charged.",
          },
          422,
        );
      }
      return json({ ok: true });
    });
    render(
      <PublishDialog open onOpenChange={() => undefined} enabled {...clock} />,
    );
    await screen.findByRole("button", { name: /^preview$/i });
    await user.type(screen.getByLabelText(/your sentence/i), "spam spam spam");
    await user.click(screen.getByRole("button", { name: /^preview$/i }));
    await user.click(await screen.findByRole("button", { name: /^continue$/i }));
    expect(await screen.findByText(/you have not been charged/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/your sentence/i)).toBeInTheDocument();
  });

  it("skips the wallet when checkout is simulated", async () => {
    vi.mocked(fetch).mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/analytics")) return json({ ok: true });
      if (url.includes("/api/publish/preflight")) {
        return json({ text: "I was here.", moderationStatus: "approved" });
      }
      if (url.includes("/api/publish/intent")) {
        return json({
          intentId: INTENT_ID,
          wallKey: "7K9P-X4MF-82QH-K3R2",
          amount: "1.00",
          recipient: "0x1111111111111111111111111111111111111111",
          network: "base-sepolia",
          expiresAt: new Date(Date.now() + 60_000).toISOString(),
          simulated: true,
          simulatedPaymentId: `0x${"cd".repeat(32)}`,
        });
      }
      if (url.includes("/api/publish/verify")) {
        return json({
          publicNumber: 19,
          messageId: "00000000-0000-4000-8000-000000000013",
          publishedAt: new Date().toISOString(),
        });
      }
      return json({ error: "not found" }, 404);
    });
    const user = userEvent.setup();
    render(
      <PublishDialog open onOpenChange={() => undefined} enabled {...clock} />,
    );
    await screen.findByRole("button", { name: /^preview$/i });
    await user.type(screen.getByLabelText(/your sentence/i), "I was here.");
    await user.click(screen.getByRole("button", { name: /^preview$/i }));
    await user.click(await screen.findByRole("button", { name: /^continue$/i }));
    await user.click(await screen.findByRole("button", { name: /pass-challenge/i }));
    await user.click(await screen.findByRole("button", { name: /^continue$/i }));
    await user.click(await screen.findByRole("button", { name: /i saved my wall key/i }));
    expect(screen.getByText(/simulation — no usdc leaves a wallet/i)).toBeInTheDocument();
    await user.click(await screen.findByRole("button", { name: /pay 1\.00 usdc/i }));
    expect(await screen.findByText("YOU ARE ON THE WALL.")).toBeInTheDocument();
    expect(initiateBasePayment).not.toHaveBeenCalled();
    const verifyCall = vi.mocked(fetch).mock.calls.find(([url]) => String(url).includes("/api/publish/verify"));
    expect(verifyCall?.[1]).toEqual(
      expect.objectContaining({
        body: JSON.stringify({
          intentId: INTENT_ID,
          transactionHash: `0x${"cd".repeat(32)}`,
        }),
      }),
    );
  });

  it("celebrates a unique number and offers share after verification", async () => {
    const user = userEvent.setup();
    render(
      <PublishDialog open onOpenChange={() => undefined} enabled {...clock} />,
    );
    await screen.findByRole("button", { name: /^preview$/i });
    await user.type(screen.getByLabelText(/your sentence/i), "I was here.");
    await user.click(screen.getByRole("button", { name: /^preview$/i }));
    await user.click(await screen.findByRole("button", { name: /^continue$/i }));
    await user.click(await screen.findByRole("button", { name: /pass-challenge/i }));
    await user.click(await screen.findByRole("button", { name: /^continue$/i }));
    expect(await screen.findByText("7K9P-X4MF-82QH-K3R2")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /save your wall key/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /pay 1\.00 usdc/i })).not.toBeInTheDocument();
    await user.click(await screen.findByRole("button", { name: /i saved my wall key/i }));
    await user.click(await screen.findByRole("button", { name: /pay 1\.00 usdc/i }));
    expect(await screen.findByText("YOU ARE ON THE WALL.")).toBeInTheDocument();
    expect(screen.getByText((_, node) => (node?.textContent ?? "").replace(/\s+/g, " ").trim() === "MESSAGE #004291")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /share your message/i })).toBeInTheDocument();
    expect(screen.queryByText(/connect wallet/i)).not.toBeInTheDocument();
    await waitFor(() => {
      expect(vi.mocked(fetch).mock.calls.some(([url]) => String(url).includes("/api/publish/verify"))).toBe(
        true,
      );
    });
  });
});
