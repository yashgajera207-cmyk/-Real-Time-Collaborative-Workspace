import * as Y from "yjs";
import { prisma } from "./auth";

/**
 * Reconstructs a document's state by replaying every stored update in
 * insertion order. This is the "kill the server mid-session, restart,
 * reload" guarantee from the phase 1 spec - the log is the source of
 * truth, the in-memory Y.Doc is just a cache of it.
 */
export async function loadDocument(documentId: string): Promise<Y.Doc> {
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

export async function appendUpdate(
  documentId: string,
  userId: string,
  update: Uint8Array
): Promise<void> {
  await prisma.documentUpdate.create({
    data: {
      documentId,
      createdById: userId,
      data: Buffer.from(update),
    },
  });
}
