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
import { createLowlight, common } from "lowlight";
import { useEffect, useMemo, useState } from "react";
import * as Y from "yjs";
import { motion, AnimatePresence } from "framer-motion";
import { MessageSquare, History } from "lucide-react";
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

const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:1234";

async function fetchToken(documentId: string): Promise<string> {
  const res = await fetch(`/api/documents/${documentId}/token`, { method: "POST" });
  if (!res.ok) throw new Error("failed to obtain sync token");
  const data = (await res.json()) as { token: string };
  return data.token;
}

export function CollaborativeEditor({ documentId, workspaceId, role, userId, userName }: CollaborativeEditorProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const editable = role === "editor" || role === "owner";
  const canComment = editable || role === "commenter";
  const [status, setStatus] = useState<ConnectionState>("connecting");
  const [lastDeltaBytes, setLastDeltaBytes] = useState<number | null>(null);
  const [panel, setPanel] = useState<"none" | "comments" | "history">("none");
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);

  const ydoc = useMemo(() => {
    if (!mounted) return null;
    return new Y.Doc();
  }, [documentId, mounted]);

  const fragment = useMemo(() => {
    if (!ydoc) return null;
    return ydoc.getXmlFragment("prosemirror");
  }, [ydoc]);

  const color = useMemo(() => colorForUser(userId), [userId]);
  const members = useWorkspaceMembers(workspaceId);
  const { threads, createThread, reply, setResolved } = useComments(documentId);

  const provider = useMemo(() => {
    if (!ydoc || !mounted) return null;
    return new QuillWebsocketProvider({
      wsUrl: WS_URL,
      documentId,
      userId,
      user: { name: userName, color },
      doc: ydoc,
      getToken: () => fetchToken(documentId),
      onStatusChange: setStatus,
      onSyncStats: ({ deltaBytes }) => setLastDeltaBytes(deltaBytes),
    });
  }, [ydoc, documentId, userId, userName, color, mounted]);

  useEffect(() => {
    if (!provider) return;
    return () => provider.destroy();
  }, [provider]);

  const presence = usePresence(provider?.awareness);

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
        ...(fragment ? [Collaboration.configure({ fragment })] : []),
        ...(provider ? [CollaborationCursor.configure({ provider, user: { name: userName, color } })] : []),
        Placeholder.configure({ placeholder: "Start writing, or type '/' for commands..." }),
        Underline,
        Link.configure({ openOnClick: false, autolink: true }),
        Image,
        TaskList,
        TaskItem.configure({ nested: true }),
        CodeBlockLowlight.configure({ lowlight }),
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

  useEffect(() => {
    if (editor && !editor.isDestroyed) {
      editor.view.dispatch(editor.view.state.tr);
    }
  }, [editor, threads]);

  if (!mounted || !provider || !fragment) {
    return <div className="flex h-full flex-col bg-white" />;
  }

  const handleCreateThread = async (params: {
    anchorStart: string;
    anchorEnd: string;
    quotedText: string;
    body: string;
    mentionedUserIds: string[];
  }) => {
    const created = await createThread(params);
    if (created) {
      setPanel("comments");
      setActiveThreadId(created.id);
    }
    return created;
  };

  return (
    <div className="flex h-full">
      <div className="flex h-full flex-1 flex-col">
        <div className="flex items-center justify-between border-b border-ink-100 bg-white px-4 py-2">
          <EditorToolbar editor={editor} editable={editable} />
          <div className="flex items-center gap-2">
            <PresenceAvatarStack entries={presence} />
            <motion.div layout>
              <ConnectionStatus state={status} lastDeltaBytes={lastDeltaBytes} />
            </motion.div>
            <button
              onClick={() => setPanel(panel === "comments" ? "none" : "comments")}
              className={`flex h-8 items-center gap-1.5 rounded-md px-2 text-xs font-medium transition-colors
                ${panel === "comments" ? "bg-ink-900 text-white" : "text-ink-600 hover:bg-ink-50"}`}
            >
              <MessageSquare className="h-3.5 w-3.5" />
              {threads.filter((t) => !t.resolved).length || ""}
            </button>
            <button
              onClick={() => setPanel(panel === "history" ? "none" : "history")}
              className={`flex h-8 items-center gap-1.5 rounded-md px-2 text-xs font-medium transition-colors
                ${panel === "history" ? "bg-ink-900 text-white" : "text-ink-600 hover:bg-ink-50"}`}
            >
              <History className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        <div className="relative flex-1 overflow-y-auto bg-white">
          <EditorContent editor={editor} />
          {canComment && (
            <NewCommentBubble editor={editor} members={members} onCreateThread={handleCreateThread} />
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
            className="h-full w-80 shrink-0 border-l border-ink-100 bg-white"
          >
            <CommentsSidebar
              threads={threads}
              orphanedThreadIds={orphanedThreadIds}
              activeThreadId={activeThreadId}
              onSelectThread={setActiveThreadId}
              onReply={reply}
              onSetResolved={setResolved}
              members={members}
              canComment={canComment}
            />
          </motion.div>
        )}
        {panel === "history" && (
          <VersionHistoryPanel
            documentId={documentId}
            liveDoc={ydoc!}
            editor={editor}
            canEdit={editable}
            onClose={() => setPanel("none")}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
