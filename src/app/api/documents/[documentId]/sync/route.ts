import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { resolveDocumentRole, canRead, canBroadcastEdits } from "@/lib/permissions";
import * as Y from "yjs";

export const dynamic = "force-dynamic";

// In-memory presence cache for active online awareness states per document
const documentAwarenessCache = new Map<
  string,
  Map<string, { update: string; updatedAt: number }>
>();

// GET /api/documents/:documentId/sync -> Return compiled Yjs doc state and active online user awareness
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

  // 4. Gather active online user awareness states (active in last 12 seconds)
  const now = Date.now();
  const activeAwareness: string[] = [];
  const roomPresence = documentAwarenessCache.get(documentId);
  if (roomPresence) {
    for (const [key, val] of Array.from(roomPresence.entries())) {
      if (now - val.updatedAt > 12000) {
        roomPresence.delete(key);
      } else {
        activeAwareness.push(val.update);
      }
    }
  }

  return NextResponse.json({
    state: base64State,
    lastUpdateId,
    updateCount: updates.length,
    awarenessStates: activeAwareness,
  });
}

// POST /api/documents/:documentId/sync -> Persist local Yjs update and update live presence/cursor awareness
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

  // Handle awareness/presence update
  if (body.awareness && typeof body.awareness === "string") {
    let roomPresence = documentAwarenessCache.get(documentId);
    if (!roomPresence) {
      roomPresence = new Map();
      documentAwarenessCache.set(documentId, roomPresence);
    }
    const clientKey = `${session.user.id}:${body.clientId || "default"}`;
    roomPresence.set(clientKey, { update: body.awareness, updatedAt: Date.now() });
  }

  let savedId = "0";

  // Handle document Yjs content update
  if (body.update && typeof body.update === "string") {
    const updateBytes = Buffer.from(body.update, "base64");

    const saved = await prisma.documentUpdate.create({
      data: {
        documentId,
        data: updateBytes,
        createdById: session.user.id,
      },
    });
    savedId = saved.id.toString();

    // Check update count for snapshot compaction
    const count = await prisma.documentUpdate.count({ where: { documentId } });
    if (count > 50) {
      void compactSnapshots(documentId);
    }
  }

  return NextResponse.json({ ok: true, updateId: savedId });
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
