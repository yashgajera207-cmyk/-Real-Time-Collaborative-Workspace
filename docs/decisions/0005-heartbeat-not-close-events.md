# 5. Presence honesty depends on ping/pong, not onclose

## Status
Accepted (phase 2)

## Context
`onclose` only fires for a polite disconnect - a normal tab close, a
network layer that sends a close frame. A phone going through a tunnel,
a hard-killed process, or a laptop lid slammed shut sends nothing. If
presence only updated on `close`, the avatar stack would lie about who's
still there indefinitely.

## Decision
Every 10 seconds, the WS server pings every open socket
(`server/index.ts`, the `heartbeatTimer` interval). If a socket didn't
answer the *previous* ping, it's assumed dead and `terminate()`d, which
does fire `close` and triggers the normal cleanup path (removing the
member, evicting its awareness clientIDs, broadcasting the removal -
`server/rooms.ts: removeMember`).

## Consequence
A dead connection is detected and evicted within roughly one heartbeat
cycle (comfortably under the 30-second bar from the brief), regardless
of whether it died politely or not. `removeMember` doesn't need to know
which kind of disconnect it's handling - that's the point.
