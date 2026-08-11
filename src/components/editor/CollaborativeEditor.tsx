"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Collaboration from "@tiptap/extension-collaboration";
import CollaborationCursor from "@tiptap/extension-collaboration-cursor";
import Placeholder from "@tiptap/extension-placeholder";
import { useEffect, useMemo, useState } from "react";
import * as Y from "yjs";
import { motion } from "framer-motion";
import { QuillWebsocketProvider } from "@/lib/yjs-provider";
import { colorForUser, usePresence } from "@/lib/presence";
import { EditorToolbar } from "./EditorToolbar";
import { ConnectionStatus } from "./ConnectionStatus";
import { PresenceAvatarStack } from "./PresenceAvatarStack";
import type { ConnectionState, DocumentRole } from "@/types";

interface CollaborativeEditorProps {
  documentId: string;
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

export function CollaborativeEditor({ documentId, role, userId, userName }: CollaborativeEditorProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const editable = role === "editor" || role === "owner";
  const [status, setStatus] = useState<ConnectionState>("connecting");
  const [lastDeltaBytes, setLastDeltaBytes] = useState<number | null>(null);

  const ydoc = useMemo(() => {
    if (!mounted) return null;
    return new Y.Doc();
  }, [documentId, mounted]);

  const fragment = useMemo(() => {
    if (!ydoc) return null;
    return ydoc.getXmlFragment("prosemirror");
  }, [ydoc]);

  const color = useMemo(() => colorForUser(userId), [userId]);

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

  const editor = useEditor(
    {
      immediatelyRender: false,
      editable,
      extensions: [
        StarterKit.configure({ history: false }), // Yjs owns undo history
        ...(fragment ? [Collaboration.configure({ fragment })] : []),
        ...(provider
          ? [
              CollaborationCursor.configure({
                provider,
                user: { name: userName, color },
                render: (user) => {
                  const cursor = document.createElement("span");
                  cursor.classList.add("collaboration-cursor__caret");
                  cursor.setAttribute("style", `border-color: ${user.color}`);

                  const label = document.createElement("div");
                  label.classList.add("collaboration-cursor__label");
                  label.setAttribute("style", `background-color: ${user.color}`);
                  label.insertBefore(document.createTextNode(user.name), null);

                  const space = document.createTextNode("\u2060");
                  cursor.insertBefore(space, null);
                  cursor.insertBefore(label, null);
                  return cursor;
                },
              }),
            ]
          : []),
        Placeholder.configure({ placeholder: "Start writing..." }),
      ],
      editorProps: {
        attributes: {
          class:
            "prose prose-ink max-w-none focus:outline-none min-h-[60vh] px-8 py-6 text-[15px] leading-7",
        },
      },
    },
    [fragment, editable, provider]
  );

  if (!mounted || !provider) {
    return <div className="flex h-full flex-col bg-white" />;
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-ink-100 bg-white px-4 py-2">
        <EditorToolbar editor={editor} editable={editable} />
        <div className="flex items-center gap-3">
          <PresenceAvatarStack entries={presence} />
          <motion.div layout>
            <ConnectionStatus state={status} lastDeltaBytes={lastDeltaBytes} />
          </motion.div>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto bg-white">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
