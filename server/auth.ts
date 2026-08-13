import jwt from "jsonwebtoken";
import { PrismaClient, DocumentRole } from "@prisma/client";

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

interface SessionTokenPayload {
  sub: string;
  documentId: string;
}

interface ShareTokenPayload {
  documentId: string;
  shareToken: string;
}

export class AuthError extends Error {}

export interface AuthResult {
  userId: string;
  role: DocumentRole;
  isShareLink: boolean;
}

export async function authenticateConnection(
  token: string | undefined,
  requestedDocumentId: string
): Promise<AuthResult> {
  const secret = process.env.WS_TOKEN_SECRET;
  if (!secret) throw new AuthError("server misconfigured: WS_TOKEN_SECRET missing");
  if (!token) throw new AuthError("missing token");

  let payload: SessionTokenPayload | ShareTokenPayload;
  try {
    payload = jwt.verify(token, secret) as SessionTokenPayload | ShareTokenPayload;
  } catch {
    throw new AuthError("invalid or expired token");
  }

  if (payload.documentId !== requestedDocumentId) {
    throw new AuthError("token does not match requested document");
  }

  if ("shareToken" in payload) {
    const link = await prisma.shareLink.findUnique({
      where: { token: payload.shareToken },
      select: { documentId: true, revoked: true },
    });
    if (!link || link.revoked || link.documentId !== payload.documentId) {
      throw new AuthError("share link is invalid or has been revoked");
    }
    return { userId: `guest:${payload.shareToken.slice(0, 8)}`, role: DocumentRole.viewer, isShareLink: true };
  }

  const role = await resolveDocumentRole(payload.sub, payload.documentId);
  if (!role) throw new AuthError("no access to this document");

  return { userId: payload.sub, role, isShareLink: false };
}

async function resolveDocumentRole(
  userId: string,
  documentId: string
): Promise<DocumentRole | null> {
  const acl = await prisma.documentAcl.findUnique({
    where: { documentId_userId: { documentId, userId } },
    select: { role: true },
  });

  if (acl?.role === DocumentRole.owner) return DocumentRole.owner;

  const doc = await prisma.document.findUnique({
    where: { id: documentId },
    select: { createdById: true, workspaceId: true },
  });

  if (!doc) return null;

  if (doc.createdById === userId) return DocumentRole.owner;

  const wsMembership = await prisma.membership.findUnique({
    where: { userId_workspaceId: { userId, workspaceId: doc.workspaceId } },
    select: { role: true },
  });
  const roleStr = wsMembership?.role as string | undefined;
  if (roleStr === "owner") return DocumentRole.owner;
  if (roleStr === "admin" || roleStr === "member") {
    if (acl?.role) return acl.role;
    return DocumentRole.editor;
  }

  if (acl?.role) return acl.role;

  return null;
}

export { prisma };
