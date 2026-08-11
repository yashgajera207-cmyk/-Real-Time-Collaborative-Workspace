import { describe, it, expect } from "vitest";
import { DocumentRole } from "@prisma/client";
import { roleAtLeast, canBroadcastEdits, canComment, canRead } from "@/lib/permissions";

describe("ACL rank resolution", () => {
  it("orders roles viewer < commenter < editor < owner", () => {
    expect(roleAtLeast(DocumentRole.viewer, DocumentRole.viewer)).toBe(true);
    expect(roleAtLeast(DocumentRole.viewer, DocumentRole.commenter)).toBe(false);
    expect(roleAtLeast(DocumentRole.owner, DocumentRole.viewer)).toBe(true);
  });

  it("treats null (no ACL row) as no access at all", () => {
    expect(roleAtLeast(null, DocumentRole.viewer)).toBe(false);
    expect(canRead(null)).toBe(false);
  });

  it("only editor and owner can broadcast edits", () => {
    expect(canBroadcastEdits(DocumentRole.viewer)).toBe(false);
    expect(canBroadcastEdits(DocumentRole.commenter)).toBe(false);
    expect(canBroadcastEdits(DocumentRole.editor)).toBe(true);
    expect(canBroadcastEdits(DocumentRole.owner)).toBe(true);
  });

  it("commenter and above can comment, viewer cannot", () => {
    expect(canComment(DocumentRole.viewer)).toBe(false);
    expect(canComment(DocumentRole.commenter)).toBe(true);
  });
});
