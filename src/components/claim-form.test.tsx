import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ClaimForm } from "@/components/claim-form";

describe("claim form", () => {
  it("asks for a Wall Key and never a wallet sign-in", () => {
    render(
      <ClaimForm
        publicNumber={4291}
        phase="archived"
        finalRank={1}
        text="Call your mother."
      />,
    );
    expect(screen.getByText(/this message won/i)).toBeInTheDocument();
    expect(screen.getByText(/no account/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/7K9P-X4MF-82QH-K3R2/i)).toBeInTheDocument();
    expect(screen.queryByText(/connect wallet/i)).not.toBeInTheDocument();
  });
});
