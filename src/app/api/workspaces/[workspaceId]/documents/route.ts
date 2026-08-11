import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { DocumentRole } from "@prisma/client";

// POST /api/workspaces/:workspaceId/documents -> create a document.
// Creator becomes owner via an explicit DocumentAcl row.

const createSchema = z.object({ title: z.string().min(1).max(200) });

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

  const document = await prisma.document.create({
    data: {
      title: parsed.data.title,
      workspaceId,
      createdById: session.user.id,
      acl: { create: { userId: session.user.id, role: DocumentRole.owner } },
    },
  });

  return NextResponse.json(document, { status: 201 });
}
