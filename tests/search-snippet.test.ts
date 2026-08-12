import { describe, it, expect } from "vitest";
import { buildSnippet } from "@/lib/search-snippet";

describe("buildSnippet", () => {
  it("returns null when the query isn't found", () => {
    expect(buildSnippet("the quick brown fox", "giraffe")).toBeNull();
  });

  it("returns null for an empty query", () => {
    expect(buildSnippet("the quick brown fox", "")).toBeNull();
  });

  it("centers a short excerpt around the first match, case-insensitively", () => {
    const text = "a".repeat(60) + "TARGET" + "b".repeat(60);
    const snippet = buildSnippet(text, "target", 10);
    expect(snippet).toContain("TARGET");
    expect(snippet?.length).toBeLessThan(40);
  });

  it("omits the ellipsis at an edge that isn't truncated", () => {
    const snippet = buildSnippet("target right at the start of a short string", "target", 5);
    expect(snippet?.startsWith("…")).toBe(false);
  });
});
