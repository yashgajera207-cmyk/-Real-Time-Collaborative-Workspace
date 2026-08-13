import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { resolveDocumentRole, canRead, canBroadcastEdits } from "@/lib/permissions";
import * as Y from "yjs";

export const dynamic = "force-dynamic";

// GET /api/documents/:documentId/sync -> Return compiled Yjs doc state and latest updates
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ documentId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { documentId } = await params;
  const role = await resolveDocumentRole(session.user.id, documentId);
  if (!canRead(role)) return NextResponse.json({ error: "not found" }, { status: 404 });

  // 1. Fetch latest snapshot if exists
  const snapshot = await prisma.documentSnapshot.findFirst({
    where: { documentId },
    orderBy: { createdAt: "desc" },
    select: { data: true, createdAt: true },
  });

  // 2. Fetch updates newer than snapshot
  const updates = await prisma.documentUpdate.findMany({
    where: {
      documentId,
      ...(snapshot ? { createdAt: { gt: snapshot.createdAt } } : {}),
    },
    orderBy: { id: "asc" },
    select: { id: true, data: true },
  });

  // 3. Compile Y.Doc
  const doc = new Y.Doc();
  if (snapshot) {
    Y.applyUpdate(doc, new Uint8Array(snapshot.data));
  }
  for (const u of updates) {
    Y.applyUpdate(doc, new Uint8Array(u.data));
  }

  const compiled = Y.encodeStateAsUpdate(doc);
  const base64State = Buffer.from(compiled).toString("base64");
  const lastUpdateId = updates.length > 0 ? updates[updates.length - 1]?.id.toString() ?? "0" : "0";

  return NextResponse.json({
    state: base64State,
    lastUpdateId,
    updateCount: updates.length,
  });
}

// POST /api/documents/:documentId/sync -> Persist local Yjs update
export async function POST(
  req: Request,
  { params }: { params: Promise<{ documentId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { documentId } = await params;
  const role = await resolveDocumentRole(session.user.id, documentId);
  if (!canBroadcastEdits(role)) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const body = await req.json();
  if (!body.update || typeof body.update !== "string") {
    return NextResponse.json({ error: "invalid update payload" }, { status: 400 });
  }

  const updateBytes = Buffer.from(body.update, "base64");

  // Save update
  const saved = await prisma.documentUpdate.create({
    data: {
      documentId,
      data: updateBytes,
      createdById: session.user.id,
    },
  });

  // Check update count for snapshot compaction
  const count = await prisma.documentUpdate.count({ where: { documentId } });
  if (count > 50) {
    // Perform async background compaction
    void compactSnapshots(documentId);
  }

  return NextResponse.json({ ok: true, updateId: saved.id.toString() });
}

async function compactSnapshots(documentId: string) {
  try {
    const allUpdates = await prisma.documentUpdate.findMany({
      where: { documentId },
      orderBy: { id: "asc" },
      select: { data: true },
    });

    const doc = new Y.Doc();
    for (const u of allUpdates) {
      Y.applyUpdate(doc, new Uint8Array(u.data));
    }

    const state = Y.encodeStateAsUpdate(doc);
    await prisma.documentSnapshot.create({
      data: {
        documentId,
        data: Buffer.from(state),
      },
    });

    // Keep only last 10 updates
    const updatesToKeep = await prisma.documentUpdate.findMany({
      where: { documentId },
      orderBy: { id: "desc" },
      take: 10,
      select: { id: true },
    });

    const keepIds = updatesToKeep.map((u) => u.id);
    await prisma.documentUpdate.deleteMany({
      where: {
        documentId,
        id: { notIn: keepIds },
      },
    });
  } catch (err) {
    console.error("Snapshot compaction error:", err);
  }
}
