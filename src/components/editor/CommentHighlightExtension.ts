"use client";

import { Extension } from "@tiptap/core";
import { Plugin, PluginKey, type EditorState } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import * as Y from "yjs";
import { ySyncPluginKey, relativePositionToAbsolutePosition } from "y-prosemirror";

export interface AnchoredThread {
  id: string;
  anchorStart: string; // base64 encoded Y.RelativePosition
  anchorEnd: string;
  resolved: boolean;
}

function fromBase64(b64: string): Uint8Array {
  const binary = window.atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function resolveInState(state: EditorState, thread: AnchoredThread): { from: number; to: number } | null {
  const syncState = ySyncPluginKey.getState(state) as
    | { doc: Y.Doc; binding?: { mapping: Map<unknown, unknown> } }
    | undefined;
  if (!syncState?.binding) return null;

  try {
    const relStart = Y.decodeRelativePosition(fromBase64(thread.anchorStart));
    const relEnd = Y.decodeRelativePosition(fromBase64(thread.anchorEnd));
    const fragment = syncState.doc.getXmlFragment("prosemirror");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const from = relativePositionToAbsolutePosition(syncState.doc, fragment, relStart, syncState.binding.mapping as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const to = relativePositionToAbsolutePosition(syncState.doc, fragment, relEnd, syncState.binding.mapping as any);
    if (from == null || to == null || from === to) return null;
    return { from: Math.min(from, to), to: Math.max(from, to) };
  } catch {
    return null;
  }
}

const commentsPluginKey = new PluginKey("quillComments");

export interface CommentHighlightOptions {
  getThreads: () => AnchoredThread[];
  onThreadClick: (threadId: string) => void;
  activeThreadId: string | null;
}

export const CommentHighlight = Extension.create<CommentHighlightOptions>({
  name: "commentHighlight",

  addOptions() {
    return {
      getThreads: () => [],
      onThreadClick: () => {},
      activeThreadId: null,
    };
  },

  addProseMirrorPlugins() {
    const options = this.options;
    return [
      new Plugin({
        key: commentsPluginKey,
        props: {
          decorations: (state) => {
            const decorations: Decoration[] = [];
            for (const thread of options.getThreads()) {
              const range = resolveInState(state, thread);
              if (!range) continue; // orphaned - shown in the sidebar instead, not in the doc
              const isActive = thread.id === options.activeThreadId;
              const classes = [
                "quill-comment-mark",
                thread.resolved ? "quill-comment-mark--resolved" : "",
                isActive ? "quill-comment-mark--active" : "",
              ]
                .filter(Boolean)
                .join(" ");
              decorations.push(
                Decoration.inline(range.from, range.to, {
                  class: classes,
                  "data-thread-id": thread.id,
                })
              );
            }
            return DecorationSet.create(state.doc, decorations);
          },
          handleClick: (view, pos, event) => {
            const target = event.target as HTMLElement;
            const threadId = target.closest?.("[data-thread-id]")?.getAttribute("data-thread-id");
            if (threadId) {
              options.onThreadClick(threadId);
              return true;
            }
            return false;
          },
        },
      }),
    ];
  },
});
