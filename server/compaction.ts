import * as Y from "yjs";
import type { Prisma } from "@prisma/client";
import { prisma } from "./auth";
import { loadDocument } from "./persistence";

export interface CompactionResult {
  compactedThroughId: bigint;
  deletedUpdateCount: number;
  snapshotBytes: number;
}

/**
 * Compaction is the "biggest differentiator" the spec calls out: an
 * append-only DocumentUpdate log grows forever, and cold loads get
 * slower every day as loadDocument() replays more and more rows. This
 * collapses everything currently in the log into one full-state
 * snapshot, records where the log was truncated (compactedThroughId),
 * and deletes the now-redundant rows.
 *
 * Deliberately NOT the same thing as a phase-3 named version: those are
 * user-facing history entries kept forever. A compaction checkpoint is
 * an internal implementation detail - if it didn't exist, reconstruction
 * would still be correct, just slower.
 */
export async function compactDocument(documentId: string): Promise<CompactionResult | null> {
  // Find the newest update currently in the log; everything up to and
  // including it is what this compaction will cover. Doing this as a
  // fixed cutoff (rather than "delete everything") means an update that
  // arrives WHILE compaction is running is never at risk of being
  // dropped - it simply lands after the cutoff and survives untouched.
  const latest = await prisma.documentUpdate.findFirst({
    where: { documentId },
    orderBy: { id: "desc" },
    select: { id: true },
  });
  if (!latest) return null; // nothing to compact yet

  const doc = await loadDocument(documentId);
  const snapshotData = Y.encodeStateAsUpdate(doc);

  const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    await tx.documentSnapshot.create({
      data: {
        documentId,
        data: Buffer.from(snapshotData),
        label: null,
        compactedThroughId: latest.id,
      },
    });
    const deleted = await tx.documentUpdate.deleteMany({
      where: { documentId, id: { lte: latest.id } },
    });
    return deleted.count;
  });

  return {
    compactedThroughId: latest.id,
    deletedUpdateCount: result,
    snapshotBytes: snapshotData.byteLength,
  };
}

export const COMPACTION_UPDATE_THRESHOLD = 5000;

/**
 * Best-effort, non-blocking: called after persisting an update once the
 * log has grown past a threshold. Runs at most once per check (the
 * caller is responsible for not calling this on every single update -
 * see rooms.ts's updatesSinceCompactionCheck counter).
 */
export async function compactIfOverThreshold(documentId: string): Promise<void> {
  const count = await prisma.documentUpdate.count({ where: { documentId } });
  if (count >= COMPACTION_UPDATE_THRESHOLD) {
    await compactDocument(documentId);
  }
}
