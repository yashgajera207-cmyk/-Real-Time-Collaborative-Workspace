# 7. Version restore clones content into the live doc, instead of computing a patch

## Status
Accepted (phase 3)

## Context
Restoring an old version has to produce a **new** operation that
converges with whatever anyone else is concurrently editing - not a
destructive overwrite, and not something that corrupts the CRDT if two
people restore different versions at once.

## Decision
`VersionHistoryPanel.tsx: restoreVersion` decodes the target snapshot
into a throwaway `Y.Doc`, then inside a single `Y.transact` on the
*live* document: deletes the live fragment's current children and
inserts clones (via Yjs's own `.clone()`) of the snapshot fragment's
children. This produces one ordinary Yjs update, which flows through
`doc.on('update')` → the provider → the WS server → persisted and
broadcast, exactly like a normal keystroke.

## Why not a computed diff
A minimal patch between two document states would be more surgical, but
Yjs doesn't provide a general "diff two XmlFragments and produce the
minimal transform" primitive, and hand-rolling one is a lot of
surface area for subtle bugs given the explicit warning in the brief
that CRDT code fails silently under specific interleavings. Delete-all
+ clone-insert is coarser (it re-creates every node rather than patching
just what changed) but it's built entirely out of operations Yjs
guarantees are correct, and it's still just one transaction - one
update - either way.

## Consequence
Every prior version, and the full update log up to the compaction
checkpoint (ADR 6), is completely unaffected by a restore. Restoring
twice in a row, by two different people, converges the same way any two
concurrent edits do.
