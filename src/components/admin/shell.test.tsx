import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { AdminShell } from "@/components/admin/shell";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/admin",
}));

describe("admin shell", () => {
  it("gives each stewardship job its own place", () => {
    render(
      <AdminShell email="ops@example.com">
        <p>Overview body</p>
      </AdminShell>,
    );
    expect(screen.getAllByRole("navigation", { name: /stewardship/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("link", { name: /^overview$/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("link", { name: /this wall/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("link", { name: /moderation/i }).length).toBeGreaterThan(0);
    expect(screen.getByText("ops@example.com")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /sign out/i })).toBeInTheDocument();
  });
});
