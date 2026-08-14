import { vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

vi.mock("server-only", () => ({}));

afterEach(() => {
  cleanup();
});
