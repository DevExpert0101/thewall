import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import { SiteShell } from "@/components/site-shell";

vi.mock("next/navigation", () => ({
  usePathname: () => "/wall",
}));

describe("SiteShell browsing", () => {
  it("does not create an anonymous session while the visitor only reads", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    render(
      <SiteShell>
        <p>The wall</p>
      </SiteShell>,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("points readers to how the monument works", () => {
    const { getByRole } = render(
      <SiteShell>
        <p>The wall</p>
      </SiteShell>,
    );
    expect(getByRole("link", { name: /how it works/i })).toHaveAttribute("href", "/how-it-works");
  });
});
