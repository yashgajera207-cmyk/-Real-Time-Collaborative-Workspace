# 4. Comments are anchored with Yjs RelativePosition, not character offsets

## Status
Accepted (phase 3)

## Context
A comment needs to stay attached to the text it was made on as other
people concurrently edit the document - including edits before the
comment, edits after it, and deletion of the commented text itself.

## Decision
`CommentThread.anchorStart` / `anchorEnd` store encoded Yjs
`RelativePosition`s (via `y-prosemirror`'s
`absolutePositionToRelativePosition`), not integer offsets. Every render,
`CommentHighlightExtension.ts` re-resolves both ends back to live
positions with `relativePositionToAbsolutePosition`. If either end
resolves to `null`, the underlying content is gone and the thread is
shown as orphaned rather than pinned to the wrong words.

## Why not offsets
An offset is a snapshot of "where the text was" at one instant. The
moment anyone edits anything before that offset, it's simply wrong - not
approximately wrong, silently wrong, pointing at different words with no
signal that anything happened. This is exactly the failure mode the
original brief calls out by name.

## Why comments live in Postgres, not the Yjs document
Marks embedded directly in the CRDT document would also survive
concurrent edits reasonably well (they're part of the synced structure),
but thread metadata - resolved/unresolved, replies, mentions - doesn't
belong in the document content, needs its own queryable/indexable shape,
and shouldn't grow the update log or the document's clone-based restore
path (ADR 7). Keeping the anchor as a small encoded RelativePosition
pair in Postgres gets the concurrency-safety property without either
cost.
