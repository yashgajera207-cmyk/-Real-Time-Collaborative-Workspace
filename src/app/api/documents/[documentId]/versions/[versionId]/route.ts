import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireDocumentRole } from "@/lib/permissions";
import { DocumentRole } from "@prisma/client";

// GET /api/documents/:documentId/versions/:versionId
// Returns the raw encoded Yjs state as base64. The client applies it to a
// throwaway Y.Doc to extract text for diffing, or clones its fragment
// into the live doc to restore - both happen client-side because that's
// where the live, already-connected Y.Doc lives.

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ documentId: string; versionId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { documentId, versionId } = await params;
  try {
    await requireDocumentRole(session.user.id, documentId, DocumentRole.viewer);
  } catch {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const snapshot = await prisma.documentSnapshot.findUnique({ where: { id: versionId } });
  if (!snapshot || snapshot.documentId !== documentId) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  return NextResponse.json({
    id: snapshot.id,
    label: snapshot.label,
    createdAt: snapshot.createdAt,
    data: Buffer.from(snapshot.data).toString("base64"),
  });
}
