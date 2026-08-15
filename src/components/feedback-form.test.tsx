import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FeedbackForm } from "@/components/feedback-form";

describe("visitor feedback", () => {
  it("posts a private note to the feedback route", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(() =>
      Promise.resolve(
        new Response(JSON.stringify({ ok: true }), {
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );
    vi.stubGlobal("fetch", fetchMock);
    render(<FeedbackForm />);
    await user.type(
      screen.getByLabelText(/your note/i),
      "The pay button did nothing on my phone.",
    );
    await user.click(screen.getByRole("button", { name: /send the note/i }));
    expect(fetchMock).toHaveBeenCalled();
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe("/api/feedback");
    expect(String(fetchMock.mock.calls[0]?.[1]?.body ?? "")).toMatch(/pay button/i);
    expect(await screen.findByText(/received/i)).toBeInTheDocument();
    vi.unstubAllGlobals();
  });
});
