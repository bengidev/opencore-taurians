import { describe, expect, it } from "vitest";
import { createMemoryWorkAreaReader } from "./sessionWorkArea";

describe("sessionWorkArea", () => {
  it("memory reader returns fixed size", async () => {
    const read = createMemoryWorkAreaReader({ width: 1920, height: 1080 });
    await expect(read()).resolves.toEqual({ width: 1920, height: 1080 });
  });

  it("memory reader returns null", async () => {
    const read = createMemoryWorkAreaReader(null);
    await expect(read()).resolves.toBeNull();
  });
});
