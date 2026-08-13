# 1. A standalone WebSocket process, not a Next.js route handler

## Status
Accepted (phase 1)

## Context
The editing surface needs one process holding a live, in-memory Yjs
document and open sockets for every connected client, for the entire
lifetime of a room - not just the duration of a single request.

## Decision
Run the sync server as a separate, long-lived Node process (`server/`,
Fastify + `@fastify/websocket` + `ws`), deployed independently from the
Next.js app, communicating with it only through the database and a
shared `WS_TOKEN_SECRET`.

## Trade-off
Two processes to deploy and monitor instead of one, and two `tsconfig`s
to keep in sync by hand (see ADR 2). In exchange: the WS server can hold
state in RAM correctly, restart independently of the web app, and scale
by connection count rather than HTTP request count.

## Alternative considered
A hosted sync service (Liveblocks, managed PartyKit, Firebase) was ruled
out by the assignment itself - "you own the sync server" - which also
happens to be the only option that keeps the whole persistence and
compaction story (ADR 6) under our control.
