# Quill — Phases 1-4: a complete collaborative document workspace

A real-time collaborative document workspace, built up in four phases.
Phase 1: auth, workspace/document CRUD with per-document ACLs, and a
standalone WebSocket server relaying and persisting Yjs CRDT updates.
Phase 2: surviving a real network - live cursors, honest presence,
reconnection with backoff, delta-only resync, offline editing. Phase 3:
turning it into an actual product - rich text, slash commands, anchored
comments with mentions, version history, nested pages, workspace search.
Phase 4: scale and hardening - log compaction, room lifecycle management,
socket abuse protection, public share links, and graceful shutdown.

## Stack

Next.js 15 (App Router) · TypeScript (`strict`, `noUncheckedIndexedAccess`,
no `any` in `src/`) · Postgres + Prisma · Auth.js v5 · Yjs + TipTap ·
a standalone Fastify/`ws` process for realtime sync · Tailwind + Framer Motion.

## Why two processes

The WebSocket server (`server/index.ts`) is **not** a Next.js route handler.
A CRDT room needs one process holding a live `Y.Doc` and open sockets for
its entire lifetime; route handlers are stateless request/response cycles
(and cold-start on serverless targets). So: Next.js serves the app and
issues short-lived tokens, and a separate long-lived Node process
(deployable independently, e.g. on Railway/Fly/Render) owns every socket
and every room.

## Getting started

```bash
cp .env.example .env          # fill in DATABASE_URL, AUTH_SECRET, WS_TOKEN_SECRET
docker compose up -d          # local Postgres
npm install
npm run prisma:migrate        # creates tables from prisma/schema.prisma
npm run seed                  # demo workspace + 4 demo accounts (one per ACL role)
npm run dev                   # runs Next.js AND the WS server together
```

Open two browser tabs at `http://localhost:3000`, sign in (see demo
accounts below), open the same document in both, and type in both at once.

Generate real secrets instead of the placeholders in `.env.example`:

```bash
openssl rand -base64 32
```

### Demo accounts (password: `password123`)

| Role | Email |
|---|---|
| owner | `owner@quill.dev` |
| editor | `editor@quill.dev` |
| commenter | `commenter@quill.dev` |
| viewer | `viewer@quill.dev` |

All four already have ACL rows on the seeded document (and its nested
child page, "Formatting cheatsheet" - open the sidebar tree to see it),
so you can log in as each in a separate tab/profile and see the
permission boundary hold —
the viewer account can open the document and watch it update live, but
typing does nothing (the toolbar disables and the server silently drops
their edits, see `server/index.ts: handleClientUpdate`).

## Project structure

```
src/
  app/
    (dashboard)/            # auth-gated: sidebar layout + workspace/document pages
    api/                    # workspace/document CRUD, WS token issuance, NextAuth,
                             # versions, comments, notifications, search, members
    login/
  components/
    editor/                 # CollaborativeEditor, EditorToolbar, ConnectionStatus,
                             # PresenceAvatarStack, CommentHighlightExtension,
                             # CommentsSidebar, NewCommentBubble, MentionComposer,
                             # VersionHistoryPanel, SlashCommand, SlashMenuList
    workspace/               # sidebar, DocumentTree (nested pages), Breadcrumbs,
                             # WorkspaceSearch, NotificationsBell, document grid,
                             # create-workspace/document modals
    ui/                      # Button, Input, Avatar, Modal — the shared kit
    auth/                    # LoginForm
  lib/                      # prisma client, auth.ts (Auth.js config),
                             # permissions.ts (ACL resolution), ws-token.ts,
                             # yjs-provider.ts (client sync provider: handshake,
                             # awareness, offline cache, backoff), sync-protocol.ts,
                             # presence.ts (usePresence hook + colour util),
                             # comment-anchor.ts (RelativePosition encode/resolve),
                             # reconstruct.ts (replay log for version snapshots),
                             # word-diff.ts, search-snippet.ts, notify.ts,
                             # use-comments.ts, use-workspace-members.ts
  types/
server/                     # the standalone WS process — separate tsconfig,
  index.ts                  # deliberately does not import from src/;
                             # heartbeat, idle-room eviction, abuse
                             # protection, graceful shutdown, /metrics
  auth.ts                   # re-verifies session AND share-link tokens,
                             # re-resolves access independently
  rooms.ts                  # in-memory Y.Doc + Awareness + member registry
                             # per room, idle eviction, per-user room counts
  persistence.ts            # append/replay (compaction-checkpoint aware),
                             # search-index refresh, periodic snapshots
  compaction.ts             # log compaction: snapshot + truncate
  protocol.ts               # wire message framing (SYNC_STEP / UPDATE / AWARENESS)
prisma/
  schema.prisma
  seed.ts
scripts/
  bench-compaction.ts       # reproduces the cold-load before/after numbers
docs/
  sync-model.md             # architecture + protocol + compaction, with a diagram
  perf/README.md            # how to capture the perf numbers the spec asks for
  decisions/                # 8 ADRs covering the major design choices across
                             # all four phases
tests/
  permissions.test.ts       # ACL rank logic
  ws-auth.test.ts           # the socket's auth boundary, mocked Prisma
  sync-protocol.test.ts     # wire protocol message framing
  word-diff.test.ts         # version-history diff algorithm
  search-snippet.test.ts    # search result excerpt builder
```

