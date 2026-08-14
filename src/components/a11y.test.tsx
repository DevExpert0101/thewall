import { render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { Faq } from "@/components/faq";
import { PrimaryCta } from "@/components/primary-cta";

describe("keyboard access", () => {
  it("can tab to the live publish CTA and activate it", async () => {
    const user = userEvent.setup();
    let clicked = false;
    render(<PrimaryCta phase="live" onPublish={() => { clicked = true; }} />);
    await user.tab();
    await user.keyboard("{Enter}");
    expect(clicked).toBe(true);
  });

  it("can open FAQ items from the keyboard", async () => {
    const user = userEvent.setup();
    const { getByText } = render(<Faq />);
    const trigger = getByText(/what is the wall/i);
    trigger.focus();
    await user.keyboard("{Enter}");
    expect(getByText(/24-hour anonymous monument/i)).toBeInTheDocument();
  });
});
