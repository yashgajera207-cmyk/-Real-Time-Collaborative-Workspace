"use client";

import { motion, AnimatePresence } from "framer-motion";
import { MessageSquare, Check, RotateCcw } from "lucide-react";
import type { ThreadEntry } from "@/lib/use-comments";
import type { WorkspaceMember } from "@/lib/use-workspace-members";
import { MentionComposer } from "./MentionComposer";

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

interface CommentsSidebarProps {
  threads: ThreadEntry[];
  orphanedThreadIds: Set<string>;
  activeThreadId: string | null;
  onSelectThread: (id: string | null) => void;
  onReply: (threadId: string, body: string, mentionedUserIds: string[]) => unknown;
  onSetResolved: (threadId: string, resolved: boolean) => unknown;
  members: WorkspaceMember[];
  canComment: boolean;
}

export function CommentsSidebar({
  threads,
  orphanedThreadIds,
  activeThreadId,
  onSelectThread,
  onReply,
  onSetResolved,
  members,
  canComment,
}: CommentsSidebarProps) {
  if (threads.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 p-8 text-center text-sm text-ink-400">
        <MessageSquare className="h-5 w-5" />
        <p>No comments yet. Select text in the document to start a thread.</p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-3 overflow-y-auto p-3">
      <AnimatePresence initial={false}>
        {threads.map((thread) => {
          const isActive = thread.id === activeThreadId;
          const isOrphaned = orphanedThreadIds.has(thread.id);
          return (
            <motion.div
              key={thread.id}
              layout
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, height: 0 }}
              onClick={() => onSelectThread(thread.id)}
              className={`cursor-pointer rounded-xl border p-3 transition-colors ${
                isActive ? "border-accent-400 bg-accent-50" : "border-ink-100 bg-white hover:border-ink-200"
              } ${thread.resolved ? "opacity-60" : ""}`}
            >
              <p className="mb-2 line-clamp-1 border-l-2 border-ink-200 pl-2 text-xs italic text-ink-400">
                "{thread.quotedText}"
              </p>

              {isOrphaned && (
                <p className="mb-2 text-[11px] font-medium text-live-warn">
                  The commented text was deleted - this thread is orphaned.
                </p>
              )}

              <div className="flex flex-col gap-2">
                {thread.comments.map((c) => (
                  <div key={c.id} className="text-sm">
                    <span className="font-medium text-ink-900">{c.author.name}</span>{" "}
                    <span className="text-xs text-ink-400">{timeAgo(c.createdAt)}</span>
                    <p className="text-ink-700">{c.body}</p>
                  </div>
                ))}
              </div>

              <div className="mt-2 flex items-center justify-between">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    void onSetResolved(thread.id, !thread.resolved);
                  }}
                  className="flex items-center gap-1 text-xs text-ink-500 hover:text-ink-900"
                >
                  {thread.resolved ? (
                    <>
                      <RotateCcw className="h-3.5 w-3.5" /> Reopen
                    </>
                  ) : (
                    <>
                      <Check className="h-3.5 w-3.5" /> Resolve
                    </>
                  )}
                </button>
              </div>

              {isActive && canComment && (
                <div className="mt-3 border-t border-ink-100 pt-3" onClick={(e) => e.stopPropagation()}>
                  <MentionComposer
                    members={members}
                    submitLabel="Reply"
                    placeholder="Reply, or @mention someone"
                    onSubmit={(body, ids) => onReply(thread.id, body, ids)}
                  />
                </div>
              )}
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
