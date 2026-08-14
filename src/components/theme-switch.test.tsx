import { afterEach, describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeSwitch } from "@/components/theme-switch";
import { THEME_STORAGE_KEY } from "@/lib/design/theme";

afterEach(() => {
  localStorage.removeItem(THEME_STORAGE_KEY);
  document.documentElement.removeAttribute("data-theme");
});

describe("ThemeSwitch", () => {
  it("lists every theme and can switch to marble", async () => {
    const user = userEvent.setup();
    render(<ThemeSwitch />);
    await user.click(screen.getByRole("button", { name: /theme:/i }));
    expect(screen.getByRole("option", { name: /limestone/i })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /obsidian/i })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /patina/i })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /midnight/i })).toBeInTheDocument();
    await user.click(screen.getByRole("option", { name: /marble/i }));
    expect(document.documentElement.getAttribute("data-theme")).toBe("marble");
  });
});
