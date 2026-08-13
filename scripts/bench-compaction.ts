/**
 * Reproduces the "cold load a document with 50,000+ updates, show me
 * before and after timings" demo from the phase 4 spec.
 *
 * Seeds a scratch document with a configurable number of synthetic Yjs
 * updates, times loadDocument() (a cold replay of the whole log), runs
 * compactDocument(), then times loadDocument() again. Requires a real
 * Postgres connection via DATABASE_URL - this sandbox couldn't run it
 * (no DB access), so the numbers below are illustrative of the *shape*
 * of the result, not a captured run. Run it yourself:
 *
 *   npm run bench:compaction               # defaults to 50,000 updates
 *   npm run bench:compaction -- 200000     # or pick your own count
 */
import * as Y from "yjs";
import { PrismaClient } from "@prisma/client";
import { loadDocument } from "../server/persistence";
import { compactDocument } from "../server/compaction";

const prisma = new PrismaClient();

const UPDATE_COUNT = Number(process.argv[2] ?? 50_000);
const BENCH_DOCUMENT_ID = "bench-compaction-scratch-doc";
const BENCH_WORKSPACE_ID = "bench-compaction-scratch-ws";
const BENCH_USER_ID = "bench-compaction-scratch-user";

async function ensureScratchFixtures(): Promise<void> {
  await prisma.user.upsert({
    where: { id: BENCH_USER_ID },
    update: {},
    create: { id: BENCH_USER_ID, name: "Bench", email: "bench@quill.dev", passwordHash: "n/a" },
  });
  await prisma.workspace.upsert({
    where: { id: BENCH_WORKSPACE_ID },
    update: {},
    create: { id: BENCH_WORKSPACE_ID, name: "Bench", slug: "bench-compaction" },
  });
  await prisma.document.upsert({
    where: { id: BENCH_DOCUMENT_ID },
    update: {},
    create: {
      id: BENCH_DOCUMENT_ID,
      title: "Compaction benchmark scratch doc",
      workspaceId: BENCH_WORKSPACE_ID,
      createdById: BENCH_USER_ID,
    },
  });
}

async function seedUpdates(count: number): Promise<void> {
  console.log(`Seeding ${count} synthetic updates...`);
  const doc = new Y.Doc();
  const text = doc.getXmlFragment("prosemirror");
  const batch: { documentId: string; createdById: string; data: Buffer }[] = [];

  doc.on("update", (update: Uint8Array) => {
    batch.push({ documentId: BENCH_DOCUMENT_ID, createdById: BENCH_USER_ID, data: Buffer.from(update) });
  });

  for (let i = 0; i < count; i++) {
    Y.transact(doc, () => {
      // Cheap, deterministic mutation - what it contains doesn't matter,
      // only that each one produces a distinct persisted update row.
      text.insert(text.length, [new Y.XmlText(`word${i} `)]);
    });
    if (batch.length >= 1000) {
      await prisma.documentUpdate.createMany({ data: batch.splice(0, batch.length) });
      process.stdout.write(`\r  ${i + 1}/${count}`);
    }
  }
  if (batch.length > 0) await prisma.documentUpdate.createMany({ data: batch });
  console.log("\nSeeding done.");
}

async function main() {
  await ensureScratchFixtures();

  const existing = await prisma.documentUpdate.count({ where: { documentId: BENCH_DOCUMENT_ID } });
  if (existing < UPDATE_COUNT) {
    await seedUpdates(UPDATE_COUNT - existing);
  }

  console.log("\n--- Cold load BEFORE compaction ---");
  const beforeStart = performance.now();
  await loadDocument(BENCH_DOCUMENT_ID);
  const beforeMs = performance.now() - beforeStart;
  console.log(`loadDocument(): ${beforeMs.toFixed(1)}ms`);

  console.log("\n--- Compacting ---");
  const compactStart = performance.now();
  const result = await compactDocument(BENCH_DOCUMENT_ID);
  const compactMs = performance.now() - compactStart;
  console.log(`compactDocument(): ${compactMs.toFixed(1)}ms`, result);

  console.log("\n--- Cold load AFTER compaction ---");
  const afterStart = performance.now();
  await loadDocument(BENCH_DOCUMENT_ID);
  const afterMs = performance.now() - afterStart;
  console.log(`loadDocument(): ${afterMs.toFixed(1)}ms`);

  console.log("\n=== Summary ===");
  console.log(`Before: ${beforeMs.toFixed(1)}ms (replaying ${UPDATE_COUNT} rows)`);
  console.log(`After:  ${afterMs.toFixed(1)}ms (replaying 0 rows - 1 snapshot only)`);
  console.log(`Speedup: ${(beforeMs / Math.max(afterMs, 0.01)).toFixed(1)}x`);

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