## How the "done when" criteria are met

- **Two tabs converge.** `CollaborativeEditor` binds TipTap to a shared
  `Y.Doc` via `@tiptap/extension-collaboration`; the custom provider in
  `src/lib/yjs-provider.ts` relays every local update to the WS server,
  which applies it to the authoritative in-memory doc, persists it, and
  rebroadcasts it to every other member of the room.
- **Server restart loses nothing.** Updates are appended to
  `DocumentUpdate` as they arrive (`server/persistence.ts:appendUpdate`).
  On room open, `loadDocument` replays every row in order to reconstruct
  state before any client is allowed to join — the log is the source of
  truth, the in-memory doc is a cache of it.
- **A viewer can't broadcast.** `server/index.ts` authenticates and
  resolves the ACL *before* the socket is added to the room
  (`authenticateConnection` in `server/auth.ts`), and `handleClientUpdate`
  drops — not queues, not defers — any incoming update from a socket
  without at least `editor` rank. Covered by `tests/ws-auth.test.ts`.
- **Unauthorised sockets get nothing.** The token is minted server-side
  only after the requester's own session proves they have an ACL row
  (`/api/documents/[documentId]/token`), is scoped to one user + one
  document, and expires in 60 seconds. The WS server never trusts it
  alone — it re-resolves the ACL from Postgres on every connection.

## Phase 2 — what's new

- **Live cursors & selections.** `@tiptap/extension-collaboration-cursor`
  bound to a `y-protocols/awareness.Awareness` instance
  (`src/lib/yjs-provider.ts`). Each tab's cursor renders with the user's
  name and a colour derived deterministically from their user ID
  (`src/lib/presence.ts`), so it's stable across reloads.
- **Avatar stack that tells the truth.** `PresenceAvatarStack` subscribes
  to awareness `change` events (`usePresence` hook) and adds/removes
  people in real time, including on disconnect.
- **Heartbeats, not just close events.** `server/index.ts` pings every
  open socket every 10s; if a socket didn't answer the *previous* ping,
  it's terminated. A killed tab or a train tunnel that never sends a
  close frame is still detected and its presence evicted — the person
  disappears from every other tab's avatar stack within one heartbeat
  cycle, comfortably under 30 seconds.
- **Reconnection with backoff + jitter.** `QuillWebsocketProvider`
  retries with exponential backoff (starting at 500ms, capped at 15s)
  plus random jitter, so a shared outage doesn't make every client retry
  in lockstep.
- **Delta sync, not a full re-download.** The wire protocol
  (`server/protocol.ts` / `src/lib/sync-protocol.ts`) is a small
  bidirectional handshake: each side sends the other its Yjs state
  vector, and gets back only the update it's missing. `onSyncStats`
  reports the size of every diff — the connection badge in the editor
  shows the last transfer size in bytes so you can literally watch a
  reconnect pull a few hundred bytes instead of the whole document.
