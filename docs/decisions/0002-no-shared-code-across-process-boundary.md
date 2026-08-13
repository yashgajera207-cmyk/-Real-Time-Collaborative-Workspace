# 2. The Next.js app and the WS server share nothing but the database and a secret

## Status
Accepted (phase 1), reaffirmed every phase since

## Context
`server/auth.ts` and `src/lib/permissions.ts` implement overlapping
logic (role ranking, ACL resolution). Same for
`server/persistence.ts` / `src/lib/reconstruct.ts`, and
`server/protocol.ts` / `src/lib/sync-protocol.ts`.

## Decision
Duplicate the small amount of logic that both sides need rather than
extract a shared package. The WS server has its own `tsconfig.json`
(CommonJS, no path aliases, excluded from the app's `tsconfig.json`) and
is never imported from `src/`.

## Trade-off
Genuine duplication - if the role-ranking rule ever changes, it has to
change in two places, and nothing enforces that automatically beyond a
shared test suite. Accepted because a shared internal package would
couple two processes with different deploy targets, different runtime
assumptions (edge/serverless-friendly Next.js code vs. a persistent
Node process), and different failure domains. The alternative -
importing `src/lib/auth.ts` (which pulls in NextAuth, Next.js request
context, etc.) into a long-lived Node process - is worse than the
duplication.

## Mitigation
Both sides are covered by the same `tests/` directory
(`permissions.test.ts` exercises the app side, `ws-auth.test.ts`
exercises the server side against the same rank ordering), so a
divergence shows up as a test failure, not a silent security gap.
