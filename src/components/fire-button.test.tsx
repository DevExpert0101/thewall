import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FireButton } from "@/components/fire-button";

vi.mock("@marsidev/react-turnstile", () => ({
  Turnstile: ({ onSuccess }: { onSuccess: (token: string) => void }) => (
    <button type="button" onClick={() => onSuccess("ok-token-ok-token")}>
      pass-challenge
    </button>
  ),
}));

afterEach(() => {
  window.localStorage.clear();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("optimistic reactions", () => {
  it("increments immediately and rolls back when the server refuses", async () => {
    const user = userEvent.setup();
    let finish: (value: Response) => void = () => undefined;
    vi.stubGlobal(
      "fetch",
      vi.fn(
        () =>
          new Promise<Response>((resolve) => {
            finish = resolve;
          }),
      ),
    );
    render(<FireButton messageId="00000000-0000-4000-8000-000000000001" count={4} />);
    await user.click(screen.getByRole("button", { name: /react with fire/i }));
    expect(screen.getByRole("button", { name: /react with fire/i })).toHaveTextContent("5");
    finish(
      new Response(JSON.stringify({ error: "Too fast", recovery: "Wait a moment." }), {
        status: 429,
        headers: { "Content-Type": "application/json" },
      }),
    );
    expect(await screen.findByText(/wait a moment/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /react with fire/i })).toHaveTextContent("4");
    vi.unstubAllGlobals();
  });

  it("keeps a higher local count when a stale pulse arrives", () => {
    const { rerender } = render(
      <FireButton messageId="00000000-0000-4000-8000-000000000001" count={7} />,
    );
    rerender(<FireButton messageId="00000000-0000-4000-8000-000000000001" count={6} />);
    expect(screen.getByRole("button", { name: /react with fire/i })).toHaveTextContent("7");
    rerender(<FireButton messageId="00000000-0000-4000-8000-000000000001" count={9} />);
    expect(screen.getByRole("button", { name: /react with fire/i })).toHaveTextContent("9");
  });

  it("renders a sealed count without a react control", () => {
    render(
      <FireButton
        messageId="00000000-0000-4000-8000-000000000001"
        count={19284921}
        readOnly
      />,
    );
    expect(screen.queryByRole("button", { name: /react with fire/i })).not.toBeInTheDocument();
    expect(screen.getByLabelText(/19,284,921 reactions/i)).toHaveTextContent("19,284,921");
  });

  it("lets a visitor react once, then locks the button", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          new Response(JSON.stringify({ reactionCount: 5 }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
        ),
      ),
    );
    render(<FireButton messageId="00000000-0000-4000-8000-000000000001" count={4} />);
    await user.click(screen.getByRole("button", { name: /react with fire/i }));
    expect(await screen.findByRole("button", { name: /already reacted/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /already reacted/i })).toHaveTextContent("5");
    await user.click(screen.getByRole("button", { name: /already reacted/i }));
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1);
  });

  it("shows a check only after the server escalates, then completes the 🔥", async () => {
    vi.stubEnv("NEXT_PUBLIC_TURNSTILE_SITE_KEY", "1x00000000000000000000AA");
    const user = userEvent.setup();
    const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      (_input, init) => {
        const body = JSON.parse(String(init?.body ?? "{}")) as { turnstileToken?: string };
        if (!body.turnstileToken) {
          return Promise.resolve(
            new Response(
              JSON.stringify({
                code: "TURNSTILE",
                error: "Check required",
                recovery: "Complete the check to keep reacting.",
              }),
              { status: 400, headers: { "Content-Type": "application/json" } },
            ),
          );
        }
        return Promise.resolve(
          new Response(JSON.stringify({ reactionCount: 6 }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
        );
      },
    );
    vi.stubGlobal("fetch", fetchMock);
    render(<FireButton messageId="00000000-0000-4000-8000-000000000001" count={5} />);
    await user.click(screen.getByRole("button", { name: /react with fire/i }));
    expect(await screen.findByText(/complete the check/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /react with fire/i })).toHaveTextContent("5");
    await user.click(screen.getByRole("button", { name: "pass-challenge" }));
    expect(await screen.findByRole("button", { name: /already reacted/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /already reacted/i })).toHaveTextContent("6");
    vi.unstubAllEnvs();
  });
});
