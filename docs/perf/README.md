# Performance notes

Both numbers the spec asks for - cold-load timings before/after
compaction, and reconnect delta payload sizes - need a real Postgres
connection and a running WS server to capture. This sandbox has neither
(no database access), so what follows is how to reproduce them yourself,
plus what to expect and why, rather than fabricated numbers.

## Cold load before/after compaction

```bash
npm run bench:compaction               # defaults to 50,000 synthetic updates
npm run bench:compaction -- 200000     # or pick your own count
```

`scripts/bench-compaction.ts`:
1. Seeds a scratch document with N synthetic `DocumentUpdate` rows (batched
   inserts, not one round-trip per row).
2. Times `loadDocument()` - a cold replay of the entire log from empty.
3. Runs `compactDocument()` and times that too.
4. Times `loadDocument()` again - now a checkpoint restore plus replaying
   zero rows, since nothing was written after the compaction ran.

### What to expect

Replay time scales roughly linearly with update count - each
`Y.applyUpdate` call is small, but 50,000 of them, plus the Postgres
round-trip to fetch all 50,000 rows, adds up. After compaction,
`loadDocument()` fetches one snapshot row and applies one update - the
cost becomes roughly constant regardless of how large the log was before
compaction ran. The exact speedup depends on your Postgres latency and
update size, which is why this script measures it on your own setup
rather than asserting a number here.

### Why this matters (from the spec)

> Almost nobody gets to this, and it's the biggest differentiator in the
> task.

An append-only log without compaction means cold loads get slower every
day a document is edited. This is the mechanism that stops that.

## Reconnect delta payload size

Every `SYNC_STEP` exchange logs its size server-side already - no
separate script needed:

```bash
npm run dev
# in another terminal, tail the WS server's structured logs and look for:
#   "sent delta sync payload" { documentId, userId, deltaBytes }
```

To see it shrink in practice: open a document, go offline in DevTools
(Network → Offline) for a couple of minutes while someone else keeps
editing, then reconnect. The connection badge in the editor itself also
surfaces the last transfer size (phase 2's `onSyncStats` →
`ConnectionStatus`'s "· NNN B" suffix) - hover it for the exact figure
without needing to read server logs at all.

### Why it stays small regardless of gap length

The delta is `Y.encodeStateAsUpdate(doc, clientStateVector)` - proportional
to *what changed since the client's last known state*, not to how long the
client was gone or how large the whole document is. A two-minute gap and
a two-day gap produce comparably sized deltas as long as a comparable
amount of actual editing happened during each.
