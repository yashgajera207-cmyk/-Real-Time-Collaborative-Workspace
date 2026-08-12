import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireDocumentRole } from "@/lib/permissions";
import { DocumentRole } from "@prisma/client";

// PATCH /api/documents/:documentId/comments/:threadId/resolve
// Toggles resolved/unresolved. Never deletes the thread - resolving is
// just a status flip so the conversation stays in the timeline.

const schema = z.object({ resolved: z.boolean() });

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ documentId: string; threadId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { documentId, threadId } = await params;
  try {
    await requireDocumentRole(session.user.id, documentId, DocumentRole.commenter);
  } catch {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const thread = await prisma.commentThread.findUnique({ where: { id: threadId } });
  if (!thread || thread.documentId !== documentId) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const updated = await prisma.commentThread.update({
    where: { id: threadId },
    data: { resolved: parsed.data.resolved },
  });

  return NextResponse.json({ id: updated.id, resolved: updated.resolved });
}
