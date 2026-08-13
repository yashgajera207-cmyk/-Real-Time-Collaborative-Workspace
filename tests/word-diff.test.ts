import { describe, it, expect } from "vitest";
import { diffWords } from "@/lib/word-diff";

describe("diffWords", () => {
  it("returns a single 'same' part for identical text", () => {
    const result = diffWords("hello world", "hello world");
    expect(result.every((p) => p.type === "same")).toBe(true);
  });

  it("detects an addition", () => {
    const result = diffWords("hello world", "hello brave world");
    expect(result.some((p) => p.type === "added" && p.text.includes("brave"))).toBe(true);
  });

  it("detects a removal", () => {
    const result = diffWords("hello brave world", "hello world");
    expect(result.some((p) => p.type === "removed" && p.text.includes("brave"))).toBe(true);
  });


  it("handles empty strings without throwing", () => {
    expect(() => diffWords("", "")).not.toThrow();
    expect(diffWords("", "hello")[0]).toMatchObject({ type: "added" });
  });
});