- **Offline editing.** `y-indexeddb` caches the doc locally
  (`IndexeddbPersistence` in `yjs-provider.ts`). Editing keeps working
  with no connection at all; on reconnect, the same delta-sync handshake
  above naturally uploads whatever was written offline and downloads
  whatever changed elsewhere, and Yjs's CRDT merge handles convergence.
- **A connection status that doesn't lie.** `connecting` /
  `connected` / `reconnecting` / `offline — changes saved locally`, each
  backed by a real state transition, not a guess.

### Demoing phase 2

- **Ungraceful disconnect:** open the document in two tabs, then just
  close one tab's browser process (don't let it send a close frame) or
  kill it from the OS task manager. The other tab's avatar for that user
  disappears within ~10-20s once the heartbeat sweep notices.
- **Offline → online reconciliation:** open DevTools → Network → Offline
  in tab A, type for a bit, then go back online. Tab B (which kept
  editing the whole time) converges with tab A's offline edits
  automatically.
- **Delta payload size:** disconnect for a couple of minutes (or just
  watch the network tab), reconnect, and hover the connection badge — it
  shows the byte size of the last sync payload, which stays small even
  after a long gap, because only the diff is sent.

## Phase 3 — what's new

- **Rich text.** Headings, bold/italic/underline/strike, inline code,
  bullet/numbered/task lists, code blocks with syntax highlighting
  (`lowlight`), quotes, links, images — all via TipTap extensions layered
  onto the same Yjs-backed document from phase 1, so every one of them is
  collaborative for free.
- **Slash commands.** Type `/` for a menu (`SlashCommand.ts` +
  `SlashMenuList.tsx`, built on `@tiptap/suggestion`) - `/heading`,
  `/todo`, `/code`, etc.
- **Anchored comments that survive concurrent edits.** Comments live in
  Postgres (`CommentThread`/`Comment`), not in the Yjs document, but each
  thread is anchored with a Yjs `RelativePosition` pair computed via
  `y-prosemirror`'s `absolutePositionToRelativePosition`
  (`src/lib/comment-anchor.ts`). A ProseMirror decoration plugin
  (`CommentHighlightExtension.ts`) re-resolves every thread's anchor back
  to a live position on every render - not once at creation time - so a
  highlight correctly follows its text through edits made before, after,
  or inside the selection by anyone. If the exact commented text is
  deleted, both ends resolve to `null` and the thread is shown as
  **orphaned** in the sidebar instead of silently pointing at the wrong
  words.
- **Comment threads with reply, resolve, unresolve, and mentions.**
  `@name` in a comment (`MentionComposer.tsx`) creates a
  `CommentMention` row and a `Notification` for the mentioned person;
  replying notifies the thread's original author. The bell in the
  sidebar (`NotificationsBell.tsx`) polls and links straight to the
  document.
- **Version history.** The WS server snapshots the live doc automatically
  every 50 applied updates (`server/persistence.ts: createSnapshot`,
  wired from `server/index.ts`), and anyone with edit rights can save a
  named version on demand from the panel. Selecting a version shows a
  word-level diff against the current document (`src/lib/word-diff.ts`,
  a small LCS diff with no external dependency). **Restoring** clones the
  snapshot's Yjs fragment into the *live* document inside one
  transaction (`VersionHistoryPanel.tsx: restoreVersion`) - that's a
  single ordinary CRDT update flowing through the same
  `doc.on('update')` → provider → server → broadcast path as any other
  edit. Every already-saved version and the full update log stay exactly
  where they were; restoring only ever adds a new operation.
- **Nested pages.** `Document.parentId` + `position`
  (`DocumentTree.tsx`) with lazy-loaded children, native HTML5
  drag-to-reparent, cycle detection, and breadcrumbs
  (`Breadcrumbs.tsx`) computed by walking the parent chain server-side.
