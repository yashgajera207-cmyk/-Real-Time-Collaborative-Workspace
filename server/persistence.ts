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

/**
 * Yjs XmlFragment#toString() renders tag-wrapped content (roughly
 * "<paragraph>hello <bold>world</bold></paragraph>"). Good enough for a
 * search index once tags are stripped - we're not trying to render it,
 * just make its words findable.
 */
export function extractPlainText(doc: Y.Doc): string {
  const xml = doc.getXmlFragment("prosemirror").toString();
  return xml
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 20_000); // keep the index column bounded
}

export async function updateSearchText(documentId: string, doc: Y.Doc): Promise<void> {
  const searchText = extractPlainText(doc);
  await prisma.document.update({
    where: { id: documentId },
    data: { searchText, updatedAt: new Date() },
  });
}

export async function createSnapshot(
  documentId: string,
  doc: Y.Doc,
  options: { label?: string; createdById?: string } = {}
): Promise<void> {
  await prisma.documentSnapshot.create({
    data: {
      documentId,
      data: Buffer.from(Y.encodeStateAsUpdate(doc)),
      label: options.label ?? null,
      createdById: options.createdById ?? null,
    },
  });
}

