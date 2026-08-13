import { DocumentRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const ROLE_RANK: Record<DocumentRole, number> = {
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

export function canBroadcastEdits(role: DocumentRole | null): boolean {
  return roleAtLeast(role, DocumentRole.editor);
}

export function canComment(role: DocumentRole | null): boolean {
  return roleAtLeast(role, DocumentRole.commenter);
}

export function canRead(role: DocumentRole | null): boolean {
  return role !== null;
}

export async function resolveDocumentRole(
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
  if (wsMembership?.role === "owner") return DocumentRole.owner;
  if (wsMembership?.role === "admin" || wsMembership?.role === "member") {
    if (acl?.role) return acl.role;
    return DocumentRole.editor;
  }

  if (acl?.role) return acl.role;

  return null;
}

export async function requireDocumentRole(
  userId: string,
  documentId: string,
  min: DocumentRole
): Promise<DocumentRole> {
  const role = await resolveDocumentRole(userId, documentId);
  if (!roleAtLeast(role, min)) {
    throw new Error("FORBIDDEN");
  }
  return role as DocumentRole;
}
