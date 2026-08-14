import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MessageComposer, composerCanContinue } from "@/components/message-composer";
import { MESSAGE_MAX_GRAPHEMES } from "@/lib/constants";

function Harness({
  onContinue,
  initial = "",
}: {
  onContinue?: () => void;
  initial?: string;
}) {
  const [value, setValue] = useState(initial);
  return <MessageComposer value={value} onChange={setValue} onContinue={onContinue} autoFocus />;
}

describe("message composer", () => {
  it("shows a live 140-character counter", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    expect(screen.getByText(`0 / ${MESSAGE_MAX_GRAPHEMES}`)).toBeInTheDocument();
    await user.type(screen.getByLabelText(/your sentence/i), "Hi");
    expect(screen.getByText(`2 / ${MESSAGE_MAX_GRAPHEMES}`)).toBeInTheDocument();
  });

  it("marks overflow and blocks continue", () => {
    const over = "a".repeat(141);
    expect(composerCanContinue("")).toBe(false);
    expect(composerCanContinue("   ")).toBe(false);
    expect(composerCanContinue("I was here.")).toBe(true);
    expect(composerCanContinue(over)).toBe(false);
    render(<MessageComposer value={over} onChange={() => undefined} />);
    expect(screen.getByText(`141 / ${MESSAGE_MAX_GRAPHEMES}`)).toBeInTheDocument();
    expect(screen.getByLabelText(/your sentence/i)).toHaveAttribute("aria-invalid", "true");
  });

  it("continues from Ctrl+Enter when the sentence is valid", async () => {
    const user = userEvent.setup();
    const onContinue = vi.fn();
    render(<Harness initial="I was here." onContinue={onContinue} />);
    screen.getByLabelText(/your sentence/i).focus();
    await user.keyboard("{Control>}{Enter}{/Control}");
    expect(onContinue).toHaveBeenCalledTimes(1);
  });

  it("does not continue from Ctrl+Enter when empty", async () => {
    const user = userEvent.setup();
    const onContinue = vi.fn();
    render(<Harness onContinue={onContinue} />);
    screen.getByLabelText(/your sentence/i).focus();
    await user.keyboard("{Control>}{Enter}{/Control}");
    expect(onContinue).not.toHaveBeenCalled();
  });
});
