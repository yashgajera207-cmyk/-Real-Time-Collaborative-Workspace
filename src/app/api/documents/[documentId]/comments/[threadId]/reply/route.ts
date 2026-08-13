import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireDocumentRole } from "@/lib/permissions";
import { notifyMentions, notifyReply } from "@/lib/notify";
import { DocumentRole } from "@prisma/client";

const schema = z.object({
  body: z.string().min(1).max(4000),
  mentionedUserIds: z.array(z.string()).default([]),
});

export async function POST(
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
  const data = parsed.data;

  const thread = await prisma.commentThread.findUnique({ where: { id: threadId } });
  if (!thread || thread.documentId !== documentId) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const comment = await prisma.comment.create({
    data: {
      threadId,
      body: data.body,
      authorId: session.user.id,
      mentions: { create: data.mentionedUserIds.map((mentionedUserId) => ({ mentionedUserId })) },
    },
    include: { author: { select: { id: true, name: true } } },
  });

  const actorName = session.user.name ?? "Someone";
  await notifyReply({
    documentId,
    threadId,
    actorId: session.user.id,
    actorName,
    threadOwnerId: thread.createdById,
  });
  await notifyMentions({
    documentId,
    threadId,
    actorId: session.user.id,
    actorName,
    mentionedUserIds: data.mentionedUserIds,
  });

  return NextResponse.json(comment, { status: 201 });
}
