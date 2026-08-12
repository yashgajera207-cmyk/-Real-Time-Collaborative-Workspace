"use client";

import { useCallback, useEffect, useState } from "react";

export interface CommentAuthor {
  id: string;
  name: string;
}

export interface CommentEntry {
  id: string;
  body: string;
  createdAt: string;
  author: CommentAuthor;
}

export interface ThreadEntry {
  id: string;
  resolved: boolean;
  quotedText: string;
  anchorStart: string;
  anchorEnd: string;
  createdAt: string;
  createdBy: CommentAuthor;
  comments: CommentEntry[];
}

const commentChannel =
  typeof window !== "undefined" && "BroadcastChannel" in window
    ? new BroadcastChannel("quill:comments")
    : null;

function notifyCommentUpdate(documentId: string) {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("quill:comments-updated", { detail: { documentId } }));
  }
  commentChannel?.postMessage({ documentId });
}

export function useComments(documentId: string) {
  const [threads, setThreads] = useState<ThreadEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const res = await fetch(`/api/documents/${documentId}/comments`, { cache: "no-store" });
    if (res.ok) setThreads(await res.json());
    setLoading(false);
  }, [documentId]);

  useEffect(() => {
    void refresh();

    const interval = setInterval(() => {
      if (typeof document !== "undefined" && document.visibilityState === "visible") {
        void refresh();
      }
    }, 3000);

    const handleUpdate = (e?: Event | MessageEvent) => {
      const targetDocId =
        e && "detail" in e
          ? (e as CustomEvent).detail?.documentId
          : e && "data" in e
          ? (e as MessageEvent).data?.documentId
          : null;
      if (!targetDocId || targetDocId === documentId) {
        void refresh();
      }
    };

    window.addEventListener("focus", handleUpdate);
    document.addEventListener("visibilitychange", handleUpdate);
    window.addEventListener("quill:comments-updated", handleUpdate as EventListener);

    if (commentChannel) {
      commentChannel.onmessage = handleUpdate;
    }

    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", handleUpdate);
      document.removeEventListener("visibilitychange", handleUpdate);
      window.removeEventListener("quill:comments-updated", handleUpdate as EventListener);
      if (commentChannel) {
        commentChannel.onmessage = null;
      }
    };
  }, [documentId, refresh]);

  const createThread = useCallback(
    async (params: {
      anchorStart: string;
      anchorEnd: string;
      quotedText: string;
      body: string;
      mentionedUserIds: string[];
    }) => {
      const res = await fetch(`/api/documents/${documentId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      });
      if (res.ok) {
        const created = (await res.json()) as ThreadEntry;
        setThreads((prev) => [...prev.filter((t) => t.id !== created.id), created]);
        notifyCommentUpdate(documentId);
        await refresh();
        return created;
      }
      return null;
    },
    [documentId, refresh]
  );

  const reply = useCallback(
    async (threadId: string, body: string, mentionedUserIds: string[]) => {
      const res = await fetch(`/api/documents/${documentId}/comments/${threadId}/reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body, mentionedUserIds }),
      });
      if (res.ok) {
        notifyCommentUpdate(documentId);
        await refresh();
      }
      return res.ok;
    },
    [documentId, refresh]
  );

  const setResolved = useCallback(
    async (threadId: string, resolved: boolean) => {
      const res = await fetch(`/api/documents/${documentId}/comments/${threadId}/resolve`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resolved }),
      });
      if (res.ok) {
        notifyCommentUpdate(documentId);
        await refresh();
      }
      return res.ok;
    },
    [documentId, refresh]
  );

  return { threads, loading, refresh, createThread, reply, setResolved };
}
