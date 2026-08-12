import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { DocumentRole } from "@prisma/client";

// POST /api/workspaces/:workspaceId/documents -> create a document.
// Creator becomes owner via an explicit DocumentAcl row.

const createSchema = z.object({
  title: z.string().min(1).max(200),
  parentId: z.string().nullable().optional(),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ workspaceId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { workspaceId } = await params;

  const membership = await prisma.membership.findUnique({
    where: { userId_workspaceId: { userId: session.user.id, workspaceId } },
  });
  if (!membership) return NextResponse.json({ error: "not found" }, { status: 404 });

  const parsed = createSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  // A parent, if given, has to actually be in this workspace and the
  // creator needs edit rights on it - otherwise anyone could staple a
  // new page under a document they can't touch.
  if (parsed.data.parentId) {
    const parent = await prisma.document.findUnique({ where: { id: parsed.data.parentId } });
    if (!parent || parent.workspaceId !== workspaceId) {
      return NextResponse.json({ error: "invalid parent" }, { status: 400 });
    }
    const parentAcl = await prisma.documentAcl.findUnique({
      where: { documentId_userId: { documentId: parsed.data.parentId, userId: session.user.id } },
    });
    if (!parentAcl || (parentAcl.role !== DocumentRole.owner && parentAcl.role !== DocumentRole.editor)) {
      return NextResponse.json({ error: "no access to that parent" }, { status: 403 });
    }
  }

  const document = await prisma.document.create({
    data: {
      title: parsed.data.title,
      workspaceId,
      parentId: parsed.data.parentId ?? null,
      createdById: session.user.id,
      acl: { create: { userId: session.user.id, role: DocumentRole.owner } },
    },
  });

  return NextResponse.json(document, { status: 201 });
}
