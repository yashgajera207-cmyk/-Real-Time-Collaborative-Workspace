"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Collaboration from "@tiptap/extension-collaboration";
import CollaborationCursor from "@tiptap/extension-collaboration-cursor";
import Placeholder from "@tiptap/extension-placeholder";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import Underline from "@tiptap/extension-underline";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import TextAlign from "@tiptap/extension-text-align";
import Highlight from "@tiptap/extension-highlight";
import Subscript from "@tiptap/extension-subscript";
import Superscript from "@tiptap/extension-superscript";
import { createLowlight, common } from "lowlight";
import { useEffect, useMemo, useRef, useState } from "react";
import * as Y from "yjs";
import { motion, AnimatePresence } from "framer-motion";
import { MessageSquare, History, Link2 } from "lucide-react";
import { QuillWebsocketProvider } from "@/lib/yjs-provider";
import { colorForUser, usePresence } from "@/lib/presence";
import { useComments } from "@/lib/use-comments";
import { useWorkspaceMembers } from "@/lib/use-workspace-members";
import { resolveAnchor } from "@/lib/comment-anchor";
import { EditorToolbar } from "./EditorToolbar";
import { ConnectionStatus } from "./ConnectionStatus";
import { PresenceAvatarStack } from "./PresenceAvatarStack";
import { CommentHighlight, type AnchoredThread } from "./CommentHighlightExtension";
import { CommentsSidebar } from "./CommentsSidebar";
import { NewCommentBubble } from "./NewCommentBubble";
import { VersionHistoryPanel } from "./VersionHistoryPanel";
import { ShareLinkPanel } from "./ShareLinkPanel";
import { SlashCommand } from "./SlashCommand";
import type { ConnectionState, DocumentRole } from "@/types";

const lowlight = createLowlight(common);

interface CollaborativeEditorProps {
  documentId: string;
  workspaceId: string;
  role: DocumentRole;
  userId: string;
  userName: string;
}

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || "";

async function fetchToken(documentId: string): Promise<string> {
  const res = await fetch(`/api/documents/${documentId}/token`, { method: "POST" });
  if (!res.ok) throw new Error("failed to obtain sync token");
  const data = (await res.json()) as { token: string };
  return data.token;
}

