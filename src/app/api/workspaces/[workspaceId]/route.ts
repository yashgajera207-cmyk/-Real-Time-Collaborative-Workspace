import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { resolveDocumentRole, canRead } from "@/lib/permissions";

// GET /api/workspaces/:workspaceId -> workspace details + accessible documents
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ workspaceId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { workspaceId } = await params;

  const membership = await prisma.membership.findUnique({
    where: { userId_workspaceId: { userId: session.user.id, workspaceId } },
    include: { workspace: true },
  });
  if (!membership) return NextResponse.json({ error: "not found" }, { status: 404 });

  const rawDocuments = await prisma.document.findMany({
    where: { workspaceId },
    orderBy: { updatedAt: "desc" },
  });

  const documents = (
    await Promise.all(
      rawDocuments.map(async (d: (typeof rawDocuments)[number]) => {
        const role = await resolveDocumentRole(session.user.id, d.id);
        if (!canRead(role)) return null;
        return {
          id: d.id,
          title: d.title,
          parentId: d.parentId,
          updatedAt: d.updatedAt,
          role: role!,
        };
      })
    )
  ).filter(Boolean);

  return NextResponse.json({
    workspace: {
      id: membership.workspace.id,
      name: membership.workspace.name,
      slug: membership.workspace.slug,
      role: membership.role,
    },
    documents,
  });
}

const updateSchema = z.object({
  name: z.string().min(1, "Name is required").max(120),
});

// PATCH /api/workspaces/:workspaceId -> rename workspace (owner only)
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ workspaceId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { workspaceId } = await params;
  const membership = await prisma.membership.findUnique({
    where: { userId_workspaceId: { userId: session.user.id, workspaceId } },
  });

  if (!membership || membership.role !== "owner") {
    return NextResponse.json({ error: "Only the workspace owner can rename the workspace" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid name" }, { status: 400 });
  }

  const updated = await prisma.workspace.update({
    where: { id: workspaceId },
    data: { name: parsed.data.name },
  });

  return NextResponse.json(updated);
}

// DELETE /api/workspaces/:workspaceId -> delete workspace (owner only)
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ workspaceId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { workspaceId } = await params;
  const membership = await prisma.membership.findUnique({
    where: { userId_workspaceId: { userId: session.user.id, workspaceId } },
  });

  if (!membership || membership.role !== "owner") {
    return NextResponse.json({ error: "Only the workspace owner can delete the workspace" }, { status: 403 });
  }

  await prisma.workspace.delete({
    where: { id: workspaceId },
  });

  return NextResponse.json({ success: true });
}
