import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireDocumentRole } from "@/lib/permissions";
import { DocumentRole } from "@prisma/client";

const schema = z.object({ revoked: z.boolean() });

// PATCH /api/documents/:documentId/share/:linkId -> revoke (or, in
// principle, un-revoke, though the UI only ever exposes revoking).
// Revoking never deletes the row - it's a status flip, same reasoning as
// resolving a comment thread: the audit trail (who made this link, when)
// stays intact.
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ documentId: string; linkId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { documentId, linkId } = await params;
  try {
    await requireDocumentRole(session.user.id, documentId, DocumentRole.editor);
  } catch {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const link = await prisma.shareLink.findUnique({ where: { id: linkId } });
  if (!link || link.documentId !== documentId) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const updated = await prisma.shareLink.update({
    where: { id: linkId },
    data: { revoked: parsed.data.revoked },
  });

  return NextResponse.json({ id: updated.id, revoked: updated.revoked });
}
