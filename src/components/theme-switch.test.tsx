import { afterEach, describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeSwitch } from "@/components/theme-switch";
import { THEME_STORAGE_KEY } from "@/lib/design/theme";

afterEach(() => {
  localStorage.removeItem(THEME_STORAGE_KEY);
  document.documentElement.removeAttribute("data-theme");
  document.documentElement.removeAttribute("data-scheme");
});

describe("ThemeSwitch", () => {
  it("lists every theme and can switch to swiss", async () => {
    const user = userEvent.setup();
    render(<ThemeSwitch />);
    await user.click(screen.getByRole("button", { name: /theme:/i }));
    expect(screen.getByRole("option", { name: /carbon/i })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /navy/i })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /atelier/i })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /paper/i })).toBeInTheDocument();
    await user.click(screen.getByRole("option", { name: /swiss/i }));
    expect(document.documentElement.getAttribute("data-theme")).toBe("swiss");
    expect(document.documentElement.getAttribute("data-scheme")).toBe("light");
  });
});
