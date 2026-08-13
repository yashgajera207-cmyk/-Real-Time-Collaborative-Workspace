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

export function useComments(documentId: string) {
  const [threads, setThreads] = useState<ThreadEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`/api/documents/${documentId}/comments`);
      if (res.ok) {
        const data = await res.json();
        setThreads((prev) => {
          if (JSON.stringify(prev) === JSON.stringify(data)) return prev;
          return data;
        });
      }
    } catch {
      // Ignore transient network errors
    } finally {
      setLoading(false);
    }
  }, [documentId]);

  useEffect(() => {
    void refresh();
    // Background polling every 4 seconds (guarded by deep JSON equality check)
    const interval = setInterval(refresh, 4_000);
    const onFocus = () => void refresh();
    window.addEventListener("focus", onFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", onFocus);
    };
  }, [refresh]);

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
      if (res.ok) await refresh();
      return res.ok;
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
      if (res.ok) await refresh();
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
      if (res.ok) await refresh();
      return res.ok;
    },
    [documentId, refresh]
  );

  return { threads, loading, refresh, createThread, reply, setResolved };
}
