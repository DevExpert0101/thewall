import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ProofOfVictory } from "@/components/proof-of-victory";
import { sampleMonumentEntry } from "@/lib/monument/sample";

describe("Proof of Victory", () => {
  it("is an owner-only artifact and stays anonymous", () => {
    render(<ProofOfVictory entry={sampleMonumentEntry()} />);
    expect(screen.getAllByText(/proof of victory/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/m-0007/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/i wrote/i)).toBeInTheDocument();
    expect(screen.getByText(/the monument stays anonymous/i)).toBeInTheDocument();
    expect(screen.queryByText(/wallet|0x|wall key/i)).not.toBeInTheDocument();
  });
});
