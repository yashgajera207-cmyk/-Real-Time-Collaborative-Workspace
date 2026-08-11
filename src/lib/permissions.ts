import { DocumentRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";

// Central ACL resolution. Every route, and the WS server's auth check,
// route through here so there is exactly one place that decides access.

export const ROLE_RANK: Record<DocumentRole, number> = {
  viewer: 0,
  commenter: 1,
  editor: 2,
  owner: 3,
};

export function roleAtLeast(role: DocumentRole | null, min: DocumentRole): boolean {
  if (!role) return false;
  // ROLE_RANK is a total mapping over every DocumentRole variant, so these
  // are never actually undefined - the `?? -1` is a defensive fallback
  // that keeps this correct under noUncheckedIndexedAccess without a
  // non-null assertion.
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

/**
 * Resolves a user's effective role on a document.
 * An explicit DocumentAcl row is authoritative. A user with no row has
 * no access at all, even if they belong to the parent workspace -
 * workspace membership alone never grants document access.
 */
export async function resolveDocumentRole(
  userId: string,
  documentId: string
): Promise<DocumentRole | null> {
  const acl = await prisma.documentAcl.findUnique({
    where: { documentId_userId: { documentId, userId } },
    select: { role: true },
  });
  return acl?.role ?? null;
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
