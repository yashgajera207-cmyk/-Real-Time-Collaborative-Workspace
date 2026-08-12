import * as Y from "yjs";
import { prisma } from "@/lib/prisma";

/**
 * Reconstructs a document by replaying its full update log. Used by API
 * routes that need document content but aren't the long-lived WS process
 * holding the live in-memory doc - manual "save a version" snapshots,
 * mainly. This never talks to the WS server; it works straight from the
 * same durable log the WS server itself replays after a restart.
 */
export async function reconstructDocument(documentId: string): Promise<Y.Doc> {
  const doc = new Y.Doc();
  const updates = await prisma.documentUpdate.findMany({
    where: { documentId },
    orderBy: { id: "asc" },
    select: { data: true },
  });

  Y.transact(doc, () => {
    for (const row of updates) {
      Y.applyUpdate(doc, new Uint8Array(row.data));
    }
  });

  return doc;
}
