# 6. Compaction checkpoints reuse the version-history snapshot table

## Status
Accepted (phase 4)

## Context
Phase 3 already has `DocumentSnapshot`: full encoded Yjs states, kept
forever, used for the user-facing version history and restore. Phase 4
needs something structurally identical - a full encoded state at a point
in time - but for a different purpose: an internal checkpoint that lets
`loadDocument()` skip replaying the entire update log from empty.

## Decision
One table, one extra nullable column: `DocumentSnapshot.compactedThroughId`.
- `null` → an ordinary named/autosave version-history entry. Kept
  forever. Restoring reads `data` directly and never touches the update
  log at all.
- non-null → a compaction checkpoint. Means "every `DocumentUpdate` row
  with `id <=` this value is summarized in `data`, and has been
  deleted." `loadDocument()` looks up the most recent one of these
  (`ORDER BY compactedThroughId DESC LIMIT 1`) and replays only the
  updates after it, instead of everything.

## Why not two tables
They're the same shape (`documentId`, `data: Bytes`, `createdAt`), and a
second table would need its own index, its own migration, and its own
"which one is authoritative for reconstruction" logic duplicated between
`server/persistence.ts` and `src/lib/reconstruct.ts` anyway. One column
distinguishes intent without duplicating structure.

## Consequence for version history
A version created before a compaction ran is completely unaffected -
its `data` is a full state, independent of whatever happened to the
update log afterward. Compaction only ever deletes `DocumentUpdate`
rows, never `DocumentSnapshot` rows, so "restore doesn't destroy
history" (phase 3's guarantee) continues to hold even after phase 4's
truncation kicks in.
