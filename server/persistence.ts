import * as Y from "yjs";
import { prisma } from "./auth";

/**
 * Reconstructs a document's state. Starts from the most recent compaction
 * checkpoint if one exists (a full encoded state covering everything up
 * to some update id) and replays only the updates after it, instead of
 * replaying the entire log from empty every time. This is what keeps
 * cold-load time bounded as a document's history grows - see
 * docs/perf/README.md for before/after numbers and how to reproduce them.
 */
export async function loadDocument(documentId: string): Promise<Y.Doc> {
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
