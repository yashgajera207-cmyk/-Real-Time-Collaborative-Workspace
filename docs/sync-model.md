# Sync, persistence, and compaction

## The moving pieces

```
┌──────────────┐        HTTP (session/share auth,        ┌──────────────┐
│   Next.js    │◄──────  CRUD, short-lived WS tokens) ───►│   Postgres   │
│   app        │                                           │              │
└──────┬───────┘                                           │  Workspace   │
       │                                                    │  Document    │
       │ mints a 60s token scoped to                        │  DocumentAcl │
       │ (userId, documentId) or                            │  DocumentUpdate  (append-only log)
       │ (shareToken, documentId)                           │  DocumentSnapshot (versions + compaction checkpoints)
       ▼                                                    │  CommentThread/Comment
┌──────────────┐   wss://  ┌───────────────────────────┐    │  ShareLink   │
│   Browser    │◄─────────►│   WS server (server/)     │───►│              │
│  Y.Doc +     │  binary   │   one Y.Doc + Awareness    │    └──────────────┘
│  y-indexeddb │  frames   │   per open room, in RAM    │
└──────────────┘           └───────────────────────────┘
```

The Next.js app never touches a live Yjs document. It issues tokens and
serves CRUD/version/comment/search endpoints against Postgres directly
(reconstructing a doc from the log when it needs content, e.g. to save a
version - see `src/lib/reconstruct.ts`). The WS server is the only
process that holds a document "live", and it does that only in memory,
never as its durability boundary.

## The wire protocol

Three message types, one leading byte, both directions
(`server/protocol.ts` / `src/lib/sync-protocol.ts`):

| Byte | Name | Meaning |
|---|---|---|
| `0` | `SYNC_STEP` | "Here's my state vector - diff yourself against it." |
| `1` | `UPDATE` | "Apply this Yjs update." Used both for the diff produced in response to a `SYNC_STEP` and for every live edit afterwards. |
| `2` | `AWARENESS` | A presence update (cursor, selection, online status). Never persisted. |

On connect (and on every reconnect), the client sends its current state
vector as `SYNC_STEP` - which already reflects anything restored from
the local `y-indexeddb` cache while offline. The server replies with
only the `UPDATE` diff the client is missing, not the whole document.
This is the delta-sync guarantee from phase 2: a reconnect after a long
gap transfers roughly the size of what actually changed, not the size of
the document.

## Durability

Every `UPDATE` from an editor-or-above is `await`ed into
`DocumentUpdate` **before** it's applied to the in-memory doc or
broadcast to anyone else (`server/index.ts: handleMessage`, case
`MSG_UPDATE`). This ordering is what makes "kill the server mid-session,
restart, reload" lose nothing: by the time a client sees an edit reflected
anywhere, it's already durable.

## Reconstruction and compaction

`loadDocument()` (`server/persistence.ts`) is the single source of truth
for "what does this document currently contain":

1. Look up the most recent `DocumentSnapshot` with a non-null
   `compactedThroughId` (a compaction checkpoint - see ADR 6).
2. If one exists, start from its full encoded state and replay only
   `DocumentUpdate` rows with `id > compactedThroughId`.
3. If none exists, replay the entire log from empty (exactly how phases
   1-3 always worked).

This function is called in three places, all requiring the same
guarantee: a fresh room being loaded for the first time
(`server/rooms.ts: getOrCreateRoom`), the compaction routine itself
(needs the current full state before it can summarize it), and the
benchmark script.

**Compaction** (`server/compaction.ts: compactDocument`) is triggered
automatically once a room's applied-update counter crosses 200 since the
last check (`server/index.ts`, `updatesSinceCompactionCheck`), which then
checks whether the *total* log for that document has crossed
`COMPACTION_UPDATE_THRESHOLD` (5,000 by default) before actually doing
anything - so an active room doesn't pay the cost of a size check on
every single keystroke, and a room under the threshold never compacts at
all. When it does run: it finds the newest update currently in the log,
replays up to exactly that point, writes one snapshot row marking that
cutoff, and deletes every `DocumentUpdate` row at or before it - all
inside one transaction, so an update arriving mid-compaction simply lands
after the cutoff and is untouched.

See `docs/perf/README.md` for how to reproduce the before/after cold-load
timings this is meant to fix.

## Room lifecycle

A room (`Y.Doc` + `Awareness` + member set) lives in the WS server's
memory for as long as it's useful:

- **Created** transparently on first join (`getOrCreateRoom`), loaded via
  the reconstruction path above.
- **Evicted** once it has zero connected members and hasn't seen activity
  for `IDLE_ROOM_EVICTION_MS` (5 minutes by default), checked every 60
  seconds (`server/index.ts`, `evictionTimer`). Eviction only ever frees
  memory - nothing durable depends on a room staying resident, because
  every update was already appended to Postgres before it was ever
  applied here.
- **Rehydrated** transparently the next time anyone joins - it's the same
  `getOrCreateRoom` call as the very first join, since there's no
  separate "cold" vs "warm" code path.
