import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ClosingCeremony } from "@/components/closing-ceremony";
import { BRAND } from "@/lib/brand";
import { sampleMonumentEntry } from "@/lib/monument/sample";

describe("closing ceremony", () => {
  it("does not reveal a Victor while the Wall is under review", () => {
    render(<ClosingCeremony reviewing />);
    expect(screen.getByText(/the wall has closed/i)).toBeInTheDocument();
    expect(screen.getByText(/under review/i)).toBeInTheDocument();
    expect(screen.queryByText(BRAND.victorMark)).not.toBeInTheDocument();
    expect(screen.queryByText(/m-0007/i)).not.toBeInTheDocument();
  });

  it("reveals the sealed Victor after finish", () => {
    render(<ClosingCeremony entry={sampleMonumentEntry()} />);
    expect(screen.getByText(BRAND.victorMark)).toBeInTheDocument();
    expect(screen.getByText(/inscription #004291/i)).toBeInTheDocument();
    expect(screen.getByText(/monument entry m-0007 has been sealed/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "M-0007" })).toHaveAttribute("href", "/monument/7");
  });
});
