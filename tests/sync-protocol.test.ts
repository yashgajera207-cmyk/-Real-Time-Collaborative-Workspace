import { describe, it, expect } from "vitest";
import {
  MSG_SYNC_STEP,
  MSG_UPDATE,
  MSG_AWARENESS,
  encodeMessage,
  decodeMessage,
} from "../server/protocol";

describe("wire protocol framing", () => {
  it("round-trips a payload through encode/decode", () => {
    const payload = new Uint8Array([1, 2, 3, 4, 5]);
    const framed = encodeMessage(MSG_UPDATE, payload);
    const { type, payload: decoded } = decodeMessage(framed);

    expect(type).toBe(MSG_UPDATE);
    expect(Array.from(decoded)).toEqual([1, 2, 3, 4, 5]);
  });

  it("handles an empty payload (e.g. an empty state vector or a no-op diff)", () => {
    const framed = encodeMessage(MSG_SYNC_STEP, new Uint8Array());
    const { type, payload } = decodeMessage(framed);

    expect(type).toBe(MSG_SYNC_STEP);
    expect(payload.byteLength).toBe(0);
  });

  it("distinguishes the three message types by their leading byte", () => {
    expect(decodeMessage(encodeMessage(MSG_SYNC_STEP, new Uint8Array())).type).toBe(0);
    expect(decodeMessage(encodeMessage(MSG_UPDATE, new Uint8Array())).type).toBe(1);
    expect(decodeMessage(encodeMessage(MSG_AWARENESS, new Uint8Array())).type).toBe(2);
  });

  it("reports type -1 for a zero-length message rather than throwing", () => {
    expect(decodeMessage(new Uint8Array()).type).toBe(-1);
  });
});
