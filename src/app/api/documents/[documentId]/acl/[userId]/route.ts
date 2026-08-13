import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { resolveDocumentRole } from "@/lib/permissions";
import { DocumentRole } from "@prisma/client";

// DELETE /api/documents/:documentId/acl/:userId -> Revoke document access (Document Owner ONLY)
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ documentId: string; userId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { documentId, userId } = await params;
  const userRole = await resolveDocumentRole(session.user.id, documentId);

  // Strictly enforce Document Owner permission
  if (userRole !== DocumentRole.owner) {
    return NextResponse.json({ error: "Only the document owner can revoke document access" }, { status: 403 });
  }

  // Prevent self revocation
  if (userId === session.user.id) {
    return NextResponse.json({ error: "You cannot revoke your own document access" }, { status: 400 });
  }

  // Prevent revoking access for the document creator
  const doc = await prisma.document.findUnique({ where: { id: documentId } });
  if (doc?.createdById === userId) {
    const ownerCount = await prisma.documentAcl.count({
      where: { documentId, role: DocumentRole.owner },
    });
    if (ownerCount <= 1) {
      return NextResponse.json({ error: "Cannot revoke access for the document creator" }, { status: 400 });
    }
  }

  await prisma.documentAcl.deleteMany({
    where: {
      documentId,
      userId,
    },
  });

  return NextResponse.json({ success: true });
}
