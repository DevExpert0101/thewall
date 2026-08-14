import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TurnstileGate } from "@/components/turnstile-gate";

vi.mock("@marsidev/react-turnstile", () => ({
  Turnstile: ({
    onSuccess,
    onError,
  }: {
    onSuccess: (token: string) => void;
    onError?: () => void;
  }) => (
    <div>
      <button type="button" onClick={() => onSuccess("ok-token-ok-token")}>
        pass-challenge
      </button>
      <button type="button" onClick={() => onError?.()}>
        fail-challenge
      </button>
    </div>
  ),
}));

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("TurnstileGate", () => {
  it("passes a token through on success", async () => {
    vi.stubEnv("NEXT_PUBLIC_TURNSTILE_SITE_KEY", "1x00000000000000000000AA");
    const onToken = vi.fn();
    const user = userEvent.setup();
    render(<TurnstileGate onToken={onToken} />);
    await user.click(screen.getByRole("button", { name: "pass-challenge" }));
    expect(onToken).toHaveBeenCalledWith("ok-token-ok-token");
  });

  it("lets the visitor retry after a failed check and keeps a readable recovery", async () => {
    vi.stubEnv("NEXT_PUBLIC_TURNSTILE_SITE_KEY", "1x00000000000000000000AA");
    const onToken = vi.fn();
    const user = userEvent.setup();
    render(<TurnstileGate onToken={onToken} />);
    await user.click(screen.getByRole("button", { name: "fail-challenge" }));
    expect(onToken).toHaveBeenCalledWith(null);
    expect(screen.getByText(/keep reading the wall/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /retry check/i })).toBeInTheDocument();
  });

  it("explains that reading still works when the site key is missing", () => {
    vi.stubEnv("NEXT_PUBLIC_TURNSTILE_SITE_KEY", "");
    render(<TurnstileGate onToken={() => undefined} />);
    expect(screen.getByText(/still read the wall/i)).toBeInTheDocument();
  });
});
