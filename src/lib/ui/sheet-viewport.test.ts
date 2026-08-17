import { describe, expect, it } from "vitest";
import { renderHook } from "@testing-library/react";
import { useSheetBox } from "@/lib/ui/sheet-viewport";

describe("sheet viewport", () => {
  it("does not pin a desktop dialog to the visual viewport", () => {
    const { result } = renderHook(() => useSheetBox(true));
    expect(result.current).toBeNull();
  });
});