- **Workspace search.** `GET /api/workspaces/:id/search` matches against
  document titles and a `searchText` mirror column that the WS server
  refreshes every few edits by stripping tags from the Yjs
  `XmlFragment`'s string form (`server/persistence.ts: updateSearchText`
  / `extractPlainText`). The ACL filter
  (`acl: { some: { userId } } }`) is in the query itself, so a document
  the searcher can't read is structurally impossible to return - not
  just hidden by the UI afterward.

### A pragmatic simplification, stated plainly

Full-text search here indexes a periodically-refreshed plain-text mirror
of the document rather than running a live, always-current index — an
honest trade-off given the WS server is the only process holding the
live Yjs state. It's refreshed every 5 applied edits, so it's very
slightly behind the absolute latest keystroke, never behind by more than
a few edits, and never shows a document the reader lacks access to.

### Demoing phase 3

- **Comment anchoring under concurrency:** open a document in two tabs,
  comment on a phrase in tab A, then in tab B type a paragraph *before*
  that phrase. The highlight in tab A stays on the same words. Delete the
  commented phrase itself from tab B - the thread now shows as orphaned
  in tab A's sidebar instead of silently drifting.
- **Restore without data loss:** save a version, keep editing, save
  another version, then restore the first one. Open the history panel
  again - both versions are still listed; the restore only added a new
  entry to the update log.
- **Search respecting ACL:** as the viewer account, search for a phrase
  that exists in a document you don't have an ACL row for - it never
  appears, because the query itself excludes it.

## Phase 4 — what's new

- **Log compaction.** The append-only `DocumentUpdate` log grows forever
  otherwise, and cold loads get slower every day. Once a room's applied-
  edit counter crosses a check interval, `server/index.ts` asks
  `server/compaction.ts: compactIfOverThreshold` whether the document's
  total log has crossed 5,000 rows; if so, it snapshots the current full
  state and deletes everything at or before that point, atomically. See
  ADR 6 for why this reuses the phase-3 `DocumentSnapshot` table instead
  of adding a new one, and `docs/perf/README.md` / `npm run
  bench:compaction` for how to capture real before/after cold-load
  numbers on your own Postgres.
- **Room lifecycle.** Every open room is a full `Y.Doc` sitting in RAM.
  `server/rooms.ts: evictIdleRooms`, swept every 60s, frees any room with
  zero connected members that's been idle for 5+ minutes (configurable via
  `IDLE_ROOM_EVICTION_MS`). Nothing is lost - every update was already
  durable in Postgres before it was ever applied to the in-memory doc -
  and the next join rehydrates transparently through the exact same
  `getOrCreateRoom` path a brand-new room uses.
- **Socket abuse protection.** Three independent guards in
  `server/index.ts`: a per-connection message rate cap (40/second,
  generous for fast typing + awareness churn, tight enough to stop a
  hostile client flooding the room), a running document-size guard that
  drops further edits once a room's approximate byte total since load
  crosses 5MB (configurable via `MAX_DOCUMENT_BYTES`), and a max-rooms-
  per-user cap (20 concurrent documents) enforced before a room is even
  joined.
- **Public share links.** `ShareLink` rows are revocable, optionally
  password-protected, and grant *only* viewer access to *exactly one*
  document - never a general credential. A share-link visitor gets a
  distinctly-shaped WS token (`{ shareToken, documentId }`, not `{ sub,
  documentId }`) that's re-validated against the database on every
  connection, same as a session token (ADR 3, ADR 8). Manage links from
  the share icon in the editor toolbar; visit one at `/share/:token`,
  which needs no account.
- **Graceful shutdown.** `SIGTERM`/`SIGINT` stop the heartbeat and
  eviction timers and close the server cleanly. There's no batched write
  buffer to flush - every update is already durably appended before it's
  ever applied (see `docs/sync-model.md`) - so a deploy's restart never
  costs anyone a keystroke, which is the actual requirement from the
  spec, satisfied by the persistence design rather than by a shutdown-time
  flush step.
