# Quill — Phase 1: the sync spine

A real-time collaborative document workspace. This phase delivers: auth,
workspace/document CRUD with per-document ACLs, and a standalone WebSocket
server that relays and persists Yjs CRDT updates so two tabs editing the
same document converge — and survive a server restart.

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

All four already have ACL rows on the seeded document, so you can log in
as each in a separate tab/profile and see the permission boundary hold —
the viewer account can open the document and watch it update live, but
typing does nothing (the toolbar disables and the server silently drops
their edits, see `server/index.ts: handleClientUpdate`).

## Project structure

```
src/
  app/
    (dashboard)/            # auth-gated: sidebar layout + workspace/document pages
    api/                    # workspace/document CRUD, WS token issuance, NextAuth
    login/
  components/
    editor/                 # CollaborativeEditor, EditorToolbar, ConnectionStatus
    workspace/               # sidebar, document grid, create-workspace/document modals
    ui/                      # Button, Input, Avatar, Modal — the shared kit
    auth/                    # LoginForm
  lib/                      # prisma client, auth.ts (Auth.js config),
                             # permissions.ts (ACL resolution), ws-token.ts,
                             # yjs-provider.ts (our own client-side sync provider)
  types/
server/                     # the standalone WS process — separate tsconfig,
  index.ts                  # deliberately does not import from src/
  auth.ts                   # re-verifies token + re-resolves ACL independently
  rooms.ts                  # in-memory Y.Doc + member registry per document
  persistence.ts            # append/replay against DocumentUpdate
prisma/
  schema.prisma
  seed.ts
tests/
  permissions.test.ts       # ACL rank logic
  ws-auth.test.ts           # the socket's auth boundary, mocked Prisma
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

## Testing

```bash
npm run test        # vitest: ACL ranking + the socket auth boundary
npm run typecheck    # strict TS across both the Next.js app and server/
```

## What's deliberately out of scope for phase 1

Presence/cursors, offline editing via `y-indexeddb`, reconnection
backoff+jitter beyond a basic version already in the provider, comments,
version history, and search are phase 2/3 work per the spec. Update
compaction and room eviction are phase 4.
