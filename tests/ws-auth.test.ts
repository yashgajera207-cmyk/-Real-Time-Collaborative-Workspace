import { describe, it, expect, vi, beforeEach } from "vitest";
import jwt from "jsonwebtoken";

// The WS server's auth module opens its own PrismaClient at import time,
// so we mock it before importing the module under test. This keeps the
// unit test independent of a running Postgres instance while still
// exercising the real authentication + ACL-resolution logic.
const findUniqueMock = vi.fn();

vi.mock("@prisma/client", () => ({
  PrismaClient: vi.fn().mockImplementation(() => ({
    documentAcl: { findUnique: findUniqueMock },
  })),
  DocumentRole: { viewer: "viewer", commenter: "commenter", editor: "editor", owner: "owner" },
}));

process.env.WS_TOKEN_SECRET = "test-secret";

const { authenticateConnection, AuthError } = await import("../server/auth");

function sign(payload: object) {
  return jwt.sign(payload, "test-secret", { expiresIn: "60s" });
}

describe("authenticateConnection (the socket's security boundary)", () => {
  beforeEach(() => findUniqueMock.mockReset());

  it("rejects a connection with no token", async () => {
    await expect(authenticateConnection(undefined, "doc-1")).rejects.toBeInstanceOf(AuthError);
  });

  it("rejects a token whose documentId doesn't match the requested room", async () => {
    const token = sign({ sub: "user-1", documentId: "doc-1" });
    await expect(authenticateConnection(token, "doc-2")).rejects.toBeInstanceOf(AuthError);
  });

  it("rejects a validly signed token when the user has no ACL row", async () => {
    findUniqueMock.mockResolvedValue(null);
    const token = sign({ sub: "user-1", documentId: "doc-1" });
    await expect(authenticateConnection(token, "doc-1")).rejects.toBeInstanceOf(AuthError);
  });

  it("accepts a valid token for a user with an ACL row and returns their role", async () => {
    findUniqueMock.mockResolvedValue({ role: "viewer" });
    const token = sign({ sub: "user-1", documentId: "doc-1" });
    const result = await authenticateConnection(token, "doc-1");
    expect(result).toEqual({ userId: "user-1", role: "viewer" });
  });

  it("rejects a token signed with the wrong secret", async () => {
    const token = jwt.sign({ sub: "user-1", documentId: "doc-1" }, "wrong-secret");
    await expect(authenticateConnection(token, "doc-1")).rejects.toBeInstanceOf(AuthError);
  });
});
