# 8. A share link is a narrowly-scoped token, not a second auth system

## Status
Accepted (phase 4)

## Context
Public read-only links need to grant document access to someone with no
account and no session, without opening a parallel authorization system
that has to be kept consistent with `DocumentAcl`.

## Decision
A `ShareLink` row (token, optional password hash, revoked flag) grants
exactly one thing: viewer access to exactly one document. The WS token
for a share-link visitor (`signShareWsToken`) carries `{ shareToken,
documentId }`, structurally distinct from a session token's `{ sub,
documentId }` (see ADR 3), so a session token can never be replayed as a
share token or vice versa. `authenticateConnection` re-checks the link
is not revoked on every connection, from the database, not from
anything the token claims.

## Consequence
Revoking a link takes effect on the *next* connection attempt, not
retroactively on sockets already open - same latency characteristic as
an ACL row being deleted while someone's already connected. A
determined operator wanting instant revocation could add a periodic
re-check to the WS server; not implemented here, since a check that only
runs on (re)connect is consistent with how every other permission change
in this system already behaves.

## Guest identity
A share-link visitor gets a synthetic per-connection ID
(`guest:<token-prefix>`) purely for awareness/presence display. It's
never written to `DocumentUpdate.createdById` (share links are always
viewer-only, so a guest can never reach the code path that would
attribute an edit) and never resolved against `DocumentAcl`.
