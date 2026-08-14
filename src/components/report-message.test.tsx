import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ReportMessage } from "@/components/report-message";

vi.mock("@/lib/session-client", () => ({
  ensureAnonymousSession: () =>
    Promise.resolve({
      configured: true,
      present: true,
      restored: false,
      created: true,
    }),
}));

function json(body: unknown, status = 200) {
  return Promise.resolve(
    new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    }),
  );
}

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn((input: RequestInfo | URL) => {
      if (String(input).includes("/api/report")) return json({ ok: true });
      return json({ ok: true });
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("public report", () => {
  it("submits a private report from the message page", async () => {
    const user = userEvent.setup();
    render(<ReportMessage messageId="00000000-0000-4000-8000-000000000009" />);
    await user.click(screen.getByRole("button", { name: /report this sentence/i }));
    await user.selectOptions(screen.getByLabelText(/reason/i), "hate");
    await user.click(screen.getByRole("button", { name: /submit report/i }));
    expect(await screen.findByText(/report received/i)).toBeInTheDocument();
    expect(vi.mocked(fetch).mock.calls.some(([url, init]) => {
      return String(url).includes("/api/report") && String((init as RequestInit).body).includes("hate");
    })).toBe(true);
  });
});
