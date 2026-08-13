import * as Y from "yjs";
import { prisma } from "@/lib/prisma";

export async function reconstructDocument(documentId: string): Promise<Y.Doc> {
  const doc = new Y.Doc();

  const checkpoint = await prisma.documentSnapshot.findFirst({
    where: { documentId, compactedThroughId: { not: null } },
    orderBy: { compactedThroughId: "desc" },
    select: { data: true, compactedThroughId: true },
  });

  const updates = await prisma.documentUpdate.findMany({
    where: {
      documentId,
      ...(checkpoint ? { id: { gt: checkpoint.compactedThroughId! } } : {}),
    },
    orderBy: { id: "asc" },
    select: { data: true },
  });

  Y.transact(doc, () => {
    if (checkpoint) Y.applyUpdate(doc, new Uint8Array(checkpoint.data));
    for (const row of updates) {
      Y.applyUpdate(doc, new Uint8Array(row.data));
    }
  });

  return doc;
}
