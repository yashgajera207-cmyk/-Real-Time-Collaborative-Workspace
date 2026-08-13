"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Collaboration from "@tiptap/extension-collaboration";
import CollaborationCursor from "@tiptap/extension-collaboration-cursor";
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
import { useEffect, useMemo, useState } from "react";
import * as Y from "yjs";
import { QuillWebsocketProvider } from "@/lib/yjs-provider";
import { colorForUser, usePresence } from "@/lib/presence";
import { ConnectionStatus } from "./ConnectionStatus";
import { PresenceAvatarStack } from "./PresenceAvatarStack";
import type { ConnectionState } from "@/types";
import { FileText, Eye } from "lucide-react";

const lowlight = createLowlight(common);

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || "wss://ws-server-production-72c6.up.railway.app";

interface PublicShareEditorProps {
  documentId: string;
  title: string;
  getWsToken: () => Promise<string>;
}

export function PublicShareEditor({ documentId, title, getWsToken }: PublicShareEditorProps) {
  const [status, setStatus] = useState<ConnectionState>("connecting");
  const guestId = useMemo(() => `guest-${Math.random().toString(36).slice(2, 8)}`, []);
  const guestName = useMemo(() => `Guest ${guestId.slice(-4)}`, [guestId]);
  const color = useMemo(() => colorForUser(guestId), [guestId]);

  const ydoc = useMemo(() => new Y.Doc(), [documentId]);
  const fragment = useMemo(() => ydoc.getXmlFragment("prosemirror"), [ydoc]);

  const provider = useMemo(
    () =>
      new QuillWebsocketProvider({
        wsUrl: WS_URL,
        documentId,
        userId: guestId,
        user: { name: guestName, color },
        doc: ydoc,
        getToken: getWsToken,
        onStatusChange: setStatus,
      }),
    [ydoc, documentId, guestId, guestName, color, getWsToken]
  );

  useEffect(() => () => provider.destroy(), [provider]);
  const presence = usePresence(provider.awareness);

  const editor = useEditor(
    {
      immediatelyRender: false,
      editable: false,
      extensions: [
        StarterKit.configure({ history: false, codeBlock: false }),
        Collaboration.configure({ fragment }),
        CollaborationCursor.configure({ provider, user: { name: guestName, color } }),
        Underline,
        Link.configure({ openOnClick: true, autolink: true }),
        Image,
        TaskList,
        TaskItem.configure({ nested: true }),
        CodeBlockLowlight.configure({ lowlight }),
        TextAlign.configure({ types: ["heading", "paragraph"] }),
        Highlight.configure({ multicolor: true }),
        Subscript,
        Superscript,
      ],
      editorProps: {
        attributes: {
          class: "prose prose-ink max-w-none focus:outline-none min-h-[60vh] px-8 py-6 text-[15px] leading-7",
        },
      },
    },
    [fragment, provider]
  );

  return (
    <div className="flex h-screen flex-col bg-ink-50/40">
      <header className="flex items-center justify-between border-b border-ink-200/60 bg-white/95 backdrop-blur-md px-6 py-3 shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-accent-50 text-accent-600 flex items-center justify-center font-bold">
            <FileText className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold text-ink-900 tracking-tight">{title}</h1>
              <span className="flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                <Eye className="h-3 w-3" /> Public View
              </span>
            </div>
            <p className="text-xs text-ink-400">Live read-only shared link</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <PresenceAvatarStack entries={presence} />
          <ConnectionStatus state={status} />
        </div>
      </header>
      <div className="flex-1 overflow-y-auto bg-white max-w-5xl mx-auto w-full border-x border-ink-200/40 shadow-xs my-4 rounded-2xl p-4">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
