import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { PrimaryCta } from "@/components/primary-cta";
import { Faq } from "@/components/faq";

describe("critical UI", () => {
  it("renders upcoming CTA", () => {
    render(<PrimaryCta phase="upcoming" />);
    expect(screen.getByText(/remind me/i)).toBeInTheDocument();
  });

  it("renders live publish CTA", () => {
    render(<PrimaryCta phase="live" onPublish={() => undefined} />);
    expect(screen.getByRole("button", { name: /leave your mark/i })).toBeInTheDocument();
  });

  it("renders archived CTA", () => {
    render(<PrimaryCta phase="archived" />);
    expect(screen.getByText(/enter the archive/i)).toBeInTheDocument();
  });

  it("exposes FAQ as accessible accordion", () => {
    render(<Faq />);
    expect(screen.getByText(/what is the wall/i)).toBeInTheDocument();
  });
});
