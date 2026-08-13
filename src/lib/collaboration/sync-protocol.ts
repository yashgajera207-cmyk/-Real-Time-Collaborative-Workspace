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
