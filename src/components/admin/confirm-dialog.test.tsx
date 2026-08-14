import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { AdminConfirmDialog } from "@/components/admin/confirm-dialog";

describe("admin confirmation dialog", () => {
  it("keeps confirm disabled until a reason and REMOVE are present", () => {
    render(
      <AdminConfirmDialog
        action="remove"
        publicNumber={4}
        pending={false}
        error={null}
        reason=""
        note=""
        confirmText=""
        onReason={() => undefined}
        onNote={() => undefined}
        onConfirmText={() => undefined}
        onCancel={() => undefined}
        onSubmit={() => undefined}
      />,
    );
    expect(screen.getByRole("button", { name: /^confirm$/i })).toBeDisabled();
    expect(screen.getByText(/type remove/i)).toBeInTheDocument();
  });

  it("enables confirm when the phrase and reason are set", () => {
    const { rerender } = render(
      <AdminConfirmDialog
        action="remove"
        publicNumber={4}
        pending={false}
        error={null}
        reason=""
        note=""
        confirmText=""
        onReason={() => undefined}
        onNote={() => undefined}
        onConfirmText={() => undefined}
        onCancel={() => undefined}
        onSubmit={() => undefined}
      />,
    );
    expect(screen.getByRole("button", { name: /^confirm$/i })).toBeDisabled();
    rerender(
      <AdminConfirmDialog
        action="remove"
        publicNumber={4}
        pending={false}
        error={null}
        reason="spam"
        note=""
        confirmText="REMOVE"
        onReason={() => undefined}
        onNote={() => undefined}
        onConfirmText={() => undefined}
        onCancel={() => undefined}
        onSubmit={() => undefined}
      />,
    );
    expect(screen.getByRole("button", { name: /^confirm$/i })).toBeEnabled();
  });
});
