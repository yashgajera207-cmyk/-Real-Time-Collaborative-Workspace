import jwt from "jsonwebtoken";
import { PrismaClient, DocumentRole } from "@prisma/client";

// This file intentionally re-implements token verification and ACL
// resolution rather than importing from src/lib. The WS server is a
// separate long-lived process with its own tsconfig and build - it must
// never depend on Next.js route internals. The two auth boundaries share
// nothing but the WS_TOKEN_SECRET environment variable and the database.

const prisma = new PrismaClient();

const ROLE_RANK: Record<DocumentRole, number> = {
  viewer: 0,
  commenter: 1,
  editor: 2,
  owner: 3,
};

export function roleAtLeast(role: DocumentRole | null, min: DocumentRole): boolean {
  if (!role) return false;
  const roleRank = ROLE_RANK[role] ?? -1;
  const minRank = ROLE_RANK[min] ?? -1;
  return roleRank >= minRank;
}

interface TokenPayload {
  sub: string;
  documentId: string;
}

export class AuthError extends Error {}

/**
 * Verifies the short-lived token AND independently re-resolves the ACL
 * from Postgres. The token proves who the user claims to be; it never
 * grants a role by itself. This function is the single security boundary
 * for every socket - an unauthorised connection must never reach the
 * relay code below it.
 */
export async function authenticateConnection(
  token: string | undefined,
  requestedDocumentId: string
): Promise<{ userId: string; role: DocumentRole }> {
  const secret = process.env.WS_TOKEN_SECRET;
  if (!secret) throw new AuthError("server misconfigured: WS_TOKEN_SECRET missing");
  if (!token) throw new AuthError("missing token");

  let payload: TokenPayload;
  try {
    payload = jwt.verify(token, secret) as TokenPayload;
  } catch {
    throw new AuthError("invalid or expired token");
  }

  if (payload.documentId !== requestedDocumentId) {
    throw new AuthError("token does not match requested document");
  }

  const acl = await prisma.documentAcl.findUnique({
    where: { documentId_userId: { documentId: payload.documentId, userId: payload.sub } },
    select: { role: true },
  });

  if (!acl) throw new AuthError("no access to this document");

  return { userId: payload.sub, role: acl.role };
}

export { prisma };
