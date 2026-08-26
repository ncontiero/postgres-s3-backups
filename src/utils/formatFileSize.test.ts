import { describe, expect, test } from "bun:test";
import { formatFileSize } from "./formatFileSize";

describe("formatFileSize", () => {
  test.each([
    [0, "0 B"],
    [999, "999 B"],
    [1_000, "1 kB"],
    [1_500, "1.5 kB"],
    [1_000_000, "1 MB"],
    [1_234_567, "1.23 MB"],
    [999_999, "1 MB"],
    [1_000_000_000, "1 GB"],
    [1_000_000_000_000_000, "1 PB"],
  ])("formats %d bytes as %s", (bytes, expected) => {
    expect(formatFileSize(bytes)).toBe(expected);
  });
});
