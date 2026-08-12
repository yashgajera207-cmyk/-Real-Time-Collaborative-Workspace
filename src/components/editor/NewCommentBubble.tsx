"use client";

import { useEffect, useState } from "react";
import type { Editor } from "@tiptap/react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageSquarePlus } from "lucide-react";
import { encodeSelectionAnchor } from "@/lib/comment-anchor";
import { MentionComposer } from "./MentionComposer";
import type { WorkspaceMember } from "@/lib/use-workspace-members";

interface NewCommentBubbleProps {
  editor: Editor | null;
  members: WorkspaceMember[];
  onCreateThread: (params: {
    anchorStart: string;
    anchorEnd: string;
    quotedText: string;
    body: string;
    mentionedUserIds: string[];
  }) => unknown;
}

export function NewCommentBubble({ editor, members, onCreateThread }: NewCommentBubbleProps) {
  const [open, setOpen] = useState(false);
  const [selection, setSelection] = useState<{ from: number; to: number; text: string } | null>(null);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => {
    if (!editor) return;

    const update = () => {
      if (open) return;
      const { from, to, empty } = editor.state.selection;
      if (empty) {
        setSelection(null);
        setCoords(null);
        return;
      }
      const text = editor.state.doc.textBetween(from, to, " ");
      setSelection({ from, to, text });
      const start = editor.view.coordsAtPos(from);
      setCoords({ top: Math.max(10, start.top - 44), left: Math.max(10, start.left) });
    };

    editor.on("selectionUpdate", update);
    return () => {
      editor.off("selectionUpdate", update);
    };
  }, [editor, open]);

  if (!editor || !selection || !coords) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 4 }}
        style={{ position: "fixed", top: coords.top, left: coords.left, zIndex: 40 }}
      >
        {!open ? (
          <button
            onClick={() => setOpen(true)}
            className="flex items-center gap-1.5 rounded-full bg-ink-900 px-3 py-1.5 text-xs font-medium text-white shadow-lg"
          >
            <MessageSquarePlus className="h-3.5 w-3.5" />
            Comment
          </button>
        ) : (
          <div className="w-72 rounded-xl border border-ink-100 bg-white p-3 shadow-xl">
            <div className="mb-2 flex items-center justify-between">
              <p className="line-clamp-2 border-l-2 border-ink-200 pl-2 text-xs italic text-ink-400">
                "{selection.text}"
              </p>
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  setSelection(null);
                  setCoords(null);
                }}
                className="ml-2 text-xs text-ink-400 hover:text-ink-700"
              >
                Cancel
              </button>
            </div>
            <MentionComposer
              members={members}
              submitLabel="Comment"
              autoFocus
              onSubmit={async (body, mentionedUserIds) => {
                if (!selection) return;
                const anchor = encodeSelectionAnchor(editor, selection.from, selection.to);
                await onCreateThread({ ...anchor, quotedText: selection.text, body, mentionedUserIds });
                setOpen(false);
                setSelection(null);
                setCoords(null);
              }}
            />
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
