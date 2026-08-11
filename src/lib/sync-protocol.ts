// Every WebSocket message is a single byte message type followed by a
// binary payload. Three message types, all bidirectional:
//
//   SYNC_STEP  - "here is my state vector, diff yourself against it and
//                 tell me what I'm missing." Sent by the client right
//                 after connecting (using whatever state it already has,
//                 including anything restored from y-indexeddb while
//                 offline), and echoed back by the server so the client
//                 can do the same diff in the other direction. This two-
//                 way exchange is what makes reconnection a delta sync
//                 instead of a full re-download, in both directions.
//   UPDATE     - "apply this Yjs update." Used for the actual diff
//                 produced in response to a SYNC_STEP, and for every
//                 ongoing live edit afterwards. Same payload shape either
//                 way, so one handler covers both.
//   AWARENESS  - "here is a presence update" (cursor, selection, online
//                 status). Never persisted, never gated by edit
//                 permission - anyone with read access can be seen.

export const MSG_SYNC_STEP = 0;
export const MSG_UPDATE = 1;
export const MSG_AWARENESS = 2;

export function encodeMessage(type: number, payload: Uint8Array): Uint8Array {
  const out = new Uint8Array(payload.byteLength + 1);
  out[0] = type;
  out.set(payload, 1);
  return out;
}

export function decodeMessage(raw: Uint8Array): { type: number; payload: Uint8Array } {
  return { type: raw.length > 0 ? raw[0]! : -1, payload: raw.subarray(1) };
}
