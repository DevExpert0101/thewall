import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ClaimForm } from "@/components/claim-form";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("claim form", () => {
  it("asks for a Wall Key and never a wallet sign-in", () => {
    render(
      <ClaimForm
        publicNumber={4291}
        phase="archived"
        finalRank={1}
        text="Call your mother."
      />,
    );
    expect(screen.getByText(/this message won/i)).toBeInTheDocument();
    expect(screen.getByText(/no account/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/7K9P-X4MF-82QH-K3R2/i)).toBeInTheDocument();
    expect(screen.getByText(/i lost my wall key/i)).toBeInTheDocument();
    expect(screen.getByText(/ownership cannot be recovered/i)).toBeInTheDocument();
    expect(screen.queryByText(/connect wallet/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/contact email/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/payout wallet/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/anonymous payout is not promised/i)).not.toBeInTheDocument();
  });

  it("asks for prize details only after a winning key is verified", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi.fn((input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes("/api/claim/challenge")) {
          return Promise.resolve(new Response(JSON.stringify({ ok: true }), { status: 200 }));
        }
        return Promise.resolve(
          new Response(JSON.stringify({ verified: true, won: true, nominated: false }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
        );
      }),
    );
    render(
      <ClaimForm
        publicNumber={4291}
        phase="archived"
        finalRank={1}
        text="Call your mother."
      />,
    );
    await user.type(screen.getByPlaceholderText(/7K9P-X4MF-82QH-K3R2/i), "7K9P-X4MF-82QH-K3R2");
    await user.click(screen.getByRole("button", { name: /verify ownership/i }));
    expect(await screen.findByRole("button", { name: /send claim/i })).toBeInTheDocument();
    expect(screen.getAllByText(/anonymous payout is not promised/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/contact email/i)).toBeInTheDocument();
    expect(screen.queryByPlaceholderText(/7K9P-X4MF-82QH-K3R2/i)).not.toBeInTheDocument();
    expect(JSON.stringify(vi.mocked(fetch).mock.calls)).not.toMatch(/payoutAddress|contactEmail/);
  });
});
