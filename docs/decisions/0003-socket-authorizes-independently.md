# 3. The socket re-resolves the ACL; the token never grants a role by itself

## Status
Accepted (phase 1)

## Context
The most common failure mode in a project like this is a correctly
permissioned web app sitting in front of a socket server that trusts a
`userId` (or worse, a role) handed to it in the connection URL.

## Decision
`/api/documents/:id/token` mints a 60-second JWT scoped to exactly one
`(userId, documentId)` pair. It carries no role. On every connection,
`server/auth.ts: authenticateConnection` independently re-queries
`DocumentAcl` from Postgres to resolve the caller's actual role, and
that query result - never anything in the token - is what the rest of
the connection's lifetime uses for permission checks (see ADR 5).

## Consequence
A viewer cannot forge editor access by hand-crafting a WebSocket
connection, because there's nothing to forge - the role isn't a claim,
it's looked up fresh, server-side, every single time. This is asserted
directly in `tests/ws-auth.test.ts`.

## Extended in phase 4
Share-link tokens (ADR 8) follow the identical pattern: the token proves
"this is share-link X", and the role (always `viewer`) and validity
(not revoked) are re-resolved from `ShareLink` on every connection, not
trusted from the token.