export function CollaborativeEditor({ documentId, workspaceId, role, userId, userName }: CollaborativeEditorProps) {
  const roleLower = String(role || "").toLowerCase();
  const isOwner = roleLower === "owner";
  const editable = isOwner || roleLower === "editor";
  const canComment = editable || roleLower === "commenter";
  const [status, setStatus] = useState<ConnectionState>("connecting");
  const [lastDeltaBytes, setLastDeltaBytes] = useState<number | null>(null);
  const [panel, setPanel] = useState<"none" | "comments" | "history" | "share">("none");
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);

  const ydoc = useMemo(() => new Y.Doc(), [documentId]);
  const fragment = useMemo(() => ydoc.getXmlFragment("prosemirror"), [ydoc]);
  const color = useMemo(() => colorForUser(userId), [userId]);
  const members = useWorkspaceMembers(workspaceId);
  const { threads, createThread, reply, setResolved } = useComments(documentId);

  const provider = useMemo(
    () =>
      new QuillWebsocketProvider({
        wsUrl: WS_URL,
        documentId,
        userId,
        user: { name: userName, color },
        doc: ydoc,
        getToken: () => fetchToken(documentId),
        onStatusChange: setStatus,
        onSyncStats: ({ deltaBytes }) => setLastDeltaBytes(deltaBytes),
      }),
    [ydoc, documentId, userId, userName, color]
  );

  useEffect(() => () => provider.destroy(), [provider]);

  const presence = usePresence(provider.awareness);

  const anchoredThreads: AnchoredThread[] = useMemo(
    () => threads.map((t) => ({ id: t.id, anchorStart: t.anchorStart, anchorEnd: t.anchorEnd, resolved: t.resolved })),
    [threads]
  );

  const editor = useEditor(
    {
      immediatelyRender: false,
      editable,
      extensions: [
        StarterKit.configure({ history: false, codeBlock: false }), // Yjs owns undo history; codeBlock replaced below
        Collaboration.configure({ fragment }),
        CollaborationCursor.configure({ provider, user: { name: userName, color } }),
        Placeholder.configure({ placeholder: "Start writing, or type '/' for commands..." }),
        Underline,
        Link.configure({ openOnClick: false, autolink: true }),
        Image,
        TaskList,
        TaskItem.configure({ nested: true }),
        CodeBlockLowlight.configure({ lowlight }),
        TextAlign.configure({ types: ["heading", "paragraph"] }),
        Highlight.configure({ multicolor: true }),
        Subscript,
        Superscript,
        SlashCommand,
        CommentHighlight.configure({
          getThreads: () => anchoredThreads,
          activeThreadId,
          onThreadClick: (threadId) => {
            setActiveThreadId(threadId);
            setPanel("comments");
          },
        }),
      ],
      editorProps: {
        attributes: {
          class:
            "prose prose-ink max-w-none focus:outline-none min-h-[60vh] px-8 py-6 text-[15px] leading-7",
        },
      },
    },
    [fragment, editable, provider, anchoredThreads, activeThreadId]
  );

  const prevThreadsJson = useRef<string>("");

  // Update ProseMirror decorations only when comment threads actually change
  useEffect(() => {
    const currentJson = JSON.stringify(threads);
    if (currentJson === prevThreadsJson.current) return;
    prevThreadsJson.current = currentJson;

    if (editor && !editor.isDestroyed) {
      editor.view.dispatch(editor.view.state.tr);
    }
  }, [editor, threads]);

  // Threads whose anchor no longer resolves to a live range - shown in
  // the sidebar as orphaned instead of highlighted in the document.
  const orphanedThreadIds = useMemo(() => {
    if (!editor) return new Set<string>();
    const orphaned = new Set<string>();
    for (const thread of threads) {
      if (!thread.resolved && resolveAnchor(editor, thread.anchorStart, thread.anchorEnd) === null) {
        orphaned.add(thread.id);
      }
    }
    return orphaned;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor, threads, editor?.state.doc]);

  return (
    <div className="flex h-full">
      <div className="flex h-full flex-1 flex-col">
        <div className="flex flex-wrap items-center justify-between border-b border-ink-200/60 bg-white/95 backdrop-blur-md px-4 py-2 gap-2">
          <EditorToolbar editor={editor} editable={editable} />
          <div className="flex items-center gap-2.5">
            <PresenceAvatarStack entries={presence} />
            <motion.div layout>
              <ConnectionStatus state={status} lastDeltaBytes={lastDeltaBytes} />
            </motion.div>
            <div className="h-5 w-px bg-ink-200/60 mx-0.5" />
            <button
              onClick={() => setPanel(panel === "comments" ? "none" : "comments")}
              title="Toggle Comments"
              className={`flex h-8 items-center gap-1.5 rounded-xl px-2.5 text-xs font-semibold transition-all ${
                panel === "comments"
                  ? "bg-ink-900 text-white shadow-xs"
                  : "text-ink-700 bg-ink-50 hover:bg-ink-100 border border-ink-200/60"
              }`}
            >
              <MessageSquare className="h-3.5 w-3.5" />
              <span>Comments</span>
              {threads.filter((t) => !t.resolved).length > 0 && (
                <span className="rounded-full bg-amber-400 px-1.5 py-0.2 text-[10px] font-bold text-amber-950">
                  {threads.filter((t) => !t.resolved).length}
                </span>
              )}
            </button>
            <button
              onClick={() => setPanel(panel === "history" ? "none" : "history")}
              title="Version History"
              className={`flex h-8 items-center gap-1.5 rounded-xl px-2.5 text-xs font-semibold transition-all ${
                panel === "history"
                  ? "bg-ink-900 text-white shadow-xs"
                  : "text-ink-700 bg-ink-50 hover:bg-ink-100 border border-ink-200/60"
              }`}
            >
              <History className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">History</span>
            </button>
            {editable && (
              <button
                onClick={() => setPanel(panel === "share" ? "none" : "share")}
                title="Public Share Links"
                className={`flex h-8 items-center gap-1.5 rounded-xl px-2.5 text-xs font-semibold transition-all ${
                  panel === "share"
                    ? "bg-ink-900 text-white shadow-xs"
                    : "text-accent-700 bg-accent-50 hover:bg-accent-100 border border-accent-200/80"
                }`}
              >
                <Link2 className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Share</span>
              </button>
            )}
          </div>
        </div>

        <div className="relative flex-1 overflow-y-auto bg-white">
          <EditorContent editor={editor} />
          {canComment && (
            <NewCommentBubble editor={editor} members={members} onCreateThread={createThread} />
          )}
        </div>
      </div>

      <AnimatePresence>
        {panel === "comments" && (
          <motion.div
            initial={{ x: 320, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 320, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="h-full border-l border-ink-200/60 bg-white"
          >
            <CommentsSidebar
              threads={threads}
              activeThreadId={activeThreadId}
              orphanedThreadIds={orphanedThreadIds}
              members={members}
              canComment={canComment}
              onSelectThread={setActiveThreadId}
              onReply={reply}
              onSetResolved={setResolved}
            />
          </motion.div>
        )}
        {panel === "history" && (
          <VersionHistoryPanel
            documentId={documentId}
            liveDoc={ydoc}
            editor={editor}
            canEdit={editable}
            onClose={() => setPanel("none")}
          />
        )}
        {panel === "share" && (
          <ShareLinkPanel documentId={documentId} onClose={() => setPanel("none")} />
        )}
      </AnimatePresence>
    </div>
  );
}
