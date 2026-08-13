import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { resolveDocumentRole, canRead, requireDocumentRole } from "@/lib/permissions";
import { DocumentRole } from "@prisma/client";

// GET /api/documents/:documentId -> metadata, this user's role, and the
// breadcrumb chain of ancestors (for nested pages). The document body
// itself is not fetched here - the editor pulls it from the WS server as
// a replayed Yjs update stream on room join.

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

  const breadcrumbs: { id: string; title: string }[] = [];
  let cursor = document.parentId;
  // Walk up the tree. Depth is bounded defensively - nested pages are a
  // convenience, not meant to go dozens of levels deep.
  for (let i = 0; i < 20 && cursor; i++) {
    const ancestor: { id: string; title: string; parentId: string | null } | null =
      await prisma.document.findUnique({
        where: { id: cursor },
        select: { id: true, title: true, parentId: true },
      });
    if (!ancestor) break;
    breadcrumbs.unshift({ id: ancestor.id, title: ancestor.title });
    cursor = ancestor.parentId;
  }

  return NextResponse.json({
    id: document.id,
    title: document.title,
    workspaceId: document.workspaceId,
    parentId: document.parentId,
    updatedAt: document.updatedAt,
    role,
    breadcrumbs,
  });
}

const patchSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  parentId: z.string().nullable().optional(),
  position: z.number().int().optional(),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ documentId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { documentId } = await params;
  let document;
  try {
    document = await prisma.document.findUnique({ where: { id: documentId } });
    await requireDocumentRole(session.user.id, documentId, DocumentRole.editor);
  } catch {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  if (!document) return NextResponse.json({ error: "not found" }, { status: 404 });

  const parsed = patchSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const { title, parentId, position } = parsed.data;

  if (parentId !== undefined && parentId !== null) {
    if (parentId === documentId) {
      return NextResponse.json({ error: "a page can't be its own parent" }, { status: 400 });
    }
    // Reparenting under another page requires edit rights there too, and
    // it has to be in the same workspace - nested pages don't cross
    // workspace boundaries.
    const parent = await prisma.document.findUnique({ where: { id: parentId } });
    if (!parent || parent.workspaceId !== document.workspaceId) {
      return NextResponse.json({ error: "invalid parent" }, { status: 400 });
    }
    try {
      await requireDocumentRole(session.user.id, parentId, DocumentRole.editor);
    } catch {
      return NextResponse.json({ error: "no access to that parent" }, { status: 403 });
    }
    // Prevent creating a cycle: the new parent can't be a descendant of
    // this document.
    let cursor: string | null = parentId;
    for (let i = 0; i < 20 && cursor; i++) {
      if (cursor === documentId) {
        return NextResponse.json({ error: "that would create a cycle" }, { status: 400 });
      }
      const next: { parentId: string | null } | null = await prisma.document.findUnique({
        where: { id: cursor },
        select: { parentId: true },
      });
      cursor = next?.parentId ?? null;
    }
  }

  const updated = await prisma.document.update({
    where: { id: documentId },
    data: {
      ...(title !== undefined ? { title } : {}),
      ...(parentId !== undefined ? { parentId } : {}),
      ...(position !== undefined ? { position } : {}),
    },
  });

  return NextResponse.json({ id: updated.id, title: updated.title, parentId: updated.parentId });
}

// DELETE /api/documents/:documentId -> Delete document (Document Owner ONLY)
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ documentId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { documentId } = await params;
  const role = await resolveDocumentRole(session.user.id, documentId);

  // Strictly enforce Document Owner permission
  if (role !== DocumentRole.owner) {
    return NextResponse.json({ error: "Only the document owner can delete this document" }, { status: 403 });
  }

  const document = await prisma.document.findUnique({ where: { id: documentId } });
  if (!document) return NextResponse.json({ error: "not found" }, { status: 404 });

  await prisma.document.delete({
    where: { id: documentId },
  });

  return NextResponse.json({ success: true, workspaceId: document.workspaceId });
}
