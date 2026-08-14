import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AdminLoginForm } from "@/components/admin/login-form";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

describe("admin login", () => {
  it("posts credentials to the server login route, not a public secret bundle", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(() =>
      Promise.resolve(
        new Response(JSON.stringify({ email: "ops@example.com" }), {
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );
    vi.stubGlobal("fetch", fetchMock);
    render(<AdminLoginForm />);
    await user.type(screen.getByLabelText(/email/i), "ops@example.com");
    await user.type(screen.getByLabelText(/password/i), "not-a-real-password");
    await user.click(screen.getByRole("button", { name: /enter/i }));
    expect(fetchMock).toHaveBeenCalled();
    expect(fetchMock.mock.calls[0]?.[0]).toBe("/api/admin/login");
    expect(String(fetchMock.mock.calls[0]?.[1]?.body ?? "")).not.toMatch(/SERVICE_ROLE|eyJ/);
    vi.unstubAllGlobals();
  });
});
