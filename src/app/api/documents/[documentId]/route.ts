import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { resolveDocumentRole, canRead } from "@/lib/permissions";

// GET /api/documents/:documentId -> metadata + this user's role.
// The actual document body is not fetched here - the editor pulls it
// from the WS server as a replayed Yjs update stream on room join.

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ documentId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { documentId } = await params;
  const role = await resolveDocumentRole(session.user.id, documentId);
  if (!canRead(role)) return NextResponse.json({ error: "not found" }, { status: 404 });

  const document = await prisma.document.findUnique({ where: { id: documentId } });
  if (!document) return NextResponse.json({ error: "not found" }, { status: 404 });

  return NextResponse.json({
    id: document.id,
    title: document.title,
    workspaceId: document.workspaceId,
    updatedAt: document.updatedAt,
    role,
  });
}
