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
    expect(screen.getByRole("status")).toHaveTextContent(/off the wall/i);
    vi.unstubAllGlobals();
  });

  it("lets a visitor mark what the note is about without a native select", async () => {
    const user = userEvent.setup();
    render(<FeedbackForm />);
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    await user.click(screen.getByLabelText(/something broken/i));
    expect(screen.getByLabelText(/something broken/i)).toBeChecked();
  });
});