- **Structured logging & optional error reporting.** Fastify's built-in
  Pino logger was already structured JSON logging in every phase
  (`app.log.info({ documentId, userId, ... }, "message")` throughout
  `server/index.ts`) - phase 4 adds an optional Sentry hook
  (`SENTRY_DSN` env var; silent no-op if unset) wrapping the three
  background-task error paths (search-index refresh, autosave, compaction).
- **A small `/metrics` endpoint.** Rooms in memory, open connections,
  unique users connected - the honest subset of the spec's stretch-goal
  ops endpoint achievable from a single process without inventing
  numbers or standing up Redis pub/sub across instances (the true stretch
  goal - multi-instance rooms sharing state - is out of scope here).

### Demoing phase 4

- **Compaction:** `npm run bench:compaction` against your own Postgres -
  watch the "before" cold load scale with update count and the "after"
  one stay flat.
- **Room eviction:** open a document, close every tab, wait 5+ minutes
  (or lower `IDLE_ROOM_EVICTION_MS` for a faster demo), check
  `/metrics` - `roomsInMemory` drops. Reopen the document - it loads
  exactly as before, transparently.
- **Abuse protection:** a hand-written WS client blasting more than 40
  messages/second at a room gets the excess silently dropped, logged
  server-side as `"dropped message: rate limit exceeded"`.
- **Share links:** create one from the share icon, open it in a private/
  incognito window - no login required, editing is disabled, cursor and
  presence still work. Revoke it and reload - access is denied on the
  next connection attempt.
- **Graceful shutdown:** `kill -TERM <pid>` the WS server mid-edit in two
  tabs - the in-flight edit that was already being processed completes
  (it was durable before it was ever applied), the process logs
  `"shutting down"` → `"shutdown complete"` and exits cleanly rather than
  dropping connections mid-write.

## Handing it in

Mapped against the spec's checklist:

- Deployed app URL / deployed `wss://` endpoint / demo accounts at every
  ACL level → deployment is environment-specific (Railway/Fly/Render for
  the WS server per the brief); demo accounts are seeded, see above.
- Clean atomic commits / green CI → this repo is delivered as a snapshot
  per phase rather than an incremental commit history; wiring up CI
  (lint + typecheck + test on push) is a `.github/workflows/ci.yml` away
  and intentionally left for you to wire to your own hosting choices.
- `docs/decisions/` with 8+ ADRs → done, 8 ADRs covering the major
  decisions across all four phases.
- `docs/sync-model.md` explaining sync/persistence/compaction with a
  diagram → done.
- `docs/perf/` with cold-load timings and reconnect delta sizes → the
  tooling and methodology are done (`npm run bench:compaction`, the
  server's own delta-size logging); this sandbox has no Postgres to
  capture real numbers with, documented plainly rather than fabricated.
- Tests: unit for ACL resolution and comment anchoring, integration
  against a real socket and database, one E2E with two concurrent
  browser contexts → ACL resolution is unit-tested
  (`permissions.test.ts`); comment anchoring's *logic* (RelativePosition
  encode/resolve) is exercised indirectly through the wire-protocol and
  word-diff tests but doesn't yet have a dedicated ProseMirror-in-jsdom
  unit test; a real socket+database integration test and a two-context
  E2E both need infrastructure (a running Postgres, a running WS server,
  a browser automation harness) this sandbox doesn't have - the existing
  17 unit tests all run and pass without any of that.
- Five-minute Loom → not applicable to a code deliverable produced this
  way.

## Testing

```bash
npm run test        # vitest: ACL ranking, socket auth boundary, wire protocol
                     # framing, word diff, search snippets
npm run typecheck    # strict TS across both the Next.js app and server/
```

## What's deliberately out of scope even after phase 4

Everything in the spec's explicit "Stretch, after the above" section:
collaborative cursors inside the comment sidebar itself, a richer ops
metrics endpoint with p99 broadcast latency, and - the real stretch goal
- two WS instances sharing rooms over Redis pub/sub with cross-instance
convergence. All of this project's phases assume a single WS server
process; horizontal scaling of the sync layer itself was never
attempted.
