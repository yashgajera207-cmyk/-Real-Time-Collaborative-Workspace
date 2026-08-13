import { describe, it, expect, vi, beforeEach } from "vitest";
import jwt from "jsonwebtoken";

// The WS server's auth module opens its own PrismaClient at import time,
// so we mock it before importing the module under test. This keeps the
// unit test independent of a running Postgres instance while still
// exercising the real authentication + ACL-resolution logic.
const findUniqueAclMock = vi.fn();
const findUniqueShareLinkMock = vi.fn();

vi.mock("@prisma/client", () => ({
  PrismaClient: vi.fn().mockImplementation(() => ({
    documentAcl: { findUnique: findUniqueAclMock },
    shareLink: { findUnique: findUniqueShareLinkMock },
  })),
  DocumentRole: { viewer: "viewer", commenter: "commenter", editor: "editor", owner: "owner" },
}));

process.env.WS_TOKEN_SECRET = "test-secret";

const { authenticateConnection, AuthError } = await import("../server/auth");

function sign(payload: object) {
  return jwt.sign(payload, "test-secret", { expiresIn: "60s" });
}

describe("authenticateConnection (the socket's security boundary)", () => {
  beforeEach(() => {
    findUniqueAclMock.mockReset();
    findUniqueShareLinkMock.mockReset();
  });

  it("rejects a connection with no token", async () => {
    await expect(authenticateConnection(undefined, "doc-1")).rejects.toBeInstanceOf(AuthError);
  });

  it("rejects a token whose documentId doesn't match the requested room", async () => {
    const token = sign({ sub: "user-1", documentId: "doc-1" });
    await expect(authenticateConnection(token, "doc-2")).rejects.toBeInstanceOf(AuthError);
  });

  it("rejects a validly signed token when the user has no ACL row", async () => {
    findUniqueAclMock.mockResolvedValue(null);
    const token = sign({ sub: "user-1", documentId: "doc-1" });
    await expect(authenticateConnection(token, "doc-1")).rejects.toBeInstanceOf(AuthError);
  });

  it("accepts a valid session token for a user with an ACL row and returns their role", async () => {
    findUniqueAclMock.mockResolvedValue({ role: "viewer" });
    const token = sign({ sub: "user-1", documentId: "doc-1" });
    const result = await authenticateConnection(token, "doc-1");
    expect(result).toEqual({ userId: "user-1", role: "viewer", isShareLink: false });
  });

  it("rejects a token signed with the wrong secret", async () => {
    const token = jwt.sign({ sub: "user-1", documentId: "doc-1" }, "wrong-secret");
    await expect(authenticateConnection(token, "doc-1")).rejects.toBeInstanceOf(AuthError);
  });

  it("accepts a valid share-link token and always resolves it to viewer", async () => {
    findUniqueShareLinkMock.mockResolvedValue({ documentId: "doc-1", revoked: false });
    const token = sign({ shareToken: "share-abc123", documentId: "doc-1" });
    const result = await authenticateConnection(token, "doc-1");
    expect(result.role).toBe("viewer");
    expect(result.isShareLink).toBe(true);
    // The ACL table is never consulted for a share-link connection - the
    // role is fixed at viewer regardless of what DocumentAcl might say.
    expect(findUniqueAclMock).not.toHaveBeenCalled();
  });

  it("rejects a share-link token whose link has been revoked", async () => {
    findUniqueShareLinkMock.mockResolvedValue({ documentId: "doc-1", revoked: true });
    const token = sign({ shareToken: "share-abc123", documentId: "doc-1" });
    await expect(authenticateConnection(token, "doc-1")).rejects.toBeInstanceOf(AuthError);
  });

  it("rejects a share-link token for a link that no longer exists", async () => {
    findUniqueShareLinkMock.mockResolvedValue(null);
    const token = sign({ shareToken: "deleted-link", documentId: "doc-1" });
    await expect(authenticateConnection(token, "doc-1")).rejects.toBeInstanceOf(AuthError);
  });

  it("a share-link token can never be replayed as a session token's higher role", async () => {
    // Even if somehow the same secret signed a payload with both shapes,
    // the presence of `shareToken` routes to the share-link path, which
    // is hard-coded to viewer and never touches DocumentAcl.
    findUniqueShareLinkMock.mockResolvedValue({ documentId: "doc-1", revoked: false });
    findUniqueAclMock.mockResolvedValue({ role: "owner" }); // would grant owner if this path were used
    const token = sign({ shareToken: "share-abc123", documentId: "doc-1" });
    const result = await authenticateConnection(token, "doc-1");
    expect(result.role).toBe("viewer");
  });
});
