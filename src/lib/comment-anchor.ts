"use client";

import type { Editor } from "@tiptap/react";
import * as Y from "yjs";
import { ySyncPluginKey, absolutePositionToRelativePosition, relativePositionToAbsolutePosition } from "y-prosemirror";

// Comments are anchored with Yjs RelativePosition, not character offsets.
// An offset is a snapshot of "where the text was", and it's wrong the
// moment anyone edits anything before it. A RelativePosition instead
// remembers *which piece of content* the anchor sits next to, and Yjs
// keeps it correctly placed as the CRDT structure changes underneath it
// - including when the exact anchored text is deleted, in which case it
// resolves to null and we treat the thread as orphaned rather than
// silently pointing at the wrong words.

function getBinding(editor: Editor) {
  const state = ySyncPluginKey.getState(editor.state) as
    | { doc: Y.Doc; type: Y.XmlFragment; binding?: { mapping: Map<unknown, unknown> } }
    | undefined;
  if (!state) throw new Error("collaboration binding not ready yet");
  return state;
}

export function encodeSelectionAnchor(
  editor: Editor,
  from: number,
  to: number
): { anchorStart: string; anchorEnd: string } {
  const { type, binding } = getBinding(editor) as {
    type: Y.XmlFragment;
    binding: { mapping: Map<unknown, unknown> };
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const relStart = absolutePositionToRelativePosition(from, type, binding.mapping as any);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const relEnd = absolutePositionToRelativePosition(to, type, binding.mapping as any);
  return {
    anchorStart: toBase64(Y.encodeRelativePosition(relStart)),
    anchorEnd: toBase64(Y.encodeRelativePosition(relEnd)),
  };
}

export interface ResolvedAnchor {
  from: number;
  to: number;
}

/**
 * Resolves a stored anchor pair back to live document positions. Returns
 * null if either end can no longer be located - i.e. the commented text
 * was deleted, which is the orphaned-thread case.
 */
export function resolveAnchor(
  editor: Editor,
  anchorStart: string,
  anchorEnd: string
): ResolvedAnchor | null {
  let state: ReturnType<typeof getBinding>;
  try {
    state = getBinding(editor);
  } catch {
    return null;
  }
  const { doc, binding } = state as { doc: Y.Doc; binding: { mapping: Map<unknown, unknown> } };

  const relStart = Y.decodeRelativePosition(fromBase64(anchorStart));
  const relEnd = Y.decodeRelativePosition(fromBase64(anchorEnd));

  const fragment = doc.getXmlFragment("prosemirror");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const absStart = relativePositionToAbsolutePosition(doc, fragment, relStart, binding.mapping as any);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const absEnd = relativePositionToAbsolutePosition(doc, fragment, relEnd, binding.mapping as any);

  if (absStart == null || absEnd == null) return null;
  if (absStart === absEnd) return null; // the entire commented range collapsed
  return { from: Math.min(absStart, absEnd), to: Math.max(absStart, absEnd) };
}

function toBase64(bytes: Uint8Array): string {
  if (typeof window === "undefined") return Buffer.from(bytes).toString("base64");
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return window.btoa(binary);
}

function fromBase64(b64: string): Uint8Array {
  if (typeof window === "undefined") return new Uint8Array(Buffer.from(b64, "base64"));
  const binary = window.atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}
