"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Collaboration from "@tiptap/extension-collaboration";
import Placeholder from "@tiptap/extension-placeholder";
import { useEffect, useMemo, useState } from "react";
import * as Y from "yjs";
import { motion } from "framer-motion";
import { QuillWebsocketProvider } from "@/lib/yjs-provider";
import { EditorToolbar } from "./EditorToolbar";
import { ConnectionStatus } from "./ConnectionStatus";
import type { ConnectionState, DocumentRole } from "@/types";

interface CollaborativeEditorProps {
  documentId: string;
  role: DocumentRole;
}

const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:1234";

async function fetchToken(documentId: string): Promise<string> {
  const res = await fetch(`/api/documents/${documentId}/token`, { method: "POST" });
  if (!res.ok) throw new Error("failed to obtain sync token");
  const data = (await res.json()) as { token: string };
  return data.token;
}

export function CollaborativeEditor({ documentId, role }: CollaborativeEditorProps) {
  const editable = role === "editor" || role === "owner";
  const [status, setStatus] = useState<ConnectionState>("connecting");

  const ydoc = useMemo(() => new Y.Doc(), [documentId]);
  const fragment = useMemo(() => ydoc.getXmlFragment("prosemirror"), [ydoc]);

  const provider = useMemo(
    () =>
      new QuillWebsocketProvider({
        wsUrl: WS_URL,
        documentId,
        doc: ydoc,
        getToken: () => fetchToken(documentId),
        onStatusChange: setStatus,
      }),
    [ydoc, documentId]
  );

  useEffect(() => () => provider.destroy(), [provider]);

  const editor = useEditor(
    {
      immediatelyRender: false,
      editable,
      extensions: [
        StarterKit.configure({ history: false }), // Yjs owns undo history
        Collaboration.configure({ fragment }),
        Placeholder.configure({ placeholder: "Start writing..." }),
      ],
      editorProps: {
        attributes: {
          class:
            "prose prose-ink max-w-none focus:outline-none min-h-[60vh] px-8 py-6 text-[15px] leading-7",
        },
      },
    },
    [fragment, editable]
  );

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-ink-100 bg-white px-4 py-2">
        <EditorToolbar editor={editor} editable={editable} />
        <motion.div layout>
          <ConnectionStatus state={status} />
        </motion.div>
      </div>
      <div className="flex-1 overflow-y-auto bg-white">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
