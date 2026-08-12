import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/workspaces/:workspaceId -> workspace details + documents the
// current user has an explicit ACL row for (see permissions.ts: workspace
// membership alone never grants document access).

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

  const documents = await prisma.document.findMany({
    where: { workspaceId, acl: { some: { userId: session.user.id } } },
    include: { acl: { where: { userId: session.user.id }, select: { role: true } } },
    orderBy: { updatedAt: "desc" },
  });

  return NextResponse.json({
    workspace: {
      id: membership.workspace.id,
      name: membership.workspace.name,
      slug: membership.workspace.slug,
      role: membership.role,
    },
    documents: documents.map((d: (typeof documents)[number]) => ({
      id: d.id,
      title: d.title,
      parentId: d.parentId,
      updatedAt: d.updatedAt,
      role: d.acl[0]?.role,
    })),
  });
}
