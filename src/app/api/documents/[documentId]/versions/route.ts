import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireDocumentRole } from "@/lib/permissions";
import { reconstructDocument } from "@/lib/reconstruct";
import { DocumentRole } from "@prisma/client";
import * as Y from "yjs";

// GET  /api/documents/:documentId/versions -> timeline (metadata only)
// POST /api/documents/:documentId/versions -> save the CURRENT state as a
//      named version. Reconstructs from the durable update log, so it
//      reflects everything persisted so far, live room or not.

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ documentId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { documentId } = await params;
  try {
    await requireDocumentRole(session.user.id, documentId, DocumentRole.viewer);
  } catch {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const versions = await prisma.documentSnapshot.findMany({
    where: { documentId },
    orderBy: { createdAt: "desc" },
    include: { createdBy: { select: { name: true } } },
  });

  return NextResponse.json(
    versions.map((v: (typeof versions)[number]) => ({
      id: v.id,
      label: v.label,
      createdAt: v.createdAt,
      createdByName: v.createdBy?.name ?? null,
    }))
  );
}

const createSchema = z.object({ label: z.string().min(1).max(80).optional() });

export async function POST(
  req: Request,
  { params }: { params: Promise<{ documentId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { documentId } = await params;
  try {
    // Commenters and viewers can browse history, but only editors+ can
    // pin a named version - same rank as being allowed to change content.
    await requireDocumentRole(session.user.id, documentId, DocumentRole.editor);
  } catch {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const parsed = createSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const doc = await reconstructDocument(documentId);
  const snapshot = await prisma.documentSnapshot.create({
    data: {
      documentId,
      data: Buffer.from(Y.encodeStateAsUpdate(doc)),
      label: parsed.data.label ?? "Manual save",
      createdById: session.user.id,
    },
  });

  return NextResponse.json({ id: snapshot.id, label: snapshot.label, createdAt: snapshot.createdAt }, { status: 201 });
}
