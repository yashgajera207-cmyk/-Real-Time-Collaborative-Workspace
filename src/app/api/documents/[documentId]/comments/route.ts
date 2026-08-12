import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireDocumentRole, resolveDocumentRole, canRead } from "@/lib/permissions";
import { notifyMentions } from "@/lib/notify";
import { DocumentRole } from "@prisma/client";

// GET  /api/documents/:documentId/comments -> every thread + its comments
// POST /api/documents/:documentId/comments -> open a new thread, anchored
//      to a Yjs RelativePosition pair the client already computed from
//      the live editor selection (see src/lib/comment-anchor.ts).

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ documentId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { documentId } = await params;
  const role = await resolveDocumentRole(session.user.id, documentId);
  if (!canRead(role)) return NextResponse.json({ error: "not found" }, { status: 404 });

  const threads = await prisma.commentThread.findMany({
    where: { documentId },
    orderBy: { createdAt: "asc" },
    include: {
      createdBy: { select: { id: true, name: true } },
      comments: {
        orderBy: { createdAt: "asc" },
        include: { author: { select: { id: true, name: true } } },
      },
    },
  });

  return NextResponse.json(
    threads.map((t: (typeof threads)[number]) => ({
      id: t.id,
      resolved: t.resolved,
      quotedText: t.quotedText,
      anchorStart: Buffer.from(t.anchorStart).toString("base64"),
      anchorEnd: Buffer.from(t.anchorEnd).toString("base64"),
      createdAt: t.createdAt,
      createdBy: t.createdBy,
      comments: t.comments.map((c: (typeof t.comments)[number]) => ({
        id: c.id,
        body: c.body,
        createdAt: c.createdAt,
        author: c.author,
      })),
    })),
    {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      },
    }
  );
}

const createSchema = z.object({
  anchorStart: z.string().min(1),
  anchorEnd: z.string().min(1),
  quotedText: z.string().max(2000),
  body: z.string().min(1).max(4000),
  mentionedUserIds: z.array(z.string()).default([]),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ documentId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { documentId } = await params;
  try {
    await requireDocumentRole(session.user.id, documentId, DocumentRole.commenter);
  } catch {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const parsed = createSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const data = parsed.data;

  const thread = await prisma.commentThread.create({
    data: {
      documentId,
      anchorStart: Buffer.from(data.anchorStart, "base64"),
      anchorEnd: Buffer.from(data.anchorEnd, "base64"),
      quotedText: data.quotedText,
      createdById: session.user.id,
      comments: {
        create: {
          body: data.body,
          authorId: session.user.id,
          mentions: { create: data.mentionedUserIds.map((mentionedUserId) => ({ mentionedUserId })) },
        },
      },
    },
  });

  const fullThread = await prisma.commentThread.findUnique({
    where: { id: thread.id },
    include: {
      createdBy: { select: { id: true, name: true } },
      comments: {
        orderBy: { createdAt: "asc" },
        include: { author: { select: { id: true, name: true } } },
      },
    },
  });

  await notifyMentions({
    documentId,
    threadId: thread.id,
    actorId: session.user.id,
    actorName: session.user.name ?? "Someone",
    mentionedUserIds: data.mentionedUserIds,
    commentBody: data.body,
  });

  return NextResponse.json(
    {
      id: fullThread!.id,
      resolved: fullThread!.resolved,
      quotedText: fullThread!.quotedText,
      anchorStart: Buffer.from(fullThread!.anchorStart).toString("base64"),
      anchorEnd: Buffer.from(fullThread!.anchorEnd).toString("base64"),
      createdAt: fullThread!.createdAt,
      createdBy: fullThread!.createdBy,
      comments: fullThread!.comments.map((c) => ({
        id: c.id,
        body: c.body,
        createdAt: c.createdAt,
        author: c.author,
      })),
    },
    { status: 201 }
  );
}
